var request = require('request'),
    xml2js = require('xml2js'),
    concat = require('concat-stream'),
    events = require('events');

/// emitted
///  'error'
///  'end'
///  'data'
function DownloaderLatestNews() {
    this.aborted = false;
    this.idPage = 0;
    this.limit = undefined;

    events.EventEmitter.call(this);

    this.abort = function(err) {
        if (!this.aborted) {
            this.aborted = true;
            this.emit('error', err);
        }
    };

    this.start = function(limit)
    {
        this.limit = limit;
        this.nextStep();
    };

    this.nextStep = function() {
        var urlPrefix = 'http://flibusta.net';
        var url = urlPrefix + '/opds/new/' + this.idPage + '/new'; // http://flibusta.net/opds/new/0/new
        console.log('...load  page: ' + url);

        var r = request.get(url);
        var self = this;
        r.on('response', function (response) {
            if (response.statusCode !== 200) {
                self.abort(new Error("URL [" + url + "] return invalid response code " + response.statusCode));
                return;
            }
            if (response.headers['content-type'] !== "application/atom+xml;charset=utf-8") {
                self.abort(new Error("URL [" + url + "] return invalid content-type: " + response.headers['content-type']));
                return;
            }
        });
        r.pipe(concat(function (fullXml) {
            //process.stdout.write(fullXml);

            if (self.aborted)
                return;

            var parser = new xml2js.Parser();
            parser.parseString(fullXml, function (err, fullJson) {
                if (err) {
                    self.abort(err);
                    return;
                }

                //console.log(fullJson);

                var entries = fullJson.feed.entry;
                if (entries && entries.length) {
                    var transformedEntries = entries.map(function (entry) {
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
                    var resultJson = {
                        title: fullJson.feed.title.pop(),
                        updated: fullJson.feed.updated.pop(),
                        icon: urlPrefix + fullJson.feed.icon.pop(),
                        logo: urlPrefix + "/sites/default/files/bluebreeze_logo.png",
                        entries: transformedEntries
                    };
                    self.emit('data', resultJson);
                    if (!self.aborted) {
                        ++self.idPage;
                        if (self.limit && (self.idPage >= self.limit)) {
                            console.log('Limit... ' + self.limit);
                            self.aborted = true;
                            self.emit('end');
                        } else {
                            self.nextStep();
                        }
                    }
                    //console.log(resultJson);
                } else {
                    console.log('DONE...');
                    self.aborted = true;
                    self.emit('end');
                }
            });
        }));

        r.on('error', function (err) {
            self.abort(err);
        });

        //r.on('end', function () {
        //    console.log("end!!!!!!!!!");
        //});
    };
}

// Copies all of the EventEmitter properties to the DownloaderLatestNews object.
DownloaderLatestNews.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = DownloaderLatestNews;
