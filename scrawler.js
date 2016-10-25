var system = require('system');
var fs = require('fs');

if(system.args.length === 4) {
    console.warn("You must specify an url");
    phantom.exit(1);
}

var startUrl = system.args[4];

// URL variables
var visitedUrls = [], pendingUrls = [], emails = [];

// Create instances
var casper = require('casper').create({ /*verbose: true, logLevel: 'debug'*/ });
var utils = require('utils');
var helpers = require('./helpers');

var addInFile = function(content, file) {
    var stream = fs.open(file,'aw');
    stream.writeLine(content);
    stream.flush();
    stream.close();
};

// Spider from the given URL
function spider(url) {

    // Add the URL to the visited stack
    visitedUrls.push(url);

    // Open the URL
    casper.open(url).then(function() {

        // Set the status style based on server status code
        var status = this.status().currentHTTPStatus;
        switch(status) {
            case 200: var statusStyle = { fg: 'green', bold: true }; break;
            case 404: var statusStyle = { fg: 'red', bold: true }; break;
            default: var statusStyle = { fg: 'magenta', bold: true }; break;
        }

        // Display the spidered URL and status
        this.echo(this.colorizer.format(status, statusStyle) + ' ' + url);

        // Search on content if an email exist
        var matched = this.getPageContent().match(/(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/g);

        if(matched !== null) {
            if(emails.indexOf(matched[0])) {
                console.log('New mail added: ' + matched[0]);

                addInFile(matched[0], 'csv/quotes.csv');

                emails.push(matched[0]);
            }
        }

        // Find links present on this page
        var links = this.evaluate(function() {
            var links = [];

            Array.prototype.forEach.call(__utils__.findAll('a'), function(e) {
                var link = e.getAttribute('href');
                links.push(link);
            });

            return links;
        });

        // Add newly found URLs to the stack
        var baseUrl = this.getGlobal('location').origin;

        Array.prototype.forEach.call(links, function(link) {
            var newUrl = helpers.absoluteUri(baseUrl, link);

            if(newUrl.indexOf('mailto:') === 0 && emails.indexOf(newUrl.substr(newUrl.indexOf(':') + 1))) {
                var email = newUrl.substr(newUrl.indexOf(':') + 1);
                console.log('New mail added: ' + email);

                addInFile(email, 'csv/quotes.csv');

                emails.push(email)
            }

            if (pendingUrls.indexOf(newUrl) == -1 && visitedUrls.indexOf(newUrl) == -1) {
                //casper.echo(casper.colorizer.format('-> Pushed ' + newUrl + ' onto the stack', { fg: 'magenta' }));
                pendingUrls.push(newUrl);
            }
        });

        // If there are URLs to be processed
        if (pendingUrls.length > 0) {
            var nextUrl = pendingUrls.shift();
            //this.echo(this.colorizer.format('<- Popped ' + nextUrl + ' from the stack', { fg: 'blue' }));
            spider(nextUrl);
        }
    });

}

// Start spidering
casper.start(startUrl, function() {
    spider(startUrl);
});

// Start the run
casper.run();