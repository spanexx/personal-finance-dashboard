const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const { getCashflowChart } = require('../controllers/cashflow.controller');

// GET /api/cashflow/chart
router.get('/chart',  verifyToken, getCashflowChart);

module.exports = router;