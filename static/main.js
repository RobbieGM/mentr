function getCookie(name) {
  match = document.cookie.match(new RegExp(name + '=([^;]+)'));
  if (match) return match[1];
}
function $(id) {
	return document.getElementById(id);
}
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