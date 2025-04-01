// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcryptjs'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll learn more about it in Part C.

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
});

// database configuration
const dbConfig = {
  host: 'db', // the database server
  port: 5432, // the database port
  database: process.env.POSTGRES_DB, // the database name
  user: process.env.POSTGRES_USER, // the user account to connect with
  password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
  .then(obj => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

// TODO - Include your API routes here
app.get('/', (req, res) => 
  {
    res.redirect('pages/login',{});
  });

app.get('/register', (req, res) => 
  {
    res.render('pages/register',{});
  });

app.get('/login', (req, res) => 
  {
    res.render('pages/login',{});
  });

//Login
app.post('/login', async (req, res) => {

  const username = req.body.username;
  var query = `SELECT username, password FROM users WHERE username = '${username}';`;
  var redirectPath = '/calendar';
  var currentUser = null;
  try 
  {
    currentUser = await db.any(query);
  } 
  catch (err) 
  {
    res.redirect('/login');
  };

  if (currentUser.length == 0)
  {
    res.redirect('/register');
  }
  else
  {
    
    const match = await bcrypt.compare(req.body.password, currentUser[0].password);
    if (match)
    {
      req.session.currentUser = currentUser;
      req.session.save();
      res.redirect(redirectPath);
    }
    else
    {
      res.render('pages/login', {
        error: true,
        message: 'Username and Password do not match. Please try again.',
      });
    }
  }
  });

    // Register
app.post('/register', async (req, res) => {
  //hash the password using bcrypt library
  const hash = await bcrypt.hash(req.body.password, 10);

  // To-DO: Insert username and hashed password into the 'users' table
  var query = `INSERT INTO users (username, password) VALUES ('${req.body.username}','${hash}');`;
  var redirectPath = '/login';
  try 
  {
    let results = await db.any(query);
    /*res.status(200).json(
      {
      data: results,
      });*/
  } 
  catch (err) 
  {
    /*res.status(400).json({
      error: err,
    });*/
    redirectPath = '/register'
  };

  res.redirect(redirectPath);
});


// Authentication middleware.
const auth = (req, res, next) => {
  if (!req.session.currentUser) {
    return res.redirect('/login');
  }
  next();
};

app.use(auth);

app.get('/logout', (req, res) => 
  {
    /*
    req.session.user = currentUser;
      req.session.save();
      res.redirect(redirectPath);
    */


    req.session.currentUser = null;
    req.session.destroy();
    res.render('pages/logout',{message: "Logged out successfully!"});
  });

app.get('/calendar', async (req, res) => 
  {
    /*
        Only functional once event table is created, and add events functionality is added.
    */

    const username = req.session.currentUser;

    var query = `SELECT eventName, eventDate, eventTime FROM events WHERE user = '${username}';`;
    let results = [];
    try 
    {
      results = await db.any(query);
      console.log("Successfully retrieved " +  results.length + " events");
    } 
    catch (err) 
    {
      console.log("Error occured in finding .");
    }
    res.render('pages/calendar',{events: results});
  });

  app.post('/calendar', async (req, res) => 
  {
    /*
        Add functionality to insert a new calendar event into events table here.
    */
  });

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
app.listen(3000);
console.log('Server is listening on port 3000');