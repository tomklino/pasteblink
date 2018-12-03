const sessions = {}
let session_id_counter;
module.exports = function init() {
  session_id_counter = 1;
  return {
    createNewSession,
    getSession
  }
}

function getSession(session_id) {
  if(!sessions[session_id]) {
    return null;
  }

  return sessions[session_id];
}

function createNewSession(args) {
  const { client } = args || {};
  session = new Session()
  if(client) {
    session.addClient(client)
  }
  session_id = session_id_counter;
  session_id_counter = session_id_counter + 1;
  sessions[session_id] = session;

  return session_id;
}

class Session {
  constructor() {
    this.ended = false;
    this.clients = [];
  }

  addClient(client) {
    this.clients.push(client)
    client.linkSession({ session: this })
    this.sendToAllInSession({ message: {
      type: 'linked',
      session_active: this.clients.length > 1
    }})
  }

  sendToAllInSession({ message, sender }) {
    this.clients.filter((client) => {
      return client.client_id !== sender
    }).forEach((client) => {
      client.ws.send(JSON.stringify(message))
    })
  }

  end() {
    this.ended = true;
  }
}
