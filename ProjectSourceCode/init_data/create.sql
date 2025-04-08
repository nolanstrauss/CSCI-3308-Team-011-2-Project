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
    eventID VARCHAR(50) PRIMARY KEY,
    eventName VarChar(120),
    eventTime time(0),
    eventDate DATE,
    user VARCHAR(50)
);