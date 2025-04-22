// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express');
const app = express();
const handlebars = require('express-handlebars');
const Handlebars = require('handlebars');
const path = require('path');
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { createEvents } = require('ics');

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

const hbs = handlebars.create({
  extname: 'hbs',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  partialsDir: path.join(__dirname, 'views/partials'),
  defaultLayout: 'main',
  helpers: {
    json: ctx => JSON.stringify(ctx)
  }
});

Handlebars.registerHelper('inc', v => parseInt(v) + 1);
Handlebars.registerHelper('date', v => {
  const [d] = v.split(' ');
  const [y,m,day] = d.split('-');
  return `${m}/${day}/${y}`;
});
Handlebars.registerHelper('time', v => {
  const [,t] = v.split(' ');
  let [h,mm] = t.split(':').map(Number);
  let am = 'AM';
  if (h >= 12) { am = 'PM'; if (h > 12) h -= 12; }
  if (h === 0) { h = 12; am = 'PM'; }
  return `${h}:${String(mm).padStart(2,'0')}${am}`;
});

const db = pgp({
  host: 'db',
  port: 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD
});

db.connect()
  .then(c => { console.log('Database connected'); c.done(); })
  .catch(e => console.error('DB error', e.message));

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  saveUninitialized: false,
  resave: false
}));

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

// make user available in all templates
app.use((req, res, next) => {
  res.locals.user = req.session.currentUser ? req.session.currentUser[0] : null;
  next();
});

app.get('/',        (req, res) => res.redirect('/welcome'));
app.get('/welcome', (req, res) => res.render('pages/welcome'));
app.get('/login',   (req, res) => res.render('pages/login', { routeIsLogin: true }));
app.get('/register',(req, res) => res.render('pages/register', { routeIsRegister: true }));

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  let users = await db.any('SELECT username,password FROM users WHERE username=$1', [username]).catch(() => []);
  if (!users.length) return res.redirect('/register');
  if (!(await bcrypt.compare(password, users[0].password))) {
    return res.render('pages/login', { error: true, message: 'Invalid credentials' });
  }
  req.session.currentUser = users;
  req.session.save(() => res.redirect('/calendar'));
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (await db.oneOrNone('SELECT username FROM users WHERE username=$1', [username])) {
    return res.render('pages/register', { error: true, message: 'Username taken' });
  }
  const hash = await bcrypt.hash(password, 10);
  await db.none('INSERT INTO users(username,password) VALUES($1,$2)', [username, hash]);
  res.redirect('/login');
});

const auth = (req, res, next) => {
  if (!req.session.currentUser) return res.redirect('/login');
  next();
};

app.use('/calendar', auth);
app.use('/logout', auth);

// display calendar
app.get('/calendar', async (req, res) => {
  const user = req.session.currentUser[0].username;
  const events = await db.any(`
    SELECT
      eventid       AS eventid,
      eventname     AS eventname,
      eventcategory AS eventcategory,
      eventdate     AS eventdate,
      eventdescription AS eventdescription,
      eventreminderdelay AS eventreminderdelay,
      eventlink     AS eventlink,
      eventemaillist  AS eventattendees
    FROM events
    WHERE eventuser = $1
    ORDER BY eventdate;
  `, [user]);
  res.render('pages/calendar', { events });
});

// ICS export
app.get('/calendar/ics', async (req, res) => {
  const user = req.session.currentUser[0].username;
  const rows = await db.any(`
    SELECT
      eventname     AS eventname,
      eventdate     AS eventdate,
      eventdescription AS eventdescription
    FROM events
    WHERE eventuser = $1;
  `, [user]);
  const icsArr = rows.map(e => {
    const d = new Date(e.eventdate);
    return {
      title: e.eventname,
      start: [d.getFullYear(), d.getMonth()+1, d.getDate(), d.getHours(), d.getMinutes()],
      description: e.eventdescription
    };
  });
  const { error, value } = createEvents(icsArr);
  if (error) return res.status(500).send('ICS generation error');
  res.setHeader('Content-disposition','attachment; filename="calendar.ics"');
  res.type('text/calendar').send(value);
});

// create
app.post('/calendar', async (req, res) => {
  const {
    event_name, event_category,
    event_date, event_time,
    event_reminder_delay, event_description,
    event_link, event_attendees
  } = req.body;
  const user = req.session.currentUser[0].username;
  const dt = new Date(`${event_date}T${event_time}`);
  const sqlTs = dt.toISOString().slice(0,19).replace('T',' ');
  const event_result = await db.one(`
    INSERT INTO events
      (eventname,eventcategory,eventdate,eventreminderdelay,
       eventdescription,eventlink,eventuser,eventemaillist)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING eventid
  `, [
    event_name, event_category, sqlTs,
    parseInt(event_reminder_delay,10),
    event_description, event_link,
    user, event_attendees
  ]);

  const event_id = event_result.eventid;

  await db.none(`
    INSERT INTO users_to_events
    (username,eventid)
    VALUES($1,$2)
  `, [
    user, event_name
  ]);

  //seperate the event email list by commas and add each value into the attendees db
  const attendees = event_attendees.split(',');
  for (const attendee of attendees) {
    await db.none(`
      INSERT INTO events_to_attendees (eventid,attendeeemail)
      VALUES($1,$2)
    `, [event_id, attendee]);

    await db.none(`
      INSERT INTO attendees (attendeeemail) 
      VALUES($1)
    `, [attendee]);
  }

  res.redirect('/calendar');
});

// edit
app.post('/calendar/edit', async (req, res) => {
  const {
    event_id, event_name, event_category,
    event_date, event_time,
    event_reminder_delay, event_description,
    event_link, event_attendees
  } = req.body;
  const dt = new Date(`${event_date}T${event_time}`);
  const sqlTs = dt.toISOString().slice(0,19).replace('T',' ');
  await db.none(`
    UPDATE events SET
      eventname=$1,
      eventcategory=$2,
      eventdate=$3,
      eventreminderdelay=$4,
      eventdescription=$5,
      eventlink=$6,
      eventemaillist=$7
    WHERE eventid=$8
  `, [
    event_name, event_category, sqlTs,
    parseInt(event_reminder_delay,10),
    event_description, event_link,
    event_attendees, event_id
  ]);
  res.redirect('/calendar');
});

// delete
app.post('/calendar/delete', async (req, res) => {
  await db.none('DELETE FROM events WHERE eventid=$1', [req.body.event_id]);
  res.redirect('/calendar');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.render('pages/logout');
  });
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

app.listen(3000, () => console.log('Server listening on port 3000'));
