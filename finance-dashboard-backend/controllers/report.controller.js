const ReportService = require('../services/report.service');
const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const { 
  ErrorHandler, 
  ValidationError, 
  AuthorizationError, 
  NotFoundError,
  DatabaseError 
} = require('../utils/errorHandler');
const { v4: uuidv4 } = require('uuid');
const { Report } = require('../models');
const { generateReportPDF } = require('../utils/pdfExport');

/**
 * Reports and Analytics Controller
 * Provides comprehensive financial reporting endpoints for the Personal Finance Dashboard
 */
class ReportController {
  /**
   * Generate spending analysis report
   * @route GET /api/reports/spending
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getSpendingReport = ErrorHandler.asyncHandler(async (req, res) => {
    logger.info(`[report Req Body]:  ${JSON.stringify(req.body)}`);
    logger.info(`Generating spending report for user ${req.user.id}`);

    const { 
      startDate, 
      endDate, 
      categoryId, 
      timeGroupBy = 'month',
      limit = 10,
      includeCharts = 'true',
      includeTransactionDetails = 'false'
    } = req.query;
    
    const userId = req.user.id;

    // Validate date parameters
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ValidationError('Invalid startDate format', [
        { field: 'startDate', message: 'Must be a valid date' }
      ]);
    }

    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ValidationError('Invalid endDate format', [
        { field: 'endDate', message: 'Must be a valid date' }
      ]);
    }

    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      categories: categoryId ? [categoryId] : [],
      groupBy: timeGroupBy,
      includeCharts: includeCharts === 'true' || includeCharts === true,
      includeTransactionDetails: includeTransactionDetails === 'true' || includeTransactionDetails === true
    };

    logger.info(`[REPORT] Incoming request data:`, {
      userId,
      query: req.query,
      options
    });

    const report = await ReportService.generateSpendingReport(userId, options);

    logger.info(`[REPORT] Outgoing response data:`, report);
    logger.info(`Spending report generated successfully for user ${userId}`);
    
    return ApiResponse.success(res, report, 'Spending report generated successfully');
  });
  /**
   * Generate income analysis report
   * @route GET /api/reports/income
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getIncomeReport = ErrorHandler.asyncHandler(async (req, res) => {
    logger.info(`Generating income report for user ${req.user.id}`);

    const { 
      startDate, 
      endDate, 
      timeGroupBy = 'month',
      includeCharts = 'true',
      includeTransactionDetails = 'false'
    } = req.query;
    
    const userId = req.user.id;

    // Validate date parameters
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ValidationError('Invalid startDate format', [
        { field: 'startDate', message: 'Must be a valid date' }
      ]);
    }

    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ValidationError('Invalid endDate format', [
        { field: 'endDate', message: 'Must be a valid date' }
      ]);
    }

    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      groupBy: timeGroupBy,
      includeCharts: includeCharts === 'true' || includeCharts === true,
      includeTransactionDetails: includeTransactionDetails === 'true' || includeTransactionDetails === true
    };

    const report = await ReportService.generateIncomeReport(userId, options);

    logger.info(`Income report generated successfully for user ${userId}`);
    
    console.log('✅ [BACKEND-INCOME] Raw income report from service:', {
      reportType: typeof report,
      keys: report ? Object.keys(report) : 'null/undefined',
      summaryKeys: report?.summary ? Object.keys(report.summary) : 'no summary',
      totalIncome: report?.summary?.totalIncome,
      sourceAnalysisLength: report?.sourceAnalysis?.length
    });
    
    console.log('📊 [BACKEND-INCOME] Sending income report to frontend:', {
      totalIncome: report?.summary?.totalIncome,
      sourceCount: report?.summary?.sourceCount,
      hasSourceAnalysis: !!report?.sourceAnalysis,
      hasPeriod: !!report?.period
    });
    
    return ApiResponse.success(res, report, 'Income report generated successfully');
  });
  /**
   * Generate cash flow analysis report
   * @route GET /api/reports/cashflow
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getCashFlowReport = ErrorHandler.asyncHandler(async (req, res) => {
    logger.info(`Generating cash flow report for user ${req.user.id}`);

    const { 
      startDate, 
      endDate, 
      projectionMonths = 6 
    } = req.query;
    
    const userId = req.user.id;

    // Validate date parameters
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ValidationError('Invalid startDate format', [
        { field: 'startDate', message: 'Must be a valid date' }
      ]);
    }

    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ValidationError('Invalid endDate format', [
        { field: 'endDate', message: 'Must be a valid date' }
      ]);
    }

    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      projectionMonths: parseInt(projectionMonths)
    };

    const report = await ReportService.generateCashFlowReport(userId, options);

    logger.info(`Cash flow report generated successfully for user ${userId}`);
    
    return ApiResponse.success(res, report, 'Cash flow report generated successfully');
  });
  /**
   * Generate budget performance report
   * @route GET /api/reports/budget-performance
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getBudgetPerformanceReport = ErrorHandler.asyncHandler(async (req, res) => {
    logger.info(`Generating budget performance report for user ${req.user.id}`);

    const { 
      startDate, 
      endDate, 
      budgetId,
      includeCharts = 'true',
      includeTransactionDetails = 'false',
      groupBy = 'month'
    } = req.query;
    
    const userId = req.user.id;

    // Validate date parameters
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ValidationError('Invalid startDate format', [
        { field: 'startDate', message: 'Must be a valid date' }
      ]);
    }

    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ValidationError('Invalid endDate format', [
        { field: 'endDate', message: 'Must be a valid date' }
      ]);
    }

    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      budgetId,
      groupBy,
      includeCharts: includeCharts === 'true' || includeCharts === true,
      includeTransactionDetails: includeTransactionDetails === 'true' || includeTransactionDetails === true
    };

    const report = await ReportService.generateBudgetPerformanceReport(userId, options);

    logger.info(`Budget performance report generated successfully for user ${userId}`);
    
    return ApiResponse.success(res, report, 'Budget performance report generated successfully');
  });
  /**
   * Generate goal progress report
   * @route GET /api/reports/goal-progress
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getGoalProgressReport = ErrorHandler.asyncHandler(async (req, res) => {
    logger.info(`Generating goal progress report for user ${req.user.id}`);

    const { goalId } = req.query;
    const userId = req.user.id;

    const options = { goalId };
    const report = await ReportService.generateGoalProgressReport(userId, options);

    logger.info(`Goal progress report generated successfully for user ${userId}`);
    
    return ApiResponse.success(res, report, 'Goal progress report generated successfully');
  });
  /**
   * Calculate net worth and trends
   * @route GET /api/reports/net-worth
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getNetWorthReport = ErrorHandler.asyncHandler(async (req, res) => {
    logger.info(`Generating net worth report for user ${req.user.id}`);

    const { 
      startDate, 
      endDate, 
      projectionMonths = 12 
    } = req.query;
    
    const userId = req.user.id;

    // Validate date parameters
    if (startDate && isNaN(Date.parse(startDate))) {
      throw new ValidationError('Invalid startDate format', [
        { field: 'startDate', message: 'Must be a valid date' }
      ]);
    }

    if (endDate && isNaN(Date.parse(endDate))) {
      throw new ValidationError('Invalid endDate format', [
        { field: 'endDate', message: 'Must be a valid date' }
      ]);
    }

    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      projectionMonths: parseInt(projectionMonths)
    };

    const report = await ReportService.calculateNetWorth(userId, options);

    logger.info(`Net worth report generated successfully for user ${userId}`);
    
    return ApiResponse.success(res, report, 'Net worth report generated successfully');
  });  /**
   * Generate comprehensive financial dashboard summary
   * @route GET /api/reports/dashboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getDashboardSummary = ErrorHandler.asyncHandler(async (req, res) => {
    logger.info(`Generating dashboard summary for user ${req.user.id}`);

    const { 
      period = 'month' // month, quarter, year
    } = req.query;
    
    const userId = req.user.id;

    // Calculate date range based on period
    const endDate = new Date();
    let startDate = new Date();
    switch (period) {
      case 'week': {
        // Set to start of current week (Sunday)
        const day = startDate.getDay();
        startDate.setDate(startDate.getDate() - day);
        break;
      }
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate = new Date('1970-01-01T00:00:00Z');
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }// Generate all reports in parallel for dashboard
    const options = { startDate, endDate };
    
    const [
      spendingReport,
      incomeReport,
      cashFlowReport,
      budgetReport,
      goalReport,
      netWorthReport
    ] = await Promise.all([
      ReportService.generateSpendingReport(userId, { ...options, limit: 5 }),
      ReportService.generateIncomeReport(userId, options),
      ReportService.generateCashFlowReport(userId, { ...options, projectionMonths: 3 }),
      ReportService.generateBudgetPerformanceReport(userId, options),
      ReportService.generateGoalProgressReport(userId, {}),
      ReportService.calculateNetWorth(userId, { ...options, projectionMonths: 6 })
    ]);

    // Build dashboard summary with only period-aware fields
    const totalIncome = incomeReport.summary?.totalIncome || 0;
    const totalExpenses = spendingReport.summary?.totalExpenses || 0;
    // Calculate savings rate properly - allowing negative values
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    
    const dashboardSummary = {
      period,
      dateRange: { startDate, endDate },
      totalIncome: totalIncome,
      totalExpenses: totalExpenses,
      netWorth: netWorthReport.current || 0,
      savingsRate: parseFloat(savingsRate.toFixed(2)), // Allow negative savings rate
      budgetUtilization: budgetReport.summary?.overallPerformance || 0,
      goalProgress: goalReport.summary?.averageProgress || 0,
      topExpenseCategories: spendingReport.categoryAnalysis?.slice(0, 3) || []
    };

    logger.info(`Dashboard summary generated successfully for user ${userId}`);
    
    return ApiResponse.success(res, dashboardSummary, 'Dashboard summary generated successfully');
  });
  /**
   * Generate financial insights and recommendations
   * @route GET /api/reports/insights
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getFinancialInsights = ErrorHandler.asyncHandler(async (req, res) => {
    logger.info(`Generating financial insights for user ${req.user.id}`);

    const userId = req.user.id;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6); // Last 6 months

    const options = { startDate, endDate };

    // Get comprehensive data for insights
    const [
      spendingReport,
      incomeReport,
      cashFlowReport,
      budgetReport,
      goalReport
    ] = await Promise.all([
      ReportService.generateSpendingReport(userId, options),
      ReportService.generateIncomeReport(userId, options),
      ReportService.generateCashFlowReport(userId, options),
      ReportService.generateBudgetPerformanceReport(userId, options),
      ReportService.generateGoalProgressReport(userId, {})
    ]);

      const insights = {
        spending: [],
        income: [],
        savings: [],
        budget: [],
        goals: []
      };      // Spending insights
      if (spendingReport.trends?.length >= 2) {
        const latestTrend = spendingReport.trends[spendingReport.trends.length - 1];
        const previousTrend = spendingReport.trends[spendingReport.trends.length - 2];
        const changePercent = ((latestTrend.amount - previousTrend.amount) / previousTrend.amount) * 100;

        if (changePercent > 20) {
          insights.spending.push({
            type: 'warning',
            title: 'Spending Increase Alert',
            message: `Your spending has increased by ${changePercent.toFixed(1)}% compared to last period.`,
            action: 'Review your recent transactions and identify unnecessary expenses.'
          });
        } else if (changePercent < -10) {
          insights.spending.push({
            type: 'positive',
            title: 'Great Spending Control',
            message: `You've reduced your spending by ${Math.abs(changePercent).toFixed(1)}% this period.`,
            action: 'Keep up the good work!'
          });
        }
      }

      // Top spending category insight
      if (spendingReport.categoryAnalysis?.length > 0) {
        const topCategory = spendingReport.categoryAnalysis[0];
        const spendingPercent = (topCategory.amount / spendingReport.summary?.totalSpent) * 100;
        
        if (spendingPercent > 40) {
          insights.spending.push({
            type: 'info',
            title: 'Category Concentration',
            message: `${spendingPercent.toFixed(1)}% of your spending is in ${topCategory.category}.`,
            action: 'Consider if this allocation aligns with your financial goals.'
          });
        }
      }

      // Income insights
      if (incomeReport.analysis?.growthRate > 10) {
        insights.income.push({
          type: 'positive',
          title: 'Income Growth',
          message: `Your income has grown by ${incomeReport.analysis.growthRate.toFixed(1)}% over the period.`,
          action: 'Consider increasing your savings rate to match your income growth.'
        });
      }

      if (incomeReport.analysis?.diversificationScore < 0.3) {
        insights.income.push({
          type: 'warning',
          title: 'Income Concentration Risk',
          message: 'Your income is heavily concentrated in few sources.',
          action: 'Consider diversifying your income streams for better financial security.'
        });
      }

      // Savings insights
      if (cashFlowReport.summary?.averageSavingsRate < 10) {
        insights.savings.push({
          type: 'warning',
          title: 'Low Savings Rate',
          message: `Your average savings rate is ${cashFlowReport.summary.averageSavingsRate.toFixed(1)}%.`,
          action: 'Financial experts recommend saving at least 20% of your income.'
        });
      } else if (cashFlowReport.summary?.averageSavingsRate >= 20) {
        insights.savings.push({
          type: 'positive',
          title: 'Excellent Savings Rate',
          message: `You're saving ${cashFlowReport.summary.averageSavingsRate.toFixed(1)}% of your income.`,
          action: 'Great job! Consider investing your savings for long-term growth.'
        });
      }

      // Budget insights
      if (budgetReport.summary?.categoriesOverBudget > 0) {
        insights.budget.push({
          type: 'warning',
          title: 'Budget Overruns',
          message: `${budgetReport.summary.categoriesOverBudget} categories are over budget.`,
          action: 'Review and adjust your budget or spending in these categories.'
        });
      }

      if (budgetReport.summary?.overallPerformance > 85) {
        insights.budget.push({
          type: 'positive',
          title: 'Budget Discipline',
          message: `You're maintaining ${budgetReport.summary.overallPerformance.toFixed(1)}% budget adherence.`,
          action: 'Excellent budget management!'
        });
      }

      // Goal insights
      const urgentGoals = goalReport.goals?.filter(goal => 
        goal.daysRemaining && goal.daysRemaining < 90 && goal.progress < 75
      ) || [];

      if (urgentGoals.length > 0) {
        insights.goals.push({
          type: 'warning',
          title: 'Goals at Risk',
          message: `${urgentGoals.length} goals may not be achieved on time.`,
          action: 'Consider increasing contributions or adjusting timelines.'
        });
      }

      const achievableGoals = goalReport.goals?.filter(goal => 
        goal.progress >= 90 && goal.daysRemaining > 0
      ) || [];

      if (achievableGoals.length > 0) {
        insights.goals.push({
          type: 'positive',
          title: 'Goals Within Reach',
          message: `${achievableGoals.length} goals are close to completion.`,
          action: 'You\'re almost there! Keep up the momentum.'
        });
      }

      const insightsData = {
        insights,
        summary: {
          totalInsights: Object.values(insights).flat().length,
          positiveInsights: Object.values(insights).flat().filter(i => i.type === 'positive').length,
          warningInsights: Object.values(insights).flat().filter(i => i.type === 'warning').length,
          infoInsights: Object.values(insights).flat().filter(i => i.type === 'info').length
        }
      };

      logger.info(`Financial insights generated successfully for user ${userId}`);
      
      return ApiResponse.success(res, insightsData, 'Financial insights generated successfully');
  });
  /**
   * Export report data in various formats
   * @route GET /api/reports/export
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static exportReport = ErrorHandler.asyncHandler(async (req, res) => {
    logger.info(`Exporting report for user ${req.user.id}`);

    const { 
      reportType, 
      format = 'json', 
      startDate, 
      endDate 
    } = req.query;
    
    const userId = req.user.id;

    if (!reportType) {
      throw new ValidationError('Report type is required', [
        { field: 'reportType', message: 'Must specify a valid report type' }
      ]);
    }

    const validReportTypes = ['spending', 'income', 'cashflow', 'budget', 'goals', 'networth'];
    if (!validReportTypes.includes(reportType)) {
      throw new ValidationError('Invalid report type', [
        { field: 'reportType', message: `Must be one of: ${validReportTypes.join(', ')}` }
      ]);
    }

    // Generate the requested report
    let reportData;
    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    };

    switch (reportType) {
      case 'spending':
        reportData = await ReportService.generateSpendingReport(userId, options);
        break;
      case 'income':
        reportData = await ReportService.generateIncomeReport(userId, options);
        break;
      case 'cashflow':
        reportData = await ReportService.generateCashFlowReport(userId, options);
        break;
      case 'budget':
        reportData = await ReportService.generateBudgetPerformanceReport(userId, options);
        break;
      case 'goals':
        reportData = await ReportService.generateGoalProgressReport(userId, {});
        break;
      case 'networth':
        reportData = await ReportService.calculateNetWorth(userId, options);
        break;
    }

    // Handle different export formats
    if (format === 'csv') {
      // For CSV format, we'll flatten the data structure
      const flattenedData = ReportController.flattenReportData(reportData, reportType);
      const csv = ReportController.convertToCSV(flattenedData);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report-${new Date().toISOString().split('T')[0]}.csv"`);
      
      logger.info(`CSV report exported successfully for user ${userId}, type: ${reportType}`);
      return res.send(csv);
    } else {
      // JSON format (default)
      const exportData = {
        success: true,
        exportDate: new Date().toISOString(),
        reportType,
        dateRange: { startDate: options.startDate, endDate: options.endDate },
        data: reportData
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report-${new Date().toISOString().split('T')[0]}.json"`);
      
      logger.info(`JSON report exported successfully for user ${userId}, type: ${reportType}`);
      return res.json(exportData);
    }
  });
  /**
   * Helper method to flatten report data for CSV export
   * @private
   */
  static flattenReportData(data, reportType) {
    switch (reportType) {
      case 'spending':
        return data.categoryAnalysis?.map(item => ({
          category: item.category,
          amount: item.amount,
          percentage: item.percentage,
          transactionCount: item.transactionCount
        })) || [];
      case 'income':
        return data.sourceAnalysis?.map(item => ({
          source: item.source,
          amount: item.amount,
          percentage: item.percentage,
          transactionCount: item.transactionCount
        })) || [];
      case 'cashflow':
        return data.monthlyCashFlow?.map(item => ({
          month: item.month,
          income: item.income,
          expenses: item.expenses,
          netCashFlow: item.netCashFlow,
          savingsRate: item.savingsRate
        })) || [];
      default:
        return [data];
    }
  }

  /**
   * Helper method to convert data to CSV format
   * @private
   */
  static convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    
    return [csvHeaders, ...csvRows].join('\n');
  }
  /**
   * Generate category breakdown for spending analysis (for dashboard)
   * @route GET /api/reports/spending-analysis
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getSpendingAnalysis = ErrorHandler.asyncHandler(async (req, res) => {
    console.log('🔍 [BACKEND-SPENDING] Spending analysis request:', {
      userId: req.user.id,
      queryParams: req.query,
      method: req.method,
      url: req.url
    });
    
    logger.info(`Generating spending analysis for user ${req.user.id}`);
    const { startDate, endDate, groupBy = 'category' } = req.query;
    const userId = req.user.id;
    // Use existing spending report logic
    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      groupBy
    };
    
    console.log('📡 [BACKEND-SPENDING] Calling ReportService.generateSpendingReport with options:', options);
    const report = await ReportService.generateSpendingReport(userId, options);
    
    console.log('✅ [BACKEND-SPENDING] Raw spending report from service:', {
      reportType: typeof report,
      keys: report ? Object.keys(report) : 'null/undefined',
      categoryAnalysisLength: report?.categoryAnalysis?.length,
      summaryKeys: report?.summary ? Object.keys(report.summary) : 'no summary',
      totalSpent: report?.summary?.totalSpent
    });
    
    // Map to frontend expected structure
    const categoryBreakdown = (report.categoryAnalysis || []).map(cat => ({
      category: {
        id: cat._id?.toString() || '',
        name: cat.categoryName || 'Unnamed Category',
        color: cat.categoryColor || '#cccccc'
      },
      amount: cat.totalAmount || 0,
      percentage: cat.percentage || 0
    }));
    return ApiResponse.success(res, { categoryBreakdown }, 'Spending analysis breakdown generated');
  });

  /**
   * Generate dashboard summary in frontend expected format
   * @route GET /api/reports/dashboard-summary
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getDashboardSummaryV2 = ErrorHandler.asyncHandler(async (req, res) => {
    const { period = 'monthly' } = req.query;
    const userId = req.user.id;

    console.log('\n=== DASHBOARD SUMMARY REQUEST ===');
    console.log(`Period Selected: ${period}`);

    // Map frontend period to backend period
    let backendPeriod;
    switch (period) {
      case 'week':
      case 'weekly':
        backendPeriod = 'week';
        break;
      case 'month':
      case 'monthly':
        backendPeriod = 'month';
        break;
      case 'quarter':
      case 'quarterly':
        backendPeriod = 'quarter';
        break;
      case 'year':
      case 'yearly':
        backendPeriod = 'year';
        break;
      case 'all':
      case 'allTime':
        backendPeriod = 'all';
        break;
      default:
        backendPeriod = 'month';
    }

    console.log('\n=== DATE RANGE ===');
    console.log('Period:', backendPeriod);

    // Use ReportService's date calculation method
    const dateRange = ReportService._calculateDateRange(backendPeriod);
    const { startDate, endDate } = dateRange;
    
    console.log('Start Date:', startDate.toISOString());
    console.log('End Date:', endDate.toISOString());

    const options = { 
      startDate, 
      endDate,
      period: backendPeriod
    };

    // Generate all reports in parallel for dashboard
    const [
      spendingReport,
      incomeReport,
      cashFlowReport,
      budgetReport,
      goalReport,
      netWorthReport,
      transactionTrends
    ] = await Promise.all([
      ReportService.generateSpendingReport(userId, { ...options, limit: 5 }),
      ReportService.generateIncomeReport(userId, options),
      ReportService.generateCashFlowReport(userId, options),
      ReportService.generateBudgetPerformanceReport(userId, options),
      ReportService.generateGoalProgressReport(userId, {}),
      ReportService.calculateNetWorth(userId, { ...options, projectionMonths: 6 }),
      ReportService.getTransactionTrendsForPeriod(userId, options)
    ]);

    console.log('\n=== RAW REPORT DATA ===');
    console.log('Spending Report Summary:', {
        totalExpenses: spendingReport.summary?.totalExpenses,
        categoriesCount: spendingReport.categoryAnalysis?.length
    });
    console.log('Income Report Summary:', {
        totalIncome: incomeReport.summary?.totalIncome,
        sourceCount: incomeReport.sourceAnalysis?.length
    });
    console.log('Cash Flow Summary:', {
        netCashFlow: cashFlowReport.summary?.netCashFlow,
        savingsRate: cashFlowReport.summary?.savingsRate
    });
    console.log('Transaction Trends:', {
        trendsDataAvailable: Array.isArray(transactionTrends) && transactionTrends !== 'insufficient-data',
        trendsCount: Array.isArray(transactionTrends) ? transactionTrends.length : 0
    });

    // Calculate savings rate properly - allowing negative values
    const totalIncome = incomeReport.summary?.totalIncome || 0;
    const totalExpenses = spendingReport.summary?.totalExpenses || 0;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    // Build final response with correct field names and period-specific data
    const result = {
      monthlyIncome: totalIncome,
      monthlyExpenses: totalExpenses,
      netWorth: netWorthReport.current?.netWorth || 0,
      savingsRate: parseFloat(savingsRate.toFixed(2)), // Allow negative savings rate
      budgetUtilization: budgetReport.summary?.overallPerformancePercentage || 0,
      goalProgress: goalReport.summary?.averageProgress || 0,
      topExpenseCategories: spendingReport.categoryAnalysis?.slice(0, 3) || [],
      recentTrends: transactionTrends
    };

    console.log('\n=== FINAL API RESPONSE ===');
    console.log(JSON.stringify({
      period: backendPeriod,
      income: result.monthlyIncome,
      expenses: result.monthlyExpenses,
      netWorth: result.netWorth,
      savingsRate: result.savingsRate
    }, null, 2));
    console.log('\n===============================\n');

    return ApiResponse.success(res, result, 'Dashboard summary (frontend) generated');
  });
  /**
   * Generate a new report (POST /api/reports/generate)
   * @route POST /api/reports/generate
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static generateReport = ErrorHandler.asyncHandler(async (req, res) => {
    logger.info(`[report Req Body]:  ${JSON.stringify(req.body)}`);
    logger.info(`Generating report (POST /generate) for user ${req.user.id}`);

    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid request data', errors.array());
    }

    const userId = req.user.id;
    const {
      name,
      type,
      period,
      startDate,
      endDate,
      format = 'json',
      options = {}
    } = req.body;

    // Validate required fields
    if (!name || !type || !period || !startDate || !endDate) {
      throw new ValidationError('Missing required fields', [
        { field: 'name', message: 'Name is required' },
        { field: 'type', message: 'Type is required' },
        { field: 'period', message: 'Period is required' },
        { field: 'startDate', message: 'Start date is required' },
        { field: 'endDate', message: 'End date is required' }
      ]);
    }

    // Prepare options for report generation
    logger.info('[REPORT] Received options from frontend:', JSON.stringify(options));
    const reportOptions = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      ...options
    };
    logger.info('[REPORT] Final reportOptions used for service:', JSON.stringify(reportOptions));

    let reportData;
    switch (type) {
      case 'income':
        reportData = await ReportService.generateIncomeReport(userId, reportOptions);
        break;
      case 'expense':
        reportData = await ReportService.generateSpendingReport(userId, reportOptions);
        break;
      case 'budget':
        reportData = await ReportService.generateBudgetPerformanceReport(userId, reportOptions);
        break;
      case 'goal':
        reportData = await ReportService.generateGoalProgressReport(userId, reportOptions);
        break;
      case 'net_worth':
        reportData = await ReportService.calculateNetWorth(userId, reportOptions);
        break;
      case 'cash_flow':
        reportData = await ReportService.generateCashFlowReport(userId, reportOptions);
        break;
      case 'tax':
        // Implement tax report logic if available
        reportData = { message: 'Tax report not implemented yet.' };
        break;
      case 'investment':
        // Implement investment report logic if available
        reportData = { message: 'Investment report not implemented yet.' };
        break;
      default:
        throw new ValidationError('Invalid report type', [
          { field: 'type', message: 'Invalid report type' }
        ]);
    }

    // --- ENFORCE OPTIONS STRICTLY ON RESPONSE ---
    // Remove charts and transaction details if not requested, for all report types
    const { includeCharts = true, includeTransactionDetails = false } = options;
    if (reportData) {
      if (!includeCharts) {
        // Remove known chart-related fields
        delete reportData.timeBasedAnalysis;
        delete reportData.trends;
        delete reportData.topMerchants;
        delete reportData.growthAnalysis;
        delete reportData.recurringIncome;
        delete reportData.historicalTrends;
      }
      if (!includeTransactionDetails) {
        delete reportData.transactionDetails;
      }
    }

    // Compose FinancialReport structure for frontend
    const now = new Date();
    const financialReport = {
      id: uuidv4(), // Generate a unique ID for each report
      userId,
      name,
      type,
      period,
      startDate,
      endDate,
      status: 'completed',
      format,
      fileUrl: undefined, // If you implement file export
      data: reportData,
      metadata: {
        totalRecords: Array.isArray(reportData?.categoryAnalysis) ? reportData.categoryAnalysis.length : 0,
        generationTime: 0, // Optionally measure/report generation time
        fileSize: undefined,
        categories: options.categories || [],
        accounts: options.accounts || []
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    // Send notification to user via WebSocket
    const socketService = require('../services/socket.service');
    if (socketService && typeof socketService.emitToUser === 'function') {
      socketService.emitToUser(
        req.user.id,
        'report:generated',
        {
          message: `Your report '${name}' is ready.`,
          reportId: financialReport.id,
          timestamp: new Date().toISOString()
        }
      );
    }

    logger.info(`Report generated successfully for user ${userId}, type: ${type}, options: ${JSON.stringify(options)}`);
    logger.info(`Report response data: ${JSON.stringify(financialReport)}`);

    // --- PERSIST REPORT TO DB ---
    try {
      await Report.create({
        id: financialReport.id,
        userId: userId,
        name,
        type,
        period,
        startDate,
        endDate,
        status: 'completed',
        format,
        fileUrl: undefined,
        data: reportData,
        metadata: financialReport.metadata,
        createdAt: now,
        updatedAt: now
      });
      logger.info(`[REPORT] Report persisted to DB for user ${userId}, id: ${financialReport.id}`);
    } catch (err) {
      logger.error(`[REPORT] Failed to persist report to DB: ${err.message}`);
    }

    return ApiResponse.success(res, financialReport, 'Report generated successfully');
  });
  /**
   * Get recent reports for a user
   * @route GET /api/reports/recent
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getRecentReports = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 5;
    logger.info(`[REPORT] Fetching recent reports for user ${userId}`);
    const reports = await Report.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    logger.info(`[REPORT] Recent reports for user ${userId}: ${reports.length}`);
    return ApiResponse.success(res, reports, 'Recent reports fetched successfully');
  });
  /**
   * Get a single report by its UUID
   * @route GET /api/reports/:id
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getReportById = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const report = await Report.findOne({ id, userId });
    if (!report) {
      throw new NotFoundError(`Report not found with id: ${id}`);
    }
    return ApiResponse.success(res, report, 'Report fetched successfully');
  });
  /**
   * Export a report by its UUID in the specified format
   * @route GET /api/reports/:id/export/:format
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static exportReportById = ErrorHandler.asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { id, format } = req.params;
    const report = await Report.findOne({ id, userId });
    if (!report) {
      throw new NotFoundError(`Report not found with id: ${id}`);
    }
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${report.name || 'report'}-${id}.json"`);
      return res.json(report);
    } else if (format === 'pdf') {
      // PDF export
      const pdfBuffer = await generateReportPDF(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${report.name || 'report'}-${id}.pdf"`);
      return res.end(pdfBuffer);
    } else {
      res.status(501).json({ error: 'Export format not implemented yet.' });
    }
  });
}

module.exports = ReportController;