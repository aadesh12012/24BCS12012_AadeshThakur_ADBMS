# Apex Bank - Banking Management System with Fraud Detection (ADBMS)

A demo banking management system designed for a college **Advanced Database Management Systems (ADBMS)** project.

This project demonstrates core banking operations, relational database engineering, PL/pgSQL database automation, and a rule-based fraud detection engine built on **PostgreSQL** and **Node.js Express**.

---

## 1. Technology Stack

- **Database:** PostgreSQL (with PL/pgSQL Triggers, Stored Procedures, Functions, Views, Constraints, and Sequences)
- **Backend:** Node.js + Express + `pg` (PostgreSQL Client with Parameterized Queries)
- **Frontend:** Pure HTML5, Modern CSS3, JavaScript (Clean, responsive light-themed dashboard with zero external framework dependencies)

---

## 2. Advanced Database Management Systems (ADBMS) Concepts Demonstrated

| ADBMS Concept | Implementation in Project | SQL Script File |
| :--- | :--- | :--- |
| **Relational Schema Design** | 6 normalized tables (`CUSTOMERS`, `BANK_ACCOUNTS`, `TRANSACTIONS`, `FRAUD_ALERTS`, `ADMINS`, `LOGIN_ATTEMPTS`) with Primary Keys, Foreign Keys (`ON DELETE CASCADE`), and check constraints. | `database/schema.sql` |
| **Integrity & Check Constraints** | `balance >= 0.00` (prevents negative balance), `amount > 0.00`, enumerated status checks (`ACTIVE`, `LOCKED`, `SUSPICIOUS`, `COMPLETED`, `REJECTED`). | `database/schema.sql` |
| **Row-Level Concurrency & Locking** | `SELECT ... FOR UPDATE` row locks in procedures to avoid race conditions and double-spending during concurrent deposits/withdrawals. | `database/plsql_procedures.sql` |
| **Deadlock Prevention** | Strict ascending resource acquisition order (`IF from_id < to_id ...`) during account-to-account transfers. | `database/plsql_procedures.sql` |
| **Stored Procedures** | Modular business logic executing within the database: `sp_deposit_money`, `sp_withdraw_money`, `sp_transfer_money`, `sp_resolve_fraud_alert`. | `database/plsql_procedures.sql` |
| **Automated Triggers** | `BEFORE` and `AFTER INSERT` triggers that monitor transactions and authentication logs, automatically flagging anomalies and logging alerts. | `database/plsql_triggers.sql` |
| **PL/pgSQL Functions** | `fn_get_account_balance(acc_no)`, `fn_calculate_ledger_balance(acc_id)` (performs ledger audit reconciliation: deposits - withdrawals - sent + received). | `database/plsql_functions.sql` |
| **Reporting Views** | `vw_customer_transaction_history`, `vw_suspicious_transactions`, `vw_fraud_alerts_detail`, `vw_admin_analytics`, `vw_bank_accounts_overview`. | `database/plsql_views.sql` |
| **Compensating Transactions (Rollback)** | When an Admin rejects a flagged transaction, a compensating transaction automatically reverses the funds (refunds/clawbacks) maintaining audit integrity. | `database/plsql_procedures.sql` |

---

## 3. Fraud Detection Engine (3 Rules)

The system enforces 3 automated fraud detection rules implemented directly inside PostgreSQL via triggers and procedures:

1. **Rule 1: High-Value Transaction Flagging**
   - **Threshold:** Any transaction exceeding **₹50,000**.
   - **Trigger:** `trg_before_transaction_insert` marks `status = 'SUSPICIOUS'`.
   - **Action:** `trg_after_transaction_insert` logs an alert in `FRAUD_ALERTS` with severity `HIGH`.
2. **Rule 2: Rapid Transactions Velocity Anomaly**
   - **Threshold:** More than **3 transactions within 60 seconds** from the same account.
   - **Trigger:** Queries transaction history within `INTERVAL '1 minute'`.
   - **Action:** Flags the burst transaction as `SUSPICIOUS` and alerts the Admin.
3. **Rule 3: Multiple Failed Login Attempts**
   - **Threshold:** **3 consecutive failed login attempts** for a username.
   - **Trigger:** `trg_check_failed_logins` on `LOGIN_ATTEMPTS`.
   - **Action:** Flags user, generates a `CRITICAL` severity fraud alert, and locks the customer account (`status = 'LOCKED'`).

---

## 4. Project Folder Structure

```
dbms_project/
├── .env                       # Environment variables (DB connection, port)
├── .env.example               # Example configuration template
├── package.json               # Node.js project manifest & scripts
├── README.md                  # Project documentation & demo guide
├── database/
│   ├── schema.sql             # Table definitions, constraints, indexes
│   ├── plsql_triggers.sql     # PL/pgSQL triggers for fraud rules 1, 2, 3
│   ├── plsql_procedures.sql   # Stored procedures (deposit, withdraw, transfer, resolve)
│   ├── plsql_functions.sql    # Functions for balance and ledger reconciliation
│   ├── plsql_views.sql        # Analytics and reporting views
│   ├── seed_data.sql          # 3 Customers, 3 Bank Accounts, 1 Admin, Initial Tx
│   ├── init_db.sql            # Master psql execution script
│   └── setup.js               # Node.js automated database setup runner
├── src/
│   ├── config/
│   │   └── db.js              # PostgreSQL connection pool (pg.Pool)
│   ├── controllers/
│   │   ├── authController.js       # Customer and admin authentication + Rule 3
│   │   ├── customerController.js   # Deposit, withdraw, transfer, statement
│   │   └── adminController.js      # Fraud alerts, resolve alert, accounts overview
│   ├── routes/
│   │   ├── authRoutes.js           # /api/auth routes
│   │   ├── customerRoutes.js       # /api/customer routes
│   │   └── adminRoutes.js          # /api/admin routes
│   └── server.js                   # Express application entry point
└── public/
    ├── index.html             # Single-Page UI (Login, Customer, Admin)
    ├── css/
    │   └── styles.css         # Modern light-themed dashboard styles
    └── js/
        ├── app.js             # Core client state, authentication, toasts
        ├── customer.js        # Customer actions (deposit, transfer, burst demo)
        └── admin.js           # Admin console (fraud resolution, audits)
```

---

## 5. Sample Dataset

### Customers & Bank Accounts
| Customer Name | Username | Password | Account Number | Account Type | Initial Balance |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Rajesh Sharma** | `rajesh` | `password123` | `ACC1001001` | SAVINGS | **₹1,00,000.00** |
| **Priya Patel** | `priya` | `password123` | `ACC1001002` | SAVINGS | **₹75,000.00** |
| **Amit Kumar** | `amit` | `password123` | `ACC1001003` | CURRENT | **₹50,000.00** |

### Bank Administrator
- **Username:** `admin`
- **Password:** `admin123`
- **Role:** `SUPER_ADMIN`

---

## 6. Setup and Installation

### Prerequisites
1. **Node.js** (v18 or higher recommended; verified with Node v25)
2. **PostgreSQL** (running locally on port `5000` or standard `5432`)

### Step 1: Configure Database Credentials
Open or edit the `.env` file in the project root:
```env
PORT=3000
PGHOST=localhost
PGPORT=5000
PGUSER=postgres
PGPASSWORD=your_actual_postgres_password
PGDATABASE=banking_db
```

### Step 2: Install Node Dependencies
```bash
npm install
```

### Step 3: Run Database Setup & Seeding
Run the automated database setup script. It connects to PostgreSQL, creates the `banking_db` database, creates all tables, triggers, procedures, views, and seeds the sample dataset:
```bash
npm run setup-db
```

*(Alternatively, you can run `psql -p 5000 -U postgres -d banking_db -f database/init_db.sql`)*

### Step 4: Start the Web Application
```bash
npm start
```
Open your browser and navigate to:
**`http://localhost:3000`**

---

## 7. Step-by-Step College Demo Script

Follow these steps during your project viva/presentation:

### Step 1: Log in as Customer
1. Click the **"Rajesh"** demo button on the login screen (fills `rajesh` / `password123`).
2. Click **Sign In to Account**.
3. You are redirected to Rajesh's dashboard. Notice his starting balance is **₹1,00,000.00**.

### Step 2: Deposit ₹10,000
1. Click **Deposit Money**.
2. Enter `10000` (or click the **₹10,000** chip button).
3. Click **Confirm Deposit**.
4. Observe that the balance atomically increases to **₹1,10,000.00**, and a completed deposit appears in Recent Transactions.

### Step 3: Transfer ₹5,000 to Another Account
1. Click **Transfer Funds** in the sidebar.
2. Select beneficiary **Priya Patel (`ACC1001002`)**.
3. Click the **"Normal: ₹5,000"** quick chip button.
4. Click **Confirm & Execute Transfer**.
5. Observe the balance decreases to **₹1,05,000.00**. Status is **COMPLETED**.

### Step 4: Make a Transaction of ₹60,000 (Trigger Fraud Rule 1)
1. On the **Transfer Funds** screen, select **Amit Kumar (`ACC1001003`)**.
2. Click the **"Flag Rule 1: ₹60,000"** quick chip button (amount: `60000`).
3. Click **Confirm & Execute Transfer**.
4. A warning toast appears: **"⚠️ FRAUD RULE 1 TRIGGERED: Transaction flagged as SUSPICIOUS!"**.
5. Observe that the transaction status is marked **SUSPICIOUS** with an amber warning badge.

### Step 5 (Bonus): Test Rule 2 (Rapid Transactions Burst)
1. Click the **"Burst Rule 2: (4 Rapid Tx)"** button on the Transfer page.
2. The system fires 4 rapid transfers in succession.
3. Once the count exceeds 3 in under 60 seconds, the 4th transfer is immediately flagged as **SUSPICIOUS**.

### Step 6 (Bonus): Test Rule 3 (Account Lockout)
1. Log out.
2. Enter username `amit` and deliberately enter a wrong password 3 consecutive times.
3. On the 3rd attempt, a critical alert pops up: **"FRAUD ALERT TRIGGERED: 3 consecutive failed login attempts detected. Your account has been locked!"**.

### Step 7: Open Admin Dashboard & Review Alerts
1. On the login page, switch to **Admin Portal** (or click the **"Admin"** demo chip).
2. Credentials: `admin` / `admin123`. Click **Access Admin Console**.
3. View the KPI cards:
   - Suspicious Transactions count
   - Pending Fraud Alerts count
4. In the **Fraud Alert Management Console**, see the flagged ₹60,000 transaction (Rule 1) and any velocity or login alerts.

### Step 8: Approve or Reject & Reverse Funds
1. Click **Reject & Reverse** on the ₹60,000 high-value alert.
2. Confirm the rejection in the modal dialog.
3. The database executes the stored procedure `sp_resolve_fraud_alert` with a compensating transaction:
   - Transaction status updates to **REJECTED**.
   - Rajesh's ₹60,000 is automatically refunded back to his account!
4. Click **Customers & Accounts** tab -> click **Audit** to see the PL/pgSQL function `fn_calculate_ledger_balance` verify that all deposits, withdrawals, and transfers reconcile with zero discrepancy.

---

## 8. Verification & Viva Questions Reference

- **Q: Why are triggers preferred for fraud detection here instead of application code?**
  *A:* Database triggers execute inside the database transaction engine. Regardless of whether a transaction is initiated via the web dashboard, a mobile client, batch job, or direct SQL prompt, the fraud detection rules cannot be bypassed.
- **Q: How is deadlock prevented in money transfers?**
  *A:* In `sp_transfer_money`, account locks (`SELECT ... FOR UPDATE`) are acquired strictly in order of ascending `account_id` (`IF from_id < to_id ...`). This guarantees no two concurrent reverse transfers can block each other cyclically.
- **Q: What happens when an Admin rejects a transaction?**
  *A:* The system executes a compensating transaction that reverts balances (crediting the sender and debiting the recipient), preserving full audit trails rather than deleting transaction history.
