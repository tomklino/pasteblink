const chai = require('chai');
const chaiHttp = require('chai-http');
const cp = require("child_process")
const path = require("path")
const fs = require('fs')

const should = chai.should();
const expect = chai.expect;

chai.use(chaiHttp)

const config = require('../config-loader.js')()

const port = config.get('listen_port')
const server = "http://localhost:" + port;

describe("server health check", function() {
  it("should report 200 OK as response to health check", function(done) {
    chai.request(server).get('/health').then((res) => {
      expect(res).to.have.status(200)
      done()
    })
  })
})

describe("api tests", function() {

})
