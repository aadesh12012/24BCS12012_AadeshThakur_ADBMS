const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// Account details & live balance
router.get('/account/:accountNumber', customerController.getAccountDetails);

// Banking operations
router.post('/deposit', customerController.deposit);
router.post('/withdraw', customerController.withdraw);
router.post('/transfer', customerController.transfer);

// History & helpers
router.get('/transactions/:accountNumber', customerController.getTransactionHistory);
router.get('/recipients', customerController.getTransferRecipients);

module.exports = router;
