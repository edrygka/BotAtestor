CREATE TABLE VerificationCode(
    Id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, 
    VerifyCode VARCHAR(50) NULL,
    Address CHAR(32) NULL UNIQUE,
    Email VARCHAR(50) NULL UNIQUE,
    Status VARCHAR(50) DEFAULT unverified
    );