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

Handlebars.registerHelper("inc", function(value, options)
{
    return parseInt(value) + 1;
});
Handlebars.registerHelper("date", function(value, options)
{
  dateTime = value.split(' ');
  dateTime = dateTime[0].split('-');
  return dateTime[2] + "/" + dateTime[1] + "/" + dateTime[0];
});
Handlebars.registerHelper("time", function(value, options)
{
  dateTime = value.split(' ');
  time = dateTime[1].split(':');
  amPm = 'AM';
  t = parseInt(time[0]);
  if (t > 12)
  {
    t -= 12;
    amPm = 'PM';
  }
  if (t == 0)
  {
    t = 12;
    amPM = 'PM';
  }
  return t + ':' + time[1] + amPm;
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
  res.redirect('/welcome');
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
  res.render('pages/welcome', {});
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

    // Check if the username already exists
    try
    {
      const userExists = await db.oneOrNone('SELECT username FROM users WHERE username = $1', [username]);
    }
    catch (err)
    {
      console.log("Could not connect to database");
    }
    if (userExists) {
      return res.status(400).render('pages/register', {
        error: true,
        message: 'This username is already taken',
      });
    }

    // Hash the password and insert the new user
    const hash = await bcrypt.hash(password, 10);
    await db.none('INSERT INTO users (username, password) VALUES ($1, $2)', [username, hash]);

  //Insert username and hashed password into the 'users' table
  var query = `INSERT INTO users (username, password) VALUES ('${req.body.username}','${hash}');`;
  var redirectPath = '/login';
  try 
  {
    let results = await db.any(query);
    res.render(redirectPath,{});
  } 
  catch (err) 
  {
    redirectPath = '/register'
    res.render(redirectPath,{error:true, message:"Error when logging in"});
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
app.use('/manage-invitations', auth);
  
app.get('/calendar', async (req, res) => 
  {
    const username = req.session.currentUser[0].username;
    console.log(username);
    var query = `SELECT eventName, eventCategory, eventDate, eventDescription, eventID, eventEmailList FROM events WHERE eventUser = '${username}' ORDER BY eventDate;`;
    results = [];
    try 
    {
      results = await db.any(query);
      console.log("Successfully retrieved " +  results.length + " events");
      console.log(results);
      res.render('pages/calendar', { events: results });
    } 
    catch (err) 
    {
      console.log("Error occured in finding .");
      app.use('/edit-calendar', auth);
      app.use('/manage-invitations', auth);
      res.render('pages/calendar', {});
    }
  });

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

  app.post('/calendar', async (req, res) => 
  {
    const eventName = req.body.event_name;
    const eventCategory = req.body.event_category;
    const eventDate = req.body.event_date;
    const eventTime = req.body.event_time;
    const eventReminderDelay = req.body.event_reminder_delay;
    const eventDesc = req.body.event_description;
    const eventLink = req.body.event_link;
    const username = req.session.currentUser[0].username;
    const attendees = req.body.event_attendees;

    console.log(eventName);
    console.log(eventCategory);
    console.log(eventDate);
    console.log(eventTime);
    console.log(eventReminderDelay);
    console.log(eventDesc);
    console.log(username);
    console.log(attendees);

    let combinedDateTimeString = req.body.event_date + 'T' + req.body.event_time;
    let combinedDate = new Date(combinedDateTimeString);
    const sqlDateTime = combinedDate.toISOString().slice(0, 19).replace('T', ' ');
    console.log(sqlDateTime);
    
    var query = `INSERT INTO events (eventName, eventCategory, eventDate, eventReminderDelay, eventDescription, eventLink, eventUser, eventEmailList) VALUES ('${eventName}','${eventCategory}','${sqlDateTime}','${eventReminderDelay}','${eventDesc}','${eventLink}','${username}','${attendees}');`;
    var redirectPath = '/login';
    try 
    {
      let results = await db.any(query);
      console.log("Successfully created event.");
      
      res.redirect('/calendar');
    } 
    catch (err) 
    {
      console.log("error in inserting event into table.");
    };

  res.render('pages/calendar', { events: results });
});

app.post('/calendar/delete', async (req, res) => 
  {
    const eventID = req.body.event_id;

    console.log("Deleting event " + eventID);
    
    var query = `DELETE FROM events WHERE eventID = '${eventID}';`;
    try 
    {
      let results = await db.any(query);
      console.log("Successfully deleted event.");
    } 
    catch (err) 
    {
      console.log("error in deleting event from table.");
    };
    res.redirect('/manage-invitations');
});


// Example protected route for editing the calendar
app.get('/edit-calendar', (req, res) => {
  res.render('pages/edit-calendar'); // Create this view accordingly
});

app.get('/manage-invitations', async (req, res) => 
  {
    const username = req.session.currentUser[0].username;
    console.log(username);
    var query = `SELECT eventName, eventCategory, eventDate, eventDescription, eventID FROM events WHERE eventUser = '${username}' ORDER BY eventDate;`;
    results = [];
    try 
    {
      results = await db.any(query);
      console.log("Successfully retrieved " +  results.length + " events");
      console.log(results);
      res.render('pages/manage-invitations', { events: results });
    } 
    catch (err) 
    {
      console.log("Error occured in finding .");
      app.use('/edit-calendar', auth);
      app.use('/manage-invitations', auth);
      res.render('pages/manage-invitations', {});
    }
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
    res.redirect('/manage-invitations');
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
