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
const bcrypt = require('bcryptjs'); // To hash passwords
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
  .then((obj) => {
    console.log('Database connection successful'); // you can view this message in the docker compose logs
    obj.done(); // success, release the connection;
  })
  .catch((error) => {
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

// Place this code *after* setting up session, but *before* your routes
app.use((req, res, next) => {
  // Store user information in locals to be used in our views
  res.locals.user = req.session.currentUser ? req.session.currentUser[0] : null;
  next();
});

// Redirect to /login by default
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Show the registration page with a flag (if needed)
app.get('/register', (req, res) => {
  res.render('pages/register', { routeIsRegister: true });
});

// Show the login page and pass a flag so the navbar displays "Register" instead of "Login"
app.get('/login', (req, res) => {
  res.render('pages/login', { routeIsLogin: true });
});

// Welcome route
app.get('/welcome', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Welcome!'
  });
});


// Login route
app.post('/login', async (req, res) => {
  const username = req.body.username;
  const query = `SELECT username, password FROM users WHERE username = $1;`;
  let currentUser;

  try {
    currentUser = await db.any(query, [username]);
  } catch (err) {
    return res.redirect('/login');
  }

  // If no such user, redirect to register
  if (currentUser.length === 0) {
    return res.redirect('/register');
  }

  // Compare password with hashed password
  const match = await bcrypt.compare(req.body.password, currentUser[0].password);
  if (match) {
    // Store the user as an array to be compatible with our locas usage (we take index 0 later)
    req.session.currentUser = currentUser;
    req.session.save();
    res.redirect('/calendar');
  } else {
    res.render('pages/login', {
      error: true,
      message: 'Username and Password do not match. Please try again.',
    });
  }
});

// Register route
app.post('/register', async (req, res) => {
  const username = req.body.username;
  const password = req.body.password;

  try {
    // Check if the username already exists
    const userExists = await db.oneOrNone('SELECT username FROM users WHERE username = $1', [username]);

    if (userExists) {
      return res.status(400).render('pages/register', {
        error: true,
        message: 'This username is already taken',
      });
    }

    // Hash the password and insert the new user
    const hash = await bcrypt.hash(password, 10);
    await db.none('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hash]);

    // Option A: Send JSON success (e.g. for frontend AJAX)
    // return res.status(200).json({ message: "success" });

    // Option B: Or redirect for traditional form submission
    return res.redirect('/login');

  } catch (err) {
    console.error(err);
    return res.status(500).render('pages/register', {
      error: true,
      message: 'An error occurred while registering. Please try again.',
    });
  }
});




// Authentication middleware: redirects to /login if not authenticated
const auth = (req, res, next) => {
  if (!req.session.currentUser) {
    return res.redirect('/login');
  }
  next();
};

// Protect routes: calendar, logout, edit-calendar, and manage-invitations
app.use('/calendar', auth);
app.use('/logout', auth);
app.use('/edit-calendar', auth);
app.use('/manage-invitations', auth);

// Logout route: destroys the session, clears cookie, and explicitly sets user to null so the navbar displays "Login/Register"
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.locals.user = null;
    res.render('pages/logout', { message: "Logged out successfully!" });
  });
});

// Calendar page - must be logged in
app.get('/calendar', async (req, res) => {
  const username = req.session.currentUser[0].username;
  var query = `SELECT eventName, eventCategory, eventDate, eventTime, eventDescription FROM events WHERE eventUser = '${username}';`;
  let results = [];

  try {
    results = await db.any(query);
    console.log("Successfully retrieved " + results.length + " events");
  } catch (err) {
    console.log("Error occured while retrieving events.");
  }

  res.render('pages/calendar', { events: results });
});

// Example protected route for editing the calendar
app.get('/edit-calendar', (req, res) => {
  res.render('pages/edit-calendar'); // Create this view accordingly
});

// Example protected route for managing invitations
app.get('/manage-invitations', (req, res) => {
  res.render('pages/manage-invitations'); // Create this view accordingly
});

// Route to create a new calendar event
app.post('/calendar', async (req, res) => {
  const eventName = req.body.event_name;
  const eventCategory = req.body.event_category;
  const eventDate = req.body.event_date;
  const eventTime = req.body.event_time;
  const eventDesc = req.body.event_description;
  const username = req.session.currentUser[0].username;
  
  var query = `INSERT INTO events (eventName, eventCategory, eventDate, eventTime, eventDescription, eventUser) VALUES ('${eventName}','${eventCategory}','${eventDate}','${eventTime}','${eventDesc}','${username}');`;
  try {
    await db.any(query);
    console.log("Successfully created event.");
    res.redirect('/calendar');
  } catch (err) {
    console.log("Error in inserting event into table.");
  }
});

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
