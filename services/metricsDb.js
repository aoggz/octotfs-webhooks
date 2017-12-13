
var sql = require('mssql');

module.exports.processWorkItemUpdate = (event) => {

    console.log(JSON.stringify(event));

  if (event && event.resource && event.resource.fields && event.resource.fields['System.State']) {

        console.log("State change processing.")
    
        var stateChange = event.resource.fields['System.State'];
        var oldValue = stateChange.oldValue
            ? stateChange.oldValue
            : null;
        var newValue = stateChange.newValue
            ? stateChange.newValue
            : stateChange;
    
        var tfsWorkItemId = event.resource.workItemId
            ? event.resource.workItemId
            : event.resource.id;
        var tfsAreaPath = event.resource.fields['System.AreaPath']
            ? event.resource.fields['System.AreaPath']
            : event.resource.revision.fields['System.AreaPath'];
    
        var tfsUserId = event.resource.revisedBy
            ? event.resource.revisedBy.id
            : null;
        var tfsUserFullName = event.resource.revisedBy
            ? event.resource.revisedBy.name
            : event.resource.fields['System.CreatedBy'];

        console.log(tfsUserFullName);
    
        var teamId,
            workItemId,
            newStateId,
            oldStateId,
            userId,
            errorMessage;
        
        return sql.connect(getDbConfig())
        .then(pool => {
    
            return Promise.all([
                getTeamId(tfsAreaPath, pool).then(id => teamId = id)
                  .then(() => getWorkItemId(tfsWorkItemId, teamId, pool).then(id => workItemId = id)),
                getStateId(newValue, pool).then(id => newStateId = id),
                getStateId(oldValue, pool).then(id => oldStateId = id),
                getUserId(tfsUserId, tfsUserFullName, pool).then(id => userId = id)
            ])
            .then(() => saveStateChangeRecord(workItemId, newStateId, oldStateId, userId, pool))
            .then(() => console.log(`Created state change record for work item ${tfsWorkItemId} changing from ${oldValue} to ${newValue}.`))
            // .then(() => slack.sendMessage(
            //     JSON.stringify({ text: slackify(event.message.html)}), 
            //     process.env.slackWebhookUrl)
            // )
            .catch(err => errorMessage = err)
            .then(() => sql.close())
            .then(() => { return errorMessage });
        })
        .catch(err => errorMessage = err)
        .then(() => sql.close())
        .then(() => { return errorMessage });
    }

    return Promise.resolve();
}
    
function getStateId(state, sqlConnectionPool) {
  return state ? getItemId(
    "state",
    state,
    `SELECT TOP 1 Id FROM WorkItemStates WHERE StateName = '${state}'`,
    `INSERT INTO WorkItemStates (StateName) VALUES ('${state}')`,
    sqlConnectionPool
  )
  : Promise.resolve();
}
    
function getUserId(tfsUserId, fullName, sqlConnectionPool) {

    var lastIndex = fullName.indexOf(" <");
    if (lastIndex) {
        fullName = fullName.substring(0, lastIndex);
    }

    var query = tfsUserId && tfsUserId != null
        ? `SELECT TOP 1 Id FROM Users WHERE TfsUserId = '${tfsUserId}'`
        : `SELECT TOP 1 Id FROM Users WHERE Name = '${fullName}'`;    

      return getItemId(
        "user",
        tfsUserId,
        query,
        `INSERT INTO Users (TfsUserId, Name) VALUES ('${tfsUserId}', '${fullName}')`,
        sqlConnectionPool,
        true
    );
    }
    
    function getWorkItemId(tfsWorkItemId, teamId, sqlConnectionPool) {
    return getItemId(
        "work item",
        tfsWorkItemId,
        `SELECT TOP 1 Id FROM WorkItems WHERE TfsWorkItemId = ${tfsWorkItemId}`,
        `INSERT INTO WorkItems (TfsWorkItemId, TeamId) VALUES (${tfsWorkItemId}, ${teamId})`,
        sqlConnectionPool
    );
    }
    
    function getTeamId(tfsAreaPath, sqlConnectionPool) {
    return getItemId(
        "team",
        tfsAreaPath,
        `SELECT TOP 1 Id FROM Teams WHERE TfsAreaPath = '${tfsAreaPath}'`,
        `INSERT INTO Teams (Name, TfsAreaPath) VALUES ('Unknown', '${tfsAreaPath}')`,
        sqlConnectionPool,
        true
    );
    }
    
    function saveStateChangeRecord(workItemId, newStateId, oldStateId, userId, sqlConnectionPool) {
    
    const oldStateValue = oldStateId ? oldStateId.toString() : "null";
    
    return sqlConnectionPool
        .request()
        .query(`INSERT INTO WorkItemStateChanges (WorkItemId, StateChangedToId, StateChangedFromId, ChangedByUserId) 
                VALUES (${workItemId}, ${newStateId}, ${oldStateValue}, ${userId})`);
    }
    
function getItemId(itemType, value, selectQuery, insertQuery, sqlConnectionPool, sendCreateNotification = false) {

  console.log(`Searching for ${itemType} ${value}...`);

  return sqlConnectionPool.request().query(selectQuery)
  .then(r => { 

    if (r && r.recordset && r.recordset[0] && r.recordset[0].Id) {
        console.log(`Located ${itemType} ${r.recordset[0].Id.toString()} representing ${value}.`);
        return Promise.resolve(r.recordset[0].Id);
    }

    console.log(`No matching ${itemType} representing ${value} found. Creating...`)

    return sqlConnectionPool.request().query(`${insertQuery}; SELECT SCOPE_IDENTITY() [Id]`)
        .then(r2 => {
            var message = `Created ${itemType} ${r2.recordset[0].Id.toString()} representing ${value}.`;
            console.log(message); 

            if (sendCreateNotification) {
                sendDataCleanupRequiredNotification(`${message}. Clean up data, as needed`, context)
            }

            return Promise.resolve(r2.recordset[0].Id)
        });  
    });

}
    
function getDbConfig() {
  return {
      server: process.env.sqlServer,
      database: process.env.sqlDatabase,
      user: process.env.sqlUser,
      password: process.env.sqlPassword,
      port: 1433,
      options: {
          encrypt: true
      }
  };
}
