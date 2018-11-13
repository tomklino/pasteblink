const express = require('express');
const configLoader = require('./config-loader.js')

const config = configLoader({ home_dir: __dirname })
const smoke_tests = [];
app = express();

app.get('/health', function(req, res) {
  res.end("healthy")
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
}

checkAndStartServer(config.get('listen_port'))
