var param = {
    aborted: false,
    limit: 2
};

console.log("TEST started...");
var transfer = require('./core')(
    param,
    function (err, arrJson) {
        if (err) {
            param.aborted = true;
            console.error(err);
            console.error("TEST failed...");
            return;
        }

        if (!arrJson) {
            console.log("TEST finished...");
            return;
        }

        console.log(arrJson);
    });