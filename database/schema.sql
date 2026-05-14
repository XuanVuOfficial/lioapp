CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    displayName VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    departmentId VARCHAR(50),
    password VARCHAR(255),
    managedDeptIds JSON,
    createdAt BIGINT,
    createdBy VARCHAR(50),
    updatedAt BIGINT,
    avatarUrl TEXT,
    mustChangePassword BOOLEAN DEFAULT FALSE,
    hireDate VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    managerEmail VARCHAR(255),
    managerName VARCHAR(255),
    parentId VARCHAR(50),
    level INT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    abbreviation VARCHAR(50) NOT NULL,
    createdAt VARCHAR(50),
    createdByEmail VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS leads (
    id VARCHAR(50) PRIMARY KEY,
    creatorEmail VARCHAR(255) NOT NULL,
    createdAt VARCHAR(50) NOT NULL,
    assignedToEmail VARCHAR(255),
    assignedByEmail VARCHAR(255),
    departmentId VARCHAR(50),
    projectId VARCHAR(50),
    customerCode VARCHAR(100),
    customerName VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    status VARCHAR(100) NOT NULL,
    subStatus VARCHAR(100),
    appointmentStatus VARCHAR(100),
    resultStatus VARCHAR(100),
    details TEXT,
    updatedAt VARCHAR(50) NOT NULL,
    updatedByEmail VARCHAR(255) NOT NULL,
    imageUrl TEXT,
    interestLevel VARCHAR(100),
    notes TEXT,
    history JSON
);

CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR(50) PRIMARY KEY,
    tabVisibility JSON,
    roleLimits JSON
);
