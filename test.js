var DownloaderLatestNews = require('./core');

var downloader = new DownloaderLatestNews();

downloader.on('data', function(arrJson) {
    //console.log(arrJson);
});

downloader.on('error', function(err) {
    console.error(err);
    console.error("TEST failed...");
});

downloader.on('end', function() {
    console.log("TEST finished...");
});

console.log("TEST started...");
downloader.start(2);
