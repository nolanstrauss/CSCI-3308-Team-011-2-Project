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
    eventdate VarChar(60) NOT NULL,
    eventreminderdelay INT NOT NULL,
    eventdescription TEXT,
    eventlink VarChar(520),
    eventemaillist VarChar(1000),
    eventuser VARCHAR(50) NOT NULL
);

