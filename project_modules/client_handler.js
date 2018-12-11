const debug = require('nice_debug')('CLIENT_HANDLER_DEBUG')
const clients = {};
let client_id_counter;

module.exports = function init(context) {
  const { plugins } = context || {};
  client_id_counter = 1;

  const { eventBindings, actionBindings } = Array.isArray(plugins) ?
    loadPlugins(plugins) :
    { eventBindings: {}, actionBindings: {} };

  return initClientMethods({ eventBindings, actionBindings })
}

function loadPlugins(plugins) {
  const eventBindings = {
    onNewConnection: [],
    onMessage: [],
    onConnectionClosed: []
  }

  const actionBindings = {
    getClient: null,
    createNewClient: null
  }

  const actions = {
    getClient(binding) {
      actionBindings.getClient = binding;
    },
    createNewClient(binding) {
      actionBindings.createNewClient = binding;
    }
  }

  const events = {
    onNewConnection(binding) {
      eventBindings.onNewConnection.push(binding)
    },
    onMessage(binding) {
      eventBindings.onMessage.push(binding)
    },
    onConnectionClosed(binding) {
      eventBindings.onConnectionClosed.push(binding)
    }
  }

  plugins.forEach((plugin) => {
    plugin(events, actions)
  })

  debug(5, "eventBindings:", eventBindings, "actionBindings:", actionBindings)
  return { eventBindings, actionBindings };
}

function initClientMethods({ eventBindings, actionBindings }) {
  async function createNewClient({ ws }) {
    let client = new Client({ ws, eventBindings })
    clients[client.client_id] = client;
    if(typeof actionBindings.createNewClient === 'function') {
      return await actionBindings.createNewClient(client_id)
    }
    return client.client_id;
  }

  async function getClient(client_id) {
    if(!clients[client_id]) {
      if(typeof actionBindings.getClient === 'function') {
        return await actionBindings.getClient(client_id)
      }
      return null;
    }
    return clients[client_id]
  }

  return {
    createNewClient,
    getClient
  }
}

class Client {
  constructor({ ws, eventBindings = {} }) {
    this.ws = ws;
    this.eventBindings = eventBindings;
    this.client_id = client_id_counter; //TODO generate client_id randomly
    this.ws.on('close', () => {
      if(this.in_session) {
        this.session.end();
        this.in_session = false;
      }
      if(Array.isArray(this.eventBindings.onConnectionClosed)) {
        this.eventBindings.onConnectionClosed.forEach((binding) => {
          binding(client_id)
        })
      }
    })
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

      if(Array.isArray(this.eventBindings.onMessage)) {
        this.eventBindings.onMessage.forEach((binding) => {
          binding(client_id, message)
        })
      }
    })

    this.in_session = false;
    this.session = null;
    client_id_counter = client_id_counter + 1;

    if(Array.isArray(this.eventBindings.onNewConnection)) {
      this.eventBindings.onNewConnection.forEach((binding) => {
        binding(this.client_id)
      })
    }
  }

  send(data) {
    this.ws.send(data)
  }

  linkSession({ session }) {
    this.in_session = true;
    this.session = session;
  }
}
