const router = require('express').Router()

module.exports = function({ sessions, clients }) {
  router.get('/client/:client_id', async (req, res, next) => {
    if(req.useragent.browser === 'unknown') {
      console.log('unknown browser, may not be able to handle cookies. ignoring')
      res.send('')
      return;
    }
    const { client_id } = req.params;
    let { session_id } = req.session;

    const client = await clients.getClient(client_id)
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

  return router;
}
