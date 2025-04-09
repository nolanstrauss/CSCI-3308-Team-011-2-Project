// test/calendar.spec.js

const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

chai.use(chaiHttp);

// Import your Express app; ensure that index.js exports just the app (not app.listen(3000))
// so that tests can import it without starting a separate server instance.
const app = require('../index');

describe('GET /calendar (Unauthenticated)', () => {
  it('should redirect unauthenticated users to /login', (done) => {
    chai.request(app)
      .get('/calendar')
      .redirects(0)  // Prevent chai-http from automatically following the redirect
      .end((err, res) => {
        expect(res).to.have.status(302);
        // Check that the Location header points to the login route.
        expect(res).to.have.header('location', '/login');
        done();
      });
  });
});
