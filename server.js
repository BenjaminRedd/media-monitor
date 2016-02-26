var express = require('express');
var app = express();

//Sub-apps
var postgres = require('./sub-postgres');
app.use(postgres);

//Default path
app.use(express.static('public'));

//Go!
app.listen(process.env.PORT || 3000);