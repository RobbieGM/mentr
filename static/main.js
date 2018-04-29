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

function cancelBodyScroll(e) {
	e.stopPropagation();
	if (e.target == document.body) {
		e.preventDefault();
		scrollTo(0, lastBodyScroll);
	}
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
	//scrollTo(0, lastBodyScroll); // makes stuff laggy
}
function showDialog(title, content, buttons, callback=function(){}) {
	$('modal-overlay').classList.add('active');
	$('modal-dialog').classList.add('active');
	$('md-title').innerHTML = title;
	$('md-content').innerHTML = content;
	$('md-buttons').innerHTML = buttons.map(buttonText => '<button>' + buttonText + '</button>');
	$('md-buttons').onclick = function(e) {
		hideDialog();
		if (e.target.tagName == 'BUTTON')
			callback(e.target.innerHTML);
	};
}

function hideDialog() {
	$('modal-overlay').classList.remove('active');
	$('modal-dialog').classList.remove('active');
}

var socket = new WebSocket('ws://' + location.host + '/socket');
socket.on = {};
socket.onmessage = function(received) {
	var args = JSON.parse(received.data);
	console.log(args);
	var cmd = args.shift();
	if (socket.on[cmd]) {
		socket.on[cmd].apply(null, args);
	}
};
socket.sendObject = function(obj) {
	socket.send(JSON.stringify(obj));
};
socket.emit = function(...args) {
	if (socket.readyState == socket.OPEN) {
		socket.send(JSON.stringify(args));
	} else socket.queue.push(JSON.stringify(args));
};
socket.queue = [];
socket.onopen = function() {
	for (let msg of socket.queue) {
		socket.send(msg);
	}
};
socket.on['toast'] = function(...args) {
	toast.apply(null, args);
};
socket.on['reload'] = () => location.reload();

function addActiveClass(evt) {
	evt.target.classList.add('held-down');
}
function removeActiveClass(evt) {
	evt.target.classList.remove('held-down');
}

addEventListener('load', function() {
	$('username').innerHTML = getCookie('username') || 'Logged Out';
	$('top-back-button').onclick = function() {
		setTimeout(() => history.back(), 100);
	};
	document.body.classList.remove('preload'); // reenable transitions (disabling them initially fixes a Chrome bug but we need those transitions back now)
	document.querySelectorAll('nav a').forEach(function(link) {
		link.addEventListener('click', function(e) {
			e.preventDefault();
			$('navbar').classList.remove('active');
			setTimeout(() => location.assign(link.href), 200);
		});

		url = str => str.replace(/\/+$/, '');

		if (url(link.getAttribute('href')) == url(location.pathname)) {
			link.classList.add('target');
		}
	});
	// fast :active fake psuedo classes for mobile
	document.body.addEventListener('touchstart', addActiveClass);
	document.body.addEventListener('touchend', removeActiveClass);
	document.body.addEventListener('touchcancel', removeActiveClass);
});