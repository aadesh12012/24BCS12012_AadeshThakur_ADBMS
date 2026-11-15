-- =============================================================================
-- ADBMS Project: Banking Management System with Fraud Detection
-- Component: PL/pgSQL Stored Functions
-- Concepts: Deterministic / Scalar functions, Auditing, Aggregations
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FUNCTION: Get Account Balance by Account Number
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_account_balance(p_account_number VARCHAR(20))
RETURNS NUMERIC(15, 2)
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance NUMERIC(15, 2);
BEGIN
    SELECT balance INTO v_balance
    FROM BANK_ACCOUNTS
    WHERE account_number = p_account_number;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account number % not found', p_account_number;
    END IF;

    RETURN v_balance;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. FUNCTION: Ledger Audit Reconciliation
-- Computes expected balance based on sum of transactions vs current balance
-- Demonstrates SQL Aggregations and Integrity Verifications
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calculate_ledger_balance(p_account_id INT)
RETURNS TABLE (
    account_id INT,
    account_number VARCHAR(20),
    current_stored_balance NUMERIC(15, 2),
    total_deposits NUMERIC(15, 2),
    total_withdrawals NUMERIC(15, 2),
    total_transfers_sent NUMERIC(15, 2),
    total_transfers_received NUMERIC(15, 2),
    calculated_balance NUMERIC(15, 2),
    is_reconciled BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_acc_num VARCHAR(20);
    v_stored_bal NUMERIC(15, 2);
    v_dep NUMERIC(15, 2) := 0;
    v_wdr NUMERIC(15, 2) := 0;
    v_sent NUMERIC(15, 2) := 0;
    v_rcvd NUMERIC(15, 2) := 0;
    v_calc NUMERIC(15, 2) := 0;
BEGIN
    -- Get account info
    SELECT ba.account_number, ba.balance
    INTO v_acc_num, v_stored_bal
    FROM BANK_ACCOUNTS ba
    WHERE ba.account_id = p_account_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account ID % not found', p_account_id;
    END IF;

    -- Total deposits (only completed/approved)
    SELECT COALESCE(SUM(amount), 0.00) INTO v_dep
    FROM TRANSACTIONS
    WHERE account_id = p_account_id
      AND transaction_type = 'DEPOSIT'
      AND status NOT IN ('REJECTED');

    -- Total withdrawals
    SELECT COALESCE(SUM(amount), 0.00) INTO v_wdr
    FROM TRANSACTIONS
    WHERE account_id = p_account_id
      AND transaction_type = 'WITHDRAWAL'
      AND status NOT IN ('REJECTED');

    -- Total transfers sent
    SELECT COALESCE(SUM(amount), 0.00) INTO v_sent
    FROM TRANSACTIONS
    WHERE account_id = p_account_id
      AND transaction_type = 'TRANSFER'
      AND status NOT IN ('REJECTED');

    -- Total transfers received
    SELECT COALESCE(SUM(amount), 0.00) INTO v_rcvd
    FROM TRANSACTIONS
    WHERE receiver_account_id = p_account_id
      AND transaction_type = 'TRANSFER'
      AND status NOT IN ('REJECTED');

    -- Note: Initial balance plus deposits plus transfers received minus withdrawals minus transfers sent
    -- For demonstration, we compare the current balance
    v_calc := v_dep + v_rcvd - v_wdr - v_sent;

    RETURN QUERY
    SELECT
        p_account_id,
        v_acc_num,
        v_stored_bal,
        v_dep,
        v_wdr,
        v_sent,
        v_rcvd,
        v_calc,
        (v_stored_bal = v_calc);
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. FUNCTION: Count Recent Transactions within Interval
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_count_recent_transactions(p_account_id INT, p_seconds INT DEFAULT 60)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM TRANSACTIONS
    WHERE account_id = p_account_id
      AND transaction_date >= (CURRENT_TIMESTAMP - (p_seconds || ' seconds')::INTERVAL);

    RETURN v_count;
END;
$$;
