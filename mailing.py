import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from string import Template

def send_html(to, subject, file_path, **format):
	content = Template(open(file_path).read()).substitute(format)

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