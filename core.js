var request = require('request'),
    xml2js = require('xml2js'),
    concat = require('concat-stream');

/*
var param_example = {
    aborted: false
    //, limit: 1
};
*/
var nextNews = function (param, cb) {
    if (param.idPage === undefined)
        param.idPage = 0;

    var url = 'http://flibusta.net/opds/new/' + param.idPage + '/new'; // http://flibusta.net/opds/new/0/new
    console.log('...load  page: ' + url);

    var r = request.get(url);
    r.on('response', function (response) {
        if (response.statusCode !== 200) {
            cb(new Error("URL [" + url + "] return invalid response code " + response.statusCode));
            return;
        }
        if (response.headers['content-type'] !== "application/atom+xml;charset=utf-8") {
            cb(new Error("URL [" + url + "] return invalid content-type: " + response.headers['content-type']));
            return;
        }
    });
    r.pipe(concat(function (fullXml) {
        //process.stdout.write(fullXml);

        if (param.aborted)
            return;

        var parser = new xml2js.Parser();
        parser.parseString(fullXml, function (err, fullJson) {
            if (err) {
                cb(err);
                return;
            }

            //console.log(fullJson);

            var entries = fullJson.feed.entry;
            if (entries && entries.length && (!param.limit || (param.idPage < param.limit))) {
                var transformedJson = entries.map(function (entry) {
                    //console.log(JSON.stringify(entry));
                    return {
                        updated: entry.updated.pop(),
                        idTagBook: Number(entry.id.pop().split(':').pop()),
                        title: entry.title.pop(),
                        author: !entry.author ? null : entry.author.pop().name.pop(),
                        categories: !entry.category ? [] : entry.category.map(function (category) {
                            return category['$'].term;
                        }),
                        content: entry.content.pop()['_']
                    };
                });
                cb(null, transformedJson);
                if (!param.aborted) {
                    ++param.idPage;
                    nextNews(param, cb);
                }
                //console.log(resultJson);
            } else {
                console.log('DONE...');
                param.aborted = true;
                cb(null, null);
            }
        });
    }));

    r.on('error', function (err) {
        cb(err);
    });

    //r.on('end', function () {
    //    console.log("end!!!!!!!!!");
    //});
};

module.exports = nextNews;
