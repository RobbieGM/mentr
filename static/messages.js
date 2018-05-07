function loadConversation(person) {
	pushState('conversation');
	$('conversation').classList.add('active');
	$('conversation').dataset.person = person;
	socket.emit('load_conversation', person);
}

backButtonActionFrom.conversation = function() {
	$('conversation').classList.remove('active');
	setTimeout(function clearConversation() {
		for (let message of document.querySelectorAll('#conversation .message')) {
			message.remove();
		}
	}, 200);
};
backButtonActionFrom['new-conversation'] = function() {
	backButtonActionFrom.conversation();
	$('new-conversation-username').value = '';
	setTimeout(function() {
		$('new-conversation-username').classList.remove('visible');
	}, 200);
};

function loadConversationPreview(person, lastMessage, otherPersonFirstNameLetter) {
	if ($('no-conversations')) $('no-conversations').remove();
	removeLoader();
	var isNew = false;
	var conversation = document.querySelector(`main > div[data-person="${person}"]`);
	if (!conversation) {
		conversation = document.createElement('div');
		isNew = true;
	}
	if (otherPersonFirstNameLetter)
		conversation.dataset.iconLetter = otherPersonFirstNameLetter.toUpperCase();
	conversation.dataset.person = person;
	conversation.innerHTML = `<p class='who'>${person}</p><p>${lastMessage}</p>`;
	if (isNew)
		$('main').appendChild(conversation);
}

function removeLoader() {
	if ($('loader')) $('loader').remove();
}

addEventListener('load', function() {
	socket.emit('load_conversation_previews');
	socket.on.conversation_preview_loaded = loadConversationPreview;
	socket.on.no_conversations = function() {
		removeLoader();
		$('main').innerHTML = `<p id='no-conversations'>No conversations yet</p>`;
	};
	socket.on.messages_loaded = function(messages) {
		var lastMessage;
		for (const [sender, receiver, content, date, type] of messages) {
			var message = document.createElement('div');
			message.className = 'message';
			var isMine = sender == getCookie('username');
			if (isMine)
				message.classList.add('my-message');
			if (type == 'text') {
				message.innerHTML = content;
			} else if (type == 'image') {
				message.innerHTML = `<img src='${content}'/>`;
			} else {
				message.innerHTML = '<code>There was an error loading this message.</code>';
			}
			message.dataset.date = date;
			$('conversation').appendChild(message);
		}
		$('conversation').scrollTop = $('conversation').scrollHeight;
	};
	$('main').onclick = function(e) {
		var target = e.target;
		while (target.parentNode) {
			if (target.matches('main > div')) {
				loadConversation(target.dataset.person);
			}
			target = target.parentNode;
		}
	};
	$('message-input').onkeypress = function(e) {
		if (e.keyCode == 13) { // Enter
			$('send').click();
		}
	};
	$('send').onclick = function() {
		var person = $('conversation').dataset.person;
		if (person.trim() == '') {
			toast('Provide a username to send to');
			return;
		}
		socket.emit('message', person, $('message-input').value, 'text');
		$('message-input').value = '';
	};
	$('plus').onclick = function() {
		var ncu = $('new-conversation-username');
		$('conversation').classList.add('active');
		pushState('new-conversation');
		ncu.className = 'visible no-animate';
		void ncu.offsetWidth;
		ncu.classList.remove('no-animate');
		ncu.onchange();
	};
	$('new-conversation-username').onchange = function() {
		$('conversation').dataset.person = this.value;
	};
	$('send-image').onclick = function() {
		$('image-file-input').click();
	};
	$('image-file-input').onchange = function() {
		try {
			if (!this.files[0].type.includes('image/')) {
				toast('Image files only');
				return;
			}
			resizeImageFile(this.files[0]).then(dataUrl => {
				var person = $('conversation').dataset.person;
				if (person.trim() == '') {
					toast('Provide a username to send to');
					return;
				}
				socket.emit('message', person, dataUrl, 'image');
			}).catch(() => {
				toast('There was an error.');
			});
		} catch (err) {} // no files
	};
});