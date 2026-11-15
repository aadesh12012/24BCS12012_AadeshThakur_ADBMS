-- =============================================================================
-- ADBMS Project: Banking Management System with Fraud Detection
-- Component: SQL Views for Reporting & Analytics
-- Concepts: Multi-table JOINs, Aggregations, Outer Joins, Reporting Views
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. VIEW: Customer Transaction History (with Sender & Receiver Resolution)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_customer_transaction_history AS
SELECT 
    t.transaction_id,
    t.account_id,
    sa.account_number AS sender_account_number,
    sc.full_name AS sender_name,
    sc.username AS sender_username,
    t.receiver_account_id,
    ra.account_number AS receiver_account_number,
    rc.full_name AS receiver_name,
    t.transaction_type,
    t.amount,
    '₹' || TO_CHAR(t.amount, 'FM99,99,999.00') AS formatted_amount,
    t.description,
    t.status,
    t.transaction_date,
    TO_CHAR(t.transaction_date, 'DD-Mon-YYYY HH12:MI:SS AM') AS formatted_date
FROM TRANSACTIONS t
JOIN BANK_ACCOUNTS sa ON t.account_id = sa.account_id
JOIN CUSTOMERS sc ON sa.customer_id = sc.customer_id
LEFT JOIN BANK_ACCOUNTS ra ON t.receiver_account_id = ra.account_id
LEFT JOIN CUSTOMERS rc ON ra.customer_id = rc.customer_id;

-- -----------------------------------------------------------------------------
-- 2. VIEW: Suspicious Transactions View (for Admin Risk Management)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_suspicious_transactions AS
SELECT 
    t.transaction_id,
    t.transaction_date,
    TO_CHAR(t.transaction_date, 'DD-Mon-YYYY HH12:MI:SS AM') AS formatted_date,
    c.full_name AS customer_name,
    c.username,
    c.phone,
    ba.account_number,
    t.transaction_type,
    t.amount,
    '₹' || TO_CHAR(t.amount, 'FM99,99,999.00') AS formatted_amount,
    t.status AS transaction_status,
    fa.alert_id,
    fa.alert_type,
    fa.severity,
    fa.alert_message,
    fa.threshold_value,
    fa.actual_value,
    fa.status AS alert_status
FROM TRANSACTIONS t
JOIN BANK_ACCOUNTS ba ON t.account_id = ba.account_id
JOIN CUSTOMERS c ON ba.customer_id = c.customer_id
LEFT JOIN FRAUD_ALERTS fa ON t.transaction_id = fa.transaction_id
WHERE t.status = 'SUSPICIOUS' OR fa.status = 'PENDING';

-- -----------------------------------------------------------------------------
-- 3. VIEW: Fraud Alerts Management Detail View
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_fraud_alerts_detail AS
SELECT 
    fa.alert_id,
    fa.alert_type,
    fa.severity,
    fa.alert_message,
    fa.threshold_value,
    fa.actual_value,
    fa.status AS alert_status,
    fa.created_at,
    TO_CHAR(fa.created_at, 'DD-Mon-YYYY HH12:MI:SS AM') AS formatted_created_at,
    fa.resolved_at,
    fa.resolved_by,
    fa.resolution_remarks,
    ba.account_number,
    c.full_name AS customer_name,
    c.username,
    t.transaction_id,
    t.transaction_type,
    t.amount AS transaction_amount,
    t.status AS transaction_status
FROM FRAUD_ALERTS fa
LEFT JOIN BANK_ACCOUNTS ba ON fa.account_id = ba.account_id
LEFT JOIN CUSTOMERS c ON ba.customer_id = c.customer_id
LEFT JOIN TRANSACTIONS t ON fa.transaction_id = t.transaction_id;

-- -----------------------------------------------------------------------------
-- 4. VIEW: Bank Accounts Overview (Customer & Account Mapping)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_bank_accounts_overview AS
SELECT 
    ba.account_id,
    ba.account_number,
    ba.account_type,
    ba.balance,
    '₹' || TO_CHAR(ba.balance, 'FM99,99,999.00') AS formatted_balance,
    ba.is_active,
    ba.created_at,
    c.customer_id,
    c.full_name AS customer_name,
    c.username,
    c.email,
    c.phone,
    c.status AS customer_status
FROM BANK_ACCOUNTS ba
JOIN CUSTOMERS c ON ba.customer_id = c.customer_id;

-- -----------------------------------------------------------------------------
-- 5. VIEW: Admin Analytics & Metrics Dashboard Summary
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_admin_analytics AS
SELECT 
    (SELECT COUNT(*) FROM CUSTOMERS) AS total_customers,
    (SELECT COUNT(*) FROM BANK_ACCOUNTS WHERE is_active = TRUE) AS total_active_accounts,
    (SELECT COALESCE(SUM(balance), 0.00) FROM BANK_ACCOUNTS) AS total_bank_balance,
    (SELECT COUNT(*) FROM TRANSACTIONS) AS total_transactions,
    (SELECT COUNT(*) FROM TRANSACTIONS WHERE status = 'SUSPICIOUS') AS total_suspicious_transactions,
    (SELECT COUNT(*) FROM FRAUD_ALERTS WHERE status = 'PENDING') AS pending_fraud_alerts,
    (SELECT COUNT(*) FROM FRAUD_ALERTS WHERE status = 'APPROVED') AS approved_fraud_alerts,
    (SELECT COUNT(*) FROM FRAUD_ALERTS WHERE status = 'REJECTED') AS rejected_fraud_alerts;
