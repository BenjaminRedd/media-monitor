// 1. This is a work in progress.
// 2. As of v1.0.0, it only tracks the Daily Star.
// 3. This work is public domain.

var express = require('express');
var app = module.exports = express();
var pg = require('pg');
var request = require('request');
var cheerio = require('cheerio');

// Initialize
console.log("Subapp Lebanon Media Monitor running.");
getNewDate();

// Set the beginning of time and our other universal variables.
var earliestRecord = new Date(1998, 4, 11);
var problemDates = [];
var problems = false;
var problemHandling = {};
var latest = new Date();
var done = false;
var reqs = [];

// Handle get requests.
app.get('/dailystar/get', function(req, res) {
	res.send(data);
});

// Update data for today (runs every 24 hours).
var data = {abs: 0, pct: 0, series: {}};
var update = setInterval(getNewDate, 86400000);
function getNewDate() {
	var today = new Date();
	var monthago = new Date().setDate(today.getDate() - 30);
	monthago = new Date(monthago);
	var mmonth = monthago.getMonth() + 1;
	if (mmonth < 10) mmonth = '0' + mmonth;
	else mmonth = mmonth.toString();
	var mdate = monthago.getDate();
	if (mdate < 10) mdate = '0' + mdate;
	else mdate = mdate.toString();
	monthago = monthago.getFullYear() + '-' + mmonth + '-' + mdate;
	pg.connect(process.env.DATABASE_URL, function(err, client) {
		if (err) throw err;
		client.query('SELECT COUNT(*) FROM ds WHERE source = \'The Daily Star\' AND time >= \'' + monthago + '\';', function(err, results) {
			if (err) throw err;
			var original = results.rows[0].count;
			data.abs = Math.round(results.rows[0].count / 30);
			client.query('SELECT COUNT(*) FROM ds WHERE time >= \'' + monthago + '\';', function(err, results) {
				if (err) throw err;
				if (results.rows[0].count != 0) data.pct = Math.round((original / results.rows[0].count) * 100);
				else data.pct = 'ERR';

				// Get time series.
				for (i = new Date(earliestRecord.getTime()); i < today; i.setDate(i.getDate() + 1)) {
					var imonth = i.getMonth() + 1;
					if (imonth < 10) imonth = '0' + imonth;
					else imonth.toString();
					var idate = i.getDate();
					if (idate < 10) idate = '0' + idate;
					else idate.toString();
					var istr = i.getFullYear() + '-' + imonth + '-' + idate;
					getCount(istr);
				}

				function getCount(date) {
					client.query('SELECT COUNT(*) FROM ds WHERE date_trunc(\'day\', time) = \'' + date + '\';', function(err, results) {
						if (err) throw err;
						data.series[date] = results.rows[0].count;
						checkDone();
					});
				}

				var daycount = Math.round((today.getTime() - earliestRecord.getTime()) / (24*60*60*1000));
				function checkDone() {
					//console.log('Series length: ' + Object.keys(data.series).length + ' / ' + daycount);
					if (Object.keys(data.series).length == daycount - 1) {
						client.end();
					}
				}
			});
		});
	});
}

// All of the rest basically populates our database.

// First time run: sets up table. After that, checks to see it's still there.
pg.connect(process.env.DATABASE_URL, function(err, client) {
	if (err) throw err;
	client.query('\
		CREATE TABLE IF NOT EXISTS ds (\
			id SERIAL PRIMARY KEY,\
			time TIMESTAMP,\
			url TEXT,\
			title TEXT,\
			category TEXT,\
			source TEXT,\
			authors TEXT\
		);\
		CREATE TABLE IF NOT EXISTS dsdate (\
			dates DATE,\
			flag TEXT\
		);\
		CREATE TABLE IF NOT EXISTS skipped (\
			date DATE,\
			url TEXT\
		);\
	', function(err, result) {
		if (err) throw err;
		var d = new Date();
		iterate(d);
		client.end();
	});
	//done('createTables');
});

// Cycle through all dates, back to the beginning of (Daily Star digital) time, or 11 May 1998.
function iterate(d) {
	//pg.end();
	if (problems == true) {
		solveProblems();
	} else {
		d.setDate(d.getDate() - 1);
		//console.log(d + ' should be greater than ' + earliestRecord);
		if (d >= earliestRecord) {
			checkStart(d);
		} else {
			console.log('Finished logging dates back to the beginning of time. Moving on to problems.');
			problems = true;
			solveProblems();
		}
	}
}

function solveProblems() {
	if (problemDates.length > 0) {
		var date = problemDates[Math.floor(Math.random()*problemDates.length)];
		var ddate = new Date(date.slice(0, 4), date.slice(5, 2), date.slice(8, 2));
		checkStart(ddate);
	} else {
		console.log('Finished logging all problem dates.');
		finalValidation();
	}
}

// Here's where we run through all of our dates in the date table and make sure everything is logged. EVERYTHING.
function finalValidation() {
	pg.connect(process.env.DATABASE_URL, function(err, client) {
		if (err) reboot(err, 'finalValidation/connect');
		else {
			var j = new Date();
			j.setDate(j.getDate() - 1);
			for (j; j >= earliestRecord; j.setDate(j.getDate() - 1)) {
				validate(j, client);
			}
		}
	});

	function validate(date, client) {
		var day = date.getDate();
		if (day < 10) day = '0' + day;
		var month = date.getMonth() + 1;
		if (month < 10) month = '0' + month;
		var datestring = date.getFullYear() + '-' + month + '-' + day;
		var eday = earliestRecord.getDate();
		if (eday < 10) eday = '0' + eday;
		var emonth = earliestRecord.getMonth() + 1;
		if (emonth < 10) emonth = '0' + emonth;
		var estring = earliestRecord.getFullYear() + '-' + emonth + '-' + eday;
		client.query('SELECT 1 FROM dsdate WHERE dates = \'' + datestring + '\';', function(err, results) {
			if (err) reboot(err, 'finalValidation/query');
			else {
				if (results.rowCount == 0) {
					console.log('Validation failed for: ' + datestring);
				}
				if (datestring == estring) {
					console.log('Validation complete.');
					done = true;
					client.end();
				}
			}
		});
	}
}

// The command that kicks everything off...
/*app.get('/dailystar/get', function(req, res) {
	console.log('Daily Star get request received for ' + JSON.stringify(req.query) + '.');
	var date = req.query.date.slice(8) + req.query.date.slice(5,7) + req.query.date.slice(0,4);*/

function checkStart(ddate) {
	// Format the date.
	var day = ddate.getDate();
	if (day < 10) day = '0' + day;
	var month = ddate.getMonth() + 1;
	if (month < 10) month = '0' + month;
	var dstring = ddate.getFullYear() + '-' + month + '-' + day;
	//console.log('Date string is: ' + dstring);

	// Check to see if we've already logged this date.
	pg.connect(process.env.DATABASE_URL, function(err, client) {
		if (err) reboot(err, 'checkStart/connect');
		else client.query('SELECT 1 FROM dsdate WHERE dates = \'' + dstring + '\';', function(err, results) {
			if (err) reboot(err, 'checkStart/query/getline');
			else {
				//console.log(JSON.stringify(results));
				if (results.rowCount == 0) {
					var flag = 'none';
					getLinks(flag, dstring, getData, putData);
					//res.send('Getting ' + req.query.date + '…');
					console.log('Getting date ' + dstring + '...');
					problemDates.push(dstring);
					client.end();
				} else {
					client.query('SELECT flag FROM dsdate WHERE dates = \'' + dstring + '\';', function(err, results) {
						if (err) reboot(err, 'checkStart/query/getflag');
						else {
							//console.log(JSON.stringify(results));
							if (results.rows[0].flag == 'complete') {
								//res.send(req.query.date + ' is already logged.');
								console.log('Date ' + dstring + ' has already been logged.');
								iterate(ddate);
							} else if (results.rows[0].flag == 'partial') {
								var flag = 'partial';
								getLinks(flag, dstring, getData, putData);
								//res.send('Getting ' + req.query.date + '…');
								console.log('Resuming logging for date ' + dstring + '...');
								problemDates.push(dstring);
							} else {
								//res.send('We had an error. This date had a flag: ' + results.rows[0].flag);
								console.log('We had an error. This date had a flag: ' + results.rows[0].flag);
								problemDates.push(dstring);
								iterate(ddate);
							}
							client.end();
						}
					});
				}
			}
		});
	});
}

// Takes a date, grabs a list of URLs of articles published that day, and gives that list to a callback function.
function getLinks(flag, date, callback, callback2) {
	var url = 'http://www.dailystar.com.lb/LiveNews.aspx?date=' + date.slice(8) + date.slice(5,7) + date.slice(0,4);;
	reqs.push(request(url, function (error, response, body) {
		if (!error) {
			var $ = cheerio.load(body),
				urls = [];
			$('.block.more-news a').each(function(i, e) {
				if ($(this).attr('href').charAt(0) == '/') urls[i] = 'http://www.dailystar.com.lb' + $(this).attr('href');
				else urls[i] = 'http://www.dailystar.com.lb/' + $(this).attr('href');
			});

			// Check to make sure we actually got something.
			if (urls.length > 0) {
				console.log('Got URLs.');
				callback(flag, date, urls, callback2);
			} else {
				console.log('No URLs detected for ' + date);
				if ($('.block.more-news').is('.block.more-news')) {
					pg.connect(process.env.DATABASE_URL, function(err, client) {
						if (err) reboot(err, 'getLinks/connect');

						else {
							client.query('INSERT INTO dsdate (dates, flag) VALUES ($1, $2);', [date, 'complete'], function(err, results) {
								if (err) reboot(err, 'getLinks/query/completeflag');
								else {
									//console.log('Added date ' + date + ' to date table with complete flag.');
									if (problemDates.indexOf(date) > -1) problemDates.splice(problemDates.indexOf(date), 1);
									var month = (parseInt(date.slice(5, 7), 10) - 1).toString();
									if (month < 10) month = '0' + month;
									var ddate = new Date(date.slice(0, 4), month, date.slice(8, 10));
									iterate(ddate);
									latest = new Date();
									client.end();
									pg.end();
								}
							});
						}
					});
				} else {
					var month = (parseInt(date.slice(5, 7), 10) - 1).toString();
					if (month < 10) month = '0' + month;
					var ddate = new Date(date.slice(0, 4), month, date.slice(8, 10));
					iterate(ddate);
					latest = new Date();
				}
			}
		} else {
			console.log('We’ve encountered an error: ' + error);
			var month = (parseInt(date.slice(5, 7), 10) - 1).toString();
			if (month < 10) month = '0' + month;
			var ddate = new Date(date.slice(0, 4), month, date.slice(8, 10));
			iterate(ddate);
		}
	}));
}

// Loops through our list of article URLs and fetches data.
function getData(flag, date, urls, callback) {
	var table = [];
	var errors = [];
	var skipped = [];

	// Iterate through our URLs.
	for (i = 0; i < urls.length; i++) {
		//console.log('Fetching ' + (i + 1) + ' of ' + urls.length + ' / ' + urls[i] + '...');
		getPage(urls[i])
	}

	function getPage(url) {
		// Populate the table with data from all the articles.
		reqs.push(request(url, function (error, response, body) {
			if (!error) {
				var $ = cheerio.load(body),
					title = $('#bodyHolder_divTitle').text();
					time = $('#bodyHolder_divDate').text().match(/[0-9]{2}:[0-9]{2} [a-zA-Z]{2}/);
					category = $('#bodyHolder_divCategory').text();

				// The Star's source/author markup is jankety, so we have to be careful.
				// First case: Source but no author.
				if ($('#bodyHolder_divSource') != '') {
					var source = $('#bodyHolder_divSource').text(),
						authors = [];
					table.push([date, time, url, title, category, source, authors]);
				// Second case: Author(s) and maybe a source.
				} else if ($('#bodyHolder_aAuthor') != '') {
					// Is there a source?
					if ($('#bodyHolder_aAuthor span[style="margin-left:5px;"]')) {
						var source = $('#bodyHolder_aAuthor span[style="margin-left:5px;"]').text();
					} else {
						source = '';
					}
					// Authors will be an array.
					var authors = [];
					$('#bodyHolder_aAuthor .reviewer a').each(function(j, e) {
						authors[j] = $(this).text();
					});
					table.push([date, time, url, title, category, source, authors]);
				// Third case: Something's wrong!
				} else if ($('title').text() == 'The resource cannot be found.') {
					skipped.push(url);
					console.log('SKIPPING! Daily Star CMS couldn’t serve this one: ' + url);
				} else if (response.request.uri.href == 'http://www.dailystar.com.lb//default.aspx?test') {
					skipped.push(url);
					console.log('SKIPPING! Redirected to homepage for: ' + url);
				} else {
					errors.push(url);
					//var source = '',
					//	authors = [];
					console.log('Unrecognized response for ' + url);
				}
				//console.log(JSON.stringify([date, time, url, title, category, source, authors]));
			// What happens when we get an error trying to fetch a page?
			} else {
				// Redirect loop.
				/*if (error.match('Error: Exceeded maxRedirects. Probably stuck in a redirect loop')) {
					console.log('SKIPPING! Redirect loop detected for: ' + url);
					skipped.push(url);*/

				// General case: allows 12 attempts to get page.
				//} else {
					if (problemHandling[url]) {
						if (problemHandling[url] > 11) {
							console.log('SKIPPING! Something went horribly wrong with this one ' + problemHandling[url] + ' times: ' + url);
							skipped.push(url);
							delete problemHandling[url];
						} else {
							problemHandling[url]++;
							errors.push(url);
						}
					} else {
						console.log('Encountered error requesting ' + url + ' ' + error);
						problemHandling[url] = 1;
						errors.push(url);
					}
				//}
			}
		}));
	}

	// We need to check to see if out table is complete before calling the putData function. If there were errors, we take care of them...
	var put = setInterval(testTable, 1000);

	function testTable() {
		if (errors.length > 0) {
			console.log('We have ' + errors.length + ' error(s). Refetching ' + errors[0] + '...');
			getPage(errors[0]);
			errors.splice(0, 1);
			//console.log('Problems here: ' + JSON.stringify(problemHandling));
		}

		if (table.length + skipped.length == urls.length) {
			//console.log('Skipped ' + skipped.length + ' article(s).');
			for (i = 0; i < skipped.length; i++) {
				//console.log('Skipped ' + (i + 1) + '/' + skipped.length + ': ' + skipped[i]);
				skipLog(date, skipped[i]);
			}
			callback(flag, table);
			clearInterval(put);
		}
	}
}

// This adds a failed URL to the database.
function skipLog(date, url) {
	pg.connect(process.env.DATABASE_URL, function(err, client) {
		if (err) reboot(err, 'skipLog/connect');
		else client.query('INSERT INTO skipped (date, url) VALUES ($1, $2);', [date, url], function(err, results) {
			if (err) reboot(err, 'skipLog/query');
			client.end();
		});
		//done('skipLog');
	});
}

// Put data in the database.
function putData(flag, table) {
	pg.connect(process.env.DATABASE_URL, function(err, client) {
		if (err) reboot(err, 'putData/connect');

		else {
			var errors = [];
			var count = 0;
			//var date = table[0][0].slice(4) + '-' + table[0][0].slice(2,4) + '-' + table[0][0].slice(0,2);
			var date = table[0][0];

			if (flag == 'none') {
				client.query('INSERT INTO dsdate (dates, flag) VALUES ($1, $2);', [date, 'partial'], function(err, results) {
					if (err) reboot(err, 'putData/query/partialflag');
					//else console.log('Added date to date table with partial flag.');
				});
			}

			//console.log('Initiating putLine loop.');

			for (i = 0; i < table.length; i++) {
				// First, fix the date time group.
				var time = table[i][1];
				//console.log(time + ' / ' + table[i][2]);
				if (time.toString().charAt(6) == 'P' && time.toString().slice(0,2) != '12') {
					time = (parseInt(time.slice(0,2)) + 12).toString() + time.toString().slice(2,5) + ':00';
				} else if (time.toString().charAt(6) == 'A' && time.toString().slice(0,2) == '12') {
					time = '00' + time.toString().slice(2,5) + ':00';
				} else {
					time = time.toString().slice(0,5) + ':00';
				}
				var data = [date + ' ' + time, table[i][2], table[i][3], table[i][4], table[i][5], table[i][6]];

				//console.log('Putting line ' + i + ' / ' + table.length);
				putLine(data);
			}

			// Error checking & final validation.
			var put = setInterval(testTable, 1000);
		}

		function testTable() {
			if (errors.length > 0) {
				console.log('We have ' + errors.length + ' error(s). Reputting ' + errors[0][2] + '...');
				putLine(errors[0]);
				errors.splice(0, 1);
			}

			if (count == table.length && errors.length == 0) {
				client.query('SELECT COUNT(*) FROM ds;', function(err, results) {
					if (err) reboot(err, 'putData/testTable/query/finishwrite');
					else {
						var now = new Date();
						var hour = now.getHours(),
							min = now.getMinutes();
						if (hour < 10) hour = '0' + hour;
						else hour = hour.toString();
						if (min < 10) min = '0' + min;
						else min = min.toString();
						console.log(hour + min + ' Finished writing ' + count + ' records to the database. There are ' + results.rows[0].count + ' records now in the database.');
					}
					clearInterval(put);
				});
				client.query('UPDATE dsdate SET flag=\'complete\' WHERE dates=$1;', [date], function(err, results) {
					if (err) reboot(err, 'putData/testTable/query/completeflag');
					else {
						//console.log('Added date ' + date + ' to date table with complete flag.');
						if (problemDates.indexOf(date) > -1) problemDates.splice(problemDates.indexOf(date), 1);
						if (problemDates.length > 0) console.log('We still have problems with these dates: ' + JSON.stringify(problemDates));
						//console.log('Hello date: ' + JSON.stringify(date));
						var month = (parseInt(date.slice(5, 7), 10) - 1).toString();
						if (month < 10) month = '0' + month;
						var ddate = new Date(date.slice(0, 4), month, date.slice(8, 10));
						//console.log(ddate);
						iterate(ddate);
						latest = new Date();
						client.end();
						pg.end();
					}
				});
			}
		}

		// Writes lines to database.
		function putLine(line) {
			if (flag == 'partial') {
				client.query('SELECT COUNT(1) FROM ds WHERE url=\'' + line[1] + '\';', function(err, results) {
					if (err) reboot(err, 'putData/putLine/query/checkpartial');
					else {
						if (results.rows[0].count > 0) {
							count++;
							console.log('Row already written. Skipping...');
						} else {
							client.query('INSERT INTO ds (time, url, title, category, source, authors)\
								VALUES ($1, $2, $3, $4, $5, $6);', line, function(error, results) {
									if (error) {
										console.log('Error writing line to DB: ' + error);
										errors.push(line);
									} else {
										count++;
										//console.log('Wrote ' + count + '/' + table.length);
									}
								}
							);
						}
					}
				});
			} else {
				client.query('INSERT INTO ds (time, url, title, category, source, authors)\
					VALUES ($1, $2, $3, $4, $5, $6);', line, function(error, results) {
						if (error) {
							console.log('Error writing line to DB: ' + error);
							errors.push(line);
						} else {
							count++;
							//console.log('Wrote ' + count + '/' + table.length);
						}
					}
				);
			}
		}
	});
}

// Something went horribly wrong somewhere. Gotta reboot.
function reboot(err, location) {
	console.log('ERROR! REBOOTING!! AT ' + location + ': ' + err);
	pg.end();
	var rnum = reqs.length;
	for (i = 0; i < rnum; i++) {
		reqs[0].abort();
		reqs.splice(0, 1);
	}
	var d = new Date();
	iterate(d);
}

// Check the connection and for stalling every ten minutes
var check = setInterval(checkConnection, 600000);

function checkConnection() {
	// Is the database already built?
	if (done == true) {
		clearInterval(check);
		return;
	} else {

	// Is our program hanging somewhere, and if so, is there even an internet connection?
		var now = new Date();
		if (now.getTime() > latest.getTime() + 300000) {
			require('dns').lookup('google.com', function(err) {
				if (err && err.code == "ENOTFOUND") {
					console.log('NO INTERNET ' + now);
					var rnum = reqs.length;
					for (i = 0; i < rnum; i++) {
						reqs[0].abort();
						reqs.splice(0, 1);
					}
					return; // Basically, we'll wait another 10 minutes hoping for internet to return.
				} else {
					reboot('Program hanging longer than 5 min.', 'checkConnection');
				}
			});
		}
	}
}