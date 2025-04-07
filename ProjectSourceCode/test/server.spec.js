// ********************** Initialize server **********************************

const server = require('../src/index'); //TODO: Make sure the path to your index.js is correctly added

// ********************** Import Libraries ***********************************

const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

// ********************** DEFAULT WELCOME TESTCASE ****************************

describe('Server!', () => {
  // Sample test case given to test / endpoint.
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});

// *********************** TODO: WRITE 2 UNIT TESTCASES **************************

// ********************************************************************************

//Positive test case for /register route
describe('Testing Register API', () => {
    it('Positive: /register with valid input', (done) => {
      chai
        .request(server)
        .post('/register') // Ensure this matches your actual registration route
        .send({ username: 'testuser', password: 'TestPassword123' }) // Valid input
        .end((err, res) => {
          expect(res).to.have.status(200); // Expecting a 200 status for success
          expect(res.body.message).to.equals('success'); // Adjust based on your API's success message
          done();
        });
    });
  });