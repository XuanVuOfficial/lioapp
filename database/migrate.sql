-- Init migrations
ALTER TABLE users ADD COLUMN hireDate VARCHAR(50);

CREATE TABLE IF NOT EXISTS user_fcm_tokens (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token TEXT NOT NULL,
    updatedAt VARCHAR(50) NOT NULL
);
