function resizeImageFile(file) {
	return new Promise((resolve, reject) => {
		if (!file.type.match(/^image\/.*/)) {
			reject('Not an image file');
			return;
		}
		var fr = new FileReader();
		fr.onload = () => {
			var image = new Image();
			image.onload = imageEvt => {
				var canvas = document.createElement('canvas');
				var maxSize = 1000;
				var width = image.width, height = image.height;
				if (width > height && width > maxSize) {
					height *= maxSize / width;
					width = maxSize;
				} else if (height > maxSize) {
					width *= maxSize / height;
					height = maxSize;
				}
				canvas.width = width;
				canvas.height = height;
				canvas.getContext('2d').drawImage(image, 0, 0, width, height);
				var resizedImage = canvas.toDataURL('image/jpeg');
				resolve(resizedImage);
			};
			image.src = fr.result;
		};
		fr.readAsDataURL(file);
	});
}