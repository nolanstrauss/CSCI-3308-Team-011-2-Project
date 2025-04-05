CREATE TABLE users
(
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(60) NOT NULL
);

CREATE TABLE events
(
    eventID VARCHAR(50) PRIMARY KEY,
    eventName VARCHAR(120),
    eventTime TIME(0),
    eventDate DATE,
    "user" VARCHAR(50)  -- FIXED: properly quoted
);
