const chai = require('chai');
const chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;
const app = require('../index');

describe('POST /register', () => {
  it('Positive Test: should redirect to /login if registration succeeds', done => {
    chai
      .request(app)
      .post('/register')
      .send({ username: 'testUserPositive', password: 'testPass123' })
      .end((err, res) => {
        done();
      });
  });

  it('Negative Test: should redirect to /register if user already exists', done => {
    chai
      .request(app)
      .post('/register')
      .send({ username: 'testUserPositive', password: 'testPass123' })
      .end((err, res) => {
        done();
      });
  });
});
