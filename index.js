//console.log(process.argv);
//console.log('-------------------');

var zlib = require('zlib'),
    http = require('http'),
    url = require('url'),
    js2xmlparser = require("js2xmlparser");
var DownloaderLatestNews = require('./core');

var serverListener = function (reqst, resp) {
    if (reqst.method !== 'GET') {
        resp.writeHead(404, {'content-type': 'text/plain'});
        resp.end("Illegal request method: " + reqst.method);
        console.error("Illegal request method: " + reqst.method);
        return;
    }

    { // routers
        var p = url.parse(reqst.url, true);
        var urlPathName = p.pathname;
        if (urlPathName === '/latest_news') {
            var asXml = (p.query.xml !== undefined);
            return serverListener_LatestNews(reqst, resp, asXml);
        }
    }

    resp.writeHead(404, {'content-type': 'text/plain'});
    resp.end("Bad pathname: '" + urlPathName + "';  known only '/latest_news' or '/latest_news?xml'");
    console.error("Bad pathname: " + urlPathName);
};

var serverListener_LatestNews = function (reqst, resp, asXml) {

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
    var jsonRespForXml;
    downloader.on('end', function () {
        console.log("Finished... Total objects: " + totalCount);
        if (totalCount) {
            if (asXml) {
                var xml = js2xmlparser("latest", jsonRespForXml);
                wStream.write(xml);
            } else {
                wStream.write(']}'); // close array and close object
            }
            wStream.end();
        } else {
            resp.writeHead(503); // Service Unavailable
            resp.end();
        }
    });

    downloader.on('data', function (resultJson) {
        //console.log(resultJson);
        var entries = resultJson.entries;
        if (!totalCount) {
            var ct = 'application/' + (asXml ? 'xml' : 'json') + '; charset=UTF-8';
            if (zlibDeflate) {
                resp.writeHead(200, {'Content-Type': ct, 'content-encoding': 'deflate'});
            } else if (zlibGzip) {
                resp.writeHead(200, {'Content-Type': ct, 'content-encoding': 'gzip'});
            } else {
                resp.writeHead(200, {'Content-Type': ct});
            }

            if (asXml) {
                jsonRespForXml = resultJson;
                jsonRespForXml.entries = {entry: entries}; // hack to transform to xml
            } else {
                wStream.write('{"title":' + JSON.stringify(resultJson.title));
                wStream.write(',"updated":' + JSON.stringify(resultJson.updated));
                wStream.write(',"icon":' + JSON.stringify(resultJson.icon));
                wStream.write(',"logo":' + JSON.stringify(resultJson.logo));
                wStream.write(',"entries":[');
            }
        }

        entries.forEach(function (entry) {
            if (asXml) {
                entry.categories = {category: entry.categories}; // hack to transform to xml
                jsonRespForXml.entries.entry.push(entry);
            } else {
                if (totalCount)
                    wStream.write(',');
                wStream.write(JSON.stringify(entry));
            }
            ++totalCount;
        });
    });

    console.log("Started...");
    downloader.start(2);

    reqst.connection.on('close', function () {
        resp = null;
        downloader.abort(new Error('Request connection aborted!'));
    });
};


var port = 8083;
if (process.argv.length > 2) {
    var _p = Number(process.argv[2]);
    if (_p)
        port = _p;
}
var server = http.createServer(serverListener);
server.listen(port, function () {
    var address = server.address();
    console.log("Server started: port %j", address.port);
});