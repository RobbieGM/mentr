addEventListener('load', function() {
	socket.emit('load_conversations');
	function removeLoader() {
		if ($('loader')) $('loader').remove();
	}
	socket.on.conversation_loaded = function(who, lastMessage, otherPersonFirstNameLetter) {
		removeLoader();
		var conversation = document.createElement('div');
		conversation.dataset.iconLetter = otherPersonFirstNameLetter.toUpperCase();
		conversation.innerHTML = `<p class='who'>${who}</p><p>${lastMessage}</p>`;
		$('main').appendChild(conversation);
	};
	socket.on.no_conversations = function() {
		removeLoader();
		$('main').innerHTML = '<p id="no-conversations">No conversations yet</p>';
	};
});
