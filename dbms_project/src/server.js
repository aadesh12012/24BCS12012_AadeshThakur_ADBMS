const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/admin', adminRoutes);

// Health Check & DB Connection Test
app.get('/api/health', async (req, res) => {
    try {
        const dbRes = await db.query('SELECT NOW() as now, version() as version');
        res.json({
            status: 'UP',
            timestamp: dbRes.rows[0].now,
            database: 'PostgreSQL Connected',
            pgVersion: dbRes.rows[0].version
        });
    } catch (err) {
        res.status(500).json({
            status: 'DOWN',
            error: err.message
        });
    }
});

// Fallback to index.html for single-page experience
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log('=================================================================');
    console.log('🏛️  Banking Management System with Fraud Detection (ADBMS)');
    console.log(`🌐 Server running at: http://localhost:${PORT}`);
    console.log(`🗄️  PostgreSQL Host: ${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5000}`);
    console.log(`📊 Connected Database: ${process.env.PGDATABASE || 'banking_db'}`);
    console.log('=================================================================');
});
