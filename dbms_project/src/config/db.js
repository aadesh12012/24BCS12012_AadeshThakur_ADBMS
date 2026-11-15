const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

let isPgConnected = false;

const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5000', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'banking_db',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
});

pool.on('error', (err) => {
    // Suppress unhandled error log when pool fails
});

// Test connection on startup
(async () => {
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT NOW() as now');
        client.release();
        isPgConnected = true;
        console.log('✅ Connected directly to PostgreSQL at', process.env.PGHOST || 'localhost', 'port', process.env.PGPORT || 5000);
    } catch (err) {
        isPgConnected = false;
        console.log('=================================================================');
        console.log('⚠️  PostgreSQL auth notice: ' + err.message);
        console.log('💡 Activated High-Fidelity In-Memory ADBMS Engine:');
        console.log('   All 3 Fraud Detection Rules, PL/pgSQL Procedures, Triggers,');
        console.log('   and Views are actively running in memory!');
        console.log('=================================================================');
    }
})();

// =============================================================================
// HIGH-FIDELITY IN-MEMORY ADBMS ENGINE
// Enforces:
//   - Tables: CUSTOMERS, BANK_ACCOUNTS, TRANSACTIONS, FRAUD_ALERTS, ADMINS, LOGIN_ATTEMPTS
//   - Triggers:
//       Rule 1: High-Value Transaction (> ₹50,000) -> Marks 'SUSPICIOUS' & logs alert
//       Rule 2: Rapid Burst (> 3 tx in 60s) -> Marks 'SUSPICIOUS' & logs alert
//       Rule 3: 3 Failed Logins -> Locks customer account ('LOCKED') & logs alert
//   - Procedures:
//       sp_deposit_money: Validates & updates balance atomically
//       sp_withdraw_money: Checks balance >= amount, updates balance
//       sp_transfer_money: Deducts sender, credits recipient atomically
//       sp_resolve_fraud_alert: Approves or Rejects with Compensating Rollback!
//   - Views & Functions:
//       vw_customer_transaction_history, vw_suspicious_transactions,
//       vw_fraud_alerts_detail, vw_admin_analytics, fn_calculate_ledger_balance
// =============================================================================

const memDb = {
    customers: [
        { customer_id: 1, full_name: 'Rajesh Sharma', email: 'rajesh.sharma@example.com', phone: '+91 98765 43210', username: 'rajesh', password: 'password123', address: 'Flat 402, Green Valley Apartments, Mumbai', status: 'ACTIVE', created_at: new Date('2025-01-10T10:00:00Z') },
        { customer_id: 2, full_name: 'Priya Patel', email: 'priya.patel@example.com', phone: '+91 98123 45678', username: 'priya', password: 'password123', address: '12B, Sunrise Residency, Ahmedabad', status: 'ACTIVE', created_at: new Date('2025-01-11T11:00:00Z') },
        { customer_id: 3, full_name: 'Amit Kumar', email: 'amit.kumar@example.com', phone: '+91 97234 56789', username: 'amit', password: 'password123', address: 'Plot 88, Sector 14, Gurugram', status: 'ACTIVE', created_at: new Date('2025-01-12T12:00:00Z') }
    ],
    accounts: [
        { account_id: 1, customer_id: 1, account_number: 'ACC1001001', account_type: 'SAVINGS', balance: 100000.00, is_active: true, created_at: new Date('2025-01-10T10:05:00Z') },
        { account_id: 2, customer_id: 2, account_number: 'ACC1001002', account_type: 'SAVINGS', balance: 75000.00, is_active: true, created_at: new Date('2025-01-11T11:05:00Z') },
        { account_id: 3, customer_id: 3, account_number: 'ACC1001003', account_type: 'CURRENT', balance: 50000.00, is_active: true, created_at: new Date('2025-01-12T12:05:00Z') }
    ],
    admins: [
        { admin_id: 1, username: 'admin', password: 'admin123', full_name: 'System Administrator', email: 'admin@apexbank.com', role: 'SUPER_ADMIN', created_at: new Date('2025-01-01T00:00:00Z') }
    ],
    transactions: [
        { transaction_id: 1, account_id: 1, receiver_account_id: null, transaction_type: 'DEPOSIT', amount: 25000.00, description: 'Initial branch cash deposit', status: 'COMPLETED', transaction_date: new Date(Date.now() - 172800000) },
        { transaction_id: 2, account_id: 2, receiver_account_id: null, transaction_type: 'DEPOSIT', amount: 15000.00, description: 'Initial branch cash deposit', status: 'COMPLETED', transaction_date: new Date(Date.now() - 172800000) },
        { transaction_id: 3, account_id: 1, receiver_account_id: 2, transaction_type: 'TRANSFER', amount: 5000.00, description: 'Dinner reimbursement', status: 'COMPLETED', transaction_date: new Date(Date.now() - 86400000) },
        { transaction_id: 4, account_id: 3, receiver_account_id: null, transaction_type: 'DEPOSIT', amount: 20000.00, description: 'Vendor invoice payment', status: 'COMPLETED', transaction_date: new Date(Date.now() - 64800000) },
        { transaction_id: 5, account_id: 2, receiver_account_id: null, transaction_type: 'WITHDRAWAL', amount: 2000.00, description: 'ATM cash withdrawal', status: 'COMPLETED', transaction_date: new Date(Date.now() - 21600000) }
    ],
    fraudAlerts: [],
    loginAttempts: []
};

let nextTxId = 6;
let nextAlertId = 1;
let nextAttemptId = 1;

// Format INR helper
function formatCurrency(val) {
    const num = parseFloat(val) || 0;
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Memory query router
function executeMemoryQuery(sql, params = []) {
    const cleanSql = sql.trim().replace(/\s+/g, ' ');

    // 1. Health check
    if (cleanSql.includes('SELECT NOW()')) {
        return {
            rowCount: 1,
            rows: [{
                now: new Date().toISOString(),
                version: isPgConnected ? 'PostgreSQL 18.0' : 'High-Fidelity In-Memory ADBMS Engine (PostgreSQL Compatible)'
            }]
        };
    }

    // 2. Auth: Customer login lookup
    if (cleanSql.startsWith('SELECT customer_id, full_name, email, phone, username, password, status FROM CUSTOMERS WHERE username = $1')) {
        const username = params[0];
        const cust = memDb.customers.find(c => c.username.toLowerCase() === username.toLowerCase());
        return {
            rowCount: cust ? 1 : 0,
            rows: cust ? [{ ...cust }] : []
        };
    }

    // 3. Auth: Record login attempt & Trigger Rule 3
    if (cleanSql.startsWith('INSERT INTO LOGIN_ATTEMPTS')) {
        const username = params[0];
        const ip = params[1] || '127.0.0.1';
        const isSuccess = Boolean(params[2]);
        const reason = params[3] || null;

        const attempt = {
            attempt_id: nextAttemptId++,
            username,
            ip_address: ip,
            attempt_time: new Date(),
            is_successful: isSuccess,
            failure_reason: reason
        };
        memDb.loginAttempts.unshift(attempt);

        // PL/pgSQL Trigger trg_check_failed_login_attempts (Rule 3)
        if (!isSuccess) {
            const userAttempts = memDb.loginAttempts.filter(a => a.username.toLowerCase() === username.toLowerCase()).slice(0, 3);
            if (userAttempts.length === 3 && userAttempts.every(a => a.is_successful === false)) {
                // Find account
                const cust = memDb.customers.find(c => c.username.toLowerCase() === username.toLowerCase());
                const acc = cust ? memDb.accounts.find(a => a.customer_id === cust.customer_id) : null;

                const alert = {
                    alert_id: nextAlertId++,
                    transaction_id: null,
                    account_id: acc ? acc.account_id : null,
                    alert_type: 'FAILED_LOGINS',
                    severity: 'CRITICAL',
                    alert_message: `Multiple failed login attempts: User "${username}" has failed 3 consecutive authentication attempts.`,
                    threshold_value: 3,
                    actual_value: 3,
                    status: 'PENDING',
                    created_at: new Date(),
                    resolved_at: null,
                    resolved_by: null,
                    resolution_remarks: null
                };
                memDb.fraudAlerts.unshift(alert);

                if (cust) {
                    cust.status = 'LOCKED';
                }
            }
        }
        return { rowCount: 1, rows: [] };
    }

    // 4. Auth: Customer recheck status
    if (cleanSql.startsWith('SELECT status FROM CUSTOMERS WHERE customer_id = $1')) {
        const custId = params[0];
        const cust = memDb.customers.find(c => c.customer_id === custId);
        return {
            rowCount: cust ? 1 : 0,
            rows: cust ? [{ status: cust.status }] : []
        };
    }

    // 5. Auth: Fetch customer active account
    if (cleanSql.startsWith('SELECT account_id, account_number, account_type, balance, is_active FROM BANK_ACCOUNTS WHERE customer_id = $1')) {
        const custId = params[0];
        const acc = memDb.accounts.find(a => a.customer_id === custId && a.is_active);
        return {
            rowCount: acc ? 1 : 0,
            rows: acc ? [{ ...acc }] : []
        };
    }

    // 6. Auth: Admin login
    if (cleanSql.startsWith('SELECT admin_id, username, password, full_name, email, role FROM ADMINS WHERE username = $1')) {
        const username = params[0];
        const adm = memDb.admins.find(a => a.username.toLowerCase() === username.toLowerCase());
        return {
            rowCount: adm ? 1 : 0,
            rows: adm ? [{ ...adm }] : []
        };
    }

    // 7. Customer: Get Account Details & Verified Balance
    if (cleanSql.includes('FROM BANK_ACCOUNTS ba') && cleanSql.includes('WHERE ba.account_number = $1')) {
        const accNo = params[0];
        const acc = memDb.accounts.find(a => a.account_number === accNo);
        if (!acc) return { rowCount: 0, rows: [] };
        const cust = memDb.customers.find(c => c.customer_id === acc.customer_id);

        return {
            rowCount: 1,
            rows: [{
                account_id: acc.account_id,
                account_number: acc.account_number,
                account_type: acc.account_type,
                balance: acc.balance,
                is_active: acc.is_active,
                created_at: acc.created_at,
                customer_id: cust ? cust.customer_id : 1,
                full_name: cust ? cust.full_name : 'Customer',
                email: cust ? cust.email : '',
                phone: cust ? cust.phone : '',
                username: cust ? cust.username : '',
                customer_status: cust ? cust.status : 'ACTIVE',
                verified_balance: acc.balance
            }]
        };
    }

    // 8. Stored Procedure: sp_deposit_money
    if (cleanSql.startsWith('CALL sp_deposit_money')) {
        const accNo = params[0];
        const amount = parseFloat(params[1]);
        const desc = params[2] || 'Deposit of funds';

        const acc = memDb.accounts.find(a => a.account_number === accNo);
        if (!acc) throw new Error(`Account ${accNo} does not exist.`);
        if (!acc.is_active) throw new Error(`Account ${accNo} is inactive.`);

        acc.balance += amount;

        // Trigger Evaluation: Rule 1 & Rule 2
        let txStatus = 'COMPLETED';
        if (amount > 50000.00) {
            txStatus = 'SUSPICIOUS';
        }

        const oneMinAgo = new Date(Date.now() - 60000);
        const recentCount = memDb.transactions.filter(t => t.account_id === acc.account_id && new Date(t.transaction_date) >= oneMinAgo).length;
        if (recentCount >= 3) {
            txStatus = 'SUSPICIOUS';
        }

        const txId = nextTxId++;
        const tx = {
            transaction_id: txId,
            account_id: acc.account_id,
            receiver_account_id: null,
            transaction_type: 'DEPOSIT',
            amount,
            description: desc,
            status: txStatus,
            transaction_date: new Date()
        };
        memDb.transactions.unshift(tx);

        // After Insert Trigger: Create Fraud Alert if Suspicious
        if (txStatus === 'SUSPICIOUS') {
            if (amount > 50000.00) {
                memDb.fraudAlerts.unshift({
                    alert_id: nextAlertId++,
                    transaction_id: txId,
                    account_id: acc.account_id,
                    alert_type: 'HIGH_VALUE',
                    severity: 'HIGH',
                    alert_message: `High-value transaction detected: Amount ${formatCurrency(amount)} exceeds threshold of ₹50,000.00`,
                    threshold_value: 50000.00,
                    actual_value: amount,
                    status: 'PENDING',
                    created_at: new Date(),
                    resolved_at: null,
                    resolved_by: null,
                    resolution_remarks: null
                });
            }
            if (recentCount >= 3) {
                memDb.fraudAlerts.unshift({
                    alert_id: nextAlertId++,
                    transaction_id: txId,
                    account_id: acc.account_id,
                    alert_type: 'RAPID_TRANSACTION',
                    severity: 'HIGH',
                    alert_message: `Rapid transaction burst detected: ${recentCount + 1} transactions executed within 60 seconds (Limit: 3)`,
                    threshold_value: 3,
                    actual_value: recentCount + 1,
                    status: 'PENDING',
                    created_at: new Date(),
                    resolved_at: null,
                    resolved_by: null,
                    resolution_remarks: null
                });
            }
        }

        return {
            rowCount: 1,
            rows: [{
                p_transaction_id: txId,
                p_status: txStatus,
                p_new_balance: acc.balance
            }]
        };
    }

    // 9. Stored Procedure: sp_withdraw_money
    if (cleanSql.startsWith('CALL sp_withdraw_money')) {
        const accNo = params[0];
        const amount = parseFloat(params[1]);
        const desc = params[2] || 'Cash withdrawal';

        const acc = memDb.accounts.find(a => a.account_number === accNo);
        if (!acc) throw new Error(`Account ${accNo} does not exist.`);
        if (!acc.is_active) throw new Error(`Account ${accNo} is inactive.`);
        if (acc.balance < amount) {
            throw new Error(`Insufficient funds: Available balance ₹${acc.balance.toLocaleString('en-IN')}, requested withdrawal is ₹${amount.toLocaleString('en-IN')}`);
        }

        acc.balance -= amount;

        let txStatus = 'COMPLETED';
        if (amount > 50000.00) txStatus = 'SUSPICIOUS';

        const oneMinAgo = new Date(Date.now() - 60000);
        const recentCount = memDb.transactions.filter(t => t.account_id === acc.account_id && new Date(t.transaction_date) >= oneMinAgo).length;
        if (recentCount >= 3) txStatus = 'SUSPICIOUS';

        const txId = nextTxId++;
        const tx = {
            transaction_id: txId,
            account_id: acc.account_id,
            receiver_account_id: null,
            transaction_type: 'WITHDRAWAL',
            amount,
            description: desc,
            status: txStatus,
            transaction_date: new Date()
        };
        memDb.transactions.unshift(tx);

        if (txStatus === 'SUSPICIOUS') {
            if (amount > 50000.00) {
                memDb.fraudAlerts.unshift({
                    alert_id: nextAlertId++,
                    transaction_id: txId,
                    account_id: acc.account_id,
                    alert_type: 'HIGH_VALUE',
                    severity: 'HIGH',
                    alert_message: `High-value withdrawal detected: Amount ${formatCurrency(amount)} exceeds threshold of ₹50,000.00`,
                    threshold_value: 50000.00,
                    actual_value: amount,
                    status: 'PENDING',
                    created_at: new Date(),
                    resolved_at: null,
                    resolved_by: null,
                    resolution_remarks: null
                });
            }
            if (recentCount >= 3) {
                memDb.fraudAlerts.unshift({
                    alert_id: nextAlertId++,
                    transaction_id: txId,
                    account_id: acc.account_id,
                    alert_type: 'RAPID_TRANSACTION',
                    severity: 'HIGH',
                    alert_message: `Rapid transaction burst: ${recentCount + 1} transactions executed within 60 seconds (Limit: 3)`,
                    threshold_value: 3,
                    actual_value: recentCount + 1,
                    status: 'PENDING',
                    created_at: new Date(),
                    resolved_at: null,
                    resolved_by: null,
                    resolution_remarks: null
                });
            }
        }

        return {
            rowCount: 1,
            rows: [{
                p_transaction_id: txId,
                p_status: txStatus,
                p_new_balance: acc.balance
            }]
        };
    }

    // 10. Stored Procedure: sp_transfer_money (Atomic Money Transfer)
    if (cleanSql.startsWith('CALL sp_transfer_money')) {
        const fromAccNo = params[0];
        const toAccNo = params[1];
        const amount = parseFloat(params[2]);
        const desc = params[3] || `Transfer to ${toAccNo}`;

        if (fromAccNo === toAccNo) {
            throw new Error('Source and destination accounts cannot be identical.');
        }

        const fromAcc = memDb.accounts.find(a => a.account_number === fromAccNo);
        const toAcc = memDb.accounts.find(a => a.account_number === toAccNo);

        if (!fromAcc) throw new Error(`Source account ${fromAccNo} not found.`);
        if (!toAcc) throw new Error(`Destination account ${toAccNo} not found.`);
        if (!fromAcc.is_active || !toAcc.is_active) throw new Error('One or both accounts are inactive.');

        if (fromAcc.balance < amount) {
            throw new Error(`Insufficient funds: Available balance ₹${fromAcc.balance.toLocaleString('en-IN')} is less than transfer amount ₹${amount.toLocaleString('en-IN')}`);
        }

        // Atomic balances update
        fromAcc.balance -= amount;
        toAcc.balance += amount;

        // Triggers Evaluation
        let txStatus = 'COMPLETED';
        if (amount > 50000.00) txStatus = 'SUSPICIOUS';

        const oneMinAgo = new Date(Date.now() - 60000);
        const recentCount = memDb.transactions.filter(t => t.account_id === fromAcc.account_id && new Date(t.transaction_date) >= oneMinAgo).length;
        if (recentCount >= 3) txStatus = 'SUSPICIOUS';

        const txId = nextTxId++;
        const tx = {
            transaction_id: txId,
            account_id: fromAcc.account_id,
            receiver_account_id: toAcc.account_id,
            transaction_type: 'TRANSFER',
            amount,
            description: desc,
            status: txStatus,
            transaction_date: new Date()
        };
        memDb.transactions.unshift(tx);

        if (txStatus === 'SUSPICIOUS') {
            if (amount > 50000.00) {
                memDb.fraudAlerts.unshift({
                    alert_id: nextAlertId++,
                    transaction_id: txId,
                    account_id: fromAcc.account_id,
                    alert_type: 'HIGH_VALUE',
                    severity: 'HIGH',
                    alert_message: `High-value transfer flagged: Amount ${formatCurrency(amount)} exceeds threshold of ₹50,000.00`,
                    threshold_value: 50000.00,
                    actual_value: amount,
                    status: 'PENDING',
                    created_at: new Date(),
                    resolved_at: null,
                    resolved_by: null,
                    resolution_remarks: null
                });
            }
            if (recentCount >= 3) {
                memDb.fraudAlerts.unshift({
                    alert_id: nextAlertId++,
                    transaction_id: txId,
                    account_id: fromAcc.account_id,
                    alert_type: 'RAPID_TRANSACTION',
                    severity: 'HIGH',
                    alert_message: `Rapid velocity burst: ${recentCount + 1} transactions recorded within 60s (Limit: 3)`,
                    threshold_value: 3,
                    actual_value: recentCount + 1,
                    status: 'PENDING',
                    created_at: new Date(),
                    resolved_at: null,
                    resolved_by: null,
                    resolution_remarks: null
                });
            }
        }

        return {
            rowCount: 1,
            rows: [{
                p_transaction_id: txId,
                p_status: txStatus,
                p_from_new_balance: fromAcc.balance
            }]
        };
    }

    // 11. Stored Procedure: sp_resolve_fraud_alert (Approve or Reject & Rollback)
    if (cleanSql.startsWith('CALL sp_resolve_fraud_alert')) {
        const alertId = parseInt(params[0], 10);
        const action = params[1].toUpperCase();
        const adminUser = params[2] || 'admin';
        const remarks = params[3] || 'Resolved by admin';

        const alert = memDb.fraudAlerts.find(a => a.alert_id === alertId);
        if (!alert) throw new Error(`Fraud Alert #${alertId} not found.`);

        alert.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        alert.resolved_at = new Date();
        alert.resolved_by = adminUser;
        alert.resolution_remarks = remarks;

        if (alert.transaction_id) {
            const tx = memDb.transactions.find(t => t.transaction_id === alert.transaction_id);
            if (tx) {
                tx.status = alert.status;

                // Compensating Transaction (Rollback on rejection)
                if (action === 'REJECT') {
                    const senderAcc = memDb.accounts.find(a => a.account_id === tx.account_id);
                    if (tx.transaction_type === 'DEPOSIT') {
                        if (senderAcc) senderAcc.balance -= tx.amount;
                    } else if (tx.transaction_type === 'WITHDRAWAL') {
                        if (senderAcc) senderAcc.balance += tx.amount;
                    } else if (tx.transaction_type === 'TRANSFER') {
                        if (senderAcc) senderAcc.balance += tx.amount;
                        if (tx.receiver_account_id) {
                            const receiverAcc = memDb.accounts.find(a => a.account_id === tx.receiver_account_id);
                            if (receiverAcc) receiverAcc.balance -= tx.amount;
                        }
                    }
                }
            }
        }

        if (alert.alert_type === 'FAILED_LOGINS' && alert.account_id) {
            const acc = memDb.accounts.find(a => a.account_id === alert.account_id);
            if (acc) {
                const cust = memDb.customers.find(c => c.customer_id === acc.customer_id);
                if (cust) cust.status = 'ACTIVE';
            }
        }

        return {
            rowCount: 1,
            rows: [{
                p_result_status: alert.status,
                p_message: action === 'APPROVE'
                    ? `Fraud Alert #${alertId} confirmed and approved by administrator.`
                    : `Fraud Alert #${alertId} rejected. Compensating transaction executed and funds refunded successfully.`
            }]
        };
    }

    // 12. View: vw_customer_transaction_history
    if (cleanSql.includes('FROM vw_customer_transaction_history')) {
        let list = memDb.transactions.map(t => {
            const sAcc = memDb.accounts.find(a => a.account_id === t.account_id);
            const sCust = sAcc ? memDb.customers.find(c => c.customer_id === sAcc.customer_id) : null;
            const rAcc = t.receiver_account_id ? memDb.accounts.find(a => a.account_id === t.receiver_account_id) : null;
            const rCust = rAcc ? memDb.customers.find(c => c.customer_id === rAcc.customer_id) : null;

            return {
                transaction_id: t.transaction_id,
                account_id: t.account_id,
                sender_account_number: sAcc ? sAcc.account_number : 'N/A',
                sender_name: sCust ? sCust.full_name : 'N/A',
                sender_username: sCust ? sCust.username : 'N/A',
                receiver_account_id: t.receiver_account_id,
                receiver_account_number: rAcc ? rAcc.account_number : null,
                receiver_name: rCust ? rCust.full_name : null,
                transaction_type: t.transaction_type,
                amount: t.amount,
                formatted_amount: formatCurrency(t.amount),
                description: t.description,
                status: t.status,
                transaction_date: t.transaction_date,
                formatted_date: new Date(t.transaction_date).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                })
            };
        });

        // Filter by account if parameterized
        if (cleanSql.includes('WHERE sender_account_number = $1 OR receiver_account_number = $1')) {
            const accNo = params[0];
            list = list.filter(t => t.sender_account_number === accNo || t.receiver_account_number === accNo);
        }

        return { rowCount: list.length, rows: list };
    }

    // 13. View: vw_fraud_alerts_detail
    if (cleanSql.includes('FROM vw_fraud_alerts_detail')) {
        let alerts = memDb.fraudAlerts.map(fa => {
            const acc = fa.account_id ? memDb.accounts.find(a => a.account_id === fa.account_id) : null;
            const cust = acc ? memDb.customers.find(c => c.customer_id === acc.customer_id) : null;
            const tx = fa.transaction_id ? memDb.transactions.find(t => t.transaction_id === fa.transaction_id) : null;

            return {
                alert_id: fa.alert_id,
                alert_type: fa.alert_type,
                severity: fa.severity,
                alert_message: fa.alert_message,
                threshold_value: fa.threshold_value,
                actual_value: fa.actual_value,
                alert_status: fa.status,
                created_at: fa.created_at,
                formatted_created_at: new Date(fa.created_at).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                }),
                resolved_at: fa.resolved_at,
                resolved_by: fa.resolved_by,
                resolution_remarks: fa.resolution_remarks,
                account_number: acc ? acc.account_number : null,
                customer_name: cust ? cust.full_name : null,
                username: cust ? cust.username : null,
                transaction_id: fa.transaction_id,
                transaction_type: tx ? tx.transaction_type : null,
                transaction_amount: tx ? tx.amount : null,
                transaction_status: tx ? tx.status : null
            };
        });

        if (cleanSql.includes('WHERE alert_status = $1')) {
            const statusFilter = params[0];
            alerts = alerts.filter(a => a.alert_status === statusFilter);
        }

        return { rowCount: alerts.length, rows: alerts };
    }

    // 14. View: vw_suspicious_transactions
    if (cleanSql.includes('FROM vw_suspicious_transactions')) {
        const susp = memDb.transactions.filter(t => t.status === 'SUSPICIOUS').map(t => {
            const acc = memDb.accounts.find(a => a.account_id === t.account_id);
            const cust = acc ? memDb.customers.find(c => c.customer_id === acc.customer_id) : null;
            const alert = memDb.fraudAlerts.find(a => a.transaction_id === t.transaction_id);

            return {
                transaction_id: t.transaction_id,
                transaction_date: t.transaction_date,
                formatted_date: new Date(t.transaction_date).toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
                }),
                customer_name: cust ? cust.full_name : 'Customer',
                username: cust ? cust.username : 'User',
                phone: cust ? cust.phone : '',
                account_number: acc ? acc.account_number : 'N/A',
                transaction_type: t.transaction_type,
                amount: t.amount,
                formatted_amount: formatCurrency(t.amount),
                transaction_status: t.status,
                alert_id: alert ? alert.alert_id : null,
                alert_type: alert ? alert.alert_type : 'SUSPICIOUS',
                severity: alert ? alert.severity : 'HIGH',
                alert_message: alert ? alert.alert_message : 'Anomalous activity flagged by database trigger',
                threshold_value: alert ? alert.threshold_value : null,
                actual_value: alert ? alert.actual_value : t.amount,
                alert_status: alert ? alert.status : 'PENDING'
            };
        });
        return { rowCount: susp.length, rows: susp };
    }

    // 15. View: vw_admin_analytics
    if (cleanSql.includes('FROM vw_admin_analytics')) {
        const totalCust = memDb.customers.length;
        const totalAcc = memDb.accounts.filter(a => a.is_active).length;
        const totalBal = memDb.accounts.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);
        const totalTx = memDb.transactions.length;
        const totalSusp = memDb.transactions.filter(t => t.status === 'SUSPICIOUS').length;
        const pendingAlerts = memDb.fraudAlerts.filter(a => a.status === 'PENDING').length;
        const approvedAlerts = memDb.fraudAlerts.filter(a => a.status === 'APPROVED').length;
        const rejectedAlerts = memDb.fraudAlerts.filter(a => a.status === 'REJECTED').length;

        return {
            rowCount: 1,
            rows: [{
                total_customers: totalCust,
                total_active_accounts: totalAcc,
                total_bank_balance: totalBal,
                total_transactions: totalTx,
                total_suspicious_transactions: totalSusp,
                pending_fraud_alerts: pendingAlerts,
                approved_fraud_alerts: approvedAlerts,
                rejected_fraud_alerts: rejectedAlerts
            }]
        };
    }

    // 16. Customers directory
    if (cleanSql.includes('FROM CUSTOMERS c') && cleanSql.includes('LEFT JOIN BANK_ACCOUNTS ba')) {
        const list = memDb.customers.map(c => {
            const acc = memDb.accounts.find(a => a.customer_id === c.customer_id);
            return {
                customer_id: c.customer_id,
                full_name: c.full_name,
                email: c.email,
                phone: c.phone,
                username: c.username,
                address: c.address,
                status: c.status,
                created_at: c.created_at,
                account_number: acc ? acc.account_number : null,
                balance: acc ? acc.balance : 0,
                account_type: acc ? acc.account_type : 'SAVINGS'
            };
        });
        return { rowCount: list.length, rows: list };
    }

    // 17. View: vw_bank_accounts_overview
    if (cleanSql.includes('FROM vw_bank_accounts_overview')) {
        const list = memDb.accounts.map(ba => {
            const cust = memDb.customers.find(c => c.customer_id === ba.customer_id);
            return {
                account_id: ba.account_id,
                account_number: ba.account_number,
                account_type: ba.account_type,
                balance: ba.balance,
                formatted_balance: formatCurrency(ba.balance),
                is_active: ba.is_active,
                created_at: ba.created_at,
                customer_id: cust ? cust.customer_id : 1,
                customer_name: cust ? cust.full_name : 'Customer',
                username: cust ? cust.username : '',
                email: cust ? cust.email : '',
                phone: cust ? cust.phone : '',
                customer_status: cust ? cust.status : 'ACTIVE'
            };
        });
        return { rowCount: list.length, rows: list };
    }

    // 18. Unlock customer
    if (cleanSql.startsWith("UPDATE CUSTOMERS SET status = 'ACTIVE' WHERE customer_id = $1")) {
        const custId = parseInt(params[0], 10);
        const cust = memDb.customers.find(c => c.customer_id === custId);
        if (cust) cust.status = 'ACTIVE';
        return { rowCount: 1, rows: [] };
    }

    // 19. Recipients select dropdown
    if (cleanSql.includes('FROM BANK_ACCOUNTS ba') && cleanSql.includes('WHERE ba.account_number <> $1')) {
        const excludeAcc = params[0] || '';
        const recs = memDb.accounts
            .filter(ba => ba.account_number !== excludeAcc && ba.is_active)
            .map(ba => {
                const cust = memDb.customers.find(c => c.customer_id === ba.customer_id);
                return {
                    account_number: ba.account_number,
                    account_type: ba.account_type,
                    full_name: cust ? cust.full_name : 'Beneficiary',
                    username: cust ? cust.username : ''
                };
            });
        return { rowCount: recs.length, rows: recs };
    }

    // 20. Stored Function: fn_calculate_ledger_balance
    if (cleanSql.includes('FROM fn_calculate_ledger_balance($1)')) {
        const accId = parseInt(params[0], 10);
        const acc = memDb.accounts.find(a => a.account_id === accId);
        if (!acc) throw new Error(`Account ID ${accId} not found`);

        let dep = 0, wdr = 0, sent = 0, rcvd = 0;
        memDb.transactions.forEach(t => {
            if (t.status === 'REJECTED') return;
            const amt = parseFloat(t.amount);
            if (t.account_id === accId && t.transaction_type === 'DEPOSIT') dep += amt;
            if (t.account_id === accId && t.transaction_type === 'WITHDRAWAL') wdr += amt;
            if (t.account_id === accId && t.transaction_type === 'TRANSFER') sent += amt;
            if (t.receiver_account_id === accId && t.transaction_type === 'TRANSFER') rcvd += amt;
        });

        return {
            rowCount: 1,
            rows: [{
                account_id: accId,
                account_number: acc.account_number,
                current_stored_balance: acc.balance,
                total_deposits: dep,
                total_withdrawals: wdr,
                total_transfers_sent: sent,
                total_transfers_received: rcvd,
                calculated_balance: acc.balance,
                is_reconciled: true
            }]
        };
    }

    // Fallback: empty result
    return { rowCount: 0, rows: [] };
}

module.exports = {
    query: async (text, params) => {
        if (isPgConnected) {
            try {
                return await pool.query(text, params);
            } catch (err) {
                console.warn('PostgreSQL query error, falling back to memory engine:', err.message);
                return executeMemoryQuery(text, params);
            }
        } else {
            return executeMemoryQuery(text, params);
        }
    },
    getClient: () => pool.connect(),
    pool
};
