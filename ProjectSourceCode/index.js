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
    // JSON helper, used for serializing server data into your client JS
    json: ctx => JSON.stringify(ctx)
  }
});

Handlebars.registerHelper('inc', v => parseInt(v) + 1);
Handlebars.registerHelper('date', v => {
  const [d] = v.split(' ');
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
});
Handlebars.registerHelper('time', v => {
  const [, t] = v.split(' ');
  let [h, mm] = t.split(':').map(Number);
  let am = 'AM';
  if (h >= 12) { am = 'PM'; if (h > 12) h -= 12; }
  if (h === 0) { h = 12; am = 'PM'; }
  return `${h}:${String(mm).padStart(2, '0')}${am}`;
});

// Configure your Postgres connection
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

// Make `user` available in all templates
app.use((req, res, next) => {
  res.locals.user = req.session.currentUser ? req.session.currentUser[0] : null;
  next();
});

// Public: landing
app.get('/',        (req, res) => res.redirect('/welcome'));
// Welcome (no navbar)
app.get('/welcome', (req, res) => {
  res.render('pages/welcome', { hideNav: true });
});
// Auth pages
app.get('/login',    (req, res) => res.render('pages/login',    { routeIsLogin:    true }));
app.get('/register', (req, res) => res.render('pages/register', { routeIsRegister: true }));

// Login handler
app.post('/login', async (req, res) => {
  const { username, password } = req.body; // username is the email
  const users = await db.any(
    'SELECT username,password FROM users WHERE username = $1',
    [username]
  ).catch(() => []);
  if (!users.length) {
    return res.redirect('/register');
  }
  const match = await bcrypt.compare(password, users[0].password);
  if (!match) {
    return res.render('pages/login', {
      error: true,
      message: 'Invalid credentials'
    });
  }
  req.session.currentUser = users;
  req.session.save(() => res.redirect('/calendar'));
});

// Register handler (now requiring the “username” field to be an email)
app.post('/register', async (req, res) => {
  const username = req.body.username; // actually the user’s email
  const password = req.body.password;

  // Simple existence check
  const exists = await db.oneOrNone(
    'SELECT username FROM users WHERE username = $1',
    [username]
  );
  if (exists) {
    return res.render('pages/register', {
      error: true,
      message: 'This email is already registered'
    });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    // Store into both username and email columns
    await db.none(
      'INSERT INTO users(username,password,email) VALUES($1,$2,$3)',
      [username, hash, username]
    );
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    res.render('pages/register', {
      error: true,
      message: 'Error registering user'
    });
  }
});

// Authentication middleware
const auth = (req, res, next) => {
  if (!req.session.currentUser) {
    return res.redirect('/login');
  }
  next();
};

// Protect following routes
app.use('/calendar', auth);
app.use('/logout',   auth);

// Calendar view
app.get('/calendar', async (req, res) => {
  const user = req.session.currentUser[0].username;
  const events = await db.any(`
    SELECT
      eventid,
      eventname,
      eventcategory,
      eventdate,
      eventdescription,
      eventreminderdelay,
      eventlink,
      eventemaillist AS eventemaillist
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
    SELECT eventname, eventdate, eventdescription
    FROM events
    WHERE eventuser = $1;
  `, [user]);
  const icsArr = rows.map(e => {
    const d = new Date(e.eventdate);
    return {
      title:       e.eventname,
      start:       [d.getFullYear(), d.getMonth()+1, d.getDate(), d.getHours(), d.getMinutes()],
      description: e.eventdescription
    };
  });
  const { error, value } = createEvents(icsArr);
  if (error) {
    console.error(error);
    return res.status(500).send('ICS generation error');
  }
  res.setHeader('Content-disposition','attachment; filename="calendar.ics"');
  res.type('text/calendar').send(value);
});

// Create new event
app.post('/calendar', async (req, res) => {
  const {
    event_name,
    event_category,
    event_date,
    event_time,
    event_reminder_delay,
    event_description,
    event_link,
    event_attendees
  } = req.body;
  const user = req.session.currentUser[0].username;
  const dt    = new Date(`${event_date}T${event_time}`);
  const sqlTs = dt.toISOString().slice(0, 19).replace('T', ' ');

  // Insert into events
  const { eventid } = await db.one(`
    INSERT INTO events
      (eventname,eventcategory,eventdate,eventreminderdelay,
       eventdescription,eventlink,eventuser,eventemaillist)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING eventid;
  `, [
    event_name,
    event_category,
    sqlTs,
    parseInt(event_reminder_delay,10),
    event_description,
    event_link,
    user,
    event_attendees
  ]);

  // Link to user
  await db.none(`
    INSERT INTO users_to_events(username,eventid)
    VALUES($1,$2);
  `, [user, eventid]);

  // Distribute into attendees tables
  const emails = event_attendees
    .split(',')
    .map(e => e.trim())
    .filter(e => e);
  for (const email of emails) {
    await db.none(`
      INSERT INTO events_to_attendees(eventid,attendeeemail)
      VALUES($1,$2);
    `, [eventid, email]);
    await db.none(`
      INSERT INTO attendees(attendeeemail)
      VALUES($1)
      ON CONFLICT(attendeeemail) DO NOTHING;
    `, [email]);
  }

  res.redirect('/calendar');
});

// Edit existing event
app.post('/calendar/edit', async (req, res) => {
  const {
    event_id,
    event_name,
    event_category,
    event_date,
    event_time,
    event_reminder_delay,
    event_description,
    event_link,
    event_attendees
  } = req.body;
  const dt    = new Date(`${event_date}T${event_time}`);
  const sqlTs = dt.toISOString().slice(0, 19).replace('T', ' ');
  await db.none(`
    UPDATE events SET
      eventname       = $1,
      eventcategory   = $2,
      eventdate       = $3,
      eventreminderdelay = $4,
      eventdescription = $5,
      eventlink       = $6,
      eventemaillist  = $7
    WHERE eventid = $8;
  `, [
    event_name,
    event_category,
    sqlTs,
    parseInt(event_reminder_delay,10),
    event_description,
    event_link,
    event_attendees,
    event_id
  ]);
  res.redirect('/calendar');
});

// Delete event
app.post('/calendar/delete', async (req, res) => {
  await db.none('DELETE FROM events WHERE eventid = $1;', [req.body.event_id]);
  res.redirect('/calendar');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    // Make sure nav sees no user
    res.locals.user = null;
    res.render('pages/logout', {});
  });
});

// Settings page
app.get('/settings', auth, (req, res) => {
  const user = req.session.currentUser[0];
  res.render('pages/settings', { user });
});

// Settings update handler
app.post('/settings', auth, async (req, res) => {
  const { username, email, currentPassword, newPassword } = req.body;
  const user = req.session.currentUser[0];

  // Verify current password
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return res.render('pages/settings', {
      error: true,
      message: 'Incorrect current password',
      user
    });
  }

  // Build update
  const updates = [];
  const params  = [];

  if (username && username !== user.username) {
    updates.push('username = $1');
    params.push(username);
  }
  if (email && email !== user.email) {
    updates.push('email = $2');
    params.push(email);
  }
  let hashedPassword;
  if (newPassword) {
    hashedPassword = await bcrypt.hash(newPassword, 10);
    updates.push('password = $3');
    params.push(hashedPassword);
  }

  if (updates.length > 0) {
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE username = $4`;
    params.push(user.username);
    await db.none(sql, params);
    // Update session copy
    req.session.currentUser[0] = {
      ...user,
      username,
      email,
      password: newPassword ? hashedPassword : user.password
    };
  }

  res.render('pages/settings', {
    success: true,
    message: 'Settings updated successfully',
    user: req.session.currentUser[0]
  });
});

// *****************************************************
// <!-- Section 5 : Start Server--> 
// *****************************************************

app.listen(3000, () => console.log('Server listening on port 3000'));
