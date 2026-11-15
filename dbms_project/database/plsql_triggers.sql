-- =============================================================================
-- ADBMS Project: Banking Management System with Fraud Detection
-- Component: PL/pgSQL Triggers for Automatic Fraud Detection
-- Rules:
--   1. High-value transaction (> ₹50,000)
--   2. Rapid transactions (> 3 transactions within 1 minute from same account)
--   3. Multiple failed login attempts (3 consecutive failures)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TRIGGER 1 & 2: Before Insert on TRANSACTIONS
-- Evaluates transaction amount and velocity; marks status as 'SUSPICIOUS'
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_before_transaction_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_recent_count INT;
    v_high_value_limit NUMERIC := 50000.00;
    v_rapid_tx_limit INT := 3;
BEGIN
    -- Rule 1: High-Value Transaction Rule
    IF NEW.amount > v_high_value_limit THEN
        NEW.status := 'SUSPICIOUS';
    END IF;

    -- Rule 2: Rapid Transactions Rule (within last 60 seconds)
    SELECT COUNT(*)
    INTO v_recent_count
    FROM TRANSACTIONS
    WHERE account_id = NEW.account_id
      AND transaction_date >= (CURRENT_TIMESTAMP - INTERVAL '1 minute');

    IF v_recent_count >= v_rapid_tx_limit THEN
        NEW.status := 'SUSPICIOUS';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_before_transaction_insert ON TRANSACTIONS;
CREATE TRIGGER trg_before_transaction_insert
    BEFORE INSERT ON TRANSACTIONS
    FOR EACH ROW
    EXECUTE FUNCTION fn_trg_before_transaction_insert();

-- -----------------------------------------------------------------------------
-- TRIGGER 1 & 2 (Cont.): After Insert on TRANSACTIONS
-- Automatically generates detailed alerts in FRAUD_ALERTS table
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_after_transaction_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_recent_count INT;
    v_high_value_limit NUMERIC := 50000.00;
    v_rapid_tx_limit INT := 3;
BEGIN
    -- If transaction was marked SUSPICIOUS, identify and record reason(s)
    IF NEW.status = 'SUSPICIOUS' THEN

        -- Check if it violated Rule 1 (High Value)
        IF NEW.amount > v_high_value_limit THEN
            INSERT INTO FRAUD_ALERTS (
                transaction_id,
                account_id,
                alert_type,
                severity,
                alert_message,
                threshold_value,
                actual_value,
                status
            ) VALUES (
                NEW.transaction_id,
                NEW.account_id,
                'HIGH_VALUE',
                'HIGH',
                'High-value transaction detected: Amount ₹' || TO_CHAR(NEW.amount, 'FM99,99,999.00') || ' exceeds threshold of ₹' || TO_CHAR(v_high_value_limit, 'FM99,99,999.00'),
                v_high_value_limit,
                NEW.amount,
                'PENDING'
            );
        END IF;

        -- Check if it violated Rule 2 (Rapid Transactions)
        SELECT COUNT(*)
        INTO v_recent_count
        FROM TRANSACTIONS
        WHERE account_id = NEW.account_id
          AND transaction_date >= (CURRENT_TIMESTAMP - INTERVAL '1 minute')
          AND transaction_id <> NEW.transaction_id;

        IF v_recent_count >= v_rapid_tx_limit THEN
            INSERT INTO FRAUD_ALERTS (
                transaction_id,
                account_id,
                alert_type,
                severity,
                alert_message,
                threshold_value,
                actual_value,
                status
            ) VALUES (
                NEW.transaction_id,
                NEW.account_id,
                'RAPID_TRANSACTION',
                'HIGH',
                'Rapid transaction burst detected: ' || (v_recent_count + 1) || ' transactions executed within 60 seconds (Limit: ' || v_rapid_tx_limit || ')',
                v_rapid_tx_limit,
                v_recent_count + 1,
                'PENDING'
            );
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_transaction_insert ON TRANSACTIONS;
CREATE TRIGGER trg_after_transaction_insert
    AFTER INSERT ON TRANSACTIONS
    FOR EACH ROW
    EXECUTE FUNCTION fn_trg_after_transaction_insert();

-- -----------------------------------------------------------------------------
-- TRIGGER 3: After Insert on LOGIN_ATTEMPTS
-- Rule 3: Flag account after 3 consecutive failed login attempts
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_trg_check_failed_login_attempts()
RETURNS TRIGGER AS $$
DECLARE
    v_recent_failures INT;
    v_account_id INT;
    v_customer_id INT;
    v_already_alerted INT;
BEGIN
    -- Only evaluate when a failed attempt is registered
    IF NEW.is_successful = FALSE THEN

        -- Count consecutive failed attempts among the last 3 records for this user
        WITH last_three AS (
            SELECT is_successful
            FROM LOGIN_ATTEMPTS
            WHERE username = NEW.username
            ORDER BY attempt_time DESC, attempt_id DESC
            LIMIT 3
        )
        SELECT COUNT(*)
        INTO v_recent_failures
        FROM last_three
        WHERE is_successful = FALSE;

        -- If exactly 3 consecutive failures exist
        IF v_recent_failures = 3 THEN
            -- Check if user maps to a customer
            SELECT c.customer_id, a.account_id
            INTO v_customer_id, v_account_id
            FROM CUSTOMERS c
            LEFT JOIN BANK_ACCOUNTS a ON c.customer_id = a.customer_id
            WHERE c.username = NEW.username
            LIMIT 1;

            -- Check if a recent pending alert was already created in last 2 minutes to prevent duplicates
            SELECT COUNT(*)
            INTO v_already_alerted
            FROM FRAUD_ALERTS
            WHERE alert_type = 'FAILED_LOGINS'
              AND alert_message LIKE '%' || NEW.username || '%'
              AND created_at >= (CURRENT_TIMESTAMP - INTERVAL '2 minutes');

            IF v_already_alerted = 0 THEN
                INSERT INTO FRAUD_ALERTS (
                    transaction_id,
                    account_id,
                    alert_type,
                    severity,
                    alert_message,
                    threshold_value,
                    actual_value,
                    status
                ) VALUES (
                    NULL,
                    v_account_id,
                    'FAILED_LOGINS',
                    'CRITICAL',
                    'Multiple failed login attempts: User "' || NEW.username || '" has failed 3 consecutive authentication attempts.',
                    3,
                    3,
                    'PENDING'
                );

                -- Update customer status to LOCKED for security if customer exists
                IF v_customer_id IS NOT NULL THEN
                    UPDATE CUSTOMERS
                    SET status = 'LOCKED'
                    WHERE customer_id = v_customer_id;
                END IF;
            END IF;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_failed_logins ON LOGIN_ATTEMPTS;
CREATE TRIGGER trg_check_failed_logins
    AFTER INSERT ON LOGIN_ATTEMPTS
    FOR EACH ROW
    EXECUTE FUNCTION fn_trg_check_failed_login_attempts();
