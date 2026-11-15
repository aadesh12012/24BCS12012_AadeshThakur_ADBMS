// =============================================================================
// Apex Financial — Premium Fintech Web Application Script
// Connects to Node.js / Express Backend + PostgreSQL Database
// =============================================================================

const state = {
    user: null,
    role: 'CUSTOMER', // 'CUSTOMER' | 'ADMIN'
    isBalanceVisible: true,
    currentBalance: 0,
    activeCustomerTab: 'overview',
    activeAdminTab: 'overview',
    customerChart: null,
    adminChart: null,
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initIcons();
    checkDatabaseConnection();

    // Check for saved session
    const saved = localStorage.getItem('apex_fintech_session');
    if (saved) {
        try {
            state.user = JSON.parse(saved);
            state.role = state.user.role;
            showDashboard();
        } catch (e) {
            localStorage.removeItem('apex_fintech_session');
            showLogin();
        }
    } else {
        showLogin();
    }
});

// Render Lucide Icons
function initIcons() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Check backend health & database status
async function checkDatabaseConnection() {
    const label = document.getElementById('dbStatusLabel');
    try {
        const res = await fetch('/api/health');
        const data = await res.json();
        if (data.status === 'UP') {
            label.textContent = 'PostgreSQL Active';
        } else {
            label.textContent = 'Database Offline';
        }
    } catch (e) {
        label.textContent = 'Server Offline';
    }
}

// -----------------------------------------------------------------------------
// 1. AUTHENTICATION & ROLE SWITCHING
// -----------------------------------------------------------------------------
function switchLoginRole(role) {
    state.role = role;
    const tabCust = document.getElementById('tabCustomerBtn');
    const tabAdmin = document.getElementById('tabAdminBtn');
    const formCust = document.getElementById('customerLoginForm');
    const formAdmin = document.getElementById('adminLoginForm');

    if (role === 'CUSTOMER') {
        tabCust.classList.add('active');
        tabAdmin.classList.remove('active');
        formCust.classList.remove('hidden');
        formAdmin.classList.add('hidden');
    } else {
        tabAdmin.classList.add('active');
        tabCust.classList.remove('active');
        formAdmin.classList.remove('hidden');
        formCust.classList.add('hidden');
    }
    initIcons();
}

function quickFillLogin(u, p, role) {
    switchLoginRole(role);
    if (role === 'CUSTOMER') {
        document.getElementById('custUsername').value = u;
        document.getElementById('custPassword').value = p;
    } else {
        document.getElementById('adminUsername').value = u;
        document.getElementById('adminPassword').value = p;
    }
    showToast('info', 'Demo Credentials Loaded', `Selected user: ${u}`);
}

async function handleCustomerLogin(e) {
    e.preventDefault();
    const username = document.getElementById('custUsername').value.trim();
    const password = document.getElementById('custPassword').value;
    const submitBtn = document.getElementById('btnCustomerSubmit');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Signing In...</span>';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
            state.user = data.user;
            state.role = 'CUSTOMER';
            localStorage.setItem('apex_fintech_session', JSON.stringify(state.user));
            showToast('success', 'Authentication Successful', `Welcome, ${data.user.fullName}`);
            showDashboard();
        } else {
            if (data.isLocked) {
                showToast('danger', 'ACCOUNT LOCKED (Rule 3)', data.message);
            } else {
                showToast('danger', 'Access Denied', data.message);
            }
        }
    } catch (err) {
        showToast('danger', 'Server Error', 'Failed to connect to backend: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Sign In</span> <i data-lucide="arrow-right" class="icon-sm"></i>';
        initIcons();
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const username = document.getElementById('adminUsername').value.trim();
    const password = document.getElementById('adminPassword').value;
    const submitBtn = document.getElementById('btnAdminSubmit');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Authenticating...</span>';

    try {
        const res = await fetch('/api/auth/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
            state.user = data.user;
            state.role = 'ADMIN';
            localStorage.setItem('apex_fintech_session', JSON.stringify(state.user));
            showToast('success', 'Admin Session Verified', `Signed in as ${data.user.fullName}`);
            showDashboard();
        } else {
            showToast('danger', 'Authentication Failed', data.message);
        }
    } catch (err) {
        showToast('danger', 'Server Error', err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Access Admin Console</span> <i data-lucide="arrow-right" class="icon-sm"></i>';
        initIcons();
    }
}

function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appShell').classList.add('hidden');
    initIcons();
}

function logout() {
    state.user = null;
    localStorage.removeItem('apex_fintech_session');
    showLogin();
    showToast('info', 'Signed Out', 'Your session has ended securely.');
}

// -----------------------------------------------------------------------------
// 2. DASHBOARD NAVIGATION & SHELL
// -----------------------------------------------------------------------------
function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');

    const nameEl = document.getElementById('sidebarUserName');
    const subEl = document.getElementById('sidebarUserSub');
    const avatarEl = document.getElementById('userAvatarBadge');
    const roleLabel = document.getElementById('sidebarRoleLabel');

    nameEl.textContent = state.user.fullName;
    avatarEl.textContent = state.user.fullName.charAt(0).toUpperCase();

    if (state.role === 'CUSTOMER') {
        roleLabel.textContent = 'Banking';
        subEl.textContent = state.user.account ? state.user.account.account_number : 'Savings';
        document.getElementById('customerNav').classList.remove('hidden');
        document.getElementById('adminNav').classList.add('hidden');
        document.getElementById('customerViews').classList.remove('hidden');
        document.getElementById('adminViews').classList.add('hidden');
        document.getElementById('topbarCustomerActions').classList.remove('hidden');

        switchCustomerTab('overview');
        loadCustomerData();
    } else {
        roleLabel.textContent = 'Risk Operations';
        subEl.textContent = 'Administrator';
        document.getElementById('customerNav').classList.add('hidden');
        document.getElementById('adminNav').classList.remove('hidden');
        document.getElementById('customerViews').classList.add('hidden');
        document.getElementById('adminViews').classList.remove('hidden');
        document.getElementById('topbarCustomerActions').classList.add('hidden');

        switchAdminTab('overview');
        loadAdminData();
    }
    initIcons();
}

function refreshCurrentView() {
    if (state.role === 'CUSTOMER') {
        loadCustomerData();
    } else {
        loadAdminData();
    }
    showToast('info', 'Refreshed', 'Retrieved latest records from database.');
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('mainSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('active');
}

// -----------------------------------------------------------------------------
// 3. CUSTOMER DASHBOARD LOGIC
// -----------------------------------------------------------------------------
function switchCustomerTab(tabName) {
    state.activeCustomerTab = tabName;

    // Update Nav Active State
    const navItems = document.querySelectorAll('#customerNav .nav-item');
    navItems.forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`#customerNav a[href="#${tabName}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Hide all customer tabs
    const tabs = ['custTabOverview', 'custTabAccounts', 'custTabTransactions', 'custTabTransfer', 'custTabNotifications', 'custTabSettings'];
    tabs.forEach(t => document.getElementById(t).classList.add('hidden'));

    // Topbar header mapping
    const titleMap = {
        overview: { title: 'Overview', sub: 'Account summary and live balance' },
        accounts: { title: 'My Accounts', sub: 'Registered deposit and savings portfolio' },
        transactions: { title: 'Transactions', sub: 'Complete historical ledger statement' },
        transfer: { title: 'Transfer Money', sub: 'Send funds securely across verified accounts' },
        notifications: { title: 'Notifications', sub: 'Security alerts and audit notifications' },
        settings: { title: 'Settings', sub: 'Profile details and account security' },
    };

    const header = titleMap[tabName] || titleMap.overview;
    document.getElementById('topbarTitle').textContent = header.title;
    document.getElementById('topbarSubtitle').textContent = header.sub;

    if (tabName === 'overview') document.getElementById('custTabOverview').classList.remove('hidden');
    if (tabName === 'accounts') document.getElementById('custTabAccounts').classList.remove('hidden');
    if (tabName === 'transactions') document.getElementById('custTabTransactions').classList.remove('hidden');
    if (tabName === 'transfer') {
        document.getElementById('custTabTransfer').classList.remove('hidden');
        loadTransferBeneficiaries();
    }
    if (tabName === 'notifications') document.getElementById('custTabNotifications').classList.remove('hidden');
    if (tabName === 'settings') {
        document.getElementById('custTabSettings').classList.remove('hidden');
        populateCustomerSettings();
    }

    initIcons();
}

// Fetch and render Customer Account Data
async function loadCustomerData() {
    if (!state.user || !state.user.account) return;
    const accNo = state.user.account.account_number;

    try {
        // 1. Fetch live balance & account details
        const accRes = await fetch(`/api/customer/account/${accNo}`);
        const accData = await accRes.json();

        if (accData.success) {
            const acc = accData.account;
            state.user.account = acc;
            state.currentBalance = parseFloat(acc.balance);

            document.getElementById('custWelcomeHeading').textContent = `Welcome, ${acc.full_name.split(' ')[0]}`;
            document.getElementById('custAccountNoText').textContent = acc.account_number;
            document.getElementById('cardDetailAccNo').textContent = acc.account_number;
            document.getElementById('custAccountTypeBadge').textContent = acc.account_type || 'SAVINGS';

            const statusBadge = document.getElementById('custAccountStatusBadge');
            statusBadge.textContent = acc.customer_status;
            statusBadge.className = `badge ${acc.customer_status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`;

            updateBalanceDisplay();
        }

        // 2. Fetch transaction history
        const txRes = await fetch(`/api/customer/transactions/${accNo}`);
        const txData = await txRes.json();

        if (txData.success) {
            renderCustomerTransactions(txData.transactions);
            computeMonthlySummary(txData.transactions);
            renderCustomerActivityChart(txData.transactions);
            renderCustomerNotifications(txData.transactions);
        }
    } catch (err) {
        console.error('Customer data load error:', err);
    }
}

function updateBalanceDisplay() {
    const el = document.getElementById('custBalanceValue');
    const cardEl = document.getElementById('cardDetailBalance');
    const eye = document.getElementById('eyeIcon');

    if (state.isBalanceVisible) {
        const formatted = formatINR(state.currentBalance);
        el.textContent = formatted;
        cardEl.textContent = formatted;
        if (eye) eye.setAttribute('data-lucide', 'eye-off');
    } else {
        el.textContent = '₹ ••••••••';
        cardEl.textContent = '₹ ••••••••';
        if (eye) eye.setAttribute('data-lucide', 'eye');
    }
    initIcons();
}

function toggleBalanceVisibility() {
    state.isBalanceVisible = !state.isBalanceVisible;
    updateBalanceDisplay();
}

// Compute Inflow, Outflow, Net flow from real transactions
function computeMonthlySummary(transactions) {
    if (!transactions) return;
    const accNo = state.user.account.account_number;

    let totalInflow = 0;
    let totalOutflow = 0;

    transactions.forEach(t => {
        if (t.status === 'REJECTED') return;
        const amt = parseFloat(t.amount) || 0;
        const isDebit = (t.transaction_type === 'WITHDRAWAL') || 
                        (t.transaction_type === 'TRANSFER' && t.sender_account_number === accNo);

        if (isDebit) {
            totalOutflow += amt;
        } else {
            totalInflow += amt;
        }
    });

    const net = totalInflow - totalOutflow;

    document.getElementById('custTotalInflow').textContent = `+${formatINR(totalInflow)}`;
    document.getElementById('custTotalOutflow').textContent = `-${formatINR(totalOutflow)}`;
    
    const netEl = document.getElementById('custNetCashflow');
    netEl.textContent = (net >= 0 ? '+' : '-') + formatINR(Math.abs(net));
    netEl.className = `flow-val-total ${net >= 0 ? 'text-primary' : 'text-danger'}`;
}

// Render Customer Transactions Tables
function renderCustomerTransactions(transactions) {
    const recentBody = document.getElementById('custRecentTxTableBody');
    const fullBody = document.getElementById('custFullTxTableBody');
    const accNo = state.user.account.account_number;

    if (!transactions || transactions.length === 0) {
        const empty = '<tr><td colspan="7" class="text-center text-muted py-4">No transactions found in this account.</td></tr>';
        if (recentBody) recentBody.innerHTML = empty;
        if (fullBody) fullBody.innerHTML = empty;
        return;
    }

    const rows = transactions.map(t => {
        const isDebit = (t.transaction_type === 'WITHDRAWAL') || 
                        (t.transaction_type === 'TRANSFER' && t.sender_account_number === accNo);
        const color = isDebit ? 'text-secondary' : 'text-success';
        const sign = isDebit ? '-' : '+';
        const desc = t.transaction_type === 'TRANSFER'
            ? (isDebit ? `To ${t.receiver_name} (${t.receiver_account_number})` : `From ${t.sender_name} (${t.sender_account_number})`)
            : (t.description || t.transaction_type);

        return `
            <tr>
                <td class="font-mono text-xs">#${t.transaction_id}</td>
                <td><small class="text-secondary">${t.formatted_date || formatDate(t.transaction_date)}</small></td>
                <td><span class="badge badge-neutral">${t.transaction_type}</span></td>
                <td><strong>${desc}</strong></td>
                <td class="${color} font-semibold">${sign}${t.formatted_amount || formatINR(t.amount)}</td>
                <td>${renderStatusBadge(t.status)}</td>
            </tr>
        `;
    });

    if (recentBody) recentBody.innerHTML = rows.slice(0, 5).join('');
    if (fullBody) fullBody.innerHTML = rows.join('');
}

// Render Account Activity Chart via Chart.js
function renderCustomerActivityChart(transactions) {
    const ctx = document.getElementById('customerActivityChart');
    if (!ctx) return;

    if (state.customerChart) {
        state.customerChart.destroy();
    }

    // Generate last 6 transaction points or monthly points
    const labels = [];
    const creditsData = [];
    const debitsData = [];
    const accNo = state.user.account.account_number;

    const recent = (transactions || []).slice(0, 7).reverse();
    recent.forEach((t, i) => {
        labels.push(`Tx #${t.transaction_id}`);
        const isDebit = (t.transaction_type === 'WITHDRAWAL') || 
                        (t.transaction_type === 'TRANSFER' && t.sender_account_number === accNo);
        if (isDebit) {
            debitsData.push(parseFloat(t.amount));
            creditsData.push(0);
        } else {
            creditsData.push(parseFloat(t.amount));
            debitsData.push(0);
        }
    });

    if (labels.length === 0) {
        labels.push('Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5');
        creditsData.push(25000, 10000, 15000, 5000, 12000);
        debitsData.push(2000, 5000, 1000, 4000, 3000);
    }

    state.customerChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Inflow (₹)',
                    data: creditsData,
                    backgroundColor: '#533AFD',
                    borderRadius: 4,
                    barThickness: 16,
                },
                {
                    label: 'Outflow (₹)',
                    data: debitsData,
                    backgroundColor: '#FF6118',
                    borderRadius: 4,
                    barThickness: 16,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748D', font: { size: 11, family: 'Inter' } }
                },
                y: {
                    grid: { color: '#E5EDF5' },
                    ticks: {
                        color: '#64748D',
                        font: { size: 11, family: 'Inter' },
                        callback: (v) => '₹' + v.toLocaleString('en-IN')
                    }
                }
            }
        }
    });
}

function renderCustomerNotifications(transactions) {
    const list = document.getElementById('customerNotificationsList');
    if (!list) return;

    const notifs = [
        {
            title: 'Account Security Active',
            desc: 'Automated PL/pgSQL fraud detection engine is actively safeguarding all outbound transfers.',
            time: 'Just now',
            type: 'info'
        }
    ];

    (transactions || []).forEach(t => {
        if (t.status === 'SUSPICIOUS') {
            notifs.unshift({
                title: 'Transaction Flagged for Review',
                desc: `Tx #${t.transaction_id} of ₹${parseFloat(t.amount).toLocaleString('en-IN')} was flagged as SUSPICIOUS and routed to Risk Admin.`,
                time: formatDate(t.transaction_date),
                type: 'warning'
            });
        }
    });

    list.innerHTML = notifs.map(n => `
        <div class="card p-4 mb-3 border-l-4" style="border-left: 4px solid ${n.type === 'warning' ? '#FF6118' : '#533AFD'};">
            <div class="flex justify-between items-center mb-1">
                <strong class="text-sm font-semibold">${n.title}</strong>
                <span class="text-xs text-muted">${n.time}</span>
            </div>
            <p class="text-xs text-secondary">${n.desc}</p>
        </div>
    `).join('');
}

function populateCustomerSettings() {
    if (!state.user) return;
    document.getElementById('setCustName').value = state.user.fullName || '';
    document.getElementById('setCustEmail').value = state.user.email || '';
    document.getElementById('setCustPhone').value = state.user.phone || '';
    document.getElementById('setCustUsername').value = state.user.username || '';
}

// -----------------------------------------------------------------------------
// 4. BANKING ACTIONS (Deposit, Withdraw, Transfer)
// -----------------------------------------------------------------------------
function openDepositModal() {
    document.getElementById('depositModalForm').reset();
    openModal('depositModal');
}

function openWithdrawModal() {
    document.getElementById('withdrawModalForm').reset();
    openModal('withdrawModal');
}

async function handleDepositSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('modalDepositAmount').value);
    const description = document.getElementById('modalDepositRemarks').value || 'Customer cash deposit';
    const accountNumber = state.user.account.account_number;

    closeModal('depositModal');

    try {
        const res = await fetch('/api/customer/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountNumber, amount, description })
        });
        const data = await res.json();

        if (data.success) {
            if (data.isSuspicious) {
                showToast('warning', '⚠️ FRAUD ANOMALY TRIGGERED', data.message);
            } else {
                showToast('success', 'Deposit Confirmed', data.message);
            }
            loadCustomerData();
        } else {
            showToast('danger', 'Deposit Failed', data.message);
        }
    } catch (err) {
        showToast('danger', 'Error', err.message);
    }
}

async function handleWithdrawSubmit(e) {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('modalWithdrawAmount').value);
    const description = document.getElementById('modalWithdrawRemarks').value || 'Customer cash withdrawal';
    const accountNumber = state.user.account.account_number;

    closeModal('withdrawModal');

    try {
        const res = await fetch('/api/customer/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountNumber, amount, description })
        });
        const data = await res.json();

        if (data.success) {
            if (data.isSuspicious) {
                showToast('warning', '⚠️ FRAUD ANOMALY TRIGGERED', data.message);
            } else {
                showToast('success', 'Withdrawal Confirmed', data.message);
            }
            loadCustomerData();
        } else {
            showToast('danger', 'Withdrawal Denied', data.message);
        }
    } catch (err) {
        showToast('danger', 'Error', err.message);
    }
}

async function loadTransferBeneficiaries() {
    if (!state.user || !state.user.account) return;
    const accNo = state.user.account.account_number;

    try {
        const res = await fetch(`/api/customer/recipients?excludeAccount=${accNo}`);
        const data = await res.json();

        if (data.success) {
            const select = document.getElementById('transferRecipientSelect');
            select.innerHTML = '<option value="">-- Select Beneficiary Recipient --</option>';

            data.recipients.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.account_number;
                opt.textContent = `${r.account_number} — ${r.full_name} (${r.account_type})`;
                select.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Error loading beneficiaries:', err);
    }
}

async function handleTransferSubmit(e) {
    e.preventDefault();
    const toAccount = document.getElementById('transferRecipientSelect').value;
    const amount = parseFloat(document.getElementById('transferAmountInput').value);
    const description = document.getElementById('transferRemarksInput').value || 'Funds transfer';
    const fromAccount = state.user.account.account_number;

    if (!toAccount) {
        showToast('danger', 'Validation Error', 'Please select a beneficiary account.');
        return;
    }

    const btn = document.getElementById('btnTransferSubmit');
    btn.disabled = true;
    btn.innerHTML = '<span>Executing Atomic Procedure...</span>';

    try {
        const res = await fetch('/api/customer/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromAccount, toAccount, amount, description })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('transferMoneyForm').reset();
            if (data.isSuspicious) {
                showToast('warning', '⚠️ FRAUD RULE 1 TRIGGERED!', `Transfer of ${formatINR(amount)} flagged as SUSPICIOUS! Alert sent to Admin.`);
            } else {
                showToast('success', 'Transfer Completed', data.message);
            }
            loadCustomerData();
            switchCustomerTab('transactions');
        } else {
            showToast('danger', 'Transfer Failed', data.message);
        }
    } catch (err) {
        showToast('danger', 'Transaction Error', err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send" class="icon-sm"></i> <span>Confirm & Transfer</span>';
        initIcons();
    }
}

function setTransferDemo(amount, description) {
    document.getElementById('transferAmountInput').value = amount;
    document.getElementById('transferRemarksInput').value = description;

    const select = document.getElementById('transferRecipientSelect');
    if (select.options.length > 1 && !select.value) {
        select.selectedIndex = 1;
    }
}

// Rapid Transaction Burst Demo (Rule 2)
async function triggerRapidBurstDemo() {
    const select = document.getElementById('transferRecipientSelect');
    if (select.options.length <= 1) {
        showToast('danger', 'Error', 'No recipient account available.');
        return;
    }
    const toAccount = select.options[1].value;
    const fromAccount = state.user.account.account_number;

    showToast('info', 'Rapid Burst Demo Triggered', 'Firing 4 quick transfers to simulate velocity anomaly (> 3 tx / min)...');

    for (let i = 1; i <= 4; i++) {
        try {
            const res = await fetch('/api/customer/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromAccount,
                    toAccount,
                    amount: 50 * i,
                    description: `Rapid Burst Tx #${i} (Rule 2 Simulation)`
                })
            });
            const data = await res.json();
            if (data.isSuspicious) {
                showToast('warning', `⚠️ Tx #${i} FLAGGED as SUSPICIOUS!`, `Velocity threshold exceeded (>3 tx in 60s). Trigger recorded in FRAUD_ALERTS.`);
            }
        } catch (e) {
            console.error(e);
        }
    }
    loadCustomerData();
    switchCustomerTab('transactions');
}

// -----------------------------------------------------------------------------
// 5. ADMIN DASHBOARD LOGIC
// -----------------------------------------------------------------------------
function switchAdminTab(tabName) {
    state.activeAdminTab = tabName;

    // Update Nav Active State
    const navItems = document.querySelectorAll('#adminNav .nav-item');
    navItems.forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`#adminNav a[href="#admin${capitalize(tabName)}"]`) || 
                      document.querySelector(`#adminNav a[href="#admin${tabName}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Hide all admin tabs
    const tabs = ['admTabOverview', 'admTabFraud', 'admTabCustomers', 'admTabAccounts', 'admTabTransactions', 'admTabAudit'];
    tabs.forEach(t => document.getElementById(t).classList.add('hidden'));

    const titleMap = {
        overview: { title: 'Risk & Operations Overview', sub: 'System-wide monitoring of customers, accounts, and fraud anomalies' },
        fraud: { title: 'Fraud Monitoring Interface', sub: 'Automated anomaly detection, investigations, and alert resolutions' },
        alerts: { title: 'Fraud Alerts Journal', sub: 'Filter and review pending security alerts' },
        customers: { title: 'Customers Directory', sub: 'Customer profiles and status management' },
        accounts: { title: 'Bank Accounts Ledger', sub: 'Verified bank accounts and balance reconciliation' },
        transactions: { title: 'Master Transaction Journal', sub: 'Complete database audit trail of all financial movements' },
        audit: { title: 'ADBMS Technical Audit Engine', sub: 'Database constructs enforcing transactional integrity and security rules' }
    };

    const header = titleMap[tabName] || titleMap.overview;
    document.getElementById('topbarTitle').textContent = header.title;
    document.getElementById('topbarSubtitle').textContent = header.sub;

    if (tabName === 'overview') document.getElementById('admTabOverview').classList.remove('hidden');
    if (tabName === 'fraud' || tabName === 'alerts') document.getElementById('admTabFraud').classList.remove('hidden');
    if (tabName === 'customers') {
        document.getElementById('admTabCustomers').classList.remove('hidden');
        loadAdminCustomers();
    }
    if (tabName === 'accounts') {
        document.getElementById('admTabAccounts').classList.remove('hidden');
        loadAdminAccounts();
    }
    if (tabName === 'transactions') {
        document.getElementById('admTabTransactions').classList.remove('hidden');
        loadAdminTransactions();
    }
    if (tabName === 'audit') document.getElementById('admTabAudit').classList.remove('hidden');

    initIcons();
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Load and Render Admin Data
async function loadAdminData() {
    try {
        // 1. Metrics View
        const mRes = await fetch('/api/admin/metrics');
        const mData = await mRes.json();

        if (mData.success) {
            const m = mData.metrics;
            document.getElementById('admMetricCustomers').textContent = m.totalCustomers;
            document.getElementById('admMetricAccounts').textContent = m.totalActiveAccounts;
            document.getElementById('admMetricTransactions').textContent = m.totalTransactions;
            document.getElementById('admMetricSuspicious').textContent = m.totalSuspiciousTransactions;
            document.getElementById('admMetricPending').textContent = m.pendingFraudAlerts;
            document.getElementById('badgeFraudAlertsCount').textContent = m.pendingFraudAlerts;

            // Fraud tab counts
            document.getElementById('fCountSuspicious').textContent = m.totalSuspiciousTransactions;
            document.getElementById('fCountPending').textContent = m.pendingFraudAlerts;
        }

        // 2. Fraud Alerts View
        loadAdminFraudAlerts();

        // 3. Admin Volume Chart
        renderAdminVolumeChart();
    } catch (err) {
        console.error('Admin data load error:', err);
    }
}

// Fetch & Render Fraud Alerts
async function loadAdminFraudAlerts() {
    const filterSelect = document.getElementById('adminFraudFilterSelect');
    const filter = filterSelect ? filterSelect.value : '';

    try {
        const res = await fetch(`/api/admin/fraud-alerts?status=${filter}`);
        const data = await res.json();

        const quickBody = document.getElementById('admQuickAlertsTableBody');
        const fullBody = document.getElementById('admFullFraudTableBody');

        if (!data.success || data.alerts.length === 0) {
            const empty = '<tr><td colspan="8" class="text-center text-muted py-4">No fraud alerts matching filter.</td></tr>';
            if (quickBody) quickBody.innerHTML = empty;
            if (fullBody) fullBody.innerHTML = empty;
            return;
        }

        // Compute rule breakdown counts
        let countRule1 = 0;
        let countRule2 = 0;
        let countRule3 = 0;

        data.alerts.forEach(a => {
            if (a.alert_type === 'HIGH_VALUE') countRule1++;
            if (a.alert_type === 'RAPID_TRANSACTION') countRule2++;
            if (a.alert_type === 'FAILED_LOGINS') countRule3++;
        });

        document.getElementById('fCountHighValue').textContent = countRule1;
        document.getElementById('fCountRapid').textContent = countRule2;
        document.getElementById('fCountLogins').textContent = countRule3;

        // Render full table rows
        const rows = data.alerts.map(a => {
            const isPending = a.alert_status === 'PENDING';
            let ruleTag = '';
            if (a.alert_type === 'HIGH_VALUE') ruleTag = '<span class="badge badge-warning">Rule 1: High Value</span>';
            if (a.alert_type === 'RAPID_TRANSACTION') ruleTag = '<span class="badge badge-warning">Rule 2: Velocity</span>';
            if (a.alert_type === 'FAILED_LOGINS') ruleTag = '<span class="badge badge-danger">Rule 3: Failed Logins</span>';

            const actionsHtml = isPending ? `
                <div style="display:flex; gap:6px;">
                    <button class="btn btn-outline btn-sm" onclick="openAlertDetailsModal(${JSON.stringify(a).replace(/"/g, '&quot;')})">Details</button>
                    <button class="btn btn-success btn-sm" onclick="quickResolve(${a.alert_id}, 'APPROVE')">Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="quickResolve(${a.alert_id}, 'REJECT')">Reject</button>
                </div>
            ` : `<small class="text-muted">${a.alert_status} by ${a.resolved_by || 'admin'}</small>`;

            return `
                <tr>
                    <td class="font-mono text-xs font-semibold">#${a.alert_id}</td>
                    <td><strong>${a.customer_name || 'System Anomaly'}</strong></td>
                    <td class="font-mono text-xs">${a.account_number || a.username || 'N/A'}</td>
                    <td class="font-semibold text-warning">${a.transaction_amount ? formatINR(a.transaction_amount) : '—'}</td>
                    <td><small>${a.alert_message}</small></td>
                    <td><small class="text-secondary">${a.formatted_created_at || formatDate(a.created_at)}</small></td>
                    <td>${renderStatusBadge(a.alert_status)}</td>
                    <td>${actionsHtml}</td>
                </tr>
            `;
        });

        if (fullBody) fullBody.innerHTML = rows.join('');
        if (quickBody) quickBody.innerHTML = rows.slice(0, 5).join('');
    } catch (err) {
        console.error('Error fetching fraud alerts:', err);
    }
}

// Render Admin Volume Chart via Chart.js
function renderAdminVolumeChart() {
    const ctx = document.getElementById('adminVolumeChart');
    if (!ctx) return;

    if (state.adminChart) {
        state.adminChart.destroy();
    }

    state.adminChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
            datasets: [
                {
                    label: 'Normal Transactions',
                    data: [15, 28, 42, 35, 50, 48, 62, 55],
                    borderColor: '#533AFD',
                    backgroundColor: 'rgba(83, 58, 253, 0.08)',
                    tension: 0.35,
                    fill: true,
                    pointRadius: 4,
                },
                {
                    label: 'Flagged Anomalies',
                    data: [0, 1, 0, 2, 0, 1, 3, 1],
                    borderColor: '#FF6118',
                    backgroundColor: 'rgba(255, 97, 24, 0.12)',
                    tension: 0.35,
                    fill: true,
                    pointRadius: 4,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#64748D', font: { size: 12, family: 'Inter' } }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#64748D', font: { size: 11, family: 'Inter' } }
                },
                y: {
                    grid: { color: '#E5EDF5' },
                    ticks: { color: '#64748D', font: { size: 11, family: 'Inter' } }
                }
            }
        }
    });
}

// Open Detailed Fraud Modal
function openAlertDetailsModal(alert) {
    document.getElementById('modalTargetAlertId').value = alert.alert_id;
    document.getElementById('modalResolutionRemarks').value = '';

    const body = document.getElementById('modalAlertDetailsBody');
    body.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <strong style="font-size:15px; color:#0D1738;">Alert #${alert.alert_id} Details</strong>
            ${renderStatusBadge(alert.alert_status)}
        </div>
        <table style="width:100%; font-size:13px; line-height:1.8;">
            <tr><td style="color:#64748D; width:140px;">Rule Triggered:</td><td><strong>${alert.alert_type}</strong></td></tr>
            <tr><td style="color:#64748D;">Customer Name:</td><td><strong>${alert.customer_name || 'N/A'}</strong></td></tr>
            <tr><td style="color:#64748D;">Account Number:</td><td><code>${alert.account_number || 'N/A'}</code></td></tr>
            <tr><td style="color:#64748D;">Transaction ID:</td><td>${alert.transaction_id ? '#' + alert.transaction_id : 'N/A'}</td></tr>
            <tr><td style="color:#64748D;">Amount:</td><td style="color:#FF6118; font-weight:700;">${alert.transaction_amount ? formatINR(alert.transaction_amount) : 'N/A'}</td></tr>
            <tr><td style="color:#64748D;">Threshold Limit:</td><td>${alert.threshold_value ? formatINR(alert.threshold_value) : 'N/A'}</td></tr>
            <tr><td style="color:#64748D;">Violation Reason:</td><td>${alert.alert_message}</td></tr>
            <tr><td style="color:#64748D;">Timestamp:</td><td>${alert.formatted_created_at || formatDate(alert.created_at)}</td></tr>
        </table>
    `;

    const actionBlock = document.getElementById('modalAlertActionBlock');
    const btnApprove = document.getElementById('btnModalApprove');
    const btnReject = document.getElementById('btnModalReject');

    if (alert.alert_status === 'PENDING') {
        actionBlock.classList.remove('hidden');
        btnApprove.classList.remove('hidden');
        btnReject.classList.remove('hidden');
    } else {
        actionBlock.classList.add('hidden');
        btnApprove.classList.add('hidden');
        btnReject.classList.add('hidden');
    }

    openModal('fraudAlertModal');
    initIcons();
}

// Execute Resolution from Modal
async function executeAlertResolution(action) {
    const alertId = document.getElementById('modalTargetAlertId').value;
    const remarks = document.getElementById('modalResolutionRemarks').value;
    closeModal('fraudAlertModal');

    await submitResolution(alertId, action, remarks);
}

// Quick 1-Click Resolve from Table
async function quickResolve(alertId, action) {
    const promptMsg = action === 'APPROVE'
        ? `Approve Fraud Alert #${alertId} and mark transaction legitimate?`
        : `Reject Fraud Alert #${alertId} and execute automatic compensating transaction to refund/rollback funds?`;

    if (!confirm(promptMsg)) return;

    await submitResolution(alertId, action, `Action ${action} executed by Admin Console`);
}

async function submitResolution(alertId, action, remarks) {
    try {
        const res = await fetch('/api/admin/resolve-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                alertId,
                action,
                adminUsername: state.user ? state.user.username : 'admin',
                remarks
            })
        });
        const data = await res.json();

        if (data.success) {
            showToast('success', 'Alert Resolved', data.message);
            loadAdminData();
        } else {
            showToast('danger', 'Resolution Error', data.message);
        }
    } catch (err) {
        showToast('danger', 'Error', err.message);
    }
}

// -----------------------------------------------------------------------------
// 6. ADMIN DIRECTORY & LEDGER VIEWS
// -----------------------------------------------------------------------------
async function loadAdminCustomers() {
    try {
        const res = await fetch('/api/admin/customers');
        const data = await res.json();
        const tbody = document.getElementById('admCustomersTableBody');

        if (!data.success || data.customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No customers registered.</td></tr>';
            return;
        }

        tbody.innerHTML = data.customers.map(c => {
            const isLocked = c.status === 'LOCKED';
            let actionBtn = isLocked 
                ? `<button class="btn btn-danger btn-sm" onclick="unlockCustomerAccount(${c.customer_id}, '${c.full_name}')">Unlock User</button>`
                : `<span class="text-muted">—</span>`;

            return `
                <tr>
                    <td class="font-mono text-xs">#${c.customer_id}</td>
                    <td><strong>${c.full_name}</strong></td>
                    <td><code>${c.username}</code></td>
                    <td class="text-secondary">${c.email}</td>
                    <td class="text-secondary">${c.phone}</td>
                    <td class="font-mono text-xs font-semibold">${c.account_number || 'N/A'}</td>
                    <td class="font-semibold text-primary">${formatINR(c.balance)}</td>
                    <td>${renderStatusBadge(c.status)}</td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Error loading customers:', err);
    }
}

async function loadAdminAccounts() {
    try {
        const res = await fetch('/api/admin/accounts');
        const data = await res.json();
        const tbody = document.getElementById('admAccountsTableBody');

        if (!data.success || data.accounts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No accounts in ledger.</td></tr>';
            return;
        }

        tbody.innerHTML = data.accounts.map(a => `
            <tr>
                <td class="font-mono text-xs font-semibold">${a.account_number}</td>
                <td><span class="badge badge-neutral">${a.account_type}</span></td>
                <td><strong>${a.customer_name}</strong> (${a.username})</td>
                <td class="font-semibold text-success">${a.formatted_balance || formatINR(a.balance)}</td>
                <td>${renderStatusBadge(a.customer_status)}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="triggerLedgerAudit(${a.account_id}, '${a.account_number}')">
                        <i data-lucide="calculator" class="icon-xs text-primary"></i> Run Audit
                    </button>
                </td>
            </tr>
        `).join('');
        initIcons();
    } catch (err) {
        console.error('Error loading accounts:', err);
    }
}

async function loadAdminTransactions() {
    try {
        const res = await fetch('/api/admin/transactions');
        const data = await res.json();
        const tbody = document.getElementById('admTransactionsTableBody');

        if (!data.success || data.transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No transactions found.</td></tr>';
            return;
        }

        tbody.innerHTML = data.transactions.map(t => `
            <tr>
                <td class="font-mono text-xs">#${t.transaction_id}</td>
                <td><small class="text-secondary">${t.formatted_date || formatDate(t.transaction_date)}</small></td>
                <td class="font-mono text-xs">${t.sender_account_number}</td>
                <td><strong>${t.sender_name}</strong></td>
                <td><span class="badge badge-neutral">${t.transaction_type}</span></td>
                <td class="font-semibold">${t.formatted_amount || formatINR(t.amount)}</td>
                <td>${t.receiver_account_number ? `${t.receiver_name} (${t.receiver_account_number})` : '—'}</td>
                <td>${renderStatusBadge(t.status)}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Error loading master transactions:', err);
    }
}

// Unlock Locked Customer (Rule 3)
async function unlockCustomerAccount(customerId, name) {
    if (!confirm(`Unlock account for ${name}?`)) return;

    try {
        const res = await fetch('/api/admin/unlock-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId })
        });
        const data = await res.json();

        if (data.success) {
            showToast('success', 'User Unlocked', data.message);
            loadAdminCustomers();
        } else {
            showToast('danger', 'Error', data.message);
        }
    } catch (err) {
        showToast('danger', 'Error', err.message);
    }
}

// PL/pgSQL Function fn_calculate_ledger_balance Audit
async function triggerLedgerAudit(accountId, accountNo) {
    const body = document.getElementById('auditReportModalBody');
    body.innerHTML = '<div class="text-center py-4"><p class="text-secondary">Executing PL/pgSQL audit function...</p></div>';
    openModal('auditReportModal');

    try {
        const res = await fetch(`/api/admin/audit/${accountId}`);
        const data = await res.json();

        if (data.success && data.audit) {
            const a = data.audit;
            const isReconciled = a.is_reconciled;

            body.innerHTML = `
                <div style="background:#F8FAFD; padding:18px; border-radius:8px; border:1px solid #E5EDF5;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
                        <div>
                            <span style="font-size:11px; text-transform:uppercase; color:#64748D; font-weight:600;">Audited Account</span>
                            <h4 style="font-size:16px; color:#0D1738;">${a.account_number}</h4>
                        </div>
                        <span class="badge ${isReconciled ? 'badge-success' : 'badge-danger'}">
                            ${isReconciled ? 'RECONCILED' : 'DISCREPANCY'}
                        </span>
                    </div>

                    <table style="width:100%; font-size:13px; border-collapse:collapse; line-height:2.2;">
                        <tr style="border-bottom:1px solid #E5EDF5;">
                            <td style="color:#64748D;">Total Deposits:</td>
                            <td style="text-align:right; font-weight:600;" class="text-success">+${formatINR(a.total_deposits)}</td>
                        </tr>
                        <tr style="border-bottom:1px solid #E5EDF5;">
                            <td style="color:#64748D;">Total Withdrawals:</td>
                            <td style="text-align:right; font-weight:600;" class="text-warning">-${formatINR(a.total_withdrawals)}</td>
                        </tr>
                        <tr style="border-bottom:1px solid #E5EDF5;">
                            <td style="color:#64748D;">Transfers Sent:</td>
                            <td style="text-align:right; font-weight:600;" class="text-warning">-${formatINR(a.total_transfers_sent)}</td>
                        </tr>
                        <tr style="border-bottom:1px solid #E5EDF5;">
                            <td style="color:#64748D;">Transfers Received:</td>
                            <td style="text-align:right; font-weight:600;" class="text-success">+${formatINR(a.total_transfers_received)}</td>
                        </tr>
                        <tr style="font-weight:700; background:#f1f5f9;">
                            <td style="padding-left:6px;">Current Stored Balance:</td>
                            <td style="text-align:right; padding-right:6px;" class="text-primary">${formatINR(a.current_stored_balance)}</td>
                        </tr>
                    </table>

                    <p style="margin-top:14px; font-size:11.5px; color:#64748D;">
                        <em>Computed directly via PostgreSQL function <code>fn_calculate_ledger_balance(p_account_id)</code>.</em>
                    </p>
                </div>
            `;
        } else {
            body.innerHTML = `<p class="text-danger">Audit failed: ${data.message}</p>`;
        }
    } catch (err) {
        body.innerHTML = `<p class="text-danger">Error: ${err.message}</p>`;
    }
}

// -----------------------------------------------------------------------------
// 7. UTILITIES, FORMATTERS & MODAL HELPERS
// -----------------------------------------------------------------------------
function formatINR(val) {
    const n = parseFloat(val) || 0;
    return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(str) {
    if (!str) return 'N/A';
    return new Date(str).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
}

function renderStatusBadge(status) {
    const s = (status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'APPROVED' || s === 'ACTIVE') {
        return `<span class="badge badge-success"><i data-lucide="check" class="icon-xs"></i> ${s}</span>`;
    }
    if (s === 'SUSPICIOUS' || s === 'PENDING') {
        return `<span class="badge badge-warning"><i data-lucide="alert-triangle" class="icon-xs"></i> ${s}</span>`;
    }
    if (s === 'REJECTED' || s === 'LOCKED') {
        return `<span class="badge badge-danger"><i data-lucide="x" class="icon-xs"></i> ${s}</span>`;
    }
    return `<span class="badge badge-neutral">${s}</span>`;
}

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    initIcons();
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

function showToast(type, title, msg) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'warning') iconName = 'alert-triangle';
    if (type === 'danger') iconName = 'alert-octagon';

    toast.innerHTML = `
        <i data-lucide="${iconName}" class="icon-sm text-${type}"></i>
        <div>
            <div class="toast-title">${title}</div>
            <div class="toast-msg">${msg}</div>
        </div>
    `;

    container.appendChild(toast);
    initIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => toast.remove(), 250);
    }, 4500);
}
