let {CreateEvent,RemoveUserFromEvent} = require("./email");
CreateEvent(
    ["micahgagerman21@gmail.com"], // list of emails to send to
    "awsome event", //name of event
    new Date(Date.now() + 15000), // 15 seconds from now
    2, // 2-minute reminder
    "https://google.com",
    "a really cool website so awesome"
);
// console.log("about to remove user in 30 seconds")
// setTimeout(() => RemoveUserFromEvent("cysteely@gmail.com","Test Event"),30000)