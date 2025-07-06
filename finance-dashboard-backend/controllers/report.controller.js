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
    logger.info(`Generating spending report for user ${req.user.id}`);

    const { 
      startDate, 
      endDate, 
      categoryId, 
      timeGroupBy = 'month',
      limit = 10 
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
      groupBy: timeGroupBy
    };

    const report = await ReportService.generateSpendingReport(userId, options);

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
      timeGroupBy = 'month' 
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
      groupBy: timeGroupBy
    };

    const report = await ReportService.generateIncomeReport(userId, options);

    logger.info(`Income report generated successfully for user ${userId}`);
    
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
      budgetId 
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
      budgetId
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
    const startDate = new Date();
    
    switch (period) {
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
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

    const dashboardSummary = {
      period,
      dateRange: { startDate, endDate },
      spending: {
        totalAmount: spendingReport.summary?.totalSpending || 0,
        topCategories: spendingReport.categoryAnalysis?.slice(0, 3) || [],
        trend: spendingReport.trends?.length > 0 ? spendingReport.trends[spendingReport.trends.length - 1] : null
      },
      income: {
        totalAmount: incomeReport.summary?.totalIncome || 0,
        growthRate: incomeReport.analysis?.growthRate || 0,
        diversificationScore: incomeReport.analysis?.diversificationScore || 0
      },
      cashFlow: {
        netCashFlow: cashFlowReport.summary?.averageNetCashFlow || 0,
        savingsRate: cashFlowReport.summary?.averageSavingsRate || 0,
        trend: cashFlowReport.patterns?.trend || 'stable'
      },
      budget: {
        overallPerformance: budgetReport.summary?.overallPerformance || 0,
        categoriesOverBudget: budgetReport.summary?.categoriesOverBudget || 0,
        totalVariance: budgetReport.summary?.totalVariance || 0
      },
      goals: {
        totalGoals: goalReport.summary?.totalGoals || 0,
        onTrackGoals: goalReport.summary?.onTrackGoals || 0,
        averageProgress: goalReport.summary?.averageProgress || 0
      },
      netWorth: {
        current: netWorthReport.current || 0,
        change: netWorthReport.trends?.length > 1 ?
          netWorthReport.current - netWorthReport.trends[netWorthReport.trends.length - 2].netWorth : 0,
        projectedGrowth: netWorthReport.projections?.length > 0 ?
          netWorthReport.projections[netWorthReport.projections.length - 1].projected - netWorthReport.current : 0
      }
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
    logger.info(`Generating spending analysis for user ${req.user.id}`);
    const { startDate, endDate, groupBy = 'category' } = req.query;
    const userId = req.user.id;
    // Use existing spending report logic
    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      groupBy
    };
    const report = await ReportService.generateSpendingReport(userId, options);
    // Map to frontend expected structure
    const categoryBreakdown = (report.categoryAnalysis || []).map(cat => ({
      category: {
        id: cat.categoryId?.toString() || '',
        name: cat.categoryName || '',
        color: cat.color || '#cccccc'
      },
      amount: cat.totalSpent || 0,
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
    logger.info(`Generating dashboard summary (frontend format) for user ${req.user.id}`);
    const { period = 'monthly' } = req.query;
    // Map period to backend period
    let backendPeriod = 'month';
    if (period === 'quarterly') backendPeriod = 'quarter';
    else if (period === 'yearly') backendPeriod = 'year';

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    switch (backendPeriod) {
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }
    const userId = req.user.id;
    const options = { startDate, endDate };
    // Generate all reports in parallel for dashboard
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
    // Compose backend summary
    const dashboardSummary = {
      period: backendPeriod,
      dateRange: { startDate, endDate },
      spending: {
        totalAmount: spendingReport.summary?.totalSpending || 0,
        topCategories: spendingReport.categoryAnalysis?.slice(0, 3) || [],
        trend: spendingReport.trends?.length > 0 ? spendingReport.trends[spendingReport.trends.length - 1] : null
      },
      income: {
        totalAmount: incomeReport.summary?.totalIncome || 0,
        growthRate: incomeReport.analysis?.growthRate || 0,
        diversificationScore: incomeReport.analysis?.diversificationScore || 0
      },
      cashFlow: {
        netCashFlow: cashFlowReport.summary?.averageNetCashFlow || 0,
        savingsRate: cashFlowReport.summary?.averageSavingsRate || 0,
        trend: cashFlowReport.patterns?.trend || 'stable'
      },
      budget: {
        overallPerformance: budgetReport.summary?.overallPerformance || 0,
        categoriesOverBudget: budgetReport.summary?.categoriesOverBudget || 0,
        totalVariance: budgetReport.summary?.totalVariance || 0
      },
      goals: {
        totalGoals: goalReport.summary?.totalGoals || 0,
        onTrackGoals: goalReport.summary?.onTrackGoals || 0,
        averageProgress: goalReport.summary?.averageProgress || 0
      },
      netWorth: {
        current: netWorthReport.current || 0,
        change: netWorthReport.trends?.length > 1 ? 
          netWorthReport.current - netWorthReport.trends[netWorthReport.trends.length - 2].netWorth : 0,
        projectedGrowth: netWorthReport.projections?.length > 0 ? 
          netWorthReport.projections[netWorthReport.projections.length - 1].projected - netWorthReport.current : 0
      }
    };
    // Map backend keys to frontend expected keys
    const result = {
      monthlyIncome: dashboardSummary.income?.totalAmount || 0,
      monthlyExpenses: dashboardSummary.spending?.totalAmount || 0,
      netWorth: dashboardSummary.netWorth?.current || 0,
      savingsRate: dashboardSummary.cashFlow?.savingsRate || 0,
      budgetUtilization: dashboardSummary.budget?.overallPerformance || 0,
      goalProgress: dashboardSummary.goals?.averageProgress || 0,
      topExpenseCategories: dashboardSummary.spending?.topCategories || [],
      recentTrends: dashboardSummary.cashFlow?.trend ? [dashboardSummary.cashFlow.trend] : []
    };
    return ApiResponse.success(res, result, 'Dashboard summary (frontend) generated');
  });
}

module.exports = ReportController;