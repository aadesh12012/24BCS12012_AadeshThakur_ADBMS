const db = require('../config/db');

// Dashboard Overview Metrics (Uses View vw_admin_analytics)
exports.getDashboardMetrics = async (req, res) => {
    try {
        const metricsRes = await db.query('SELECT * FROM vw_admin_analytics');
        const metrics = metricsRes.rows[0] || {};

        // Also fetch recent fraud alerts
        const recentAlertsRes = await db.query(
            `SELECT * FROM vw_fraud_alerts_detail
             WHERE alert_status = 'PENDING'
             ORDER BY created_at DESC
             LIMIT 5`
        );

        res.json({
            success: true,
            metrics: {
                totalCustomers: parseInt(metrics.total_customers || 0, 10),
                totalActiveAccounts: parseInt(metrics.total_active_accounts || 0, 10),
                totalBankBalance: parseFloat(metrics.total_bank_balance || 0),
                totalTransactions: parseInt(metrics.total_transactions || 0, 10),
                totalSuspiciousTransactions: parseInt(metrics.total_suspicious_transactions || 0, 10),
                pendingFraudAlerts: parseInt(metrics.pending_fraud_alerts || 0, 10),
                approvedFraudAlerts: parseInt(metrics.approved_fraud_alerts || 0, 10),
                rejectedFraudAlerts: parseInt(metrics.rejected_fraud_alerts || 0, 10),
            },
            recentPendingAlerts: recentAlertsRes.rows
        });
    } catch (err) {
        console.error('Error fetching admin metrics:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
};

// View All Customers
exports.getAllCustomers = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT c.customer_id, c.full_name, c.email, c.phone, c.username, c.address, c.status, c.created_at,
                    ba.account_number, ba.balance, ba.account_type
             FROM CUSTOMERS c
             LEFT JOIN BANK_ACCOUNTS ba ON c.customer_id = ba.customer_id
             ORDER BY c.customer_id ASC`
        );

        res.json({
            success: true,
            count: result.rowCount,
            customers: result.rows
        });
    } catch (err) {
        console.error('Error fetching customers:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
};

// View All Bank Accounts (Uses View vw_bank_accounts_overview)
exports.getAllAccounts = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM vw_bank_accounts_overview ORDER BY account_id ASC');
        res.json({
            success: true,
            count: result.rowCount,
            accounts: result.rows
        });
    } catch (err) {
        console.error('Error fetching accounts:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
};

// View All Transactions (Uses View vw_customer_transaction_history)
exports.getAllTransactions = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM vw_customer_transaction_history ORDER BY transaction_date DESC LIMIT 100'
        );
        res.json({
            success: true,
            count: result.rowCount,
            transactions: result.rows
        });
    } catch (err) {
        console.error('Error fetching transactions:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
};

// View Suspicious Transactions (Uses View vw_suspicious_transactions)
exports.getSuspiciousTransactions = async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM vw_suspicious_transactions ORDER BY transaction_date DESC'
        );
        res.json({
            success: true,
            count: result.rowCount,
            suspiciousTransactions: result.rows
        });
    } catch (err) {
        console.error('Error fetching suspicious transactions:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
};

// View All Fraud Alerts (Uses View vw_fraud_alerts_detail)
exports.getAllFraudAlerts = async (req, res) => {
    const { status } = req.query; // 'PENDING', 'APPROVED', 'REJECTED' or all

    try {
        let queryStr = 'SELECT * FROM vw_fraud_alerts_detail';
        const params = [];

        if (status) {
            queryStr += ' WHERE alert_status = $1';
            params.push(status.toUpperCase());
        }

        queryStr += ' ORDER BY created_at DESC';

        const result = await db.query(queryStr, params);
        res.json({
            success: true,
            count: result.rowCount,
            alerts: result.rows
        });
    } catch (err) {
        console.error('Error fetching fraud alerts:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
};

// Approve or Reject Suspicious Transaction / Fraud Alert
// Calls Stored Procedure sp_resolve_fraud_alert
exports.resolveFraudAlert = async (req, res) => {
    const { alertId, action, remarks, adminUsername } = req.body;

    if (!alertId || !action) {
        return res.status(400).json({ success: false, message: 'Alert ID and action (APPROVE or REJECT) are required.' });
    }

    const upperAction = action.toUpperCase();
    if (!['APPROVE', 'REJECT'].includes(upperAction)) {
        return res.status(400).json({ success: false, message: 'Action must be either APPROVE or REJECT.' });
    }

    try {
        // Execute PL/pgSQL Stored Procedure
        const result = await db.query(
            'CALL sp_resolve_fraud_alert($1, $2, $3, $4, NULL, NULL)',
            [
                parseInt(alertId, 10),
                upperAction,
                adminUsername || 'admin',
                remarks || `Action ${upperAction} performed from Admin Console`
            ]
        );

        const { p_result_status, p_message } = result.rows[0];

        res.json({
            success: true,
            resultStatus: p_result_status,
            message: p_message
        });
    } catch (err) {
        console.error('Error resolving fraud alert:', err);
        res.status(400).json({ success: false, message: err.message });
    }
};

// Unlock Locked Customer Account
exports.unlockCustomer = async (req, res) => {
    const { customerId } = req.body;

    if (!customerId) {
        return res.status(400).json({ success: false, message: 'Customer ID is required.' });
    }

    try {
        await db.query(
            "UPDATE CUSTOMERS SET status = 'ACTIVE' WHERE customer_id = $1",
            [customerId]
        );

        res.json({
            success: true,
            message: 'Customer account unlocked successfully.'
        });
    } catch (err) {
        console.error('Error unlocking customer:', err);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
};

// Run Ledger Audit Reconciliation (Calls PL/pgSQL function fn_calculate_ledger_balance)
exports.runLedgerAudit = async (req, res) => {
    const { accountId } = req.params;

    try {
        const result = await db.query(
            'SELECT * FROM fn_calculate_ledger_balance($1)',
            [parseInt(accountId, 10)]
        );

        res.json({
            success: true,
            audit: result.rows[0]
        });
    } catch (err) {
        console.error('Error running ledger audit:', err);
        res.status(500).json({ success: false, message: 'Audit failed: ' + err.message });
    }
};
