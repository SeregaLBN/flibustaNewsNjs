//console.log(process.argv);
//console.log('-------------------');

var zlib = require('zlib'),
    http = require('http'),
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

    downloader.on('error', function (err) {
        console.error(err);
        if (resp) {
            resp.writeHead(500, {'Content-Type': 'application/json; charset=UTF-8'});
            resp.end(JSON.stringify(err));
        }
    });

    var acceptEncoding = reqst.headers['accept-encoding'];
    if (!acceptEncoding) {
        acceptEncoding = '';
    }
    var zlibDeflate = null;
    var zlibGzip = null;
    if (acceptEncoding.match(/\bdeflate\b/)) {
        zlibDeflate = zlib.createDeflate();
        zlibDeflate.pipe(resp);
    } else if (acceptEncoding.match(/\bgzip\b/)) {
        zlibGzip = zlib.createGzip();
        zlibGzip.pipe(resp);
    }

    var wStream = zlibDeflate ? zlibDeflate : zlibGzip ? zlibGzip : resp;

    var totalCount = 0;
    downloader.on('end', function () {
        console.log("Finished... Total objects: " + totalCount);
        if (totalCount) {
            wStream.write(']');
            wStream.end();
        } else {
            resp.writeHead(503); // Service Unavailable
            resp.end();
        }
    });

    downloader.on('data', function (arrJson) {
        //console.log(arrJson);
        if (!totalCount) {
            if (zlibDeflate) {
                resp.writeHead(200, {'Content-Type': 'application/json; charset=UTF-8', 'content-encoding': 'deflate'});
            } else if (zlibGzip) {
                resp.writeHead(200, {'Content-Type': 'application/json; charset=UTF-8', 'content-encoding': 'gzip'});
            } else {
                resp.writeHead(200, {'Content-Type': 'application/json; charset=UTF-8'});
            }
            wStream.write('[');
        }

        arrJson.forEach(function (jsnObj) {
            if (totalCount)
                wStream.write(',');
            wStream.write(JSON.stringify(jsnObj));
        });
        totalCount += arrJson.length;
    });

    console.log("Started...");
    downloader.start();

    reqst.connection.on('close', function () {
        resp = null;
        downloader.abort(new Error('Request connection aborted!'));
    });
});

var port = 8083;
if (process.argv.length > 2) {
    var _p = Number(process.argv[2]);
    if (_p)
        port = _p;
}
server.listen(port, function () {
    var address = server.address();
    console.log("Server started: port %j", address.port);
});