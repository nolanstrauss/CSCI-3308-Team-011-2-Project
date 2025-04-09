let {createEvent} = require("./email");
createEvent(
    ["micahgagerman21@gmail.com"], // list of emails to send to
    "Test Event", //name of event
    new Date(Date.now() + 300000), // 5 minutes from now
    2 // 2-minute reminder
);