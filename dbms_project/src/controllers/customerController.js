const db = require('../config/db');

// Get Customer Account Details and Live Balance
exports.getAccountDetails = async (req, res) => {
    const { accountNumber } = req.params;

    try {
        const result = await db.query(
            `SELECT ba.account_id, ba.account_number, ba.account_type, ba.balance, ba.is_active, ba.created_at,
                    c.customer_id, c.full_name, c.email, c.phone, c.username, c.status AS customer_status,
                    fn_get_account_balance(ba.account_number) AS verified_balance
             FROM BANK_ACCOUNTS ba
             JOIN CUSTOMERS c ON ba.customer_id = c.customer_id
             WHERE ba.account_number = $1`,
            [accountNumber]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        res.json({
            success: true,
            account: result.rows[0]
        });
    } catch (err) {
        console.error('Error fetching account details:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
};

// Deposit Money (Invokes Stored Procedure sp_deposit_money)
exports.deposit = async (req, res) => {
    const { accountNumber, amount, description } = req.body;
    const parsedAmount = parseFloat(amount);

    if (!accountNumber || isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Valid account number and positive amount are required.' });
    }

    try {
        // Execute PL/pgSQL Stored Procedure
        const result = await db.query(
            'CALL sp_deposit_money($1, $2, $3, NULL, NULL, NULL)',
            [accountNumber, parsedAmount, description || 'Customer cash deposit']
        );

        const { p_transaction_id, p_status, p_new_balance } = result.rows[0];

        // Check if any fraud alert was generated for this transaction
        const alertRes = await db.query(
            'SELECT alert_id, alert_type, severity, alert_message FROM FRAUD_ALERTS WHERE transaction_id = $1',
            [p_transaction_id]
        );

        const hasAlert = alertRes.rowCount > 0;
        const alertDetails = hasAlert ? alertRes.rows[0] : null;

        res.json({
            success: true,
            transactionId: p_transaction_id,
            status: p_status,
            newBalance: p_new_balance,
            isSuspicious: p_status === 'SUSPICIOUS',
            alert: alertDetails,
            message: p_status === 'SUSPICIOUS'
                ? `Transaction ₹${parsedAmount.toLocaleString('en-IN')} flagged as SUSPICIOUS! Alert sent to Admin.`
                : `₹${parsedAmount.toLocaleString('en-IN')} successfully deposited.`
        });
    } catch (err) {
        console.error('Deposit error:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

// Withdraw Money (Invokes Stored Procedure sp_withdraw_money)
exports.withdraw = async (req, res) => {
    const { accountNumber, amount, description } = req.body;
    const parsedAmount = parseFloat(amount);

    if (!accountNumber || isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Valid account number and positive amount are required.' });
    }

    try {
        // Execute PL/pgSQL Stored Procedure
        const result = await db.query(
            'CALL sp_withdraw_money($1, $2, $3, NULL, NULL, NULL)',
            [accountNumber, parsedAmount, description || 'Customer withdrawal']
        );

        const { p_transaction_id, p_status, p_new_balance } = result.rows[0];

        const alertRes = await db.query(
            'SELECT alert_id, alert_type, severity, alert_message FROM FRAUD_ALERTS WHERE transaction_id = $1',
            [p_transaction_id]
        );

        const hasAlert = alertRes.rowCount > 0;
        const alertDetails = hasAlert ? alertRes.rows[0] : null;

        res.json({
            success: true,
            transactionId: p_transaction_id,
            status: p_status,
            newBalance: p_new_balance,
            isSuspicious: p_status === 'SUSPICIOUS',
            alert: alertDetails,
            message: p_status === 'SUSPICIOUS'
                ? `Withdrawal of ₹${parsedAmount.toLocaleString('en-IN')} flagged as SUSPICIOUS! Alert sent to Admin.`
                : `₹${parsedAmount.toLocaleString('en-IN')} successfully withdrawn.`
        });
    } catch (err) {
        console.error('Withdrawal error:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

// Transfer Money (Invokes Stored Procedure sp_transfer_money)
exports.transfer = async (req, res) => {
    const { fromAccount, toAccount, amount, description } = req.body;
    const parsedAmount = parseFloat(amount);

    if (!fromAccount || !toAccount || isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Source account, destination account, and positive amount are required.' });
    }

    if (fromAccount === toAccount) {
        return res.status(400).json({ success: false, message: 'Source and destination accounts cannot be the same.' });
    }

    try {
        // Execute PL/pgSQL Stored Procedure
        const result = await db.query(
            'CALL sp_transfer_money($1, $2, $3, $4, NULL, NULL, NULL)',
            [fromAccount, toAccount, parsedAmount, description || 'Funds transfer']
        );

        const { p_transaction_id, p_status, p_from_new_balance } = result.rows[0];

        const alertRes = await db.query(
            'SELECT alert_id, alert_type, severity, alert_message FROM FRAUD_ALERTS WHERE transaction_id = $1',
            [p_transaction_id]
        );

        const hasAlert = alertRes.rowCount > 0;
        const alertDetails = hasAlert ? alertRes.rows[0] : null;

        res.json({
            success: true,
            transactionId: p_transaction_id,
            status: p_status,
            newBalance: p_from_new_balance,
            isSuspicious: p_status === 'SUSPICIOUS',
            alert: alertDetails,
            message: p_status === 'SUSPICIOUS'
                ? `Transfer of ₹${parsedAmount.toLocaleString('en-IN')} to ${toAccount} flagged as SUSPICIOUS! Alert logged for Admin review.`
                : `₹${parsedAmount.toLocaleString('en-IN')} successfully transferred to ${toAccount}.`
        });
    } catch (err) {
        console.error('Transfer error:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

// Get Customer Transaction History (Uses Reporting View vw_customer_transaction_history)
exports.getTransactionHistory = async (req, res) => {
    const { accountNumber } = req.params;

    try {
        const result = await db.query(
            `SELECT * FROM vw_customer_transaction_history
             WHERE sender_account_number = $1 OR receiver_account_number = $1
             ORDER BY transaction_date DESC
             LIMIT 50`,
            [accountNumber]
        );

        res.json({
            success: true,
            count: result.rowCount,
            transactions: result.rows
        });
    } catch (err) {
        console.error('Error fetching transaction history:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
};

// Helper: List available recipient accounts for transfer dropdown
exports.getTransferRecipients = async (req, res) => {
    const { excludeAccount } = req.query;

    try {
        const result = await db.query(
            `SELECT ba.account_number, ba.account_type, c.full_name, c.username
             FROM BANK_ACCOUNTS ba
             JOIN CUSTOMERS c ON ba.customer_id = c.customer_id
             WHERE ba.account_number <> $1 AND ba.is_active = TRUE`,
            [excludeAccount || '']
        );

        res.json({
            success: true,
            recipients: result.rows
        });
    } catch (err) {
        console.error('Error fetching recipients:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
};
