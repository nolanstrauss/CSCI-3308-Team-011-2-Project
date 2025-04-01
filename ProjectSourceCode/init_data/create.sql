CREATE TABLE users
(
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(60) NOT NULL
);

CREATE TABLE events
(
    eventID VARCHAR(50) PRIMARY KEY,
    eventName VarChar(120),
    eventTime time(0),
    eventDate DATE,
    user VARCHAR(50)
);