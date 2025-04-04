
// This test covers the existing GET /welcome route

const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;


const app = require('../index.js');

describe('GET /welcome', () => {
  it('should return JSON with status="success" and message="Welcome!"', (done) => {
    chai
      .request(app)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('object');
        expect(res.body).to.have.property('status', 'success');
        expect(res.body).to.have.property('message', 'Welcome!');
        done();
      });
  });
});
