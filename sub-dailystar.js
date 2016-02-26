var express = require('express');
var app = module.exports = express();
var pg = require('pg');
var request = require('request');
var cheerio = require('cheerio');

console.log("Subapp DailyStar running.");

app.get('/dailystar/get', function(req, res) {
	console.log('Daily Star get request received for ' + JSON.stringify(req.query) + '.');
	console.log(req.query.date);
	//res.sendFile(__dirname + '/subapps/kahraba/input.html');
});

function getDate(date) {
	putData(getLinks(date));
}

function getLinks(date) {
	url = 'http://www.dailystar.com.lb/LiveNews.aspx?date=' + date;
	request(url, function (error, response, body) {
		if (!error) {
			var $ = cheerio.load(body),
				urls = $('.main-content a').attr('href');
			console.log(JSON.stringify(urls));
			return urls;
		} else {
			console.log('We’ve encountered an error: ' + error);
			return 'Uh-oh';
		}
	});
}

function putData(urls) {
	if urls = 'Uh-oh' {
		console.log('We can’t get data from pages because we didn’t get the urls!');
	} else {
		for (i = 0; i < urls.length; i++) {
			console.log('Fetching ' + urls[i] + '...');
			request(url[i], function (error, response, body) {
				if (!error) {
					var $ = cheerio.load(body),
						title = $('#bodyHolder_divTitle').text()
					console.log('Got article: ' + title);
				} else {
					console.log('Had a problem with this one: ' + error);
				}
			});
		}
	}
}

pg.connect(process.env.DATABASE_URL, function(err, client) {
	if (err) throw err;
	console.log('Connected to postgres db! Yay!');

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