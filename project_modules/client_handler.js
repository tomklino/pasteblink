const debug = require('nice_debug')('CLIENT_HANDLER_DEBUG')
const randomstring = require("randomstring");

const clients = {};
let client_id_counter;

function generateClientId() {
  return `C-${randomstring.generate(3)}`
}

module.exports = function init(context) {
  const { plugins = [] } = context || {};
  client_id_counter = 1;

  const lifeCycleHooks = loadPlugins(plugins)

  return initClientMethods(lifeCycleHooks)
}

function initClientMethods(lifeCycleHooks) {
  async function createNewClient({ ws }) {
    let client = new Client({ ws, lifeCycleHooks })
    clients[client.client_id] = client;
    await lifeCycleHooks.clientCreated(client);
    return client.client_id;
  }

  async function getClient(client_id) {
    if(!clients[client_id]) {
      return await lifeCycleHooks.getClient(client.client_id)
    }
    return clients[client_id]
  }

  return {
    createNewClient,
    getClient
  }
}

function loadPlugins(plugins) {
  const eventBindings = {
    onClientCreated: [],
    onMessage: [],
    onConnectionClosed: []
  }

  const actionBindings = {
    getClient: () => { return null },
    createNewClient: () => { return null }
  }

  const actions = {
    getClient(binding) {
      if(typeof binding === 'function') {
        actionBindings.getClient = binding;
      }
    },
    createNewClient(binding) {
      if(typeof binding === 'function') {
        actionBindings.createNewClient = binding;
      }
    }
  }

  const events = {
    onClientCreated(binding) {
      eventBindings.onClientCreated.push(binding)
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
  return new LifeCycleHooks({ eventBindings, actionBindings });
}

class LifeCycleHooks {
  constructor({ eventBindings, actionBindings }) {
    this.eventBindings = eventBindings;
    this.actionBindings = actionBindings;
  }

  clientCreated(client) {
    this.eventBindings.onClientCreated.forEach((binding) => {
      binding(client)
    })
  }

  message(client_id, message) {
    this.eventBindings.onMessage.forEach((binding) => {
      binding(client_id, message)
    })
  }

  connectionClosed(client_id) {
    this.eventBindings.onConnectionClosed.forEach((binding) =>{
      binding(client_id)
    })
  }

  async getClient(client_id) {
    return await this.actionBindings.getClient(client_id)
  }

  async createNewClient(client_id) {
    return await this.actionBindings.createNewClient(client_id)
  }
}

class Client {
  constructor({ ws, lifeCycleHooks }) {
    this.ws = ws;
    this.client_id = generateClientId();
    this.ws.on('close', () => {
      if(this.in_session) {
        this.session.end();
        this.in_session = false;
      }
      lifeCycleHooks.connectionClosed(this.client_id)
    })
    this.ws.send(JSON.stringify({
      type: 'server-init',
      client_id: this.client_id
    }))
    this.ws.on('message', (data) => {
      debug(2, "message event from ", this.client_id)
      let message = JSON.parse(data);
      if(this.in_session) {
        if(message.type === 'peer_message') {
          this.session.sendToAllInSession({
            message,
            sender: this.client_id
          })
        } else {
          debug(2, "type is not 'peer_message' - ignoring message")
        }
      }

      lifeCycleHooks.message(this, message)
    })

    this.in_session = false;
    this.session = null;
    client_id_counter = client_id_counter + 1;
  }

  send(data) {
    this.ws.send(typeof data === "string" ? data : JSON.stringify(data))
  }

  linkSession({ session }) {
    this.in_session = true;
    this.session = session;
  }
}
