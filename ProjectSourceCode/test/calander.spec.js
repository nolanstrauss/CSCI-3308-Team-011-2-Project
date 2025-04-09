// test/calendar.spec.js

const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

chai.use(chaiHttp);

const app = require('../index');

describe('GET /calendar (Unauthenticated)', () => {
  it('should redirect unauthenticated users to /login', (done) => {
    chai.request(app)
      .get('/calendar')
      .redirects(0)  
      .end((err, res) => {
        expect(res).to.have.status(302);
        expect(res).to.have.header('location', '/login');
        done();
      });
  });
});
