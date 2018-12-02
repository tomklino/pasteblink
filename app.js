const express = require('express');
const WebSocket = require('ws');
const useragent = require('express-useragent');
const https = require('https');
const cookieSession = require('cookie-session');
const proxy = require('express-http-proxy');

const configLoader = require('./config-loader.js')

const config = configLoader({ home_dir: __dirname })
const smoke_tests = [];

function tearDown() {
  //TODO send disconnect messages to all connected clients
  process.exit(0)
}
process.on('SIGTERM', tearDown)
process.on('SIGINT', tearDown)

app = express();
app.use(cookieSession({
  secret: config.get('cookie_secret'),
  signed: true
}))
app.use(useragent.express());

app.get('/health', function(req, res) {
  res.end("healthy. version: 0.1")
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
  client.ws.send(JSON.stringify({
    type: 'linked',
    session_active: session.length > 1
  }))
  if(session.length > 1) {
    console.log('session has additional client(s) connected to it, letting them know...')
    session
      .filter(peer_id => peer_id !== client_id)
      .map(peer_id => all_clients[peer_id])
      .forEach((peer) => {
        peer.ws.send(JSON.stringify({
          type: 'linked',
          session_active: true
        }))
      })
  }
  return session_id;
}

function addNewClient({ ws }) {
  console.log((new Date()).toISOString(), " new websocket connection logged")
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
  ws.send(JSON.stringify({
    type: 'server-init',
    client_id: client.client_id
  }))
}

app.get('/client/:client_id', (req, res) => {
  if(req.useragent.browser === 'unknown') {
    console.log('unknown browser, may not be able to handle cookies. ignoring')
    res.send('')
    return;
  }
  const { client_id } = req.params;
  const { session_id } = req.session;
  console.log('/client:', client_id)
  if(!all_clients[client_id]) {
    console.log(`a client by the id ${client_id} is not currently connected`)
    res.status(400).send('NO CLIENT BY THAT ID')
    return;
  }
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

const proxy_to_frontend = proxy(config.get('frontend_server_address'))
app.use('/', proxy_to_frontend)

async function checkAndStartServer(port) {
  let wss;
  try {
    await Promise.all(smoke_tests.map(async (test) => { return await test() }))
  } catch(e) {
    console.error(`smoke tests did not pass: ${e.code}. terminating.`)
    process.exit(1);
  }
  if(config.get('tls')) {
    console.log('using tls')
    const fs = require('fs');

    let privateKey  = fs.readFileSync(config.get("private_key_file"), 'utf8');
    let certificate = fs.readFileSync(config.get("cert_file"), 'utf8');
    let credentials = { key: privateKey, cert: certificate };
    https.createServer(credentials, app).listen(port, () => {
      console.log(`server started, listening on port ${port}`)
      console.log(`websocket server on port ${config.get('ws_port')}`)
    });
    wssTlsServer = https.createServer(credentials)
    wss = new WebSocket.Server({ server: wssTlsServer });
    wssTlsServer.listen(config.get('ws_port'))
    redirectApp = express()
    redirectApp.get('*', (req, res) => {
      res.redirect(301, config.get('https_redirect_target'))
    })
    redirectApp.listen(config.get('non_tls_port'), () => {
      console.log("redirect app listening on " + config.get('non_tls_port'))
    })
  } else {
    app.listen(port, () => {
      console.log(`server started, listening on port ${port}`)
      console.log(`websocket server on port ${config.get('ws_port')}`)
    })
    wss = new WebSocket.Server({ port: config.get('ws_port') });
  }

  wss.on('connection', function connection(ws) {
    addNewClient({ ws })
    console.log('client list:', all_clients)
  });
}

checkAndStartServer(config.get('listen_port'))
