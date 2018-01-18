import cherrypy as cp
from ws4py.server.cherrypyserver import WebSocketPlugin, WebSocketTool
from ws4py.websocket import WebSocket, EchoWebSocket
from os import getcwd
from uuid import uuid4
import sqlite3

from metaclass import InstanceUnifier
from mailing import send_html

users = {}
conn = sqlite3.connect('main.db')

cwd = getcwd()

def login_required(func):
    def proxy_func(*args, **kwargs):
        if 'session_id' in cp.request.cookie and cp.request.cookie['session_id'].value in users:
            return func(*args, **kwargs)
        else:
            raise cp.HTTPRedirect('/?show_login=true')
    return proxy_func

class User(object):

    __metaclass__ = InstanceUnifier
    instances = users
    primary_key = 'session_token'

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
            print 'Warning: use tuples instead of arrays for role parameter in User.broadcast_to for consistency.'
        try:
            for session_token in users:
                if session_token in recipients or recipients == 'all':
                    for socket in users[session_token].sockets:
                        if socket.role == role or role == ('all',) or (len(users[session_token].sockets) == 0 and single_socket_override):
                            is_owned = from_token == session_token
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
            raise TypeError(
                'get_users_where takes exactly 1 name/value pair in kwargs (%s given)' % len(kwargs))
        key = kwargs.keys()[0]
        val = kwargs[key]
        selected_users = [users[st] for st in users if getattr(users[st], key) == val]
        return selected_users

    def logout(self, force=True):
        if force or len(self.sockets) == 0:
            self.destruct()

    def start_logout_timer(self):
        self.logout_timer = Timer(10, self.logout, [False])
        self.logout_timer.daemon = True
        self.logout_timer.start()

    def on_socket_close(self):
        if len(self.sockets) == 0:
            print 'User ' + self.username + ' has 5 seconds to reconnect'
            self.start_logout_timer()


class MainWebSocket(WebSocket):

    __metaclass__ = InstanceUnifier
    instances = []

    def __init__(self, *args, **kwargs):
        WebSocket.__init__(self, *args, **kwargs)
        self.session_token = None

    def emit(self, *args):
        self.send(msg(*args), False)

    def emit_user_all(self, *args):
        for sock in self.user.sockets:
            self.emit(*args)

    @property
    def user(self):
        return users[self.session_token]

    def opened(self):  # IMPORTANT: NEVER SEND MESSAGES WHEN SOCKET HAS JUST OPENED
        if self.session_token:
            print 'Socket opened. User: ' + self.user.username
            self.user.sockets.append(self)

    def closed(self, code, reason=None):
        if self.session_token in users:
            self.user.sockets.remove(self)
            self.user.on_socket_close()
        self.destruct()

    def received_message(self, received):
        try:
            print 'Socket data: ' + received.data
            msg = received.data
            msg_params = msg.split(':')
            cmd = msg_params[0]

            def x():
                pass

            # expose local functions as commands to websocket
            fn_locals = locals()
            fn_locals = { func_name: func for func_name, func in fn_locals.items() if callable(func) }
            msg_params_after_cmd = msg_params[1:]
            if cmd in fn_locals:
                fn_locals[cmd](*msg_params_after_cmd)

        except Exception as e:  # don't ask me why this is necessary; remove the try/except statement and all errors get silenced
            print 'Exception in MainWebSocket.received_message'
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

class Root(object):
    index = index_static('index.html')
    profile = index_static('profile.html', True)
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
                verification_email = form['graduation-year'][3] + form['last-name'][:6] + form['first-name'][0] + '@chelsea.k12.mi.us'
                key = uuid4()
                verification_link = 'http://0.0.0.0/verify?key=' + key
                send_html(verification_email, 'Mentr Verification', cwd + '/verification-email.html', first_name=form['first-name'], verification_link=verification_link)
                return main_page_wrap('<div style="text-align: center"><h1>Success</h1><p>Check your school email (' + verification_email + ') for a verification link.</p></div>')
            else:
                return main_page_wrap('<div style="text-align: center"><h1>Invalid Input</h1><p>Your form inputs didn\'t make sense to us. Please try again.</p></div>')

WebSocketPlugin(cp.engine).subscribe()
cp.tools.websocket = WebSocketTool()

cfg = {
    '/favicon.ico': {
        'tools.staticfile.on': True,
        'tools.staticfile.filename': cwd + '/static/favicon.ico',
    },
    '/static': {
        'tools.staticdir.on': True,
        'tools.staticdir.dir': cwd + '/static',
    },
    'global': {
        'server.socket_host': '0.0.0.0',
        'server.socket_port': 8080,
        'log.screen': True,
        'tools.caching.on': False,
        'tools.gzip.on': True,
        'tools.expires.on': True,
        'tools.expires.secs': 60 * 60 * 24 * 5,
    },
    '/socket': {
        'tools.websocket.on': True,
        'tools.websocket.handler_cls': MainWebSocket,
        'tools.caching.on': False,
        'tools.gzip.on': False,
        'tools.expires.on': False,
    },
}

if __name__ == '__main__':
    cp.quickstart(Root(), '/', config=cfg)
