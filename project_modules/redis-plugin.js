module.exports = function redisClientPlugin(redisClient) {
  function plugin(events, actions) {
    actions.getClient(async function(client_id) {
      console.log("stub action get clietn", client_id)
    }),
    events.onNewConnection(async function(client_id) {
      console.log("stub redis client pluging", client_id)
    })
  }

  return plugin;
}
