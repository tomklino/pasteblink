const express = require('express');
const WebSocket = require('ws');
const cookieSession = require('cookie-session');

const configLoader = require('./config-loader.js')

const config = configLoader({ home_dir: __dirname })
const smoke_tests = [];
app = express();
app.use(cookieSession({
  secret: config.get('cookie_secret'),
  signed: true
}))

const wss = new WebSocket.Server({ port: 8888 });

app.get('/health', function(req, res) {
  res.end("healthy")
})

const all_clients = {};
const all_sessions = {};
let current_session_id = 1;
let current_id = 1;

function createNewSession() {
  //session is an array of client ids
  const session = [];
  const session_id = current_session_id
  all_sessions[session_id] = session;
  current_session_id++;
  return session_id;
}

function sendToAllInSession({ message, session_id, sender }) {
  const recepients =
    all_sessions[session_id]
    .filter(client_id => client_id !== sender)
    .map(client_id => all_clients[client_id])

  recepients.forEach((recepient) => {
    recepient.ws.send(message)
  })
}

function addToSession({ client_id, session_id }) {
  if(!session_id) {
    session_id = createNewSession();
  }
  const session = all_sessions[session_id];
  const client = all_clients[client_id];
  client.in_session_id = session_id;
  client.in_session = true;
  client.ws.on('message', function(data) {
    sendToAllInSession({
      message: data,
      session_id: client.in_session_id,
      sender: client_id
    })
  })
  session.push(client_id)
  return session_id;
}

function addNewClient({ ws }) {
  const client = {
    client_id: current_id
  }
  current_id++;

  all_clients[client.client_id] = client;
  ws.on('close', function() {
    delete all_clients[client.client_id]
    console.log("connection closed: " + client.client_id)
  })
  client.ws = ws;
}

app.get('/client/:client_id', (req, res) => {
  const { client_id } = req.params;
  const { session_id } = req.session;
  console.log('/client:', client_id)
  if(!all_clients[client_id]) {
    console.log(`a client by the id ${client_id} is not currently connected`)
    res.status(400).send('NO CLIENT BY THAT ID')
    return;
  }
  console.log(require('util').inspect(all_clients[client_id], { depth: null }));
  if(all_clients[client_id].in_session) {
    console.log(`client ${client_id} is already in session`);
    res.status(400).send('CLIENT IS ALREADY IN SESSION');
    return;
  }
  if(session_id) {
    console.log('session id is already defined in cookie:', session_id);
    addToSession({ client_id, session_id })
    console.log('attaching client to session. destroying linker session cookie')
    req.session = null;
  } else {
    let session_id = addToSession({ client_id });
    console.log('setting cookie');
    req.session.session_id = session_id;
  }
  console.log("all_sessions:")
  console.log(require('util').inspect(all_sessions, { depth: null }));
  res.send('OK')
})

app.use(function(req, res) {
  res.status(404).send()
})


async function checkAndStartServer(port) {
  try {
    await Promise.all(smoke_tests.map(async (test) => { return await test() }))
  } catch(e) {
    console.error(`smoke tests did not pass: ${e.code}. terminating.`)
    process.exit(1);
  }
  app.listen(port, () => {
    console.log(`server started, listening on port ${port}`)
  })
  wss.on('connection', function connection(ws) {
    addNewClient({ ws })
    console.log('client list:', all_clients)
  });
}

checkAndStartServer(config.get('listen_port'))