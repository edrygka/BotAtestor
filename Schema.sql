CREATE TABLE user_verification_process(
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, 
    verifyCode INTEGER NULL,
    address CHAR(32) NULL,
    unit CHAR(32) NULL,
    amount INTEGER NULL,
    email VARCHAR(50) NULL,
    status VARCHAR(50) DEFAULT unverified,
    deviceAddress VARCHAR(50),
    cancelDate timestamp,
    FOREIGN KEY (address) REFERENCES my_addresses(address),
    FOREIGN KEY (unit) REFERENCES units(unit),
    FOREIGN KEY (deviceAddress) REFERENCES devices(device_address)
    );