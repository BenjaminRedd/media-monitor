var express = require('express');
var app = module.exports = express();
var pg = require('pg');

console.log("Subapp Postgres running.");

pg.connect(process.env.DATABASE_URL, function(err, client) {
	if (err) throw err;
	console.log('Connected to postgres! Yay!');

	client
		.query('SELECT table_schema,table_name FROM information_schema.tables;')
		.on('row', function(row) {
			console.log(JSON.stringify(row));
		});
});

/*app.get('/db', function (request, response) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    client.query('SELECT * FROM test_table', function(err, result) {
      done();
      if (err)
       { console.error(err); response.send("Error " + err); }
      else
       { response.render('pages/db', {results: result.rows} ); }
    });
  });
})*/