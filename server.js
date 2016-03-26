var express = require('express');
var app = express();

//Sub-apps
var mediamonitor = require('./media-monitor');
app.use(mediamonitor);

//Default path
app.use(express.static('public'));

//Go!
app.listen(process.env.PORT || 3000);