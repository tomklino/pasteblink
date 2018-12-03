const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require("sinon-chai");

const should = chai.should();
const expect = chai.expect;
chai.use(sinonChai);

const sessionHandler = require('../project_modules/session_handler.js')
const sessions = sessionHandler();

function makeFakeWs() {
  events = {};
  return {
    send: sinon.spy(),
    on(event, cb) {
      if(!events[event]) {
        events[event] = []
      }
      events[event].push(cb)
    },
    fakeEvent(event, arg) {
      if(!events[event]) {
        return;
      }
      events[event].forEach((cb) => {
        cb(arg);
      })
    }
  }
}

function makeFakeClient(client_id) {
  return {
    client_id,
    linkSession: sinon.spy(),
    ws: makeFakeWs()
  }
}

describe('session handler tests', () => {
  it('creates a new session', () => {
    let session_id = sessions.createNewSession();
    expect(session_id).to.be.a('number')
  })

  it('creates a session with a client id', () => {
    let session_id = sessions.createNewSession({ client: makeFakeClient(1) })
    expect(session_id).to.be.a('number')
  })

  it('creates a session and retrieve it', () => {
    let session_id = sessions.createNewSession({ client: makeFakeClient(2) })
    let session = sessions.getSession(session_id);
    expect(session).to.be.an('object')
  })

  it('creates a session, retrieves it, and who connected clients', () => {
    let session_id = sessions.createNewSession({ client: makeFakeClient(3) })
    let session = sessions.getSession(session_id)
    let clients = session.clients;
    expect(clients).to.be.an('array')
    expect(clients[0].client_id).to.eql(3)
  })

  it('creates a session, adds clients afterwards, then lists them', () => {
    let session_id = sessions.createNewSession()
    let session = sessions.getSession(session_id);
    session.addClient(makeFakeClient(4))
    session.addClient(makeFakeClient(5))
    let clients_ids = session.clients.map(client => client.client_id);
    expect(clients_ids).to.include(4)
    expect(clients_ids).to.include(5)
  })

  it('creates a session, then ends it', () => {
    let session_id = sessions.createNewSession();
    let session = sessions.getSession(session_id);
    session.ended = true;
    expect(session.ended).to.eql(true)
  })

  it('creates a session with 2 clients and sends a message from one to another', () => {
    let session_id = sessions.createNewSession()

    let session = sessions.getSession(session_id);
    let client_number_six = makeFakeClient(6)
    let client_number_seven = makeFakeClient(7)
    session.addClient(client_number_six)
    session.addClient(client_number_seven)
    session.sendToAllInSession({ message: 'hello', sender: 6 })
    expect(client_number_six.ws.send).to.not.have.been.calledWith('hello')
    expect(client_number_seven.ws.send).to.have.been.calledWith('hello')
  })

  it('creates a session, and when second client is added, notifies the first', () => {
    let client_number_eight = makeFakeClient(8);
    let client_number_nine = makeFakeClient(9);
    let session_id = sessions.createNewSession({ client: client_number_eight });
    let session = sessions.getSession(session_id);
    session.addClient(client_number_nine)
    clientEightFirstMessage = client_number_eight.ws.send.getCall(0).args[0]
    clientNineFirstMessage = client_number_nine.ws.send.getCall(0).args[0]
    expect(clientEightFirstMessage.type).to.eql('linked')
    expect(clientEightFirstMessage.session_active).to.eql(false)
    expect(clientNineFirstMessage.type).to.eql('linked')
    expect(clientNineFirstMessage.session_active).to.eql(true)
    expect(client_number_eight.linkSession).to.have.been.called
    expect(client_number_nine.linkSession).to.have.been.called
  })
})
