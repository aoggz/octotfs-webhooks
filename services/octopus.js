
var slack = require('./slack');

module.exports.sendMachineEventNotification = function(event, url) {
  console.log(event);

  slack.sendMessage(JSON.stringify({
    text: event.Payload.Event.Message,
    username: "Octopus",
    icon_url: "http://octopusdeploy.com/content/resources/favicon.png"
  }), url);
}