-- =============================================================================
-- ADBMS Project: Banking Management System with Fraud Detection
-- Component: PL/pgSQL Stored Procedures & Transaction Management
-- Concepts: ACID Properties, Row Locking (FOR UPDATE), Atomicity, Exception Handling
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DEPOSIT MONEY PROCEDURE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_deposit_money(
    p_account_number VARCHAR(20),
    p_amount NUMERIC(15, 2),
    p_description VARCHAR(255),
    INOUT p_transaction_id INT DEFAULT NULL,
    INOUT p_status VARCHAR(20) DEFAULT NULL,
    INOUT p_new_balance NUMERIC(15, 2) DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_account_id INT;
    v_current_balance NUMERIC(15, 2);
    v_is_active BOOLEAN;
BEGIN
    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Deposit amount must be greater than zero. Received: %', p_amount;
    END IF;

    -- Concurrency control: Lock account row for update
    SELECT account_id, balance, is_active
    INTO v_account_id, v_current_balance, v_is_active
    FROM BANK_ACCOUNTS
    WHERE account_number = p_account_number
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account number % does not exist.', p_account_number;
    END IF;

    IF v_is_active = FALSE THEN
        RAISE EXCEPTION 'Account % is currently inactive or suspended.', p_account_number;
    END IF;

    -- Update balance
    UPDATE BANK_ACCOUNTS
    SET balance = balance + p_amount
    WHERE account_id = v_account_id
    RETURNING balance INTO p_new_balance;

    -- Record transaction (triggers will evaluate fraud rules)
    INSERT INTO TRANSACTIONS (
        account_id,
        receiver_account_id,
        transaction_type,
        amount,
        description,
        status
    ) VALUES (
        v_account_id,
        NULL,
        'DEPOSIT',
        p_amount,
        COALESCE(p_description, 'Deposit of funds'),
        'COMPLETED'
    )
    RETURNING transaction_id, status INTO p_transaction_id, p_status;

EXCEPTION
    WHEN OTHERS THEN
        -- Transaction rollback is managed automatically by PL/pgSQL block
        RAISE EXCEPTION 'Deposit failed: %', SQLERRM;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. WITHDRAW MONEY PROCEDURE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_withdraw_money(
    p_account_number VARCHAR(20),
    p_amount NUMERIC(15, 2),
    p_description VARCHAR(255),
    INOUT p_transaction_id INT DEFAULT NULL,
    INOUT p_status VARCHAR(20) DEFAULT NULL,
    INOUT p_new_balance NUMERIC(15, 2) DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_account_id INT;
    v_current_balance NUMERIC(15, 2);
    v_is_active BOOLEAN;
BEGIN
    -- Validate amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Withdrawal amount must be greater than zero. Received: %', p_amount;
    END IF;

    -- Concurrency control: Lock account row for update
    SELECT account_id, balance, is_active
    INTO v_account_id, v_current_balance, v_is_active
    FROM BANK_ACCOUNTS
    WHERE account_number = p_account_number
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account number % does not exist.', p_account_number;
    END IF;

    IF v_is_active = FALSE THEN
        RAISE EXCEPTION 'Account % is inactive or suspended.', p_account_number;
    END IF;

    -- Validate sufficient funds
    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient funds: Available balance is ₹%, attempted withdrawal is ₹%', 
            v_current_balance, p_amount;
    END IF;

    -- Deduct balance
    UPDATE BANK_ACCOUNTS
    SET balance = balance - p_amount
    WHERE account_id = v_account_id
    RETURNING balance INTO p_new_balance;

    -- Record transaction (triggers will evaluate fraud rules)
    INSERT INTO TRANSACTIONS (
        account_id,
        receiver_account_id,
        transaction_type,
        amount,
        description,
        status
    ) VALUES (
        v_account_id,
        NULL,
        'WITHDRAWAL',
        p_amount,
        COALESCE(p_description, 'Cash withdrawal'),
        'COMPLETED'
    )
    RETURNING transaction_id, status INTO p_transaction_id, p_status;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Withdrawal failed: %', SQLERRM;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. TRANSFER MONEY PROCEDURE (Atomic Money Transfer)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_transfer_money(
    p_from_account VARCHAR(20),
    p_to_account VARCHAR(20),
    p_amount NUMERIC(15, 2),
    p_description VARCHAR(255),
    INOUT p_transaction_id INT DEFAULT NULL,
    INOUT p_status VARCHAR(20) DEFAULT NULL,
    INOUT p_from_new_balance NUMERIC(15, 2) DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_from_id INT;
    v_to_id INT;
    v_from_balance NUMERIC(15, 2);
    v_from_active BOOLEAN;
    v_to_active BOOLEAN;
BEGIN
    -- Validate amount and destination
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transfer amount must be greater than zero. Received: %', p_amount;
    END IF;

    IF p_from_account = p_to_account THEN
        RAISE EXCEPTION 'Source and destination accounts cannot be identical.';
    END IF;

    -- Fetch Account IDs
    SELECT account_id, is_active INTO v_from_id, v_from_active
    FROM BANK_ACCOUNTS WHERE account_number = p_from_account;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source account % does not exist.', p_from_account;
    END IF;

    SELECT account_id, is_active INTO v_to_id, v_to_active
    FROM BANK_ACCOUNTS WHERE account_number = p_to_account;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Destination account % does not exist.', p_to_account;
    END IF;

    IF v_from_active = FALSE OR v_to_active = FALSE THEN
        RAISE EXCEPTION 'One or both accounts are inactive.';
    END IF;

    -- Deadlock prevention: Lock accounts in strictly ascending order of account_id
    IF v_from_id < v_to_id THEN
        SELECT balance INTO v_from_balance FROM BANK_ACCOUNTS WHERE account_id = v_from_id FOR UPDATE;
        PERFORM 1 FROM BANK_ACCOUNTS WHERE account_id = v_to_id FOR UPDATE;
    ELSE
        PERFORM 1 FROM BANK_ACCOUNTS WHERE account_id = v_to_id FOR UPDATE;
        SELECT balance INTO v_from_balance FROM BANK_ACCOUNTS WHERE account_id = v_from_id FOR UPDATE;
    END IF;

    -- Check balance
    IF v_from_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient funds: Available balance ₹% is less than transfer amount ₹%',
            v_from_balance, p_amount;
    END IF;

    -- Atomic debit from sender
    UPDATE BANK_ACCOUNTS
    SET balance = balance - p_amount
    WHERE account_id = v_from_id
    RETURNING balance INTO p_from_new_balance;

    -- Atomic credit to recipient
    UPDATE BANK_ACCOUNTS
    SET balance = balance + p_amount
    WHERE account_id = v_to_id;

    -- Record transaction
    INSERT INTO TRANSACTIONS (
        account_id,
        receiver_account_id,
        transaction_type,
        amount,
        description,
        status
    ) VALUES (
        v_from_id,
        v_to_id,
        'TRANSFER',
        p_amount,
        COALESCE(p_description, 'Funds transfer to ' || p_to_account),
        'COMPLETED'
    )
    RETURNING transaction_id, status INTO p_transaction_id, p_status;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Transfer failed: %', SQLERRM;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. RESOLVE FRAUD ALERT PROCEDURE (Admin Approve / Reject)
-- Demonstrates compensating transactions (Rollback on rejection)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE PROCEDURE sp_resolve_fraud_alert(
    p_alert_id INT,
    p_action VARCHAR(20), -- 'APPROVE' or 'REJECT'
    p_admin_username VARCHAR(50),
    p_remarks TEXT,
    INOUT p_result_status VARCHAR(20) DEFAULT NULL,
    INOUT p_message TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_alert_record RECORD;
    v_tx_record RECORD;
BEGIN
    -- Validate action
    IF UPPER(p_action) NOT IN ('APPROVE', 'REJECT') THEN
        RAISE EXCEPTION 'Invalid resolution action. Must be APPROVE or REJECT.';
    END IF;

    -- Fetch and lock alert
    SELECT * INTO v_alert_record
    FROM FRAUD_ALERTS
    WHERE alert_id = p_alert_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fraud Alert ID % not found.', p_alert_id;
    END IF;

    IF v_alert_record.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Alert ID % is already resolved (Status: %).', p_alert_id, v_alert_record.status;
    END IF;

    IF UPPER(p_action) = 'APPROVE' THEN
        -- Admin confirms the transaction was legitimate
        UPDATE FRAUD_ALERTS
        SET status = 'APPROVED',
            resolved_at = CURRENT_TIMESTAMP,
            resolved_by = p_admin_username,
            resolution_remarks = COALESCE(p_remarks, 'Approved by admin')
        WHERE alert_id = p_alert_id;

        IF v_alert_record.transaction_id IS NOT NULL THEN
            UPDATE TRANSACTIONS
            SET status = 'APPROVED'
            WHERE transaction_id = v_alert_record.transaction_id;
        END IF;

        -- If it was a failed logins alert, unlock the account
        IF v_alert_record.alert_type = 'FAILED_LOGINS' AND v_alert_record.account_id IS NOT NULL THEN
            UPDATE CUSTOMERS c
            SET status = 'ACTIVE'
            FROM BANK_ACCOUNTS a
            WHERE a.customer_id = c.customer_id
              AND a.account_id = v_alert_record.account_id;
        END IF;

        p_result_status := 'APPROVED';
        p_message := 'Fraud alert ID ' || p_alert_id || ' approved successfully.';

    ELSIF UPPER(p_action) = 'REJECT' THEN
        -- Admin rejects transaction -> execute compensating transaction to reverse funds!
        UPDATE FRAUD_ALERTS
        SET status = 'REJECTED',
            resolved_at = CURRENT_TIMESTAMP,
            resolved_by = p_admin_username,
            resolution_remarks = COALESCE(p_remarks, 'Rejected and reversed by admin')
        WHERE alert_id = p_alert_id;

        IF v_alert_record.transaction_id IS NOT NULL THEN
            SELECT * INTO v_tx_record
            FROM TRANSACTIONS
            WHERE transaction_id = v_alert_record.transaction_id
            FOR UPDATE;

            -- Update transaction status
            UPDATE TRANSACTIONS
            SET status = 'REJECTED'
            WHERE transaction_id = v_alert_record.transaction_id;

            -- Compensating transaction logic (Rollback money transfer)
            IF v_tx_record.transaction_type = 'DEPOSIT' THEN
                -- Reverse deposit: Deduct money from account
                UPDATE BANK_ACCOUNTS
                SET balance = balance - v_tx_record.amount
                WHERE account_id = v_tx_record.account_id;

            ELSIF v_tx_record.transaction_type = 'WITHDRAWAL' THEN
                -- Reverse withdrawal: Refund money to account
                UPDATE BANK_ACCOUNTS
                SET balance = balance + v_tx_record.amount
                WHERE account_id = v_tx_record.account_id;

            ELSIF v_tx_record.transaction_type = 'TRANSFER' THEN
                -- Reverse transfer: Refund sender and clawback from recipient
                UPDATE BANK_ACCOUNTS
                SET balance = balance + v_tx_record.amount
                WHERE account_id = v_tx_record.account_id;

                IF v_tx_record.receiver_account_id IS NOT NULL THEN
                    UPDATE BANK_ACCOUNTS
                    SET balance = balance - v_tx_record.amount
                    WHERE account_id = v_tx_record.receiver_account_id;
                END IF;
            END IF;
        END IF;

        p_result_status := 'REJECTED';
        p_message := 'Fraud alert ID ' || p_alert_id || ' rejected and funds reversed successfully.';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to resolve fraud alert: %', SQLERRM;
END;
$$;
