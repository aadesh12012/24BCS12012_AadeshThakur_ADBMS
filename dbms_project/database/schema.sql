-- =============================================================================
-- ADBMS Project: Banking Management System with Fraud Detection
-- Component: Database Schema (Tables, Constraints, Sequences, Indexes)
-- RDBMS: PostgreSQL
-- =============================================================================

-- Drop tables if they exist in reverse order of foreign keys
DROP TABLE IF EXISTS FRAUD_ALERTS CASCADE;
DROP TABLE IF EXISTS TRANSACTIONS CASCADE;
DROP TABLE IF EXISTS LOGIN_ATTEMPTS CASCADE;
DROP TABLE IF EXISTS BANK_ACCOUNTS CASCADE;
DROP TABLE IF EXISTS CUSTOMERS CASCADE;
DROP TABLE IF EXISTS ADMINS CASCADE;

-- -----------------------------------------------------------------------------
-- 1. CUSTOMERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE CUSTOMERS (
    customer_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    address TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOCKED', 'SUSPENDED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast customer login lookup
CREATE INDEX idx_customers_username ON CUSTOMERS(username);

-- -----------------------------------------------------------------------------
-- 2. BANK_ACCOUNTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE BANK_ACCOUNTS (
    account_id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES CUSTOMERS(customer_id) ON DELETE CASCADE,
    account_number VARCHAR(20) UNIQUE NOT NULL,
    account_type VARCHAR(20) DEFAULT 'SAVINGS' CHECK (account_type IN ('SAVINGS', 'CURRENT', 'SALARY')),
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index on customer_id for joins and account_number for lookup
CREATE INDEX idx_accounts_customer_id ON BANK_ACCOUNTS(customer_id);
CREATE INDEX idx_accounts_account_number ON BANK_ACCOUNTS(account_number);

-- -----------------------------------------------------------------------------
-- 3. TRANSACTIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE TRANSACTIONS (
    transaction_id SERIAL PRIMARY KEY,
    account_id INT NOT NULL REFERENCES BANK_ACCOUNTS(account_id) ON DELETE CASCADE,
    receiver_account_id INT REFERENCES BANK_ACCOUNTS(account_id) ON DELETE SET NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0.00),
    description VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'SUSPICIOUS', 'PENDING', 'APPROVED', 'REJECTED')),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for querying transactions by account and date range
CREATE INDEX idx_transactions_account_id ON TRANSACTIONS(account_id);
CREATE INDEX idx_transactions_date ON TRANSACTIONS(transaction_date DESC);
CREATE INDEX idx_transactions_status ON TRANSACTIONS(status);

-- -----------------------------------------------------------------------------
-- 4. FRAUD_ALERTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE FRAUD_ALERTS (
    alert_id SERIAL PRIMARY KEY,
    transaction_id INT REFERENCES TRANSACTIONS(transaction_id) ON DELETE SET NULL,
    account_id INT REFERENCES BANK_ACCOUNTS(account_id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('HIGH_VALUE', 'RAPID_TRANSACTION', 'FAILED_LOGINS')),
    severity VARCHAR(20) NOT NULL DEFAULT 'HIGH' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    alert_message TEXT NOT NULL,
    threshold_value NUMERIC(15, 2),
    actual_value NUMERIC(15, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(50),
    resolution_remarks TEXT
);

CREATE INDEX idx_fraud_alerts_status ON FRAUD_ALERTS(status);
CREATE INDEX idx_fraud_alerts_account_id ON FRAUD_ALERTS(account_id);

-- -----------------------------------------------------------------------------
-- 5. ADMINS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE ADMINS (
    admin_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(30) DEFAULT 'SUPER_ADMIN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 6. LOGIN_ATTEMPTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE LOGIN_ATTEMPTS (
    attempt_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45) DEFAULT '127.0.0.1',
    attempt_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_successful BOOLEAN NOT NULL,
    failure_reason VARCHAR(100)
);

CREATE INDEX idx_login_attempts_username_time ON LOGIN_ATTEMPTS(username, attempt_time DESC);
