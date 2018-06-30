var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');

var app = express();
app.use( bodyParser.json() );

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));

app.get('/', function(req, res) {
	console.log('retrieve homepage');
  res.sendFile(path.join(__dirname, '/public/index.html'));
});


var port = process.env.PORT || 8080;
var httpServer = require('http').createServer(app);
httpServer.listen(port, function() {
    console.log('server running on port ' + port + '.');
});


console.log('Listening, press Ctrl+C to stop.');