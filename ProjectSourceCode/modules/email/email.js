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

async function sendEmail(to, subject, text, html = null) {
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
(async ()=>{
    // Note: this wont work with CU affiliated emails
    await sendEmail("micahgagerman21@gmail.com","Subject","preview text maybe??",`<div id="email_body"><h1>Cool awesome title</h1><p>this will soon be a really cool email body</p></div>`);
})()

// // export functions
// export default {

// }