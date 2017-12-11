'use strict';

var metricsDb = require('./services/metricsDb');

module.exports.workItemUpdate = (event, context, callback) => {  
  
  var payload = JSON.parse(event.body);  
  console.log(payload);

  metricsDb.processWorkItemUpdate(payload)
    .then(error => callback(error, { statusCode: error ? 500 : 200 }));
};