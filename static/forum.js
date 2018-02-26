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
		a.dataset.postId = article.postId;
		a.innerHTML = article.innerHTML;
		a.innerHTML += '<div class="comments"><div class="loader"></div></div>';
		a.style.top = pos.top - 10 + 'px';
		a.style.left = pos.left - 10 + 'px';
		a.style.width = pos.width + 'px';
		a.style.height = pos.height + 'px';
		a.children[0].children[0].addEventListener('click', closeFullscreenArticle);
		document.getElementsByTagName('main')[0].appendChild(a);
		void a.offsetWidth; // trigger re-render
		a.classList.add('fullscreen');
		setTimeout(() => { a.style.overflowY = 'auto' }, 200);
		socket.emit('load_comments', a.dataset.postId);
	});
	if (socket.readyState == socket.OPEN) {
		socket.emit('sync_posts');
	} else {
		socket.addEventListener('open', function() {
			socket.emit('sync_posts');
		});
	}
	socket.on.new_post = function(postId, title, content, author, votes, dateString) {
		caption = author + ' - ' + dateString;
		var article = document.createElement('article');
		article.dataset.postId = postId;
		article.innerHTML = '<div class="article-metadata"><img src="/static/ic_close_black_24px.svg"/>' + caption + '</div><h2>' + title + '</h2><p>' + content + '</p>';
		var articlesLoading = document.querySelector('main > div.loader');
		if (articlesLoading) articlesLoading.remove();
		document.getElementsByTagName('main')[0].appendChild(article);
	};
	socket.on.no_posts = function() {
		var articlesLoading = document.querySelector('main > div.loader');
		if (articlesLoading)
			articlesLoading.outerHTML = '<div style="text-align: center; width: 100%">No posts here</div>';
	};
	socket.on.new_comment = function(postId, content, author, votes, dateString) {
		var commentsSections = document.querySelectorAll('main article[data-post-id="' + postId + '"] > div.comments'); // multiple because it will populate article and fullscreen article's comments
		commentsSections.forEach(function(section) {
			if (section.children.length == 1 && section.children[0].className == 'loader') {
				section.innerHTML = '';
			}
		});
	};
	socket.on.no_comments = function(postId) {
		var commentsSections = document.querySelectorAll('main article[data-post-id="' + postId + '"] > div.comments'); // multiple because it will populate article and fullscreen article's comments
		commentsSections.forEach(function(section) {
			section.innerHTML = 'No comments yet';
		});
	};
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
	toast('Posting...', 'OK');
	$('write').classList.remove('overlay-active');
	socket.emit('post', $('post-title').value, $('post-content').value);
}
