const express = require('express');
const WebSocket = require('ws');
const useragent = require('express-useragent');
const https = require('https');
const http = require('http');
const cookieSession = require('cookie-session');
const proxy = require('express-http-proxy');
const clientHandler = require('./project_modules/client_handler.js')
const sessionHandler = require('./project_modules/session_handler.js')
const linkerInit = require('./project_modules/linker.js')
const fileSaver = require('./project_modules/file_saver.js')

const configLoader = require('./config-loader.js')

const config = configLoader({ home_dir: __dirname })
const smoke_tests = [];

function tearDown() {
  //TODO send disconnect messages to all connected clients
  process.exit(0)
}
process.on('SIGTERM', tearDown)
process.on('SIGINT', tearDown)

async function checkAndStartServer(port) {
  let wss, clientPlugins = [];
  app = express();

  const file_saver = fileSaver();
  app.use(file_saver.router);
  clientPlugins.push(file_saver.plugin);

  app.use(cookieSession({
    secret: config.get('cookie_secret'),
    signed: true
  }))
  app.use(useragent.express());

  app.get('/health', function(req, res) {
    res.end("healthy. version: 0.1")
  })

  if(config.get('https_redirect_target')) {
    app.use('/', (req, res, next) => {
      let fullHost = req.protocol + '://' + req.get('host')
      if(fullHost !== config.get('https_redirect_target')) {
        console.log(`fullHost (${fullHost}) is not the target host (${config.get('https_redirect_target')}). redirecting`)
        res.redirect(301, config.get('https_redirect_target'))
      }
      next();
    })
  }

  const clients = clientHandler({
    plugins: clientPlugins
  });
  const sessions = sessionHandler();
  const linker = linkerInit({ sessions, clients })
  app.use(linker)

  const proxy_to_frontend = proxy(config.get('frontend_server_address'))
  app.get(['/connector/*', '/welcome'], (req, res) => {
    http.get(`http://${config.get('frontend_server_address')}/`, (proxy_res) => {
      proxy_res.pipe(res)
    })
  })
  app.use('/', proxy_to_frontend)

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

  wss.on('connection', async function connection(ws) {
    await clients.createNewClient({ ws })
    console.log('new websocket connection')
  });
}

checkAndStartServer(config.get('listen_port'))
