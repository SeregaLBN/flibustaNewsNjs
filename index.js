//console.log(process.argv);
//console.log('-------------------');

var http = require('http');
    url = require('url');

var server = http.createServer(function requestListenerCallback(reqst, resp) {
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

    var param = {
        aborted: false
        //, limit: 1
    };

    console.log("Started...");
    var totalCount = 0;
    var transfer = require('./core')(
        param,
        function (err, arrJson) {
            if (err) {
                param.aborted = true;
                console.error(err);
                resp.writeHead(500, {'Content-Type': 'application/json; charset=UTF-8'});
                resp.end(JSON.stringify(err));
                return;
            }

            if (!arrJson) {
                console.log("Finished...");
                if (totalCount) {
                    resp.end(']');
                } else {
                    resp.writeHead(503); // Service Unavailable
                    resp.end();
                }
                return;
            }

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

    reqst.connection.on('close', function() {
        if (param.aborted)
            return;
        param.aborted = true;
        console.error('Request connection aborted!');
    });
});

server.listen(8083);
console.log("Server has started.");


