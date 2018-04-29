#!/usr/bin/env python3

# TODO:
# Test friend posting notifications (mostly done)
# Infinite scroll, rather than showing EVERY POST AT ONCE
# Post sorting by newest first (oldest first is default)
# Instant messaging

import cherrypy as cp
from ws4py.server.cherrypyserver import WebSocketPlugin, WebSocketTool
from ws4py.websocket import WebSocket, EchoWebSocket
from os import getcwd
from uuid import uuid4
import sqlite3
from threading import Timer
from cgi import escape
from json import dumps, loads
from traceback import print_exc
from datetime import datetime
import re

from metaclass import InstanceUnifier
from mailing import send_html, send_html_file, send_notification
import collections

users = {}
conn = sqlite3.connect('main.db', check_same_thread=False)
cur = conn.cursor()

accounts = []

cwd = getcwd()

def login_required(func):
	def proxy_func(*args, **kwargs):
		if 'session_id' in cp.request.cookie and cp.request.cookie['session_id'].value in users:
			print('7 (logged in)')
			return func(*args, **kwargs)
		else:
			print('8 (logged out)')
			raise cp.HTTPRedirect('/?show_login=true')
	return proxy_func

def csv_to_list(csv):
	csv = re.sub(r'(^\,+|\,+$)', '', csv)
	return csv.split(',')

def list_to_csv(lst):
	csv = ','.join(lst)
	return re.sub(r'(^\,+|\,+$)', '', csv)

EMAIL_TEMPLATES = {
	'friend_post': ('{name} posted', '<h3>{post_title}</h3>{post_content}'),
	'comment': ('{name} commented on your post', '{comment_content}'),
	'mention': ('{name} mentioned you', '{citation}'),
	'notification': ('{title}', '{content}') # general form
}

def dispatch_event(event_type, recipients, event_origin, **kwargs):
	if recipients == 'all':
		cur.execute('select email, friends_csv, notification_subscriptions_csv from accounts')
	else:
		recipients_sql_list = str(recipients).replace('[', '(').replace(']', ')')
		cur.execute(f'select email, friends_csv, notification_subscriptions_csv from accounts where username in {recipients_sql_list}')
	for (email, friends_csv, notification_subscriptions_csv) in cur:
		friends = csv_to_list(friends_csv)
		notif_subs = csv_to_list(notification_subscriptions_csv)
		notif_subs = {notif_type: is_on for (notif_type, is_on) in [subscription.split(':') for subscription in notif_subs]}
		friendship_required = 'friend' in event_type
		if ((event_type in notif_subs and notif_subs[event_type] == 'true') or event_type == 'notification') and (event_origin in friends or not friendship_required):
			title, content = EMAIL_TEMPLATES[event_type]
			send_notification(email, title.format(**kwargs), content.format(**kwargs))
			print(f'Sent notification to {email} from event {event_type} with origin {event_origin}')

def log(text):
	with open('info.log', 'a') as logfile:
		now = datetime.now().strftime("%Y-%m-%d %H:%M")
		logfile.write(f'[{now}] - {str(text)}\n')


class User(object, metaclass=InstanceUnifier): # more like "Session", multiple users can be the same account

	instances = users
	primary_key = 'session_id'

	def __init__(self, username, ip_addr=None):
		self.username = username
		self.sockets = []
		self.ip_addr = ip_addr

	@staticmethod
	def broadcast_to(message, recipients, role='all', single_socket_override=False, from_token='FROM_SERVER', signify_owned=False):
		if type(message) != str:
			message = msg(*message)

		if type(role) == str:
			role = (role,)
		if type(role) == list:
			role = tuple(role)
			print('Warning: use tuples instead of arrays for role parameter in User.broadcast_to for consistency.')
		try:
			for session_id in users:
				if session_id in recipients or recipients == 'all':
					for socket in users[session_id].sockets:
						if socket.role == role or role == ('all',) or (len(users[session_id].sockets) == 0 and single_socket_override):
							is_owned = from_token == session_id
							extra = None
							if signify_owned:
								extra = ':owned' if is_owned else ':foreign'
							else:
								extra = ''
							socket.send(message + extra, False)
		except Exception as e:
			print_exc()

	@staticmethod
	def get_users_where(**kwargs):
		if len(kwargs) != 1:
			raise TypeError('get_users_where takes exactly 1 name/value pair in kwargs (%s given)' % len(kwargs))
		key = list(kwargs.keys())[0]
		val = kwargs[key]
		for session in users:
			if getattr(users[session], key) == val:
				yield users[session]

	def logout(self, force=True):
		if force or len(self.sockets) == 0:
			print(f'{self.username} logged out')
			self.destruct()

	def start_logout_timer(self):
		if hasattr(self, 'logout_timer'):
			self.logout_timer.cancel()
		self.logout_timer = Timer(10, self.logout, [False])
		self.logout_timer.daemon = True
		self.logout_timer.start()

	def on_socket_close(self):
		print('Socket closed')
		if len(self.sockets) == 0:
			print('User ' + self.username + ' has 5 seconds to reconnect')
			self.start_logout_timer()


class MainWebSocket(WebSocket, metaclass=InstanceUnifier):

	instances = []

	def __init__(self, *args, **kwargs):
		WebSocket.__init__(self, *args, **kwargs)
		self.session_id = None

	def emit(self, *args):
		msg = dumps(args)
		if len(msg) < 500:
			print('>\t' + msg)
		else:
			print('>\t[long message hidden]')
		self.send(msg, False)

	@staticmethod
	def to_msg(self, *args):
		return dumps(args)

	def emit_user_all(self, *args):
		for sock in self.user.sockets:
			self.emit(*args)

	@property
	def user(self):
		return users[self.session_id]

	def opened(self):  # IMPORTANT: NEVER SEND MESSAGES WHEN SOCKET HAS JUST OPENED
		if self.session_id:
			print('Socket opened. User: ' + self.user.username)
			self.user.sockets.append(self)

	def closed(self, code, reason=None):
		if self.session_id in users:
			self.user.sockets.remove(self)
			self.user.on_socket_close()
		self.destruct()

	def received_message(self, received):
		try:
			msg = received.data.decode('ascii')
			print('<\t' + msg)
			msg_params = loads(msg)
			cmd = msg_params[0]

			def echo(*args):
				self.emit(*args)

			def post(post_type, title, content):
				if post_type not in ['text', 'image', 'link']:
					return
				if title.isspace() or content.isspace():
					self.emit('toast', 'Missing title or content')
					return
				chars = 8
				MB = 1000000
				if (post_type == 'text' and len(content) > 4000) or (post_type == 'image' and len(content) * chars > 21*MB):
					self.emit('toast', 'Your post is too large')
					return
				legal_image = re.compile(r'^[\w+:,/;=]+$')
				if post_type == 'image' and not legal_image.match(content):
					self.emit('toast', 'Corrupted image')
					return
				title = escape(title)
				if post_type == 'text':
					content = escape(content)
				datestring = datetime.now().strftime("%b %d, %Y")
				self.emit('post_success')
				cur.execute('insert into posts values (NULL, ?, ?, ?, ?, ?, ?, ?)', (post_type, title, content, self.user.username, 0, datestring, 0))
				conn.commit()
				dispatch_event('friend_post', 'all', self.user.username, name=self.user.username, post_title=title, post_content=content)

			def sync_posts():
				cur.execute('select * from posts')
				no_posts = True
				for post_id, post_type, title, content, author, votes, datestring, is_flagged in cur:
					self.emit('new_post', post_id, post_type, title, content, username_linkify(author), votes, datestring)
					no_posts = False
				if no_posts:
					self.emit('no_posts')

			def load_comments(post_id):
				cur.execute('select comment_id, content, author, votes, datestring from comments where post_id = ?', (post_id,))
				no_comments = True
				for comment_id, content, author, votes, datestring in cur:
					self.emit('new_comment', post_id, comment_id, content, username_linkify(author), votes, datestring)
					no_comments = False
				if no_comments:
					self.emit('no_comments', post_id)

			def post_comment(comment, post_id):
				comment = escape(comment)
				if comment.isspace() or not comment:
					self.emit('toast', 'Cannot post empty comment')
					return
				datestring = datetime.now().strftime("%b %d, %Y")
				cur.execute('insert into comments values (NULL, ?, ?, ?, ?, ?)', (post_id, comment, self.user.username, 0, datestring))
				conn.commit()
				
				cur.execute('select last_insert_rowid()')
				for comment_id in cur:
					self.emit('toast', 'Posted')
					self.emit('new_comment', post_id, comment_id, comment, username_linkify(self.user.username), 0, datestring)
					break
				
				cur.execute('select author from posts where id = ?', (post_id,))
				for (author,) in cur:
					dispatch_event('comment', [author], self.user.username, name=self.user.username, comment_content=comment)


			def delete_post(post_id):
				cur.execute('select id from posts where id = ? and author = ?', (post_id, self.user.username))
				owned = False
				for post_id in cur:
					owned = True
				if owned:
					cur.execute('delete from posts where id = ?', post_id)
					conn.commit()
				else:
					self.emit('toast', 'You can\'t delete that post')

			def flag(post_id):
				cur.execute('update posts set flagged = 1 where id = ?', (post_id,))
				conn.commit()

			def delete_comment(comment_id):
				cur.execute('select comment_id from comments where comment_id = ? and author = ?', (int(comment_id), self.user.username))
				for post_id in cur:
					cur.execute('delete from comments where comment_id = ?', (comment_id,))
					conn.commit()
					self.emit('delete_comment', comment_id)
					return
				self.emit('toast', 'You can\'t delete that comment')

			def set_profile_description(description):
				description = escape(description)
				cur.execute('update accounts set profile_description = ? where username = ?', (description, self.user.username))
				conn.commit()
				self.emit('reload')

			def add_friend(friend_name):
				cur.execute('select friends_csv from accounts where username = ?', (self.user.username,))
				for (friends_csv,) in cur:
					friends = csv_to_list(friends_csv)
					if friend_name in friends:
						self.emit('toast', 'This person is already your friend.')
						return
					friends.append(friend_name)
					friends_csv = list_to_csv(friends)
					cur.execute('update accounts set friends_csv = ? where username = ?', (friends_csv, self.user.username))
					conn.commit()
					return

			def load_settings():
				cur.execute('select notification_subscriptions_csv from accounts where username = ?', (self.user.username,))
				for (notification_subscriptions_csv,) in cur:
					notif_subs = csv_to_list(notification_subscriptions_csv)
					notif_subs = {notif_type: is_on == 'true' for (notif_type, is_on) in [subscription.split(':') for subscription in notif_subs]}
					self.emit('load_settings', notif_subs)
					return

			def change_settings(key, value):
				cur.execute('select notification_subscriptions_csv from accounts where username = ?', (self.user.username,))
				for (notification_subscriptions_csv,) in cur:
					notif_subs = csv_to_list(notification_subscriptions_csv)
					notif_subs = {notif_type: is_on == 'true' for (notif_type, is_on) in [subscription.split(':') for subscription in notif_subs]}
					notif_subs[key] = value
					notif_subs = list_to_csv([f'{k}:{str(v).lower()}' for k, v in zip(notif_subs.keys(), notif_subs.values())])
					print(2, notif_subs)
					cur.execute('update accounts set notification_subscriptions_csv = ? where username = ?', (notif_subs, self.user.username))
					conn.commit()
					return

			def load_conversations():
				conversations = {} # { person: last_message }
				cur.execute('select sender, receiver, content, (select first_name from accounts where username = messages.sender) as sender_first_name, (select first_name from accounts where username = messages.receiver) as receiver_first_name from messages where sender = ? or receiver = ? order by date desc', (self.user.username, self.user.username))
				for (sender, receiver, content, sender_first_name, receiver_first_name) in cur:
					if sender == self.user.username:
						other_person = receiver
						other_person_first_name = receiver_first_name
					else:
						other_person = sender
						other_person_first_name = sender_first_name
					if other_person not in conversations:
						conversations[other_person] = (content, other_person_first_name[0])
				no_conversations = True
				for other_person in conversations:
					last_message, other_person_first_name_letter = conversations[other_person]
					self.emit('conversation_loaded', other_person, last_message, other_person_first_name_letter)
					no_conversations = False
				if no_conversations:
					self.emit('no_conversations')

			def log_write(text):
				log(text)

			# expose local functions as commands to websocket
			fn_locals = { func_name: func for func_name, func in list(locals().items()) if isinstance(func, collections.Callable) }
			msg_params_after_cmd = msg_params[1:]
			if cmd in fn_locals:
				fn_locals[cmd](*msg_params_after_cmd)

		except Exception as e:  # don't ask me why this is necessary; remove the try/except statement and all errors get silenced
			print('Exception in MainWebSocket.received_message')
			print_exc()

def index_static(f, require_login=False):
	if require_login:
		@cp.expose
		@login_required
		def wrapper(self, **params):
			return cp.lib.static.serve_file(cwd + '/static/' + f)
	else:
		@cp.expose
		def wrapper(self, **params):
			return cp.lib.static.serve_file(cwd + '/static/' + f)
	return wrapper

username_linkify = lambda username: f'<a href="/profile/{username}">{username}</a>'

TEMPLATE = open(cwd + '/static/template.html').read()
def main_page_wrap(html):
	return TEMPLATE % html

class Root(object):
	index = index_static('index.html')
	messages = index_static('messages.html', True)
	forum = index_static('forum.html', True)
	settings = index_static('settings.html', True)
	about = index_static('about.html')
	help = index_static('help.html')

	@cp.expose
	def register(self, **form):
		if cp.request.method == 'GET':
			return cp.lib.static.serve_file(cwd + '/static/register.html')
		elif cp.request.method == 'POST':
			success = not (form['first-name'].isspace() or form['last-name'].isspace()) and len(form['graduation-year']) == 4 and form['graduation-year'][3].isdigit()
			if success:
				username = form['graduation-year'][3] + form['last-name'][:6] + form['first-name'][0]
				username = username.lower()
				email = username + '@chelsea.k12.mi.us'

				key = str(uuid4())
				verification_link = 'http://0.0.0.0/verify?key=' + key

				cur.execute('insert into accounts values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', (username, email, form['first-name'], form['last-name'], None, key, 0, 'This user doesn\'t have a profile description yet.', 'moderator', 'friend_post,mention,comment'))
				conn.commit()

				send_html_file(email, 'Mentr Verification', cwd + '/verification-email.html', first_name=form['first-name'], verification_link=verification_link)
				return main_page_wrap('<h1>Success</h1><p>Check your school email (' + email + ') for a verification link.</p>')
			else:
				return main_page_wrap('<h1>Invalid Input</h1><p>Your form inputs didn\'t make sense to us. Please try again.</p>')

	@cp.expose
	def login(self, **form):
		if cp.request.method == 'GET':
			return cp.lib.static.serve_file(cwd + '/static/login.html')
		elif cp.request.method == 'POST':
			username = form['username']
			password = form['password']

			selection = cur.execute('select * from accounts where is_verified = 1 and (email = ? or username = ?)', (username, username)).fetchall()
			if len(selection) == 0 or password != selection[0][4] or selection[0][6] == 0:
				raise cp.HTTPRedirect('/login?incorrect=true')
			else:
				u = User(selection[0][0])
				cp.response.cookie['session_id'] = u.session_id
				cp.response.cookie['username'] = u.username
				print('1', u.session_id)
				print('2', u.username)
				raise cp.HTTPRedirect('/forum')

	@cp.expose
	@login_required
	def profile(self, *args, **query_params):
		client_username = users[cp.request.cookie['session_id'].value].username
		try:
			username = args[0]
		except IndexError:
			username = client_username
		
		editable = username == client_username
		EDIT_BUTTON = '<button onclick="edit()">Edit Profile</button>' if editable else ''
		ADD_FRIEND_BUTTON = '<button onclick="addFriend()">Add Friend</a>' if not editable else ''

		cur.execute('select profile_description from accounts where username = ?', (username,))
		for (profile_description,) in cur: # should only run once
			return open(cwd + '/static/profile.html').read().format(username=username, profile_description=profile_description, edit_button_if_needed=EDIT_BUTTON, add_friend_button_if_needed=ADD_FRIEND_BUTTON)

		return cp.lib.static.serve_file(cwd + '/static/nonexistent_profile.html')

	@cp.expose
	def verify(self, **query_params):
		if cp.request.method == 'GET':
			return cp.lib.static.serve_file(cwd + '/static/account-setup.html')
		elif cp.request.method == 'POST':
			key = query_params['key']
			password = query_params['password']
			cur.execute('update accounts set is_verified = 1, password = ? where verification_key = ? where is_verified = 0', (password, key)) # This will silently fail to set a new password if already verified
			conn.commit()
			raise cp.HTTPRedirect('/login')
			# cur.execute('select username from accounts where rowid = last_insert_rowid()')
			# for (username,) in cur:
			#     Account(username)
			#     raise cp.HTTPRedirect('/login')

	@cp.expose
	@login_required
	def socket(self):
		handler = cp.request.ws_handler
		handler.session_id = cp.request.cookie['session_id'].value

	def _cp_dispatch(self, vpath):
		if vpath[0] == 'profile':
			cp.request.params['username'] = vpath.pop()
		return vpath

def error_404(status, message, traceback, version):
	return cp.lib.static.serve_file(cwd + '/static/error_404.html')

WebSocketPlugin(cp.engine).subscribe()
cp.tools.websocket = WebSocketTool()

cfg = {
	'/favicon.ico': {
		'tools.staticfile.on': True,
		'tools.staticfile.filename': cwd + '/static/favicon.ico',
	},
	'/apple-touch-icon.png': {
		'tools.staticfile.on': True,
		'tools.staticfile.filename': cwd + '/static/apple-touch-icon.png'
	},
	'/manifest.json': {
		'tools.staticfile.on': True,
		'tools.staticfile.filename': cwd + '/static/manifest.json',
	},
	'/static': {
		'tools.staticdir.on': True,
		'tools.staticdir.dir': cwd + '/static',
		'tools.expires.on': True,
		'tools.expires.secs': 0, # NOTE TO SELF: DO NOT USE EXPIRES. ONLY USE CACHING.
		'tools.gzip.on': True,
		'tools.caching.on': True,
	},
	'global': {
		'server.socket_host': '0.0.0.0',
		'server.socket_port': 8080,
		'log.screen': True,
		'tools.caching.on': True,
		'tools.gzip.on': True,
	},
	'/socket': {
		'tools.websocket.on': True,
		'tools.websocket.handler_cls': MainWebSocket,
		'tools.caching.on': False,
		'tools.gzip.on': False,
		'tools.expires.on': False,
	},
	'/': {
		'error_page.404': error_404,
	}
}

if __name__ == '__main__':
	cp.quickstart(Root(), '/', config=cfg)
