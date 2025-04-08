CREATE TABLE users
(
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(60) NOT NULL
);

CREATE TABLE events
(
    eventID SERIAL PRIMARY KEY,
    eventName VarChar(120) NOT NULL,
    eventCategory VarChar (120),
    eventDate DATE NOT NULL,
    eventTime time(0) NOT NULL,
    eventDescription TEXT,
    eventUser VARCHAR(50) NOT NULL
);