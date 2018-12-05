const express = require('express');
const WebSocket = require('ws');
const useragent = require('express-useragent');
const https = require('https');
const cookieSession = require('cookie-session');
const proxy = require('express-http-proxy');
const clientHandler = require('./project_modules/client_handler.js')
const sessionHandler = require('./project_modules/session_handler.js')

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

const clients = clientHandler();
const sessions = sessionHandler();

app.get('/client/:client_id', (req, res) => {
  if(req.useragent.browser === 'unknown') {
    console.log('unknown browser, may not be able to handle cookies. ignoring')
    res.send('')
    return;
  }
  const { client_id } = req.params;
  let { session_id } = req.session;

  const client = clients.getClient(client_id)
  if(!client) {
    console.log(`trying to connect client_id ${client_id}, but no client by that id is currently connected`)
    res.status(500).send('The client you are trying to link is not connected, try refreshing the page to get a new barcode')
    return;
  }
  if(!session_id) {
    console.log("no session cookie, creating new session")
    session_id = sessions.createNewSession({ client })
    req.session.session_id = session_id;
    res.send('OK - Now scan the second device you wish to communicate with');
  } else {
    console.log(`session_id found in cookie ${session_id}`)
    let session = sessions.getSession(session_id)
    if(!session || session.ended) {
      console.log(`the session_id in the cookie is invalid - creating a new sesion instead`)
      session_id = sessions.createNewSession({ client })
      req.session.session_id = session_id;
      res.send('OK - Now scan the second device you wish to communicate with');
      return;
    }
    session.addClient(client);
    console.log(`added client ${client_id} to session ${session_id}`)
    console.log('resetting session cookie')
    req.session = null;
    res.send('OK')
  }
})

if(config.get('https_redirect_target')) {
  app.use('/', (req, res, next) => {
    let fullHost = req.protocol + '://' + req.get('host')
    if(req.hostname !== config.get('https_redirect_target')) {
      res.redirect(301, config.get('https_redirect_target'))
    }
    next();
  })
}
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
    clients.createNewClient({ ws })
  });
}

checkAndStartServer(config.get('listen_port'))
