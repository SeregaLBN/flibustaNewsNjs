//console.log(process.argv);
//console.log('-------------------');

var request = require('request'),
    xml2js = require('xml2js'),
    concat = require('concat-stream'),
    http = require('http');
    url = require('url');

var nextNews = function(param) {
    var url = 'http://flibusta.net/opds/new/'+param.idPage+'/new'; // http://flibusta.net/opds/new/0/new
    console.log('...load  page: ' + url);

    var r = request.get(url);
    r.on('response', function(response) {
        if (response.statusCode !== 200) {
            param.aborted = true;
            param.httpResponse.writeHead(response.statusCode, {'content-type': 'text/plain'});

            console.error("URL ["+url+"] return invalid response code " + response.statusCode);
            param.httpResponse.write("URL ["+url+"] return invalid response code " + response.statusCode);
            if (response.statusText)
                param.httpResponse.write(' - ' + response.statusText);
            param.httpResponse.end();
            return;
        }

        if (response.headers['content-type'] !== "application/atom+xml;charset=utf-8") {
            param.aborted = true;
            param.httpResponse.writeHead(500, {'content-type': 'text/plain'});
            param.httpResponse.end("URL ["+url+"] return invalid content-type: " + response.headers['content-type']);
            console.error("URL ["+url+"] return invalid content-type: " + response.headers['content-type']);
            return;
        }
    });
    r.pipe(concat(function(fullXml) {
        //process.stdout.write(fullXml);

        if (param.aborted)
            return;

        var parser = new xml2js.Parser();
        parser.parseString(fullXml, function (err, fullJson) {
            if (err) {
                console.error(err);
                param.httpResponse.writeHead(500, {'Content-Type': 'application/json; charset=UTF-8'});
                param.httpResponse.end(JSON.stringify(err));
                return;
            }

            //console.log(fullJson);

            if (!param.idPage) {
                param.httpResponse.writeHead(200, {'Content-Type': 'application/json; charset=UTF-8'});
                param.httpResponse.write('['); // open array
                //param.test = '[';
            }

            var entries = fullJson.feed.entry;
            if (entries && entries.length && (!param.limit || (param.idPage < param.limit))) {
                var any = false;
                entries.forEach(function (entry) {
                    //console.log(JSON.stringify(entry));
                    var jsObj = {
                        updated: entry.updated.pop(),
                        idTagBook: Number(entry.id.pop().split(':').pop()),
                        title: entry.title.pop(),
                        author: !entry.author ? null : entry.author.pop().name.pop(),
                        categories: [],
                        content: entry.content.pop()['_']
                    };
                    if (entry.category)
                    entry.category.forEach(function(category) {
                        jsObj.categories.push(category['$'].term);
                    });
                    if (param.idPage || any) {
                        param.httpResponse.write(','); // js separator to next object
                        //param.test += ',';
                    }
                    any = true;
                    param.httpResponse.write(JSON.stringify(jsObj));

                    //param.test += JSON.stringify(jsObj);
                });
                if (!param.aborted) {
                    ++param.idPage;
                    nextNews(param);
                }
                //console.log(resultJson);
            } else {
                console.log('DONE...');
                param.httpResponse.end(']');
                param.aborted = true;
                //param.test += ']';
                //console.log(JSON.parse(param.test));
            }
        });
    }));

    r.on('error', function(err) {
        console.error(err);
        param.httpResponse.writeHead(500, {'Content-Type': 'application/json; charset=UTF-8'});
        param.httpResponse.end(JSON.stringify(err));
    });

    //r.on('end', function () {
    //    console.log("end!!!!!!!!!");
    //});
};

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
        aborted: false,
        idPage: 0,
        httpResponse: resp
        //, limit: 1
    };
    nextNews(param);

    reqst.connection.on('close', function() {
        if (param.aborted)
            return;
        param.aborted = true;
        console.error('Request connection aborted!');
    });
});

server.listen(8083);
console.log("Server has started.");


