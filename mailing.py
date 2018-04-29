import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from string import Template
from threading import Thread

def async(func):
	def wrapper(*args):
		Thread(target=func, args=args).start()
	return wrapper

def send_html_file(to, subject, file_path, **format):
	content = Template(open(file_path).read()).substitute(format)
	send_html(to, subject, content)

@async
def send_html(to, subject, content):
	msg = MIMEMultipart('alternative')
	msg['From'] = 'mentr'
	msg['To'] = to
	msg['Subject'] = subject
	msg.attach(MIMEText(content, 'html'))

	server = smtplib.SMTP('smtp.gmail.com:587')
	server.ehlo()
	server.starttls()
	server.login('mentr.chelsea@gmail.com', 'chelseaMentr')
	server.sendmail('mentr.chelsea@gmail.com', to, msg.as_string())
	server.quit()

def send_notification(to, subject, content):
	if '@' not in to:
		to += '@chelsea.k12.mi.us'
	send_html(to, subject, f'<h2>{subject}</h2><p>{content}</p><p>To control which notifications you see, visit your <a href="http://10.0.0.201:8080/notification_settings">notification settings</a>.')