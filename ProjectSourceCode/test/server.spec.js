// ********************** Initialize server **********************************


const server = require('../index'); //TODO: Make sure the path to your index.js is correctly added
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server



// ********************** Import Libraries ***********************************

const chai = require('chai'); // Chai HTTP provides an interface for live integration testing of the API's.
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const {assert, expect} = chai;

// database configuration
const dbConfig = {
    host: 'db', // the database server
    port: 5432, // the database port
    database: process.env.POSTGRES_DB, // the database name
    user: process.env.POSTGRES_USER, // the user account to connect with
    password: process.env.POSTGRES_PASSWORD, // the password of the user account
  };
  
  const db = pgp(dbConfig);

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

describe("Testing get non existent endpoint ", ()=> {
  it("Negative: get non existent endpoint /fake/route", (done) => {
    chai.request(server).get("/fake/route").end((err,res) => {
        if (err) {
          return done(err);
        }

        expect(res).to.have.status(404); // Expecting a 404, resource not found
        done();
    })
  })
})



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


//negative unit test for /register = returns error message for (if the username is already taken?)
describe('Testing register path', ()=>{
    it('negative : /register', done => {
        chai
            .request(server)
            .post('/register')
            .send({username:"test_user", password:"password"})
            .end((err,res)=>{
                //send second request with same username
                chai  
                    .request(server)
                    .post('/register')
                    .send({username:"test_user", password:"password"})
                    .end(async (err,res)=>{
                        expect(res).to.have.status(400)
                        expect(res.text).to.include("This username is already taken");
                        try {
                            await db.query('DELETE FROM users WHERE username = $1', ['test_user']);
                            done();
                        }
                        catch(err){
                            done(err);
                        }
                    });
            });
    });
});
