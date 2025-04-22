CREATE TABLE users
(
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(60) NOT NULL
);

CREATE TABLE users_to_events
(
    username VARCHAR(50),
    eventID VARCHAR(50)
);

CREATE TABLE events
(
    eventID Serial PRIMARY KEY,
    eventName VarChar(120) NOT NULL,
    eventCategory VarChar (120),
    eventDate VarChar(60) NOT NULL,
    eventReminderDelay INT NOT NULL,
    eventDescription TEXT,
    eventLink VarChar(520),
    eventEmailList VarChar(1000),
    eventUser VARCHAR(50) NOT NULL
);

