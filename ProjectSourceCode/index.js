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

app.use((req, res, next) => {
  res.locals.user_exists = req.session.currentUser ? true : false;
  res.locals.user = req.session.currentUser ? req.session.currentUser[0] : null;
  next();
});

app.get('/', (req, res) => {
  res.redirect('/login'); // Redirect to the `/login` route
});

app.get('/register', (req, res) => 
  {
    res.render('pages/register',{});
  });

app.get('/login', (req, res) => 
  {
    res.render('pages/login',{});
  });

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});
  
app.get('/welcome', (req, res) => {
  res.render('pages/welcome', {});
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
    
        res.redirect('/login');
      } catch (err) {
        console.error(err);
        res.status(500).render('pages/register', {
          error: true,
          message: 'An error occurred while registering. Please try again.',
        });
      }
    });


// Authentication middleware.
const auth = (req, res, next) => {
  if (!req.session.currentUser) {
    return res.redirect('/login');
  }
  next();
};

app.use('/calendar', auth);
app.use('/logout', auth);

app.get('/logout', (req, res) => 
  {
    req.session.currentUser = null;
    req.session.destroy();
    res.render('pages/logout',{message: "Logged out successfully!"});
  });

app.get('/calendar', async (req, res) => 
  {
    const username = req.session.currentUser[0].username;
    console.log(username);
    var query = `SELECT eventName, eventCategory, eventDate, eventTime, eventDescription FROM events WHERE eventUser = '${username}';`;
    results = [];
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
    const eventName = req.body.event_name;
    const eventCategory = req.body.event_category;
    const eventDate = req.body.event_date;
    const eventTime = req.body.event_time;
    const eventDesc = req.body.event_description;
    const username = req.session.currentUser[0].username;

    console.log(eventName);
    console.log(eventCategory);
    console.log(eventDate);
    console.log(eventTime);
    console.log(eventDesc);
    console.log(username);
    
    var query = `INSERT INTO events (eventName, eventCategory, eventDate, eventTime, eventDescription, eventUser) VALUES ('${eventName}','${eventCategory}','${eventDate}','${eventTime}','${eventDesc}','${username}');`;
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
  });
  // Render the settings page
app.get('/settings', (req, res) => {
  if (!req.session.currentUser) {
    return res.redirect('/login'); // Redirect to login if the user is not authenticated
  }

  res.render('pages/settings', {
    user_exists: true,
    user: req.session.currentUser[0], // Pass the current user to the template
  });
});
  app.post('/settings/change-username', async (req, res) => {
    const newUsername = req.body.new_username;
    const currentUsername = req.session.currentUser[0].username;
  
    try {
      // Check if the new username already exists
      const userExists = await db.oneOrNone('SELECT username FROM users WHERE username = $1', [newUsername]);
      if (userExists) {
        return res.status(400).render('pages/settings', {
          error: true,
          message: 'This username is already taken.',
        });
      }
  
      // Update the username
      await db.none('UPDATE users SET username = $1 WHERE username = $2', [newUsername, currentUsername]);
  
      // Update session data
      req.session.currentUser[0].username = newUsername;
  
      res.render('pages/settings', {
        success: true,
        message: 'Username updated successfully.',
      });
    } catch (err) {
      console.error(err);
      res.status(500).render('pages/settings', {
        error: true,
        message: 'An error occurred while updating your username.',
      });
    }
  });
  app.post('/settings/change-password', async (req, res) => {
    const currentPassword = req.body.current_password;
    const newPassword = req.body.new_password;
    const currentUsername = req.session.currentUser[0].username;
  
    try {
      // Get the current password hash
      const user = await db.one('SELECT password FROM users WHERE username = $1', [currentUsername]);
  
      // Verify the current password
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res.status(400).render('pages/settings', {
          error: true,
          message: 'Current password is incorrect.',
        });
      }
  
      // Hash the new password and update it
      const newHash = await bcrypt.hash(newPassword, 10);
      await db.none('UPDATE users SET password = $1 WHERE username = $2', [newHash, currentUsername]);
  
      res.render('pages/settings', {
        success: true,
        message: 'Password updated successfully.',
      });
    } catch (err) {
      console.error(err);
      res.status(500).render('pages/settings', {
        error: true,
        message: 'An error occurred while updating your password.',
      });
    }
  });
  app.post('/settings/delete-account', async (req, res) => {
    const currentUsername = req.session.currentUser[0].username;
  
    try {
      // Delete the user from the database
      await db.none('DELETE FROM users WHERE username = $1', [currentUsername]);
  
      // Destroy the session
      req.session.destroy();
  
      res.redirect('/register');
    } catch (err) {
      console.error(err);
      res.status(500).render('pages/settings', {
        error: true,
        message: 'An error occurred while deleting your account.',
      });
    }
  });
  app.use((req, res, next) => {
    res.locals.user = req.session.currentUser ? req.session.currentUser[0] : null;
    next();
  });



// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');

