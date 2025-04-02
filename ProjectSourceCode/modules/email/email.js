// import nodeMailer
const nodemailer = require("nodemailer");
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
// custom functions

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


let events = [];


// upon creation of an event, send a confirmation email to all recipients
let sendConformationEmail = async (userEmails,event_name,event_time,reminder_time) => {
  subject = `New Event: ${event_name}`
  html = `<div>Your event ${event_name} starts at ${event_time}<div>`
  // go recipient each email and send the email :O
  userEmails.forEach(email => sendEmail(email,subject,"",html));
  // add event
  events.push({
    userEmails: userEmails,
    event_name,
    event_time,
    reminder_time
  });
} 


// done automatically in event loop, do not export
let sendReminderEmail = async (userEmails,event_name,event_time,reminder_time) => {
  //@todo
}







let EmailEventLoop = async() => {
  const date = new Date();
  setInterval(()=>{
    // get time
    let currTime = date.getTime() 
    // check if n minutes before someones event
    for(let i = 0; i<events.length; i++) {
      if(events[i].event_time-reminder_time <= currTime) {
        // send email to each recipient
        sendReminderEmail(events[i].userEmails,event_name,event_time,reminder_time);
        // remove event from set
        events.splice(i,1);
      }
    }
  },60000)//repeat every minute
}




(async ()=>{
    // Note: this wont work with CU affiliated emails
})()

// // export functions
// export default {

// }