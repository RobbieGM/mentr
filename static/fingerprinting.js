function getInternalIP() {
	return new Promise(function(resolve, reject) {
		var RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
		if (RTCPeerConnection) {

			var addrs = Object.create(null); // empty object with no properties
			addrs['0.0.0.0'] = false;

			var servers = {iceServers: []};
			var rtc = new RTCPeerConnection(servers);
			rtc.createDataChannel('', {reliable: false});

			rtc.onicecandidate = function (evt) {
				if (evt.candidate) {
					grepSDP('a=' + evt.candidate.candidate);
				}
			};

			rtc.createOffer(function (offerDesc) {
				grepSDP(offerDesc.sdp);
				rtc.setLocalDescription(offerDesc);
			}, function (err) {
				resolve();
			});

			function processIPs(newAddr) {
				if (newAddr in addrs) return;
				else addrs[newAddr] = true;
				var displayAddrs = Object.keys(addrs).filter(function (k) { return addrs[k]; });
				resolve(displayAddrs.join(','));
			}

			function grepSDP(sdp) {
				var hosts = [];
				sdp.split('\r\n').forEach(function (line) {
					if (~line.indexOf('a=candidate')) {
						var parts = line.split(' '),
							addr = parts[4],
							type = parts[7];
						if (type === 'host') processIPs(addr);
					} else if (~line.indexOf('c=')) {
						var parts = line.split(' '),
							addr = parts[2];
						processIPs(addr);
					}
				});
			}
		} else {
			resolve('unavailable');
		}
	});
}

async function getExternalIP() {
	try {
		var resp = await fetch('https://api.ipify.org/');
		return await resp.text();
	} catch (err) {
		return 'unavailable';
	}
}

async function emptyPromise() { return 'unavailable'; }

async function createFingerprint() {
	function copy(obj, props) {
		var cp = {};
		for (var prop of props) {
			if (prop in obj) {
				cp[prop] = obj[prop];
			}
		}
		return cp;
	}
	var batteryPromise;
	try {
		batteryPromise = navigator.getBattery();
	} catch (e) {
		batteryPromise = emptyPromise();
	}
	var internalIPPromise = getInternalIP();
	var externalIPPromise = getExternalIP();
	var fp = {
		appVersion: navigator.appVersion,
		conn: copy(navigator.connection, ['rtt', 'downlink', 'effectiveType']),
		memoryGB: navigator.deviceMemory,
		processors: navigator.hardwareConcurrency,
		vendor: navigator.vendor,
		batteryLevel: copy(await batteryPromise, ['charging', 'level']),
		userAgent: navigator.userAgent,
		internalIP: await internalIPPromise,
		cookie: document.cookie,
		screen: copy(screen, ['width', 'height']),
		externalIP: await externalIPPromise
	};
	return fp;
}