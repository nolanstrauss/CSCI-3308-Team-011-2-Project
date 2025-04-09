// import nodeMailer
const nodemailer = require("nodemailer");
// lodash for convenience 
const _ = require("lodash")

// config env
require("dotenv").config({path: "../../.env"});

// import templates
let {confirmation_email_template, reminder_email_template} = require("./templates")
// config nodeMailer
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: {
        user: process.env.BREVO_ADDRESS,
        pass: process.env.EMAIL_SMTP_KEY,
    },
});

// Events
// structure to store active events
class Events {
  constructor() {
    this.events = []
  }

  push(event) {
    this.events.push(event)
  }

  // remove event by event object
  removeEventByEvent(event) {
    // go through each event and check if deeply equal
    for(let i = 0; i<this.events.length; i++) {
      if(_.isEqual(this.events[i],event)) {
        this.events.splice(i,1);
        return true;
      }
    }
    return false;
  }

  // remove event by id
  removeEventById(id) {
    this.events.splice(id,1)
  }


  get length() {
    return this.events.length;
  }

  get(i) {
    return this.events[i];
  }
}

// struct to store a given event details
class Event {
  constructor(user_emails,event_name,event_time,reminder_time) {
    this.user_emails = user_emails;
    this.event_name = event_name;
    this.event_time = event_time;
    this.reminder_time = reminder_time;
  }
}


let events = new Events()

// custom functions (private)
async function sendEmail(to, subject, text, html) {
    try {
      const mailOptions = {
        from: process.env.GMAIL_ADDRESS,
        to,
        subject,
        text,
        html
      };
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent: ${info.response}`);
    } catch (e) {
      console.error('Error sending email:', e);
    }
}

// upon creation of an event, send a confirmation email to all recipients
let sendConfirmationEmail = async (event) => {
  // subject and html to be updated later in my next task

  // sample, will be updated in next task
  let subject = `New Event: ${event.event_name}`
  // go recipient each email and send the email :O
  for(let i = 0; i<event.user_emails.length; i++) {
    let html = confirmation_email_template(event,i);
    try {
      await sendEmail(event.user_emails[i],subject,"",html)
    } catch {
      console.log("failed to send email to: " + event.user_emails[i])
    }
  }
} 


// done automatically in event loop, do not export
let sendReminderEmail = async (event) => {
  // subject and html to be updated later in my next task

  // sample, will be updated in next task
  let subject = `Event Upcoming: ${event.event_name}`
  for(let i = 0; i<event.user_emails.length; i++) {
    let html = reminder_email_template(event,i);
    try {
      await sendEmail(event.user_emails[i],subject,"",html)
    } catch {
      console.log("failed to send email to: " + event.user_emails[i])
    }
  }
}

let EmailEventLoop = async() => {
  setInterval(async ()=>{
    // get time
    let currTime = (new Date()).getTime() 
    // check if n minutes before someones event
    // go from end to front of list so we dont have weird indexing issues after removals
    for(let i = events.length-1; i>=0; i--) {
      if(events.get(i).event_time- (events.get(i).reminder_time*60000) <= currTime) {
        // send email to each recipient
        await sendReminderEmail(events.get(i));
        // remove event from set
        events.removeEventById(i);
      }
    }
  },60000)//repeat every minute
}

// upon import, begin email event loop 
(async ()=>{
    console.log("Email Event Loop Started!")
    EmailEventLoop()
})()

// public methods
let createEvent = async(user_emails,event_name,event_time,reminder_time) => {
  let event = new Event(user_emails,event_name,event_time,reminder_time);
  // send email
  try {
    await sendConfirmationEmail(event);
  } catch (e) {
    console.log(e);
    console.log("failed to send confirmation email")
    return;
  }

  events.push(event);
}


module.exports = {createEvent}