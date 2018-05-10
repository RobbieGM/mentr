addEventListener('load', function() {
	backButtonActionFrom['fullscreen-article'] = function() {
		closeFullscreenArticle(null, true);
	};
	backButtonActionFrom['new-post'] = function() {
		cancelWritingPost(null, true);
	};
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
		
		$('write').classList.add('hidden');
		var a = document.createElement('article');
		a.id = 'fullscreen-article';
		a.dataset.postId = article.dataset.postId;
		a.dataset.postType = article.dataset.postType;
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
		setTimeout(() => {
			requestAnimationFrame(() => {
				a.style.overflowY = 'auto';
				disableScroll();
				socket.emit('load_comments', a.dataset.postId);
				pushState('fullscreen-article');
			});
		}, 220);
	});
	if (socket.readyState == socket.OPEN) {
		loadPosts();
	} else {
		socket.addEventListener('open', function() {
			loadPosts();
		});
	}
	socket.on.new_post = function(postId, postType, title, content, author, votes, dateString) {
		caption = author + ' - ' + dateString;
		var article = document.createElement('article');
		article.dataset.postId = postId;
		article.dataset.postType = postType;
		if (postType == 'image') {
			var img = new Image();
			img.src = content;
			img.id = Math.random();
			content = img.outerHTML;
			img.onload = function() {
				var copy = document.getElementById(img.id);
				var aspectRatio = copy.naturalWidth / copy.naturalHeight;
				var height = Math.min(copy.naturalHeight, 220, (parseInt(getComputedStyle(copy.parentNode).width) - 15 * 2) / aspectRatio);
				copy.style.width = height * aspectRatio + 'px';
			};
		}
		article.innerHTML = '<div class="article-metadata"><img src="/static/ic_close_black_24px.svg"/><img src="/static/ic_more_vert_black_24px.svg"/><ul class="dropdown" onclick="dropdownClicked(this, event)"><li>Delete</li><li>Flag</li></ul>' + caption + '</div><h2>' + title + '</h2><p>' + content + '</p>';
		var articlesLoading = document.querySelector('main > div.loader');
		if (articlesLoading) articlesLoading.remove();
		document.getElementsByTagName('main')[0].appendChild(article);
	};
	socket.on.no_posts = function() {
		var articlesLoading = document.querySelector('main > div.loader');
		if (articlesLoading)
			articlesLoading.outerHTML = '<div style="text-align: center; width: 100%">No posts here</div>';
	};
	socket.on.new_comment = function(postId, commentId, content, author, votes, dateString) {
		var commentSectionLoader = document.querySelector(`#fullscreen-article[data-post-id='${postId}'] > div.comments > div.loader`);
		if (commentSectionLoader) commentSectionLoader.remove();
		var commentSection = document.querySelector(`#fullscreen-article[data-post-id='${postId}'] > div.comments`);
		var c = document.createElement('div');
		c.className = 'comment';
		c.dataset.commentId = commentId;
		c.innerHTML = content;
		var parsedAuthor = author.replace(/<.*?>/g, '');
		var deleteButton = (parsedAuthor == getCookie('username') || getCookie('username') == 'moderator') ? `<img src='/static/ic_remove_circle_outline_black_24px.svg' onclick='deleteComment(this)'/>` : '';
		c.innerHTML += `<aside>-&nbsp;${author}&nbsp;- ${dateString}${deleteButton}</aside>`;
		commentSection.appendChild(c);
	};
	socket.on.no_comments = function(postId) {
		var commentSectionLoader = document.querySelector(`#fullscreen-article[data-post-id='${postId}'] > div.comments > div.loader`);
		if (commentSectionLoader) commentSectionLoader.remove();
	};
	socket.on.delete_comment = function(commentId) {
		var comment = document.querySelector(`[data-comment-id='${commentId}']`);
		comment.classList.add('deleted');
		setTimeout(function() {
			comment.remove();
		}, 200);
	};
	socket.on.post_success = function() {
		cancelWritingPost();
		setTimeout(() => location.reload(), 200);
	};

	$('insert-text').onclick = function() {
		setPostType('text');
	};
	$('insert-image').onclick = function() {
		$('image-file-input').click();
	};
	$('insert-link').onclick = function() {
		//setPostType('link');
		toast('Coming soon');
	};
	$('insert-location').onclick = function() {
		//setPostType('text');
		toast('Coming soon');
	};
	$('post-content').oninput = function() {
		if (this.textContent.trim().length == 0) {
			this.classList.add('empty');
		} else {
			this.classList.remove('empty');
		}
		try {
			getSelection().focusNode.nextSibling.scrollIntoView();
		} catch (err) {}
	};
	$('post-content').oninput(); // to show placeholder
	$('image-file-input').onchange = function() {
		try {
			if (!this.files[0].type.includes('image/')) {
				toast('Image files only');
				return;
			}
			var lastPostType = $('edit-box').dataset.postType;
			setPostType('image');
			resizeImageFile(this.files[0]).then(dataUrl => {
				var image = new Image();
				image.src = dataUrl;
				image.onload = function() {
					$('post-content').innerHTML = ''; // clear previous image, don't allow multiple images
					$('post-content').appendChild(image);
				};
			}).catch(() => {
				toast('There was an error.');
				setPostType(lastPostType);
			});
		} catch (err) {} // no files
	};
});

var html = document.documentElement;
addEventListener('scroll', function(e) {
	if (html.scrollTop + innerHeight >= html.scrollHeight) {
		loadPosts();
	}
}, { passive: true });

function loadPosts() {
	var start = document.querySelector('main').children.length;
	socket.emit('sync_posts', start);
}

function setPostType(postType) {
	var currentType = $('edit-box').dataset.postType;
	if (currentType != postType) {
		$('edit-box').dataset.postType = postType;
		$('post-content').innerHTML = '';
		$('post-content').oninput();
		$('post-content').contentEditable = postType == 'text';
	}
}

function closeFullscreenArticle(e, fromBackButton=false) {
	if (!fromBackButton )
		history.back(); // undo history.pushState
	$('write').classList.remove('hidden');
	var fsa = $('fullscreen-article');
	['top', 'left', 'width', 'height'].forEach(function(prop) {
		fsa.style.setProperty(prop, fsa.style.getPropertyValue(prop), 'important');
	});
	fsa.classList.add('shrinking');
	fsa.style.margin = '10px';
	fsa.style.overflowY = 'hidden';
	fsa.style.background = 'var(--bkg-secondary)';
	fsa.children[0].children[0].style.opacity = '0';
	setTimeout(() => fsa.remove(), 200);
	enableScroll();
}

function togglePostKebabMenu() {
	this.nextSibling.classList.toggle('visible');
	let button = this;
	if (this.nextSibling.classList.contains('visible')) {
		document.body.addEventListener('click', function(e) {
			if (e.target == button || !button.nextSibling.classList.contains('visible')) return;
			togglePostKebabMenu.apply(button, []);
			this.removeEventListener('click', arguments.callee);
		});
	}
}

function dropdownClicked(menu, event) {
	var article = menu.parentNode.parentNode;
	switch (event.target.innerHTML) {
		case 'Delete':
			showDialog('Delete post', 'Are you sure you want to delete this post?', ['Cancel', 'OK'], function(res) {
				if (res == 'OK') {
					socket.emit('delete_post', article.dataset.postId);
					closeFullscreenArticle();
					setTimeout(() => location.reload(), 200);
				}
			});
			break;
		case 'Flag':
			socket.emit('flag', article.dataset.postId);
			break;
	}
}

function cancelWritingPost(e, fromBackButton=false) {
	if (!fromBackButton)
		history.back(); // undo history.pushState
	$('write').classList.remove('overlay-active');
	enableScroll();
}

function writeNewPost() {
	this.classList.add('overlay-active');
	setTimeout(() => requestAnimationFrame(disableScroll), 220);
	pushState('new-post');
}

function post() {
	toast('Posting...', 'OK');
	switch ($('edit-box').dataset.postType) {
		case 'text':
			socket.emit('post', 'text', $('post-title').innerText, $('post-content').innerText);
			break;
		case 'image':
			imageSrc = $('post-content').children[0].src;
			socket.emit('post', 'image', $('post-title').innerText, imageSrc);
			break;
		default:
			toast('Unsupported post type');
			cancelWritingPost();
			return;
	}
}

function postComment(button) {
	var postId = parseInt(button.parentNode.parentNode.parentNode.dataset.postId);
	var comment = button.previousSibling.value;
	toast('Posting comment...', 'OK');
	socket.emit('post_comment', comment, postId);
	button.previousSibling.value = '';
}

function deleteComment(button) {
	showDialog('Delete comment', 'Are you sure you want to delete your comment?', ['Cancel', 'OK'], function(res) {
		if (res == 'OK') {
			var commentId = button.parentNode.parentNode.dataset.commentId;
			socket.emit('delete_comment', commentId);
		}
	});
}