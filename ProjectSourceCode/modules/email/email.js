// import nodeMailer
const nodemailer = require("nodemailer");
const _ = require("lodash")
require("dotenv").config()

// TODO: Implement user authentication
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
        html,
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
  let subject = `New Event: ${event.event_name}`
  let html = `<div>Your event ${event.event_name} starts at ${event.event_time}<div>`
  // go recipient each email and send the email :O
  for(let i = 0; i<event.user_emails.length; i++) {
    let curr_email = event.user_emails[i];
    try {
      await sendEmail(curr_email,subject,"",html)
    } catch {
      console.log("failed to send email to: " + curr_email)
    }
  }
} 


// done automatically in event loop, do not export
let sendReminderEmail = async (event) => {
  // subject and html to be updated later in my next task
  let subject = `Event Upcoming: ${event.event_name}`
  let html = `<div>Your event ${event.event_name} starts at ${event.event_time}<div>`
  for(let i = 0; i<event.user_emails.length; i++) {
    let curr_email = event.user_emails[i];
    try {
      await sendEmail(curr_email,subject,"",html)
    } catch {
      console.log("failed to send email to: " + curr_email)
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
      if(events[i].event_time-events[i].reminder_time <= currTime) {
        // send email to each recipient
        await sendReminderEmail(events[i]);
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
  } catch {
    console.log("failed to send confirmation email")
  }
}

export default {createEvent}