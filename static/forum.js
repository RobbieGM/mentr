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
		a.dataset.postId = article.dataset.postId;
		a.innerHTML = article.innerHTML;
		a.innerHTML += '<div class="comments"><div class="comment your-comment"><textarea onfocus="this.classList.add(\'focused\')" placeholder=\'Your comment\'></textarea><button class="flat textarea-floating" onclick="postComment(this)">Post</button></div><div class="loader"></div></div>';
		a.style.top = pos.top - 10 + 'px';
		a.style.left = pos.left - 10 + 'px';
		a.style.width = pos.width + 'px';
		a.style.height = pos.height + 'px';
		a.children[0].children[0].addEventListener('click', closeFullscreenArticle);
		a.children[0].children[1].addEventListener('click', togglePostKebabMenu.bind(a.children[0].children[1]));
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
		article.innerHTML = '<div class="article-metadata"><img src="/static/ic_close_black_24px.svg"/><img src="/static/ic_more_vert_black_24px.svg"/><ul class="dropdown"><li>Delete</li><li>Flag</li><li>Edit</li><li>Share</li></ul>' + caption + '</div><h2>' + title + '</h2><p>' + content + '</p>';
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
		var commentSectionLoader = document.querySelector('#fullscreen-article[data-post-id="' + postId + '"] > div.comments > div.loader');
		if (commentSectionLoader) commentSectionLoader.remove();
		var commentSection = document.querySelector('#fullscreen-article[data-post-id="' + postId + '"] > div.comments');
		var c = document.createElement('div');
		c.className = 'comment';
		c.innerHTML = content;
		commentSection.appendChild(c);
	};
	socket.on.no_comments = function(postId) {
		var commentSectionLoader = document.querySelector('#fullscreen-article[data-post-id="' + postId + '"] > div.comments > div.loader');
		if (commentSectionLoader) commentSectionLoader.remove();
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
	fsa.children[0].children[0].style.opacity = '0';
	setTimeout(() => fsa.remove(), 200);
	enableScroll();
}

function togglePostKebabMenu() {
	this.nextSibling.classList.toggle('visible');
}

function post() {
	toast('Posting...', 'OK');
	$('write').classList.remove('overlay-active');
	socket.emit('post', $('post-title').value, $('post-content').value);
}

function postComment(button) {
	var postId = parseInt(button.parentNode.parentNode.parentNode.dataset.postId);
	var comment = button.previousSibling.value;
	toast('Posting comment...', 'OK');
	socket.emit('post_comment', comment, postId);
}