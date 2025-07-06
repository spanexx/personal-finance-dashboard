/**
 * Report Service Unit Tests
 * Comprehensive test suite for report.service.js
 */

const ReportService = require('../../services/report.service');
const Transaction = require('../../models/Transaction');
const Budget = require('../../models/Budget');
const Goal = require('../../models/Goal');
const Category = require('../../models/Category');
const mongoose = require('mongoose');

// Mock mongoose
jest.mock('mongoose', () => ({
  Types: {
    ObjectId: jest.fn().mockImplementation((id) => ({
      toString: () => id || 'mockObjectId',
      equals: jest.fn()
    }))
  }
}));

// Mock models
jest.mock('../../models/Transaction');
jest.mock('../../models/Budget');
jest.mock('../../models/Goal');
jest.mock('../../models/Category');

describe('ReportService', () => {
  let reportService;
  let mockUserId;
  let mockStartDate;
  let mockEndDate;

  beforeEach(() => {
    jest.clearAllMocks();
    
    reportService = new ReportService();
    mockUserId = 'user123';
    mockStartDate = new Date('2024-01-01');
    mockEndDate = new Date('2024-01-31');
    
    // Mock mongoose ObjectId
    mongoose.Types.ObjectId.mockImplementation((id) => ({
      toString: () => id || 'mockObjectId',
      equals: jest.fn()
    }));
  });

  describe('generateSpendingReport', () => {
    let mockCategoryAnalysis;
    let mockTimeBasedAnalysis;
    let mockTopMerchants;

    beforeEach(() => {
      mockCategoryAnalysis = [
        {
          _id: 'cat1',
          categoryName: 'Food & Dining',
          categoryIcon: 'restaurant',
          categoryColor: '#FF6B35',
          totalAmount: 1500,
          transactionCount: 25,
          averageAmount: 60,
          minAmount: 10,
          maxAmount: 200
        },
        {
          _id: 'cat2',
          categoryName: 'Transportation',
          categoryIcon: 'car',
          categoryColor: '#4ECDC4',
          totalAmount: 800,
          transactionCount: 15,
          averageAmount: 53.33,
          minAmount: 20,
          maxAmount: 100
        }
      ];

      mockTimeBasedAnalysis = [
        { period: '2024-01', totalAmount: 2300, transactionCount: 40 },
        { period: '2024-02', totalAmount: 2100, transactionCount: 35 }
      ];

      mockTopMerchants = [
        { _id: 'Starbucks', totalAmount: 300, transactionCount: 15 },
        { _id: 'Shell Gas Station', totalAmount: 250, transactionCount: 8 },
        { _id: 'McDonald\'s', totalAmount: 180, transactionCount: 12 }
      ];

      // Mock Transaction.aggregate for category analysis
      Transaction.aggregate
        .mockResolvedValueOnce(mockCategoryAnalysis) // First call for category analysis
        .mockResolvedValueOnce(mockTopMerchants);    // Second call for top merchants

      // Mock private methods
      jest.spyOn(reportService, '_getTimeBasedAnalysis').mockResolvedValue(mockTimeBasedAnalysis);
      jest.spyOn(reportService, '_calculateSpendingTrends').mockResolvedValue({
        trend: 'decreasing',
        changePercent: -8.7,
        analysis: 'Spending decreased by 8.7% compared to previous period'
      });
      jest.spyOn(reportService, '_calculateAverageDailySpending').mockResolvedValue(74.19);
    });

    it('should generate comprehensive spending report with default options', async () => {
      const result = await reportService.generateSpendingReport(mockUserId);

      expect(Transaction.aggregate).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('categoryAnalysis');
      expect(result).toHaveProperty('timeBasedAnalysis');
      expect(result).toHaveProperty('trends');
      expect(result).toHaveProperty('topMerchants');
      expect(result).toHaveProperty('period');

      expect(result.summary.totalSpending).toBe(2300);
      expect(result.summary.categoriesCount).toBe(2);
      expect(result.summary.transactionCount).toBe(40);
      expect(result.summary.averageDailySpending).toBe(74.19);
    });

    it('should filter spending report by categories', async () => {
      const options = {
        categories: ['cat1', 'cat2'],
        startDate: mockStartDate,
        endDate: mockEndDate
      };

      await reportService.generateSpendingReport(mockUserId, options);

      const expectedQuery = expect.objectContaining({
        userId: expect.any(Object),
        type: 'expense',
        date: { $gte: mockStartDate, $lte: mockEndDate },
        category: { $in: expect.any(Array) }
      });

      expect(Transaction.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          { $match: expectedQuery }
        ])
      );
    });

    it('should handle custom date range', async () => {
      const customStart = new Date('2024-02-01');
      const customEnd = new Date('2024-02-29');
      const options = {
        startDate: customStart,
        endDate: customEnd
      };

      const result = await reportService.generateSpendingReport(mockUserId, options);

      expect(result.period.startDate).toEqual(customStart);
      expect(result.period.endDate).toEqual(customEnd);
    });

    it('should handle different groupBy options', async () => {
      const options = { groupBy: 'week' };

      await reportService.generateSpendingReport(mockUserId, options);

      expect(reportService._getTimeBasedAnalysis).toHaveBeenCalledWith(
        expect.any(Object),
        'week'
      );
    });

    it('should handle empty transaction data', async () => {
      Transaction.aggregate
        .mockResolvedValueOnce([]) // Empty category analysis
        .mockResolvedValueOnce([]); // Empty top merchants

      const result = await reportService.generateSpendingReport(mockUserId);

      expect(result.summary.totalSpending).toBe(0);
      expect(result.summary.categoriesCount).toBe(0);
      expect(result.categoryAnalysis).toEqual([]);
      expect(result.topMerchants).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      Transaction.aggregate.mockRejectedValue(new Error('Database connection failed'));

      await expect(reportService.generateSpendingReport(mockUserId))
        .rejects.toThrow('Database connection failed');
    });

    it('should calculate correct summary with multiple categories', async () => {
      const result = await reportService.generateSpendingReport(mockUserId);

      expect(result.categoryAnalysis).toHaveLength(2);
      expect(result.categoryAnalysis[0].totalAmount).toBe(1500);
      expect(result.categoryAnalysis[1].totalAmount).toBe(800);
      expect(result.summary.totalSpending).toBe(2300);
    });
  });

  describe('generateIncomeReport', () => {
    let mockSourceAnalysis;

    beforeEach(() => {
      mockSourceAnalysis = [
        {
          _id: 'Salary - ABC Company',
          totalAmount: 5000,
          transactionCount: 2,
          averageAmount: 2500,
          frequency: [
            { date: new Date('2024-01-01'), amount: 2500 },
            { date: new Date('2024-01-15'), amount: 2500 }
          ]
        },
        {
          _id: 'Freelance Project',
          totalAmount: 1200,
          transactionCount: 3,
          averageAmount: 400,
          frequency: [
            { date: new Date('2024-01-05'), amount: 400 },
            { date: new Date('2024-01-12'), amount: 400 },
            { date: new Date('2024-01-20'), amount: 400 }
          ]
        }
      ];

      Transaction.aggregate.mockResolvedValue(mockSourceAnalysis);

      // Mock private methods
      jest.spyOn(reportService, '_calculateDiversificationScore').mockReturnValue(0.75);
      jest.spyOn(reportService, '_getTimeBasedAnalysis').mockResolvedValue([
        { period: '2024-01', totalAmount: 6200, transactionCount: 5 }
      ]);
      jest.spyOn(reportService, '_calculateIncomeGrowth').mockResolvedValue({
        growthRate: 5.2,
        trend: 'increasing',
        analysis: 'Income increased by 5.2% compared to previous period'
      });
      jest.spyOn(reportService, '_identifyRecurringIncome').mockResolvedValue([
        {
          source: 'Salary - ABC Company',
          frequency: 'bi-weekly',
          averageAmount: 2500,
          reliability: 100
        }
      ]);
      jest.spyOn(reportService, '_getMonthsDifference').mockReturnValue(1);
    });

    it('should generate comprehensive income report', async () => {
      const result = await reportService.generateIncomeReport(mockUserId);

      expect(Transaction.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            $match: expect.objectContaining({
              userId: expect.any(Object),
              type: 'income'
            })
          }
        ])
      );

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('sourceAnalysis');
      expect(result).toHaveProperty('timeBasedAnalysis');
      expect(result).toHaveProperty('growthAnalysis');
      expect(result).toHaveProperty('recurringIncome');

      expect(result.summary.totalIncome).toBe(6200);
      expect(result.summary.sourceCount).toBe(2);
      expect(result.summary.diversificationScore).toBe(0.75);
    });

    it('should calculate average monthly income correctly', async () => {
      const result = await reportService.generateIncomeReport(mockUserId);

      expect(result.summary.averageMonthlyIncome).toBe(6200); // 6200 / 1 month
    });

    it('should handle custom groupBy options', async () => {
      const options = { groupBy: 'week' };

      await reportService.generateIncomeReport(mockUserId, options);

      expect(reportService._getTimeBasedAnalysis).toHaveBeenCalledWith(
        expect.any(Object),
        'week'
      );
    });

    it('should handle empty income data', async () => {
      Transaction.aggregate.mockResolvedValue([]);

      const result = await reportService.generateIncomeReport(mockUserId);

      expect(result.summary.totalIncome).toBe(0);
      expect(result.summary.sourceCount).toBe(0);
    });

    it('should include frequency data for income sources', async () => {
      const result = await reportService.generateIncomeReport(mockUserId);

      expect(result.sourceAnalysis[0].frequency).toHaveLength(2);
      expect(result.sourceAnalysis[0].frequency[0]).toHaveProperty('date');
      expect(result.sourceAnalysis[0].frequency[0]).toHaveProperty('amount');
    });
  });

  describe('generateCashFlowReport', () => {
    let mockIncomeData;
    let mockExpenseData;

    beforeEach(() => {
      mockIncomeData = [
        { month: '2024-01', amount: 5000 },
        { month: '2024-02', amount: 5200 }
      ];

      mockExpenseData = [
        { month: '2024-01', amount: 3500 },
        { month: '2024-02', amount: 3200 }
      ];

      // Mock private methods
      jest.spyOn(reportService, '_getMonthlyData')
        .mockResolvedValueOnce(mockIncomeData)   // First call for income
        .mockResolvedValueOnce(mockExpenseData); // Second call for expenses

      jest.spyOn(reportService, '_calculateMonthlyCashFlow').mockReturnValue([
        { month: '2024-01', income: 5000, expenses: 3500, netFlow: 1500 },
        { month: '2024-02', income: 5200, expenses: 3200, netFlow: 2000 }
      ]);

      jest.spyOn(reportService, '_calculateSavingsRate').mockReturnValue({
        average: 32.14,
        best: { month: '2024-02', rate: 38.46 },
        worst: { month: '2024-01', rate: 30.0 }
      });

      jest.spyOn(reportService, '_generateCashFlowProjections').mockResolvedValue([
        { month: '2024-03', projectedIncome: 5200, projectedExpenses: 3300, projectedNetFlow: 1900 },
        { month: '2024-04', projectedIncome: 5200, projectedExpenses: 3400, projectedNetFlow: 1800 }
      ]);

      jest.spyOn(reportService, '_identifyCashFlowPatterns').mockReturnValue({
        trend: 'improving',
        volatility: 'low',
        seasonality: 'none'
      });

      jest.spyOn(reportService, '_calculateRunningBalance').mockReturnValue([
        { month: '2024-01', balance: 1500 },
        { month: '2024-02', balance: 3500 }
      ]);
    });

    it('should generate comprehensive cash flow report', async () => {
      const result = await reportService.generateCashFlowReport(mockUserId);

      expect(reportService._getMonthlyData).toHaveBeenCalledTimes(2);
      expect(reportService._getMonthlyData).toHaveBeenNthCalledWith(1, mockUserId, 'income', expect.any(Date), expect.any(Date));
      expect(reportService._getMonthlyData).toHaveBeenNthCalledWith(2, mockUserId, 'expense', expect.any(Date), expect.any(Date));

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('monthlyCashFlow');
      expect(result).toHaveProperty('savingsRate');
      expect(result).toHaveProperty('projections');
      expect(result).toHaveProperty('patterns');
      expect(result).toHaveProperty('runningBalance');

      expect(result.summary.totalIncome).toBe(10200);
      expect(result.summary.totalExpenses).toBe(6700);
      expect(result.summary.netCashFlow).toBe(3500);
    });

    it('should handle custom projection months', async () => {
      const options = { projectionMonths: 12 };

      await reportService.generateCashFlowReport(mockUserId, options);

      expect(reportService._generateCashFlowProjections).toHaveBeenCalledWith(
        mockUserId,
        12
      );
    });

    it('should calculate correct summary metrics', async () => {
      const result = await reportService.generateCashFlowReport(mockUserId);

      expect(result.summary.averageSavingsRate).toBe(32.14);
      expect(result.summary.bestMonth.rate).toBe(38.46);
      expect(result.summary.worstMonth.rate).toBe(30.0);
    });

    it('should handle periods with no income or expenses', async () => {
      jest.spyOn(reportService, '_getMonthlyData')
        .mockResolvedValueOnce([])   // No income
        .mockResolvedValueOnce([]);  // No expenses

      jest.spyOn(reportService, '_calculateMonthlyCashFlow').mockReturnValue([]);

      const result = await reportService.generateCashFlowReport(mockUserId);

      expect(result.summary.totalIncome).toBe(0);
      expect(result.summary.totalExpenses).toBe(0);
      expect(result.summary.netCashFlow).toBe(0);
    });
  });

  describe('generateBudgetPerformanceReport', () => {
    let mockBudgets;
    let mockActualSpending;

    beforeEach(() => {
      mockBudgets = [
        {
          _id: 'budget1',
          name: 'Food Budget',
          amount: 800,
          category: {
            _id: 'cat1',
            name: 'Food & Dining',
            icon: 'restaurant'
          }
        },
        {
          _id: 'budget2',
          name: 'Transport Budget',
          amount: 300,
          category: {
            _id: 'cat2',
            name: 'Transportation',
            icon: 'car'
          }
        }
      ];

      mockActualSpending = [
        [{ _id: null, totalSpent: 650, transactionCount: 25 }], // Food actual spending
        [{ _id: null, totalSpent: 320, transactionCount: 15 }]  // Transport actual spending
      ];

      Budget.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockBudgets)
      });

      Transaction.aggregate
        .mockResolvedValueOnce(mockActualSpending[0])
        .mockResolvedValueOnce(mockActualSpending[1]);

      // Mock private methods
      jest.spyOn(reportService, '_getBudgetStatus').mockImplementation((percentageUsed) => {
        if (percentageUsed <= 75) return 'on_track';
        if (percentageUsed <= 100) return 'warning';
        return 'over_budget';
      });

      jest.spyOn(reportService, '_calculateOverallBudgetPerformance').mockReturnValue({
        budgetsOnTrack: 1,
        budgetsOverBudget: 1,
        totalBudgeted: 1100,
        totalSpent: 970,
        overallVariance: -130,
        averageUtilization: 88.18
      });

      jest.spyOn(reportService, '_getBudgetHistoricalTrends').mockResolvedValue([
        { month: '2024-01', category: 'Food & Dining', budgeted: 800, spent: 750 },
        { month: '2024-01', category: 'Transportation', budgeted: 300, spent: 285 }
      ]);
    });

    it('should generate comprehensive budget performance report', async () => {
      const result = await reportService.generateBudgetPerformanceReport(mockUserId);

      expect(Budget.find).toHaveBeenCalledWith({
        userId: expect.any(Object)
      });
      expect(Transaction.aggregate).toHaveBeenCalledTimes(2);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('budgetPerformance');
      expect(result).toHaveProperty('historicalTrends');
      expect(result.budgetPerformance).toHaveLength(2);
    });

    it('should calculate budget performance metrics correctly', async () => {
      const result = await reportService.generateBudgetPerformanceReport(mockUserId);

      const foodBudget = result.budgetPerformance[0];
      expect(foodBudget.budgetAmount).toBe(800);
      expect(foodBudget.actualSpent).toBe(650);
      expect(foodBudget.variance).toBe(-150); // 650 - 800
      expect(foodBudget.percentageUsed).toBe(81.25); // (650 / 800) * 100
      expect(foodBudget.remainingAmount).toBe(150);
      expect(foodBudget.status).toBe('on_track');

      const transportBudget = result.budgetPerformance[1];
      expect(transportBudget.actualSpent).toBe(320);
      expect(transportBudget.variance).toBe(20); // 320 - 300
      expect(transportBudget.percentageUsed).toBe(106.67); // (320 / 300) * 100
      expect(transportBudget.remainingAmount).toBe(0);
      expect(transportBudget.status).toBe('over_budget');
    });

    it('should filter by specific budget IDs when provided', async () => {
      const options = { budgetIds: ['budget1'] };

      await reportService.generateBudgetPerformanceReport(mockUserId, options);

      expect(Budget.find).toHaveBeenCalledWith({
        userId: expect.any(Object),
        _id: { $in: expect.any(Array) }
      });
    });

    it('should handle budgets with no actual spending', async () => {
      Transaction.aggregate
        .mockResolvedValueOnce([])  // No spending for first budget
        .mockResolvedValueOnce([]); // No spending for second budget

      const result = await reportService.generateBudgetPerformanceReport(mockUserId);

      result.budgetPerformance.forEach(budget => {
        expect(budget.actualSpent).toBe(0);
        expect(budget.percentageUsed).toBe(0);
        expect(budget.variance).toBe(-budget.budgetAmount);
        expect(budget.transactionCount).toBe(0);
        expect(budget.remainingAmount).toBe(budget.budgetAmount);
      });
    });

    it('should calculate daily averages and projections', async () => {
      // Mock date calculation for 31 days in January
      const daysInPeriod = 31;
      jest.spyOn(Math, 'ceil').mockReturnValue(daysInPeriod);

      const result = await reportService.generateBudgetPerformanceReport(mockUserId);

      const foodBudget = result.budgetPerformance[0];
      expect(foodBudget.dailyAverage).toBe(650 / daysInPeriod);
      expect(foodBudget.projectedMonthlySpending).toBe((650 / daysInPeriod) * 30);
    });

    it('should include overall performance summary', async () => {
      const result = await reportService.generateBudgetPerformanceReport(mockUserId);

      expect(result.summary.budgetsOnTrack).toBe(1);
      expect(result.summary.budgetsOverBudget).toBe(1);
      expect(result.summary.totalBudgeted).toBe(1100);
      expect(result.summary.totalSpent).toBe(970);
      expect(result.summary.overallVariance).toBe(-130);
    });
  });

  describe('Private Method Tests', () => {
    describe('_getTimeBasedAnalysis', () => {
      beforeEach(() => {
        // Restore the original method for direct testing
        jest.restoreAllMocks();
        Transaction.aggregate.mockResolvedValue([
          { _id: { year: 2024, month: 1 }, totalAmount: 1500, transactionCount: 20 },
          { _id: { year: 2024, month: 2 }, totalAmount: 1300, transactionCount: 18 }
        ]);
      });

      it('should group transactions by month', async () => {
        const baseQuery = { userId: 'user123', type: 'expense' };
        
        const result = await reportService._getTimeBasedAnalysis(baseQuery, 'month');

        expect(Transaction.aggregate).toHaveBeenCalledWith(
          expect.arrayContaining([
            { $match: baseQuery },
            {
              $group: {
                _id: {
                  year: { $year: '$date' },
                  month: { $month: '$date' }
                },
                totalAmount: { $sum: '$amount' },
                transactionCount: { $sum: 1 }
              }
            }
          ])
        );
      });

      it('should group transactions by week', async () => {
        const baseQuery = { userId: 'user123', type: 'expense' };
        
        await reportService._getTimeBasedAnalysis(baseQuery, 'week');

        expect(Transaction.aggregate).toHaveBeenCalledWith(
          expect.arrayContaining([
            {
              $group: {
                _id: {
                  year: { $year: '$date' },
                  week: { $week: '$date' }
                },
                totalAmount: { $sum: '$amount' },
                transactionCount: { $sum: 1 }
              }
            }
          ])
        );
      });

      it('should group transactions by day', async () => {
        const baseQuery = { userId: 'user123', type: 'expense' };
        
        await reportService._getTimeBasedAnalysis(baseQuery, 'day');

        expect(Transaction.aggregate).toHaveBeenCalledWith(
          expect.arrayContaining([
            {
              $group: {
                _id: {
                  year: { $year: '$date' },
                  month: { $month: '$date' },
                  day: { $dayOfMonth: '$date' }
                },
                totalAmount: { $sum: '$amount' },
                transactionCount: { $sum: 1 }
              }
            }
          ])
        );
      });
    });

    describe('_calculateDiversificationScore', () => {
      it('should calculate diversification score correctly', () => {
        const sourceAnalysis = [
          { totalAmount: 5000 }, // 50% of total
          { totalAmount: 3000 }, // 30% of total
          { totalAmount: 2000 }  // 20% of total
        ];
        const totalIncome = 10000;

        const score = reportService._calculateDiversificationScore(sourceAnalysis, totalIncome);

        // Expected: 1 - (0.5² + 0.3² + 0.2²) = 1 - (0.25 + 0.09 + 0.04) = 1 - 0.38 = 0.62
        expect(score).toBeCloseTo(0.62, 2);
      });

      it('should return 0 for single income source', () => {
        const sourceAnalysis = [{ totalAmount: 10000 }];
        const totalIncome = 10000;

        const score = reportService._calculateDiversificationScore(sourceAnalysis, totalIncome);

        expect(score).toBe(0);
      });

      it('should handle empty source analysis', () => {
        const sourceAnalysis = [];
        const totalIncome = 0;

        const score = reportService._calculateDiversificationScore(sourceAnalysis, totalIncome);

        expect(score).toBe(0);
      });
    });

    describe('_getBudgetStatus', () => {
      it('should return on_track for usage <= 75%', () => {
        const status = reportService._getBudgetStatus(50);
        expect(status).toBe('on_track');

        const statusEdge = reportService._getBudgetStatus(75);
        expect(statusEdge).toBe('on_track');
      });

      it('should return warning for usage 75% < x <= 100%', () => {
        const status = reportService._getBudgetStatus(85);
        expect(status).toBe('warning');

        const statusEdge = reportService._getBudgetStatus(100);
        expect(statusEdge).toBe('warning');
      });

      it('should return over_budget for usage > 100%', () => {
        const status = reportService._getBudgetStatus(110);
        expect(status).toBe('over_budget');

        const statusExtreme = reportService._getBudgetStatus(200);
        expect(statusExtreme).toBe('over_budget');
      });
    });

    describe('_getMonthsDifference', () => {
      it('should calculate months difference correctly', () => {
        const start = new Date('2024-01-01');
        const end = new Date('2024-03-31');

        const months = reportService._getMonthsDifference(start, end);

        expect(months).toBeCloseTo(2.97, 1); // Approximately 3 months
      });

      it('should handle same month', () => {
        const start = new Date('2024-01-01');
        const end = new Date('2024-01-31');

        const months = reportService._getMonthsDifference(start, end);

        expect(months).toBeCloseTo(1, 1);
      });

      it('should return minimum 0.1 for very short periods', () => {
        const start = new Date('2024-01-01');
        const end = new Date('2024-01-02');

        const months = reportService._getMonthsDifference(start, end);

        expect(months).toBeGreaterThanOrEqual(0.1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Transaction.aggregate errors in spending report', async () => {
      Transaction.aggregate.mockRejectedValue(new Error('Database connection failed'));

      await expect(reportService.generateSpendingReport(mockUserId))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle Budget.find errors in budget performance report', async () => {
      Budget.find.mockReturnValue({
        populate: jest.fn().mockRejectedValue(new Error('Budget model error'))
      });

      await expect(reportService.generateBudgetPerformanceReport(mockUserId))
        .rejects.toThrow('Budget model error');
    });

    it('should handle invalid user ID gracefully', async () => {
      // Test with null user ID
      await expect(reportService.generateSpendingReport(null))
        .rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely large amounts', async () => {
      const largeAmount = Number.MAX_SAFE_INTEGER / 2;
      const mockLargeData = [
        {
          _id: 'cat1',
          categoryName: 'Large Transaction',
          totalAmount: largeAmount,
          transactionCount: 1,
          averageAmount: largeAmount,
          minAmount: largeAmount,
          maxAmount: largeAmount
        }
      ];

      Transaction.aggregate
        .mockResolvedValueOnce(mockLargeData)
        .mockResolvedValueOnce([]);

      jest.spyOn(reportService, '_getTimeBasedAnalysis').mockResolvedValue([]);
      jest.spyOn(reportService, '_calculateSpendingTrends').mockResolvedValue({});
      jest.spyOn(reportService, '_calculateAverageDailySpending').mockResolvedValue(0);

      const result = await reportService.generateSpendingReport(mockUserId);

      expect(result.summary.totalSpending).toBe(largeAmount);
      expect(result.categoryAnalysis[0].totalAmount).toBe(largeAmount);
    });

    it('should handle zero amounts correctly', async () => {
      const mockZeroData = [
        {
          _id: 'cat1',
          categoryName: 'Zero Category',
          totalAmount: 0,
          transactionCount: 0,
          averageAmount: 0,
          minAmount: 0,
          maxAmount: 0
        }
      ];

      Transaction.aggregate
        .mockResolvedValueOnce(mockZeroData)
        .mockResolvedValueOnce([]);

      jest.spyOn(reportService, '_getTimeBasedAnalysis').mockResolvedValue([]);
      jest.spyOn(reportService, '_calculateSpendingTrends').mockResolvedValue({});
      jest.spyOn(reportService, '_calculateAverageDailySpending').mockResolvedValue(0);

      const result = await reportService.generateSpendingReport(mockUserId);

      expect(result.summary.totalSpending).toBe(0);
      expect(result.summary.transactionCount).toBe(0);
    });

    it('should handle invalid date ranges', async () => {
      const invalidOptions = {
        startDate: new Date('2024-12-31'),
        endDate: new Date('2024-01-01') // End before start
      };

      // Should still process but with empty results
      Transaction.aggregate.mockResolvedValue([]);
      jest.spyOn(reportService, '_getTimeBasedAnalysis').mockResolvedValue([]);
      jest.spyOn(reportService, '_calculateSpendingTrends').mockResolvedValue({});
      jest.spyOn(reportService, '_calculateAverageDailySpending').mockResolvedValue(0);

      const result = await reportService.generateSpendingReport(mockUserId, invalidOptions);

      expect(result.summary.totalSpending).toBe(0);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        _id: `cat${i % 100}`,
        categoryName: `Category ${i % 100}`,
        totalAmount: Math.random() * 1000,
        transactionCount: Math.floor(Math.random() * 50),
        averageAmount: Math.random() * 100,
        minAmount: 1,
        maxAmount: Math.random() * 500
      }));

      Transaction.aggregate
        .mockResolvedValueOnce(largeDataset)
        .mockResolvedValueOnce([]);

      jest.spyOn(reportService, '_getTimeBasedAnalysis').mockResolvedValue([]);
      jest.spyOn(reportService, '_calculateSpendingTrends').mockResolvedValue({});
      jest.spyOn(reportService, '_calculateAverageDailySpending').mockResolvedValue(0);

      const startTime = Date.now();
      const result = await reportService.generateSpendingReport(mockUserId);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.categoryAnalysis).toHaveLength(10000);
    });
  });
});
