const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { verifyToken } = require('../middleware/auth.middleware');

/**
 * Report Routes
 * All routes require authentication
 */

// Apply authentication middleware to all routes
router.use(verifyToken);

/**
 * @route   GET /api/reports/spending
 * @desc    Generate spending analysis report
 * @access  Private
 * @params  startDate, endDate, categoryId, timeGroupBy, limit
 */
router.get('/spending', reportController.getSpendingReport);

/**
 * @route   GET /api/reports/income
 * @desc    Generate income analysis report
 * @access  Private
 * @params  startDate, endDate, timeGroupBy
 */
router.get('/income', reportController.getIncomeReport);

/**
 * @route   GET /api/reports/income-analysis
 * @desc    Generate income analysis (frontend compatible)
 * @access  Private
 * @params  startDate, endDate, sources, accounts, includeProjections
 */
router.get('/income-analysis', reportController.getIncomeReport);

/**
 * @route   GET /api/reports/cashflow
 * @desc    Generate cash flow analysis report
 * @access  Private
 * @params  startDate, endDate, projectionMonths
 */
router.get('/cashflow', reportController.getCashFlowReport);

/**
 * @route   GET /api/reports/budget-performance
 * @desc    Generate budget performance report
 * @access  Private
 * @params  startDate, endDate, budgetId
 */
router.get('/budget-performance', reportController.getBudgetPerformanceReport);

/**
 * @route   GET /api/reports/goal-progress
 * @desc    Generate goal progress report
 * @access  Private
 * @params  goalId (optional)
 */
router.get('/goal-progress', reportController.getGoalProgressReport);

/**
 * @route   GET /api/reports/net-worth
 * @desc    Calculate net worth and trends
 * @access  Private
 * @params  startDate, endDate, projectionMonths
 */
router.get('/net-worth', reportController.getNetWorthReport);

/**
 * @route   GET /api/reports/dashboard
 * @desc    Generate comprehensive financial dashboard summary
 * @access  Private
 * @params  period (month, quarter, year)
 */
router.get('/dashboard', reportController.getDashboardSummary);

/**
 * @route   GET /api/reports/insights
 * @desc    Generate financial insights and recommendations
 * @access  Private
 */
router.get('/insights', reportController.getFinancialInsights);

/**
 * @route   GET /api/reports/export
 * @desc    Export report data in various formats
 * @access  Private
 * @params  reportType, format, startDate, endDate
 */
router.get('/export', reportController.exportReport);

/**
 * @route   GET /api/reports/spending-analysis
 * @desc    Generate category breakdown for spending analysis (for dashboard)
 * @access  Private
 * @params  startDate, endDate, groupBy
 */
router.get('/spending-analysis', reportController.getSpendingAnalysis);

/**
 * @route   GET /api/reports/dashboard-summary
 * @desc    Generate dashboard summary in frontend expected format
 * @access  Private
 * @params  period (monthly, quarterly, yearly)
 */
router.get('/dashboard-summary', reportController.getDashboardSummaryV2);

/**
 * @route   POST /api/reports/generate
 * @desc    Generate a report based on type and parameters
 * @access  Private
 */
router.post('/generate', reportController.generateReport);

/**
 * @route   GET /api/reports/recent
 * @desc    Get recent reports for the authenticated user
 * @access  Private
 * @params  limit (optional)
 */
router.get('/recent', reportController.getRecentReports);

/**
 * @route   GET /api/reports/:id
 * @desc    Get a single report by its UUID
 * @access  Private
 */
router.get('/:id', reportController.getReportById);

/**
 * @route   GET /api/reports/:id/export/:format
 * @desc    Export a report by its UUID in the specified format
 * @access  Private
 */
router.get('/:id/export/:format', reportController.exportReportById);

module.exports = router;
