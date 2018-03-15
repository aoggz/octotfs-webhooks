
var https = require('https');
var slackify = require('slackify-html');

module.exports.sendMessage = function(message, webHookUrlPath) {
  try {
    var request = https.request({
      host: 'hooks.slack.com',
      port: '443',
      path: webHookUrlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(message)
      }
    });

    request.write(message);
    request.end();
  } catch (err) {
    console.error(err);
    throw err;
  }
}