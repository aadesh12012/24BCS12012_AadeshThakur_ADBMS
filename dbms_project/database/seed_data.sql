-- =============================================================================
-- ADBMS Project: Banking Management System with Fraud Detection
-- Component: Sample Dataset (Seed Data)
-- Includes: 3 Customers, 3 Bank Accounts, 1 Admin, Initial Normal Transactions
-- =============================================================================

-- Clear existing data
TRUNCATE TABLE FRAUD_ALERTS, TRANSACTIONS, LOGIN_ATTEMPTS, BANK_ACCOUNTS, CUSTOMERS, ADMINS RESTART IDENTITY CASCADE;

-- -----------------------------------------------------------------------------
-- 1. INSERT ADMIN
-- -----------------------------------------------------------------------------
INSERT INTO ADMINS (username, password, full_name, email, role)
VALUES ('admin', 'admin123', 'System Administrator', 'admin@apexbank.com', 'SUPER_ADMIN');

-- -----------------------------------------------------------------------------
-- 2. INSERT 3 CUSTOMERS
-- -----------------------------------------------------------------------------
INSERT INTO CUSTOMERS (full_name, email, phone, username, password, address, status) VALUES
('Rajesh Sharma', 'rajesh.sharma@example.com', '+91 98765 43210', 'rajesh', 'password123', 'Flat 402, Green Valley Apartments, Mumbai', 'ACTIVE'),
('Priya Patel', 'priya.patel@example.com', '+91 98123 45678', 'priya', 'password123', '12B, Sunrise Residency, Ahmedabad', 'ACTIVE'),
('Amit Kumar', 'amit.kumar@example.com', '+91 97234 56789', 'amit', 'password123', 'Plot 88, Sector 14, Gurugram', 'ACTIVE');

-- -----------------------------------------------------------------------------
-- 3. INSERT 3 BANK ACCOUNTS (Initial Balances: ₹100,000 / ₹75,000 / ₹50,000)
-- -----------------------------------------------------------------------------
INSERT INTO BANK_ACCOUNTS (customer_id, account_number, account_type, balance, is_active) VALUES
(1, 'ACC1001001', 'SAVINGS', 100000.00, TRUE),
(2, 'ACC1001002', 'SAVINGS', 75000.00, TRUE),
(3, 'ACC1001003', 'CURRENT', 50000.00, TRUE);

-- -----------------------------------------------------------------------------
-- 4. INSERT INITIAL NORMAL TRANSACTIONS
-- Note: These amounts are well below ₹50,000 to remain normal and completed
-- -----------------------------------------------------------------------------
INSERT INTO TRANSACTIONS (account_id, receiver_account_id, transaction_type, amount, description, status, transaction_date) VALUES
(1, NULL, 'DEPOSIT', 25000.00, 'Initial branch cash deposit', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(2, NULL, 'DEPOSIT', 15000.00, 'Initial branch cash deposit', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(1, 2, 'TRANSFER', 5000.00, 'Dinner reimbursement', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '1 day'),
(3, NULL, 'DEPOSIT', 20000.00, 'Vendor invoice payment', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '18 hours'),
(2, NULL, 'WITHDRAWAL', 2000.00, 'ATM cash withdrawal', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '6 hours');
