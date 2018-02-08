addEventListener('load', function() {
	document.body.addEventListener('click', function(e) {
		var article = e.target;
		while (article.matches && !article.matches('main article')) {
			article = article.parentNode;
		}
		if (!article.matches || !article.matches('main article:not(.fullscreen)')) return;
		var pos = article.getBoundingClientRect();
		// article.style.top = pos.top - 10 + 'px';
		// article.style.left = pos.left - 10 + 'px';
		// article.style.width = pos.width + 'px';
		// article.style.height = pos.height + 'px';
		// setTimeout(() => article.classList.add('fullscreen'), 5);
		disableScroll();
		$('write').classList.add('hidden');
		var a = document.createElement('article');
		a.id = 'fullscreen-article';
		a.innerHTML = article.innerHTML;
		a.style.top = pos.top - 10 + 'px';
		a.style.left = pos.left - 10 + 'px';
		a.style.width = pos.width + 'px';
		a.style.height = pos.height + 'px';
		a.style.visibility = 'hidden';
		a.children[0].children[0].addEventListener('click', closeFullscreenArticle);
		setTimeout(() => { a.classList.add('fullscreen'); a.style.visibility = 'visible' }, 40);
		document.getElementsByTagName('main')[0].appendChild(a);
		setTimeout(() => { a.style.overflowY = 'auto' }, 200);
	}); 
});
function closeFullscreenArticle() {
	$('write').classList.remove('hidden');
	var fsa = $('fullscreen-article');
	var imp = ' !important';
	['top', 'left', 'width', 'height'].forEach(function(prop) {
		fsa.style.setProperty(prop, fsa.style.getPropertyValue(prop), 'important');
	});
	fsa.style.margin = '10px';
	fsa.style.overflowY = 'hidden';
  fsa.style.background = 'var(--bkg-secondary)';
	setTimeout(() => fsa.remove(), 200);
	enableScroll();
}
function post() {
	toast('Posting...');
}
