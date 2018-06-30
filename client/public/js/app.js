var apiKey = '<API_KEY>';
var speechApiIP = '<GCE_INSTANCE_EXTERNAL_IP>';

var translateUri = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
var translateLanguagesUri = `https://translation.googleapis.com/language/translate/v2/languages?key=${apiKey}&target=en`;
var speechUri = `wss://${speechApiIP}/transcribe`;
var nlpUri = `https://language.googleapis.com/v1/documents:analyzeEntitySentiment?key=${apiKey}`;
var nlpDocUri = `https://language.googleapis.com/v1/documents:analyzeSentiment?key=${apiKey}`;
var visionUri = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

var video = document.querySelector('video');
var video_box = document.getElementById('gum-local');
var canvas = document.getElementById('canvas');
var videoCanvas = document.getElementById('video_canvas');
var language = document.getElementById("supportedLang");

// Audio variables
var context = new AudioContext();

// Video variables
var expressionList = [{
	caption: 'Joy',
	id: 'joyLikelihood'
}, {
	caption: 'Sorrow',
	id: 'sorrowLikelihood'
}, {
	caption: 'Anger',
	id: 'angerLikelihood'
}, {
	caption: 'Surprise',
	id: 'surpriseLikelihood'
}, {
	caption: 'Under Exposed',
	id: 'underExposedLikelihood'
}, {
	caption: 'Blurred',
	id: 'blurredLikelihood'
}, {
	caption: 'Headwear',
	id: 'headwearLikelihood'
}];

// WebRTC variables
var constraints = window.constraints = {
	video: true,
	audio: {
		echoCancellation: true,
		channelCount: 1,
		sampleRate: {
			ideal: 48000 // per https://g.co/cloud/speech/reference/rest/v1beta1/RecognitionConfig
		},
		sampleSize: 24 // per https://g.co/cloud/speech/reference/rest/v1beta1/RecognitionConfig
	}
};

function handleSuccess(stream) {
	startVideo(stream);
	startAudio(stream); //initTranscript(writeResult);
	//var timer = setInterval(takePicture, 300); // This will run takePicture every 300ms, caution: GCP Vision quotas
}

function startVideo(stream) {
	var videoTracks = stream.getVideoTracks();
	console.log('Got stream with constraints:', constraints);
	console.log('Using video device: ' + videoTracks[0].label);
	stream.oninactive = function() {
		console.log('Stream inactive');
	};

	window.stream = stream; // make variable available to browser console
	video.srcObject = stream;
}

function startAudio(stream) {
	var microphone = context.createMediaStreamSource(stream);
	microphone.connect(context.createAnalyser());

	initWebsocket(context, microphone);
}

function initWebsocket(context, microphone) {
	var socket;
	var sourceNode;

	// Create a node that sends raw bytes across the websocket
	var scriptNode = context.createScriptProcessor(4096, 1, 1);
	// Need the maximum value for 16-bit signed samples, to convert from float.
	const MAX_INT = Math.pow(2, 16 - 1) - 1;
	scriptNode.addEventListener('audioprocess', function(e) {
		if (socket.readyState === 1) {
			var floatSamples = e.inputBuffer.getChannelData(0);
			// The samples are floats in range [-1, 1]. Convert to 16-bit signed
			// integer.
			socket.send(Int16Array.from(floatSamples.map(function(n) {
				return n * MAX_INT;
			})));
		}
	});

	function startListening() {
		var websocketPromise = new Promise(function(resolve, reject) {
			socket = new WebSocket(speechUri);
			socket.addEventListener('open', resolve); // handles the promise
			socket.addEventListener('error', reject);
		});

		Promise.all([websocketPromise]).then(function(values) {
			socket = values[0].target;

			socket.addEventListener('close', function(e) {
				console.log('Reinitializing socket');
				startListening();
			});

			socket.addEventListener('error', function(e) {
				console.log('Error from websocket', e);
			});

			// Send the initial configuration message. When the server acknowledges
			// it, start streaming the audio bytes to the server and listening for
			// transcriptions.
			socket.addEventListener('message', function(e) {
				socket.addEventListener('message', onTranscription);

				// initializes the mic and script
				microphone.connect(scriptNode);
				scriptNode.connect(context.destination);
			}, {
				once: true
			});

			socket.send(JSON.stringify({
				sampleRate: context.sampleRate
			}));
		}).catch(console.log.bind(console));
	}

	// Handles incoming text
	function onTranscription(e) {
		var result = JSON.parse(e.data);
		var text = result.alternatives_[0].transcript_;
		if (result.alternatives_) {
			document.getElementById('transcript').innerHTML = text;
			document.getElementById('nlp_transcript').innerHTML = text;
		}

		runTranslate(text);
		if (result.isFinal_) {
			runTranslate(text);
			runNLP(text);
		}
	}

	startListening();
}

function runTranslate(text) {
	var payload = {
		"q": text,
		"target": document.getElementById('supportedLang').value
	};
	$.ajax({
		url: translateUri,
		type: 'post',
		headers: {
			'content-type': 'application/json'
		},
		success: function(result) {
			document.getElementById('translate_transcript').innerHTML = result.data.translations[0].translatedText;
		},
		data: JSON.stringify(payload)
	});
}

function runNLP(text) {
	var payload = {
		"document": {
			"type": "PLAIN_TEXT",
			"content": text
		}
	};
	$.ajax({
		url: nlpUri,
		type: 'post',
		headers: {
			'content-type': 'application/json'
		},
		success: updateSentiment,
		data: JSON.stringify(payload)
	});

	$.ajax({
		url: nlpDocUri,
		type: 'post',
		headers: {
			'content-type': 'application/json'
		},
		success: function(result) {
			document.getElementById('body_sentiment').innerHTML = `Sentiment: ${result.documentSentiment.score}, Magnitude: ${result.documentSentiment.magnitude}`;
		},
		data: JSON.stringify(payload)
	});
}

function handleError(error) {
	console.error(`Error: ${error.name}, ${error}`);
}

// Captures an image of the webRTC video
function takePicture() {
	var visionIconSelected = document.getElementById('visionSelected');
	if (visionIconSelected.style.border === '3px solid white') {
		videoCanvas.getContext('2d').clearRect(0, 0, video_box.offsetWidth, video_box.offsetHeight);
		return;
	}

	var context = canvas.getContext('2d');

	var height = video_box.offsetHeight;
	var width = video_box.offsetWidth;
	if (width && height) {
		//adjust sizing
		canvas.width = width;
		canvas.height = height;

		videoCanvas.width = width;
		videoCanvas.height = height;

		// take picture
		videoCanvas.getContext('2d').clearRect(0, 0, videoCanvas.width, videoCanvas.height);
		context.drawImage(video, 0, 0, width, height);

		// run against Vision API
		runVision(canvas.toDataURL('image/png'));
	}
}

function runVision(data) {
	var payload = {
		"requests": [{
			"image": {
				"content": data.split(";")[1].split(',')[1] // Strip out base64 img data
			},
			"features": [
				{
					"type": "FACE_DETECTION",
					"maxResults": 10,
					"model": "builtin/stable"
				},
				{
					"type": "LABEL_DETECTION",
					"maxResults": 10,
					"model": "builtin/stable"
				}
			]
		}]
	};

	$.ajax({
		url: visionUri,
		type: 'post',
		headers: {
			'content-type': 'application/json'
		},
		success: function(result) {
			updateExpressions(result.responses[0].faceAnnotations);
			updateLabels(result.responses[0].labelAnnotations);

			var videoContext = videoCanvas.getContext('2d');
			videoContext.beginPath();

			for (var i = 0; i < result.responses[0].faceAnnotations.length; i++) {
				var face = result.responses[0].faceAnnotations[i];
				var rect = face.fdBoundingPoly.vertices;

				videoContext.font = "18pt Arial";
				videoContext.fillStyle = 'green';
				videoContext.fillText('Face ' + (i + 1), rect[0].x, rect[0].y - 5);

				videoContext.rect(rect[0].x, rect[0].y, rect[2].x - rect[0].x, rect[2].y - rect[0].y);
				videoContext.lineWidth = 4;
				videoContext.strokeStyle = 'green';
			}

			videoContext.stroke();
		},
		data: JSON.stringify(payload)
	});
}

function updateExpressions(data) {
	var tableName = 'expressionTable';

	var table = document.createElement('table');
	var headerRow = document.createElement('tr');
	var th = document.createElement('th');
	th.innerHTML = 'Expression';
	headerRow.appendChild(th);
	for (var i = 0; i < data.length; i++) {
		th = document.createElement('th');
		th.innerHTML = 'Face ' + (i + 1);
		headerRow.appendChild(th);
	};

	table.appendChild(headerRow);

	expressionList.forEach(function(rowObject) {
		var row = document.createElement('tr');
		var rowName = document.createElement('td');
		rowName.innerHTML = rowObject.caption;
		row.appendChild(rowName);

		for (var i = 0; i < data.length; i++) {
			var rowData = document.createElement('td');
			rowData.innerHTML = data[i][rowObject.id];
			row.appendChild(rowData);
		};
		table.appendChild(row);
	});

	$('#' + tableName).html("");
	document.getElementById(tableName).appendChild(table);
}

function updateLabels(data) {
	var tableName = 'labelTable';

	var table = document.createElement('table');
	table.appendChild(createRow('th', ['Description', 'Score']));

	data.forEach(function(rowObject) {
		table.appendChild(createRow('td', [rowObject.description, rowObject.score]));
	});

	$('#' + tableName).html("");
	document.getElementById(tableName).appendChild(table);
}

function updateSentiment(data) {
	var tableName = 'sentimentTable';
	$('#' + tableName).html("");

	var table = document.createElement('table');
	table.appendChild(createRow('th', ['Entity', 'Salience', 'Sentiment', 'Magnitude']));

	data.entities.forEach(function(rowObject) {
		if (rowObject.salience > 0.001) {
			table.appendChild(createRow('td', [rowObject.name, rowObject.salience, rowObject.sentiment.score, rowObject.sentiment.magnitude]));
		}
	});

	if (data.entities) {
		document.getElementById('sentimentTable').appendChild(table);
	}
}

// Opens GCP ML API UI Section
function openTab(tabName) {
	var i;
	var tabContents = document.getElementsByClassName("tabcontent");
	var tabLinks = document.getElementsByClassName("tablinks");
	
	for (i = 0; i < tabContents.length; i++) {
		tabContents[i].style.display = "none";
	}
	for (i = 0; i < tabLinks.length; i++) {
		tabLinks[i].className = tabLinks[i].className.replace(" active", "");
	}
	
	document.getElementById(tabName).style.display = "block";
}

// Opens GCP Vision Tech UI Tab
function openTech(el, tabName) {
	var i;
	var techContents = document.getElementsByClassName("techcontent");
	var techLinks = document.getElementsByClassName("techlinks");
	
	for (i = 0; i < techContents.length; i++) {
		techContents[i].style.display = "none";
		techContents[i].style.visibility = "hidden";
	}
	
	for (i = 0; i < techLinks.length; i++) {
		techLinks[i].className = techLinks[i].className.replace(" active", "");
		techLinks[i].parentNode.style.border = "3px solid white";
	}
	
	document.getElementById(tabName).style.display = "block";
	document.getElementById(tabName).style.visibility = "visible";
	
	if(el) {
		el.parentNode.style.border = "3px solid black";
	}
}

// Retrieve list of languages for Google Translate API Language dropdown
$.ajax({
	url: translateLanguagesUri,
	type: 'get',
	headers: {
		'content-type': 'application/json'
	},
	success: function(result) {
		// Add each language to drop-down
		result.data.languages.forEach(function(lang) {
			language.appendChild(createLangElement(lang));
		});
	}
});


function createRow(type, arr) {
	var row = document.createElement('tr');
	arr.forEach(function(value){
		row.appendChild(createCell(type, value));
	});
	return row;
}

function createCell(type, value) {
	var td = document.createElement(type);
	td.innerHTML = value;
	return td;
}

function createLangElement(lang) {
	var l = document.createElement('option');
	l.setAttribute('value', lang.language);
	if (lang.language === 'en') {
		l.setAttribute('selected', true);
	}
	l.innerHTML = lang.name;
	return l;
}


openTab('Faces');
navigator.mediaDevices.getUserMedia(constraints).then(handleSuccess).catch(handleError);
