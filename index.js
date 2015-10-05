//console.log(process.argv);
//console.log('-------------------');

var http = require('http');
    url = require('url');
var DownloaderLatestNews = require('./core');

var server = http.createServer(function requestListenerCallback(reqst, resp) {

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // check arguments
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    if (reqst.method !== 'GET') {
        resp.writeHead(404, {'content-type': 'text/plain'});
        resp.end("Illegal request method: " + reqst.method);
        console.error("Illegal request method: " + reqst.method);
        return;
    }

    var urlObj = url.parse(reqst.url, true);
    if (urlObj.pathname !== '/latest_news') {
        resp.writeHead(404, {'content-type': 'text/plain'});
        resp.end("Bad pathname: '" + urlObj.pathname + "';  known only '/latest_news'");
        console.error("Bad pathname: " + urlObj.pathname);
        return;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    var downloader = new DownloaderLatestNews();

    downloader.on('error', function(err) {
        console.error(err);
        if (resp) {
            resp.writeHead(500, {'Content-Type': 'application/json; charset=UTF-8'});
            resp.end(JSON.stringify(err));
        }
    });

    var totalCount = 0;
    downloader.on('end', function() {
        console.log("Finished...");
        if (totalCount) {
            resp.end(']');
        } else {
            resp.writeHead(503); // Service Unavailable
            resp.end();
        }
    });

    downloader.on('data', function(arrJson) {
        //console.log(arrJson);
        if (!totalCount) {
            resp.writeHead(200, {'Content-Type': 'application/json; charset=UTF-8'});
            resp.write('[');
        }

        arrJson.forEach(function(jsnObj) {
            if (totalCount)
                resp.write(',');
            resp.write(JSON.stringify(jsnObj));
            totalCount++;
        });
    });

    console.log("Started...");
    downloader.start();

    reqst.connection.on('close', function() {
        resp = null;
        downloader.abort(new Error('Request connection aborted!'));
    });
});

server.listen(8083);
console.log("Server has started.");


