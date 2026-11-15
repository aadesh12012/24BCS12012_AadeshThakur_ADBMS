const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5000', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
};

const targetDb = process.env.PGDATABASE || 'banking_db';

async function runSetup() {
    console.log('=================================================================');
    console.log('🚀 Starting Banking Management System ADBMS Database Setup');
    console.log(`Connecting to PostgreSQL on ${config.host}:${config.port} as '${config.user}'...`);
    console.log('=================================================================');

    // 1. Connect to default postgres DB to ensure target database exists
    const adminClient = new Client({
        ...config,
        database: 'postgres'
    });

    try {
        await adminClient.connect();
        console.log(' Connected to PostgreSQL server.');

        const checkDbRes = await adminClient.query(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            [targetDb]
        );

        if (checkDbRes.rowCount === 0) {
            console.log(` Database '${targetDb}' does not exist. Creating...`);
            await adminClient.query(`CREATE DATABASE "${targetDb}"`);
            console.log(` Database '${targetDb}' created successfully.`);
        } else {
            console.log(` Database '${targetDb}' already exists.`);
        }
    } catch (err) {
        console.error('❌ Connection to PostgreSQL failed:');
        console.error(err.message);
        console.error('\nPlease check your .env file credentials (PGHOST, PGPORT, PGUSER, PGPASSWORD).');
        process.exit(1);
    } finally {
        await adminClient.end();
    }

    // 2. Connect to the target database and run initialization scripts
    const dbClient = new Client({
        ...config,
        database: targetDb
    });

    try {
        await dbClient.connect();
        console.log(` Connected to target database '${targetDb}'.`);

        const scripts = [
            { name: 'Schema (Tables & Indexes)', file: 'schema.sql' },
            { name: 'PL/pgSQL Triggers (Fraud Detection Rules 1, 2, 3)', file: 'plsql_triggers.sql' },
            { name: 'PL/pgSQL Stored Procedures (Transactions & Atomicity)', file: 'plsql_procedures.sql' },
            { name: 'PL/pgSQL Functions (Ledger Audit & Balance)', file: 'plsql_functions.sql' },
            { name: 'SQL Views (Reporting & Metrics)', file: 'plsql_views.sql' },
            { name: 'Seed Data (Customers, Accounts, Admin, Initial Tx)', file: 'seed_data.sql' }
        ];

        for (const script of scripts) {
            console.log(`\n⏳ Executing: ${script.name}...`);
            const filePath = path.join(__dirname, script.file);
            const sql = fs.readFileSync(filePath, 'utf8');
            await dbClient.query(sql);
            console.log(` ${script.name} executed successfully.`);
        }

        console.log('\n=================================================================');
        console.log('🎉 Database initialization finished successfully!');
        console.log('Ready to run the application with: npm start');
        console.log('=================================================================');
    } catch (err) {
        console.error('\n❌ SQL Execution Error:');
        console.error(err.message);
        process.exit(1);
    } finally {
        await dbClient.end();
    }
}

runSetup();
