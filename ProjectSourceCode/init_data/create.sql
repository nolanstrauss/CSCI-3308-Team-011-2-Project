CREATE TABLE users
(
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(60) NOT NULL
);

CREATE TABLE users_to_events
(
    username VARCHAR(50),
    eventid VARCHAR(50)
);

CREATE TABLE events
(
    eventid Serial PRIMARY KEY,
    eventname VarChar(120) NOT NULL,
    eventcategory VarChar (120),
    eventdate TIMESTAMP NOT NULL,
    eventreminderdelay INT NOT NULL,
    eventdescription TEXT,
    eventlink VarChar(520),
    eventuser VarChar(50),
    eventemaillist VarChar(1000)
);


CREATE TABLE events_to_attendees
(
    eventid INT,
    attendeeemail VARCHAR(100)
);

CREATE TABLE attendees 
(
    attendeeemail VARCHAR(100) PRIMARY KEY,
    attendeeusername VARCHAR(50)
);

