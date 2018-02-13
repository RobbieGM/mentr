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

cancelBodyScroll = function(e) {
	//e.preventDefault();
	//e.stopPropagation();
	scrollTo(0, lastBodyScroll);
};
var lastBodyScroll;

function disableScroll() {
	var body = document.body;
	body.style.overflowY = 'hidden';
	body.onscroll = body.onmousewheel = body.ontouchmove = cancelBodyScroll;
	document.body.addEventListener('DOMMouseScroll', cancelBodyScroll);
	lastBodyScroll = pageYOffset || document.documentElement.scrollTop;
}
function enableScroll() {
	var body = document.body;
	body.style.overflowY = 'auto';
	body.onscroll = body.onmousewheel = body.ontouchmove = null;
	document.body.removeEventListener('DOMMouseScroll', cancelBodyScroll);
	scrollTo(0, lastBodyScroll);
}

var socket = new WebSocket('ws://' + location.host + '/socket');
socket.onmessage = function(received) {
	console.log(received.data);
	var args = JSON.parse(received.data);
	console.log(args);
	var cmd = args.shift();
	if (socket['on' + cmd]) {
		socket['on' + cmd].apply(null, args);
	}
};
socket.sendObject = function(obj) {
	socket.send(JSON.stringify(obj));
};
socket.emit = function(...args) {
	socket.send(JSON.stringify(args));
};
socket.ontoast = function() {
	toast.apply(null, arguments);
};

addEventListener('load', function() {
	$('username').innerHTML = getCookie('username') || 'Logged Out';
	document.querySelectorAll('nav a').forEach(function(link) {
		link.addEventListener('click', function(e) {
			e.preventDefault();
			$('navbar').classList.remove('active');
			setTimeout(() => location.assign(link.href), 300);
		});

		url = str => str.replace(/\/+$/, '');

		if (url(link.getAttribute('href')) == url(location.pathname)) {
			link.classList.add('target');
		}
	});
});