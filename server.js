var express = require('express');
var app = express();

//Default path
app.use(express.static('public'));

//Go!
app.listen(process.env.PORT || 3000);