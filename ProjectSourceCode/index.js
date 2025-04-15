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
const { createEvents } = require('ics'); // For exporting ICS files
const { v4: uuidv4 } = require('uuid'); // For generating unique eventID

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// create `ExpressHandlebars` instance and configure the layouts and partials dir.
const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: __dirname + '/views/layouts',
  partialsDir: __dirname + '/views/partials',
  helpers: {
    // This helper outputs valid JSON for your <script>.
    json: function(context) {
      return JSON.stringify(context);
    }
  }
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
    return res.render('pages/login', { error: 'Error checking user.' });
  }

  if (currentUser.length === 0) {
    return res.render('pages/login', { error: 'User does not exist.' });
  }

  const match = await bcrypt.compare(req.body.password, currentUser[0].password);
  if (match) {
    req.session.currentUser = currentUser;
    req.session.save();
    res.redirect('/calendar');
  } else {
    res.render('pages/login', {
      error: 'Username and Password do not match. Please try again.',
    });
  }
});

// Register route
app.post('/register', async (req, res) => {
  const username = req.body.username;
  const plainPassword = req.body.password;
  const hash = await bcrypt.hash(plainPassword, 10);
  const query = `INSERT INTO users (username, password) VALUES ($1, $2);`;
  let redirectPath = '/login';

  try {
    await db.any(query, [username, hash]);
  } catch (err) {
    return res.render('pages/register', { error: 'Registration error.' });
  }
  res.redirect(redirectPath);
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

// Logout route
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
  // NOTE: We convert the DB's date to a string "YYYY-MM-DD" with TO_CHAR
  const query = `
    SELECT
      eventID,
      eventName,
      eventCategory,
      TO_CHAR(eventDate, 'YYYY-MM-DD') AS "eventdate",
      eventTime,
      eventDescription,
      eventColor
    FROM events
    WHERE eventUser = $1;
  `;
  let results = [];

  try {
    results = await db.any(query, [username]);
    console.log("Successfully retrieved " + results.length + " events");
  } catch (err) {
    console.log("Error occured while retrieving events.");
  }

  // Send them to the calendar.hbs, which references "events"
  res.render('pages/calendar', { events: results });
});

// Example protected route for editing the calendar
app.get('/edit-calendar', (req, res) => {
  res.render('pages/edit-calendar');
});

// Example protected route for managing invitations
app.get('/manage-invitations', (req, res) => {
  res.render('pages/manage-invitations');
});

// Route to create a new calendar event (with color)
app.post('/calendar', async (req, res) => {
  const eventID = uuidv4(); // Generate a unique ID
  const eventName = req.body.event_name;
  const eventCategory = req.body.event_category;
  const eventDate = req.body.event_date;
  const eventTime = req.body.event_time;
  const eventDesc = req.body.event_description;
  const eventColor = req.body.event_color; // newly added field
  const username = req.session.currentUser[0].username;
  
  var query = `
    INSERT INTO events (eventID, eventName, eventCategory, eventDate, eventTime, eventDescription, eventColor, eventUser) 
    VALUES ('${eventID}', '${eventName}', '${eventCategory}', '${eventDate}', '${eventTime}', '${eventDesc}', '${eventColor}', '${username}');
  `;
  try {
    await db.any(query);
    console.log("Successfully created event.");
    res.redirect('/calendar');
  } catch (err) {
    console.log("Error in inserting event into table.");
  }
});

// Route to download ICS
app.get('/calendar/ics', async (req, res) => {
  const username = req.session.currentUser[0].username;
  // Also cast to text here for consistency
  const query = `
    SELECT
      eventName,
      eventCategory,
      TO_CHAR(eventDate, 'YYYY-MM-DD') AS "eventdate",
      eventTime,
      eventDescription
    FROM events
    WHERE eventUser = $1;
  `;
  try {
    const results = await db.any(query, [username]);

    // Now eventdate is a string e.g. '2025-04-15', so we parse it with new Date
    const icsEvents = results.map((evt) => {
      const dateObj = new Date(evt.eventdate); 
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();

      // eventTime is likely "HH:MM:SS" or "HH:MM"
      const [hour, minute] = evt.eventtime.split(':').map(Number);

      return {
        title: evt.eventname,
        start: [year, month, day, hour, minute],
        description: evt.eventdescription,
      };
    });

    const { error, value } = createEvents(icsEvents);
    if (error) {
      console.log(error);
      return res.status(500).send('Error generating ICS.');
    }

    res.setHeader('Content-disposition', 'attachment; filename="calendar.ics"');
    res.type('text/calendar');
    res.send(value);
  } catch (err) {
    console.log(err);
    res.status(500).send('Error generating ICS.');
  }
});

//Edit event route
app.post('/calendar/edit', async (req, res) => {
  const { eventID, event_name, event_category, event_date, event_time, event_description, event_color } = req.body;

  const query = `
    UPDATE events
    SET eventName='${event_name}',
        eventCategory='${event_category}',
        eventDate='${event_date}',
        eventTime='${event_time}',
        eventDescription='${event_description}',
        eventColor='${event_color}'
    WHERE eventID='${eventID}';
  `;
  try {
    await db.any(query);
    console.log("Successfully updated event.");
    res.redirect('/calendar');
  } catch (err) {
    console.log("Error updating event.", err);
    res.redirect('/calendar');
  }
});

//delete event route

app.post('/calendar/delete', async (req, res) => {
  try {
    const { eventID } = req.body;
    const query = `DELETE FROM events WHERE eventID='${eventID}';`;
    await db.any(query);
    console.log("Successfully deleted event.");
    return res.sendStatus(200);
  } catch (err) {
    console.log("Error deleting event.");
    return res.sendStatus(500);
  }
});

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');
