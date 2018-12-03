const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require("sinon-chai");

const should = chai.should();
const expect = chai.expect;
chai.use(sinonChai);

const clientHandler = require('../project_modules/client_handler.js')
const clients = clientHandler();

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
    fakeEvent(event) {
      if(!events[event]) {
        return;
      }
      events[event].forEach((cb) => {
        cb();
      })
    }
  }
}

describe('client handler tests', () => {
  it('creates a new client', () => {
    let fakeWs = makeFakeWs()
    let client_id = clients.createNewClient({ ws: fakeWs })
    expect(client_id).to.be.a('number')
    sendSpyFirstMessage = fakeWs.send.getCall(0).args[0]
    expect(sendSpyFirstMessage.type).to.eql('server-init')
    expect(sendSpyFirstMessage.client_id).to.be.a('number')
  })

  it('creates new client and links it to a fake session', () => {
    let fakeWs = makeFakeWs();
    let client_id = clients.createNewClient({ ws: fakeWs })

    client = clients.getClient(client_id)
    let fakeSession = {
      clients: [client_id],
      ended: false,
      end: sinon.spy()
    }
    client.linkSession({ session: fakeSession })

    fakeWs.fakeEvent('close');
    expect(fakeSession.end).to.have.been.calledOnce
  })

  it('creates 2 clients and verifies they received different IDs', () => {
    let client_id_one = clients.createNewClient({ ws: makeFakeWs() })
    let client_id_two = clients.createNewClient({ ws: makeFakeWs() })

    expect(client_id_one).to.not.eql(client_id_two)
  })

  it('creates 2 clients and passes a peer message between them', () => {
    let client_id_one = clients.createNewClient({ ws: makeFakeWs() })
    let client_id_two = clients.createNewClient({ ws: makeFakeWs() })

    let client_one = clients.getClient(client_id_one)
    let client_two = clients.getClient(client_id_two)
  })
})
