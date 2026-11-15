const db = require('../config/db');

// Customer Login with Failed Attempt Logging (Rule 3)
exports.customerLogin = async (req, res) => {
    const { username, password } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    try {
        // Query customer by username
        const custResult = await db.query(
            'SELECT customer_id, full_name, email, phone, username, password, status FROM CUSTOMERS WHERE username = $1',
            [username.trim()]
        );

        if (custResult.rowCount === 0) {
            // Log failed attempt
            await db.query(
                'INSERT INTO LOGIN_ATTEMPTS (username, ip_address, is_successful, failure_reason) VALUES ($1, $2, $3, $4)',
                [username.trim(), clientIp, false, 'User does not exist']
            );
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        const customer = custResult.rows[0];

        // Check if customer account is locked
        if (customer.status === 'LOCKED') {
            await db.query(
                'INSERT INTO LOGIN_ATTEMPTS (username, ip_address, is_successful, failure_reason) VALUES ($1, $2, $3, $4)',
                [username.trim(), clientIp, false, 'Account locked due to security policy']
            );
            return res.status(403).json({
                success: false,
                isLocked: true,
                message: 'Account is locked due to multiple failed login attempts. Please contact Bank Admin.'
            });
        }

        // Verify password
        if (customer.password !== password) {
            // Log failed attempt - triggers Rule 3 in database!
            await db.query(
                'INSERT INTO LOGIN_ATTEMPTS (username, ip_address, is_successful, failure_reason) VALUES ($1, $2, $3, $4)',
                [username.trim(), clientIp, false, 'Incorrect password']
            );

            // Check if trigger just locked the account
            const recheck = await db.query(
                'SELECT status FROM CUSTOMERS WHERE customer_id = $1',
                [customer.customer_id]
            );

            if (recheck.rows[0].status === 'LOCKED') {
                return res.status(403).json({
                    success: false,
                    isLocked: true,
                    message: 'FRAUD ALERT TRIGGERED: 3 consecutive failed login attempts detected. Your account has been locked!'
                });
            }

            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        // Successful login
        await db.query(
            'INSERT INTO LOGIN_ATTEMPTS (username, ip_address, is_successful, failure_reason) VALUES ($1, $2, $3, $4)',
            [username.trim(), clientIp, true, null]
        );

        // Fetch associated active bank account
        const accResult = await db.query(
            'SELECT account_id, account_number, account_type, balance, is_active FROM BANK_ACCOUNTS WHERE customer_id = $1 AND is_active = TRUE LIMIT 1',
            [customer.customer_id]
        );

        const account = accResult.rowCount > 0 ? accResult.rows[0] : null;

        res.json({
            success: true,
            message: 'Login successful.',
            user: {
                role: 'CUSTOMER',
                customerId: customer.customer_id,
                fullName: customer.full_name,
                username: customer.username,
                email: customer.email,
                phone: customer.phone,
                status: customer.status,
                account: account
            }
        });
    } catch (err) {
        console.error('Customer login error:', err);
        res.status(500).json({ success: false, message: 'Server error during login: ' + err.message });
    }
};

// Admin Login
exports.adminLogin = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    try {
        const result = await db.query(
            'SELECT admin_id, username, password, full_name, email, role FROM ADMINS WHERE username = $1',
            [username.trim()]
        );

        if (result.rowCount === 0 || result.rows[0].password !== password) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
        }

        const admin = result.rows[0];

        res.json({
            success: true,
            message: 'Admin authentication successful.',
            user: {
                role: 'ADMIN',
                adminId: admin.admin_id,
                fullName: admin.full_name,
                username: admin.username,
                email: admin.email,
                adminRole: admin.role
            }
        });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ success: false, message: 'Server error during admin login: ' + err.message });
    }
};
