const debug = require('nice_debug')('CLIENT_HANDLER_DEBUG')
const clients = {};
let client_id_counter;

module.exports = function init() {
  client_id_counter = 1;

  return {
    createNewClient,
    getClient
  }
}

function createNewClient({ ws }) {
  let client = new Client({ ws })
  clients[client.client_id] = client;
  return client.client_id;
}

function getClient(client_id) {
  if(!clients[client_id]) {
    return null;
  }
  return clients[client_id]
}

class Client {
  constructor({ ws }) {
    this.ws = ws;
    this.ws.on('close', () => {
      if(this.in_session) {
        this.session.end();
        this.in_session = false;
      }
    })
    this.client_id = client_id_counter;
    this.ws.send(JSON.stringify({
      type: 'server-init',
      client_id: this.client_id
    }))
    this.ws.on('message', (data) => {
      debug(2, "message event from ", this.client_id)
      let message = JSON.parse(data);
      if(message.type !== 'peer_message') {
        debug(2, "type is not 'peer_message' - ignoring message")
        return;
      }
      if(this.in_session) {
        this.session.sendToAllInSession({
          message,
          sender: this.client_id
        })
      }
    })
    this.in_session = false;
    this.session = null;
    client_id_counter = client_id_counter + 1;
  }

  linkSession({ session }) {
    this.in_session = true;
    this.session = session;
  }
}
