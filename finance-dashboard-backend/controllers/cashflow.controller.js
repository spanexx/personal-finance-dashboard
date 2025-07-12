// Controller for cashflow chart API
const cashflowService = require('../services/cashflow.service');
const ApiResponse = require('../utils/apiResponse');

/**
 * Get cashflow chart data for the authenticated user
 */
async function getCashflowChart(req, res) {
  try {
    const userId = req.user.id;
    const cashflow = await cashflowService.getCashflowChartData(userId);
    return ApiResponse.success(res, { cashflow }, 'Cashflow chart data fetched');
  } catch (err) {
    return ApiResponse.serverError(res, 'Failed to fetch cashflow chart data', err);
  }
}

module.exports = { getCashflowChart };
