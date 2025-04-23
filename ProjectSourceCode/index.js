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
const {CreateEvent,RemoveUserFromEvent} = require("./modules/email/email")

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
Handlebars.registerHelper('date', v => { return `${v.getMonth()+1}/${v.getDate()}/${v.getFullYear()}`;});
Handlebars.registerHelper('time', v => { return `${v.toLocaleTimeString()}`;});

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

app.use((req, res, next) => {
  res.locals.user = req.session.currentUser ? req.session.currentUser[0] : null;
  next();
});

app.get('/',        (req, res) => res.redirect('/welcome'));
// Welcome route — pass hideNav:true so {{>nav}} is skipped
app.get('/welcome', (req, res) => {
  res.render('pages/welcome', { hideNav: true });
});

app.get('/login',   (req, res) => res.render('pages/login', { routeIsLogin: true }));
app.get('/register',(req, res) => res.render('pages/register', { routeIsRegister: true }));

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const users = await db.any('SELECT username,password FROM users WHERE username=$1', [username]).catch(() => []);
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
app.use('/manage-invitations', auth);
app.use('/rsvp', auth);
app.use('/rsvp/:event_id', auth);
app.use('/logout',   auth);

// === UPDATED GET /calendar ===
app.get('/calendar', async (req, res) => {
  const user = req.session.currentUser[0].username;
  const events = await db.any(`
    SELECT
      eventid,
      eventname,
      eventcategory,
      to_char(eventdate,'YYYY-MM-DD HH24:MI:SS') AS eventdate,
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

// ICS export (unchanged)
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
  if (error) return res.status(500).send('ICS generation error');
  res.setHeader('Content-disposition','attachment; filename="calendar.ics"');
  res.type('text/calendar').send(value);
});

// === UPDATED CREATE handler ===
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
  attendees = event_attendees.split(',')
  .map(email => email.trim())
  .filter(email => email.length > 0);

  const { eventid } = await db.one(`
    INSERT INTO events
      (eventname,eventcategory,eventdate,eventreminderdelay,
       eventdescription,eventlink,eventuser,eventemaillist)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING eventid
  `, [
    event_name, event_category, sqlTs,
    parseInt(event_reminder_delay,10),
    event_description, event_link,
    user, attendees.join(',')
  ]);


  //getting emaillist from db which is basically just event_attendees variable from body
  const attenders = await db.any(
    `SELECT eventemaillist FROM events WHERE eventid =$1`, [event_result.eventid]
  );

  const event_id = event_result.eventid;

  // associate with user

  await db.none(`
    INSERT INTO users_to_events(username,eventid)
    VALUES($1,$2)


  `, [user, eventid]);

  //seperate the event email list by commas and add each value into the attendees db
  let attendees = event_attendees.replace(" ", "").split(',');


  try {
    for (const attendee of attendees) 
      {
        const attendee_exists = await db.any('SELECT attendeeemail FROM events_to_attendees WHERE eventid=$1 AND attendeeemail=$2', [event_id, attendee]);
        if(attendee_exists.length<1){
          await db.none(`
            INSERT INTO events_to_attendees (eventid,attendeeemail,rsvp)
            VALUES($1,$2,$3)
          `, [eventid, attendee,"p"]);
        }
        
        const user_exists = await db.any(`SELECT attendeeemail FROM attendees WHERE attendeeemail= $1`, [attendee]);
        if(user_exists.length <1){
          await db.none(`
            INSERT INTO attendees (attendeeemail) 
            VALUES($1)
          `, [attendee]);
        }
        
        console.log(attendee);
      }
  } catch (e) {
    console.log("error creating event:" + e);
  }


  //link email module
  const eventDateTime = new Date(`${event_date}T${event_time}`).getTime();
CreateEvent(
  event_attendees.split(',').map(e => e.trim()).push(user), 
  event_name,
  eventDateTime, 
  parseInt(event_reminder_delay, 10),
  event_link,
  event_description
);
  res.redirect('/calendar');
});



app.get('/rsvp', async (req, res) => 
{
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
    FROM events WHERE eventid IN
    (SELECT eventid FROM events_to_attendees
    WHERE attendeeemail = $1 AND rsvp = 'p')
    ORDER BY eventdate;
  `, [user]);
  console.log(events);
  res.render('pages/rsvp',{events});
});


app.post('/rsvp', async (req, res) => 
{
  const {
    event_id, rsvp_status
  } = req.body;
  const user = req.session.currentUser[0].username;

  if (rsvp_status == 'accept')
  {
    rsvp_stat = 'a';
  }
  else if (rsvp_status == 'decline')
  {
    rsvp_stat = 'd';
  }
  
  const event_result = await db.one(`
    UPDATE events_to_attendees
    SET rsvp = ${rsvp_stat}
    WHERE eventid = '${event_id}' AND attendeeemail = '${user}';`);
  
  console.log(event_result);
});

app.get('/rsvp', async (req, res) => 
{
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
    FROM events WHERE eventid IN
    (SELECT eventid FROM events_to_attendees
    WHERE attendeeemail = $1 AND rsvp = 'p')
    ORDER BY eventdate;
  `, [user]);
  console.log(events);
  res.render('pages/rsvp',{events});
});


app.post('/rsvp', async (req, res) => 
{
  const {
    event_id, rsvp_status
  } = req.body;
  const user = req.session.currentUser[0].username;

  if (rsvp_status == 'accept')
  {
    rsvp_stat = 'a';
  }
  else if (rsvp_status == 'decline')
  {
    rsvp_stat = 'd';
  }
  
  const event_result = await db.one(`
    UPDATE events_to_attendees
    SET rsvp = ${rsvp_stat}
    WHERE eventid = '${event_id}' AND attendeeemail = '${user}';`);
  
  console.log(event_result);
});

// === UPDATED EDIT handler ===
app.post('/calendar/edit', async (req, res) => {
  try{
    const {
      event_id, event_name, event_category,
      event_date, event_time,
      event_reminder_delay, event_description,
      event_link, new_event_attendees
    } = req.body;
    const dt = new Date(`${event_date}T${event_time}`);
    const sqlTs = dt.toISOString().slice(0,19).replace('T',' ');
    
    let new_attendees = new_event_attendees.split(',')
    .map(email => email.trim())
    .filter(email=>email.length>0);
    
    
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
      new_attendees.join(','), event_id
    ]);

    let current_attendees = await db.any(
      `SELECT attendeeemail FROM events_to_attendees where eventid = $1`, 
      [event_id]
    );
    let current_emails = current_attendees.map(a=> a.attendeeemail);

    // Remove attendees that are no longer in the list
    const toRemove = current_emails.filter(email => !new_attendees.includes(email));
    for (const email of toRemove) {
      await db.none(
        'DELETE FROM events_to_attendees WHERE eventid = $1 AND attendeeemail = $2',
        [event_id, email]
      );
    }

    // Add new attendees
    const toAdd = new_attendees.filter(email => !current_emails.includes(email));
    for (const email of toAdd) {
      // Check if attendee exists in attendees table
      const attendeeExists = await db.oneOrNone(
        'SELECT 1 FROM attendees WHERE attendeeemail = $1', 
        [email]
      );
      
      if (!attendeeExists) {
        await db.none(
          'INSERT INTO attendees (attendeeemail) VALUES ($1)',
          [email]
        );
      }

      await db.none(
        'INSERT INTO events_to_attendees (eventid, attendeeemail) VALUES ($1, $2)',
        [event_id, email]
      );
    }

    res.redirect('/calendar');

  }catch (err) {
    console.error('Error in /calendar/edit:', err);
    res.status(500).send('An error occurred while updating the event.', err);
  }

});

// DELETE (unchanged)
app.post('/calendar/delete', async (req, res) => {
  await db.none('DELETE FROM events WHERE eventid=$1', [req.body.event_id]);
  res.redirect('/calendar');
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

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    // ensure the template helper sees no user
    res.locals.user = null;
    // render logout page—navbar will now show the Login button
    res.render('pages/logout', {});
  });
});

// Render the settings page (unchanged)
app.get('/settings', auth, (req, res) => {
  const user = req.session.currentUser[0];
  res.render('pages/settings', { user });
});

// Handle settings update (unchanged)
app.post('/settings', auth, async (req, res) => {
  const { username, email, currentPassword, newPassword } = req.body;
  const user = req.session.currentUser[0];

  // Verify current password
  const validPassword = await bcrypt.compare(currentPassword, user.password);
  if (!validPassword) {
    return res.render('pages/settings', { error: true, message: 'Incorrect current password', user });
  }

  // Update user information
  const updates = [];
  const params = [];

  if (username && username !== user.username) {
    updates.push('username=$1');
    params.push(username);
  }

  if (email && email !== user.email) {
    updates.push('email=$2');
    params.push(email);
  }

  if (newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    updates.push('password=$3');
    params.push(hashedPassword);
  }

  if (updates.length > 0) {
    const query = `UPDATE users SET ${updates.join(', ')} WHERE username=$4`;
    params.push(user.username);
    await db.none(query, params);
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


//example: http://localhost:3000/rsvp/203?email=micahgagerman21@gmail.com
// gets event 203, under the users username making the reqest say  micahgagerman21@gmail.com
app.get("/rsvp/:event_id", async (req,res) => {
  //get event ID & email address
  let event_id = req.params.event_id
  let email_address = -1 //should be current users username
  ///need rsvp setup in database to continue 
  /**@todo */

  //1) make sure user is logged in with this email address
  // Verify current password

  //if not send to login
  //res.render('pages/error', {
// error: "example"
 // });
  //1) check if this event id is real
  //2) check if user has this event fr
  //3) if all true, render rsvp page
  res.render('pages/rsvp', {
    event_id
  });
})

app.post("/rsvp/:event_id", (req,res) => {
  /** @todo */
  //update status, remove from email list if no 
  let event_id = req.params.event_id
  let email_address = -1 //should be current users username
  let option_selected =  req.body.options

  console.log(event_id,option_selected);
})





// *****************************************************
// <!-- Section 5 : Start Server--> 
// *****************************************************

app.listen(3000, () => console.log('Server listening on port 3000'));