function getCookie(name) {
  match = document.cookie.match(new RegExp(name + '=([^;]+)'));
  if (match) return match[1];
}
function $(id) {
	return document.getElementById(id);
}
function toast(msg, buttonText='OK') {
	var toast = $('toast');
	toast.classList.add('active');
	$('toast-message').innerHTML = msg;
	$('toast-button').innerHTML = buttonText;
	if (toast.timeout) {
		clearTimeout(toast.timeout);
	}
	toast.timeout = setTimeout(() => toast.classList.remove('active'), 3000);
}

var socket = new WebSocket('ws://' + location.host + '/socket');
socket.onmessage = function(received) {
	var args = received.data.split(':');
	var cmd = args.shift();
	if (socket['on' + cmd]) {
		socket['on' + cmd](args);
	}
};

addEventListener('load', function() {
	$('username').innerHTML = getCookie('username') || 'Logged Out';
	document.querySelectorAll('nav a').forEach(function(link) {
		link.addEventListener('click', function(e) {
			e.preventDefault();
			$('navbar').classList.remove('active');
			setTimeout(() => location.assign(link.href), 300);
		});
	});
});