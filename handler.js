'use strict';

var metricsDb = require('./services/metricsDb'),
  octopus = require('./services/octopus');

module.exports.workItemUpdate = (event, context, callback) => {  
  
  var payload = JSON.parse(event.body);  
  console.log(payload);

  metricsDb.processWorkItemUpdate(payload)
    .then(error => callback(error, { statusCode: error ? 500 : 200 }));
};

module.exports.sendMachineEventAlert = (event, context, callback) => {
  console.log(process.env.slackMachineEventWebhookUrl);
  octopus.sendMachineEventNotification(JSON.parse(event.body), process.env.slackMachineEventWebhookUrl);
  
  callback(null, { statusCode: 200 });
}