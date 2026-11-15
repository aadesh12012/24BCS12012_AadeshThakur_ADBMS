const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/metrics', adminController.getDashboardMetrics);
router.get('/customers', adminController.getAllCustomers);
router.get('/accounts', adminController.getAllAccounts);
router.get('/transactions', adminController.getAllTransactions);
router.get('/suspicious', adminController.getSuspiciousTransactions);
router.get('/fraud-alerts', adminController.getAllFraudAlerts);
router.post('/resolve-alert', adminController.resolveFraudAlert);
router.post('/unlock-customer', adminController.unlockCustomer);
router.get('/audit/:accountId', adminController.runLedgerAudit);

module.exports = router;
