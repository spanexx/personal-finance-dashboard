const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');
const Category = require('../models/Category');
const mongoose = require('mongoose');

class ReportService {
    /**
     * Generate comprehensive spending report
     * @param {string} userId - User ID
     * @param {Object} options - Report options (startDate, endDate, categories, groupBy)
     * @returns {Object} Spending report data
     */
    async generateSpendingReport(userId, options = {}) {
        const {
            startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            endDate = new Date(),
            categories = [],
            groupBy = 'month' // day, week, month, year
        } = options;

        // Base query for transactions
        const baseQuery = {
            user: new mongoose.Types.ObjectId(userId),
            type: { $regex: /^expense$/i },
            date: { $gte: startDate, $lte: endDate }
        };

        if (categories.length > 0) {
            baseQuery.category = { $in: categories.map(id => new mongoose.Types.ObjectId(id)) };
        }

        // Debug logging
        console.log('[generateSpendingReport] baseQuery:', JSON.stringify(baseQuery));
        const count = await Transaction.countDocuments(baseQuery);
        console.log(`[generateSpendingReport] Matching transactions count: ${count}`);

        // Category-wise spending analysis
        const categoryAnalysis = await Transaction.aggregate([
            { $match: baseQuery },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'categoryInfo'
                }
            },
            { $unwind: '$categoryInfo' },
            {
                $group: {
                    _id: '$category',
                    categoryName: { $first: '$categoryInfo.name' },
                    categoryIcon: { $first: '$categoryInfo.icon' },
                    categoryColor: { $first: '$categoryInfo.color' },
                    totalAmount: { $sum: '$amount' },
                    transactionCount: { $sum: 1 },
                    averageAmount: { $avg: '$amount' },
                    minAmount: { $min: '$amount' },
                    maxAmount: { $max: '$amount' }
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);

        // Time-based spending patterns
        const timeBasedAnalysis = await this._getTimeBasedAnalysis(baseQuery, groupBy);

        // Spending trends
        const trends = await this._calculateSpendingTrends(userId, startDate, endDate);

        // Top merchants/payees
        const topMerchants = await Transaction.aggregate([
            { $match: baseQuery },
            {
                $group: {
                    _id: '$description',
                    totalAmount: { $sum: '$amount' },
                    transactionCount: { $sum: 1 }
                }
            },
            { $sort: { totalAmount: -1 } },
            { $limit: 10 }
        ]);

        // Calculate totals and averages
        const totalSpending = categoryAnalysis.reduce((sum, cat) => sum + cat.totalAmount, 0);
        const averageDailySpending = await this._calculateAverageDailySpending(userId, startDate, endDate);

        return {
            summary: {
                totalSpending,
                averageDailySpending,
                transactionCount: categoryAnalysis.reduce((sum, cat) => sum + cat.transactionCount, 0),
                categoriesCount: categoryAnalysis.length
            },
            categoryAnalysis,
            timeBasedAnalysis,
            trends,
            topMerchants,
            period: { startDate, endDate }
        };
    }

    /**
     * Generate comprehensive income report
     * @param {string} userId - User ID
     * @param {Object} options - Report options
     * @returns {Object} Income report data
     */
    async generateIncomeReport(userId, options = {}) {
        const {
            startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            endDate = new Date(),
            groupBy = 'month'
        } = options;

        const baseQuery = {
            user: new mongoose.Types.ObjectId(userId),
            type: 'income',
            date: { $gte: startDate, $lte: endDate }
        };

        // Debug logging
        console.log('[generateIncomeReport] baseQuery:', JSON.stringify(baseQuery));
        const count = await Transaction.countDocuments(baseQuery);
        console.log(`[generateIncomeReport] Matching transactions count: ${count}`);

        // Income source analysis
        const sourceAnalysis = await Transaction.aggregate([
            { $match: baseQuery },
            {
                $group: {
                    _id: '$description',
                    totalAmount: { $sum: '$amount' },
                    transactionCount: { $sum: 1 },
                    averageAmount: { $avg: '$amount' },
                    frequency: {
                        $push: {
                            date: '$date',
                            amount: '$amount'
                        }
                    }
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);

        // Calculate diversification metrics
        const totalIncome = sourceAnalysis.reduce((sum, source) => sum + source.totalAmount, 0);
        const diversificationScore = this._calculateDiversificationScore(sourceAnalysis, totalIncome);

        // Time-based income patterns
        const timeBasedAnalysis = await this._getTimeBasedAnalysis(baseQuery, groupBy);

        // Income growth analysis
        const growthAnalysis = await this._calculateIncomeGrowth(userId, startDate, endDate);

        // Recurring income identification
        const recurringIncome = await this._identifyRecurringIncome(sourceAnalysis);

        return {
            summary: {
                totalIncome,
                averageMonthlyIncome: totalIncome / this._getMonthsDifference(startDate, endDate),
                sourceCount: sourceAnalysis.length,
                diversificationScore
            },
            sourceAnalysis,
            timeBasedAnalysis,
            growthAnalysis,
            recurringIncome,
            period: { startDate, endDate }
        };
    }

    /**
     * Generate cash flow report with projections
     * @param {string} userId - User ID
     * @param {Object} options - Report options
     * @returns {Object} Cash flow report data
     */
    async generateCashFlowReport(userId, options = {}) {
        const {
            startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            endDate = new Date(),
            projectionMonths = 6
        } = options;

        // Get income and expenses for the period
        const [incomeData, expenseData] = await Promise.all([
            this._getMonthlyData(userId, 'income', startDate, endDate),
            this._getMonthlyData(userId, 'expense', startDate, endDate)
        ]);

        // Calculate monthly cash flow
        const monthlyCashFlow = this._calculateMonthlyCashFlow(incomeData, expenseData);

        // Calculate savings rate
        const savingsRate = this._calculateSavingsRate(monthlyCashFlow);

        // Generate projections
        const projections = await this._generateCashFlowProjections(userId, projectionMonths);

        // Identify cash flow patterns
        const patterns = this._identifyCashFlowPatterns(monthlyCashFlow);

        // Calculate running balance (assuming starting balance)
        const runningBalance = this._calculateRunningBalance(monthlyCashFlow);

        return {
            summary: {
                totalIncome: incomeData.reduce((sum, item) => sum + item.amount, 0),
                totalExpenses: expenseData.reduce((sum, item) => sum + item.amount, 0),
                netCashFlow: monthlyCashFlow.reduce((sum, item) => sum + item.netFlow, 0),
                averageSavingsRate: savingsRate.average,
                bestMonth: savingsRate.best,
                worstMonth: savingsRate.worst
            },
            monthlyCashFlow,
            savingsRate,
            projections,
            patterns,
            runningBalance,
            period: { startDate, endDate }
        };
    }

    /**
     * Generate budget performance report
     * @param {string} userId - User ID
     * @param {Object} options - Report options
     * @returns {Object} Budget performance report
     */
    async generateBudgetPerformanceReport(userId, options = {}) {
        const {
            startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            endDate = new Date(),
            budgetIds = []
        } = options;

        let budgetQuery = { user: new mongoose.Types.ObjectId(userId) };
        if (budgetIds.length > 0) {
            budgetQuery._id = { $in: budgetIds.map(id => new mongoose.Types.ObjectId(id)) };
        }

        // Get active budgets
        const budgets = await Budget.find(budgetQuery).populate('categoryAllocations.category');

        const budgetPerformance = await Promise.all(
            budgets.map(async (budget) => {
                // For each allocation, calculate actual spending
                const allocationPerformance = await Promise.all(
                    (budget.categoryAllocations || []).map(async (allocation) => {
                        const actualSpending = await Transaction.aggregate([
                            {
                                $match: {
                                    user: new mongoose.Types.ObjectId(userId),
                                    category: allocation.category && allocation.category._id ? allocation.category._id : allocation.category,
                                    type: 'expense',
                                    date: { $gte: startDate, $lte: endDate }
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    totalSpent: { $sum: '$amount' },
                                    transactionCount: { $sum: 1 }
                                }
                            }
                        ]);
                        const spent = actualSpending[0]?.totalSpent || 0;
                        const variance = spent - allocation.allocatedAmount;
                        const percentageUsed = allocation.allocatedAmount > 0 ? (spent / allocation.allocatedAmount) * 100 : 0;
                        return {
                            categoryId: allocation.category && allocation.category._id ? allocation.category._id : allocation.category,
                            categoryName: allocation.category && allocation.category.name ? allocation.category.name : undefined,
                            allocatedAmount: allocation.allocatedAmount,
                            actualSpent: spent,
                            variance,
                            percentageUsed,
                            status: this._getBudgetStatus(percentageUsed),
                            transactionCount: actualSpending[0]?.transactionCount || 0,
                            remainingAmount: Math.max(0, allocation.allocatedAmount - spent)
                        };
                    })
                );

                // Calculate totals for the budget
                const totalAllocated = allocationPerformance.reduce((sum, a) => sum + (a.allocatedAmount || 0), 0);
                const totalSpent = allocationPerformance.reduce((sum, a) => sum + (a.actualSpent || 0), 0);
                const totalVariance = totalSpent - totalAllocated;
                const totalPercentageUsed = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

                return {
                    budgetId: budget._id,
                    budgetName: budget.name,
                    totalAllocated,
                    totalSpent,
                    totalVariance,
                    totalPercentageUsed,
                    status: this._getBudgetStatus(totalPercentageUsed),
                    allocations: allocationPerformance
                };
            })
        );

        // Calculate overall budget performance
        const overallPerformance = this._calculateOverallBudgetPerformance(budgetPerformance);

        // Historical trends
        const historicalTrends = await this._getBudgetHistoricalTrends(userId, budgetIds);

        return {
            summary: overallPerformance,
            budgetPerformance,
            historicalTrends,
            period: { startDate, endDate }
        };
    }

    /**
     * Generate goal progress report
     * @param {string} userId - User ID
     * @param {Object} options - Report options
     * @returns {Object} Goal progress report
     */
    async generateGoalProgressReport(userId, options = {}) {
        const {
            goalIds = [],
            includeCompleted = false
        } = options;

        let goalQuery = { user: new mongoose.Types.ObjectId(userId) };
        if (goalIds.length > 0) {
            goalQuery._id = { $in: goalIds.map(id => new mongoose.Types.ObjectId(id)) };
        }
        if (!includeCompleted) {
            goalQuery.status = { $ne: 'completed' };
        }

        const goals = await Goal.find(goalQuery);

        const goalProgress = goals.map(goal => {
            const progressPercentage = (goal.currentAmount / goal.targetAmount) * 100;
            const remainingAmount = goal.targetAmount - goal.currentAmount;
            const timelineAssessment = this._assessGoalTimeline(goal);
            const achievementPrediction = this._predictGoalAchievement(goal);

            return {
                goalId: goal._id,
                name: goal.name,
                description: goal.description,
                targetAmount: goal.targetAmount,
                currentAmount: goal.currentAmount,
                progressPercentage,
                remainingAmount,
                targetDate: goal.targetDate,
                status: goal.status,
                timelineAssessment,
                achievementPrediction,
                monthlyRequirement: this._calculateMonthlyRequirement(goal),
                createdAt: goal.createdAt
            };
        });

        // Calculate summary statistics
        const summary = {
            totalGoals: goalProgress.length,
            completedGoals: goalProgress.filter(g => g.progressPercentage >= 100).length,
            onTrackGoals: goalProgress.filter(g => g.timelineAssessment.status === 'on-track').length,
            behindGoals: goalProgress.filter(g => g.timelineAssessment.status === 'behind').length,
            aheadGoals: goalProgress.filter(g => g.timelineAssessment.status === 'ahead').length,
            averageProgress: goalProgress.reduce((sum, g) => sum + g.progressPercentage, 0) / goalProgress.length || 0
        };

        return {
            summary,
            goalProgress,
            recommendations: this._generateGoalRecommendations(goalProgress)
        };
    }

    /**
     * Calculate net worth with trend analysis
     * @param {string} userId - User ID
     * @param {Object} options - Calculation options
     * @returns {Object} Net worth data
     */
    async calculateNetWorth(userId, options = {}) {
        const {
            includeProjections = true,
            historicalMonths = 12
        } = options;

        // Calculate current balances from transactions
        const accountBalances = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId)
                }
            },
            {
                $group: {
                    _id: '$account',
                    balance: {
                        $sum: {
                            $cond: [
                                { $eq: ['$type', 'income'] },
                                '$amount',
                                { $multiply: ['$amount', -1] }
                            ]
                        }
                    },
                    lastTransaction: { $max: '$date' }
                }
            }
        ]);

        const totalAssets = accountBalances
            .filter(account => account.balance > 0)
            .reduce((sum, account) => sum + account.balance, 0);

        const totalLiabilities = Math.abs(
            accountBalances
                .filter(account => account.balance < 0)
                .reduce((sum, account) => sum + account.balance, 0)
        );

        const currentNetWorth = totalAssets - totalLiabilities;

        // Historical net worth calculation
        const historicalNetWorth = await this._calculateHistoricalNetWorth(userId, historicalMonths);

        // Trend analysis
        const trendAnalysis = this._analyzeNetWorthTrend(historicalNetWorth);

        // Projections
        let projections = null;
        if (includeProjections) {
            projections = this._projectNetWorth(historicalNetWorth, 12); // 12 months ahead
        }

        return {
            current: {
                netWorth: currentNetWorth,
                totalAssets,
                totalLiabilities,
                calculatedAt: new Date()
            },
            historical: historicalNetWorth,
            trend: trendAnalysis,
            projections,
            accountBreakdown: accountBalances
        };
    }

    // Helper Methods

    async _getTimeBasedAnalysis(baseQuery, groupBy) {
        const groupByFormats = {
            day: {
                _id: {
                    year: { $year: '$date' },
                    month: { $month: '$date' },
                    day: { $dayOfMonth: '$date' }
                },
                format: '%Y-%m-%d'
            },
            week: {
                _id: {
                    year: { $year: '$date' },
                    week: { $week: '$date' }
                },
                format: '%Y-W%U'
            },
            month: {
                _id: {
                    year: { $year: '$date' },
                    month: { $month: '$date' }
                },
                format: '%Y-%m'
            },
            year: {
                _id: { year: { $year: '$date' } },
                format: '%Y'
            }
        };

        const groupFormat = groupByFormats[groupBy] || groupByFormats.month;

        return await Transaction.aggregate([
            { $match: baseQuery },
            {
                $group: {
                    _id: groupFormat._id,
                    totalAmount: { $sum: '$amount' },
                    transactionCount: { $sum: 1 },
                    averageAmount: { $avg: '$amount' },
                    date: { $first: '$date' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
        ]);
    }

    async _calculateSpendingTrends(userId, startDate, endDate) {
        // Compare with previous period
        const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const previousStartDate = new Date(startDate.getTime() - (periodDays * 24 * 60 * 60 * 1000));
        const previousEndDate = startDate;

        const [currentPeriod, previousPeriod] = await Promise.all([
            Transaction.aggregate([
                {
                    $match: {
                        user: new mongoose.Types.ObjectId(userId),
                        type: 'expense',
                        date: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            Transaction.aggregate([
                {
                    $match: {
                        user: new mongoose.Types.ObjectId(userId),
                        type: 'expense',
                        date: { $gte: previousStartDate, $lte: previousEndDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const currentTotal = currentPeriod[0]?.total || 0;
        const previousTotal = previousPeriod[0]?.total || 0;
        const change = currentTotal - previousTotal;
        const percentageChange = previousTotal > 0 ? (change / previousTotal) * 100 : 0;

        return {
            currentPeriod: currentTotal,
            previousPeriod: previousTotal,
            change,
            percentageChange,
            trend: change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable'
        };
    }

    async _calculateAverageDailySpending(userId, startDate, endDate) {
        const result = await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type: 'expense',
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const totalSpending = result[0]?.total || 0;
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        return days > 0 ? totalSpending / days : 0;
    }

    _calculateDiversificationScore(sources, totalIncome) {
        if (sources.length <= 1) return 0;

        // Calculate Herfindahl-Hirschman Index (HHI) for income concentration
        const hhi = sources.reduce((sum, source) => {
            const marketShare = (source.totalAmount / totalIncome) * 100;
            return sum + (marketShare * marketShare);
        }, 0);

        // Convert HHI to diversification score (0-100, higher is more diversified)
        const maxHHI = 10000; // Maximum possible HHI (complete concentration)
        return Math.max(0, 100 - (hhi / 100));
    }

    async _calculateIncomeGrowth(userId, startDate, endDate) {
        // Similar to spending trends but for income
        const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        const previousStartDate = new Date(startDate.getTime() - (periodDays * 24 * 60 * 60 * 1000));

        const [currentPeriod, previousPeriod] = await Promise.all([
            Transaction.aggregate([
                {
                    $match: {
                        user: new mongoose.Types.ObjectId(userId),
                        type: 'income',
                        date: { $gte: startDate, $lte: endDate }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Transaction.aggregate([
                {
                    $match: {
                        user: new mongoose.Types.ObjectId(userId),
                        type: 'income',
                        date: { $gte: previousStartDate, $lte: startDate }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);

        const currentTotal = currentPeriod[0]?.total || 0;
        const previousTotal = previousPeriod[0]?.total || 0;
        const growthRate = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

        return {
            currentPeriod: currentTotal,
            previousPeriod: previousTotal,
            growthAmount: currentTotal - previousTotal,
            growthRate,
            trend: growthRate > 0 ? 'growing' : growthRate < 0 ? 'declining' : 'stable'
        };
    }

    _identifyRecurringIncome(sourceAnalysis) {
        return sourceAnalysis.filter(source => {
            // Simple heuristic: if there are multiple transactions with similar amounts
            const amounts = source.frequency.map(f => f.amount);
            const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
            const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) / amounts.length;
            const standardDeviation = Math.sqrt(variance);
            const coefficientOfVariation = standardDeviation / avgAmount;

            // If coefficient of variation is low and there are multiple transactions, likely recurring
            return coefficientOfVariation < 0.1 && amounts.length >= 2;
        }).map(source => ({
            source: source._id,
            estimatedMonthlyAmount: source.totalAmount / source.frequency.length,
            frequency: source.frequency.length,
            reliability: 1 - (source.frequency.map(f => f.amount).reduce((sum, amt, _, arr) => 
                sum + Math.abs(amt - arr.reduce((s, a) => s + a, 0) / arr.length), 0) / 
                source.frequency.length / (source.totalAmount / source.frequency.length))
        }));
    }

    async _getMonthlyData(userId, type, startDate, endDate) {
        return await Transaction.aggregate([
            {
                $match: {
                    user: new mongoose.Types.ObjectId(userId),
                    type,
                    date: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' }
                    },
                    amount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);
    }

    _calculateMonthlyCashFlow(incomeData, expenseData) {
        const monthlyData = new Map();

        // Process income data
        incomeData.forEach(item => {
            const key = `${item._id.year}-${item._id.month}`;
            if (!monthlyData.has(key)) {
                monthlyData.set(key, { income: 0, expenses: 0, year: item._id.year, month: item._id.month });
            }
            monthlyData.get(key).income = item.amount;
        });

        // Process expense data
        expenseData.forEach(item => {
            const key = `${item._id.year}-${item._id.month}`;
            if (!monthlyData.has(key)) {
                monthlyData.set(key, { income: 0, expenses: 0, year: item._id.year, month: item._id.month });
            }
            monthlyData.get(key).expenses = item.amount;
        });

        // Calculate net flow for each month
        return Array.from(monthlyData.values()).map(data => ({
            ...data,
            netFlow: data.income - data.expenses,
            savingsRate: data.income > 0 ? ((data.income - data.expenses) / data.income) * 100 : 0
        })).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
        });
    }

    _calculateSavingsRate(monthlyCashFlow) {
        const savingsRates = monthlyCashFlow.map(month => month.savingsRate).filter(rate => !isNaN(rate));
        
        if (savingsRates.length === 0) {
            return { average: 0, best: null, worst: null };
        }

        return {
            average: savingsRates.reduce((sum, rate) => sum + rate, 0) / savingsRates.length,
            best: {
                rate: Math.max(...savingsRates),
                month: monthlyCashFlow.find(m => m.savingsRate === Math.max(...savingsRates))
            },
            worst: {
                rate: Math.min(...savingsRates),
                month: monthlyCashFlow.find(m => m.savingsRate === Math.min(...savingsRates))
            }
        };
    }

    async _generateCashFlowProjections(userId, months) {
        // Get historical data for the last 12 months to calculate averages
        const endDate = new Date();
        const startDate = new Date(endDate.getFullYear() - 1, endDate.getMonth(), 1);

        const [historicalIncome, historicalExpenses] = await Promise.all([
            this._getMonthlyData(userId, 'income', startDate, endDate),
            this._getMonthlyData(userId, 'expense', startDate, endDate)
        ]);

        // Calculate averages
        const avgMonthlyIncome = historicalIncome.reduce((sum, item) => sum + item.amount, 0) / Math.max(historicalIncome.length, 1);
        const avgMonthlyExpenses = historicalExpenses.reduce((sum, item) => sum + item.amount, 0) / Math.max(historicalExpenses.length, 1);

        // Generate projections
        const projections = [];
        const currentDate = new Date();
        
        for (let i = 1; i <= months; i++) {
            const projectionDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
            projections.push({
                year: projectionDate.getFullYear(),
                month: projectionDate.getMonth() + 1,
                projectedIncome: avgMonthlyIncome,
                projectedExpenses: avgMonthlyExpenses,
                projectedNetFlow: avgMonthlyIncome - avgMonthlyExpenses,
                projectedSavingsRate: avgMonthlyIncome > 0 ? ((avgMonthlyIncome - avgMonthlyExpenses) / avgMonthlyIncome) * 100 : 0
            });
        }

        return projections;
    }

    _identifyCashFlowPatterns(monthlyCashFlow) {
        if (monthlyCashFlow.length < 3) {
            return { trend: 'insufficient-data', patterns: [] };
        }

        // Identify overall trend
        const firstHalf = monthlyCashFlow.slice(0, Math.floor(monthlyCashFlow.length / 2));
        const secondHalf = monthlyCashFlow.slice(Math.floor(monthlyCashFlow.length / 2));

        const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.netFlow, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.netFlow, 0) / secondHalf.length;

        let trend = 'stable';
        if (secondHalfAvg > firstHalfAvg * 1.1) trend = 'improving';
        else if (secondHalfAvg < firstHalfAvg * 0.9) trend = 'declining';

        // Identify specific patterns
        const patterns = [];
        
        // Seasonal patterns (simplified)
        const monthlyAverages = {};
        monthlyCashFlow.forEach(month => {
            if (!monthlyAverages[month.month]) {
                monthlyAverages[month.month] = [];
            }
            monthlyAverages[month.month].push(month.netFlow);
        });

        const seasonalVariation = Object.keys(monthlyAverages).map(month => {
            const avg = monthlyAverages[month].reduce((sum, val) => sum + val, 0) / monthlyAverages[month].length;
            return { month: parseInt(month), averageNetFlow: avg };
        });

        if (seasonalVariation.length > 1) {
            const maxSeasonal = Math.max(...seasonalVariation.map(s => s.averageNetFlow));
            const minSeasonal = Math.min(...seasonalVariation.map(s => s.averageNetFlow));
            
            if (maxSeasonal > minSeasonal * 1.5) {
                patterns.push('seasonal-variation');
            }
        }

        return { trend, patterns, seasonalVariation };
    }

    _calculateRunningBalance(monthlyCashFlow, startingBalance = 0) {
        let balance = startingBalance;
        return monthlyCashFlow.map(month => {
            balance += month.netFlow;
            return {
                ...month,
                runningBalance: balance
            };
        });
    }

    _getBudgetStatus(percentageUsed) {
        if (percentageUsed <= 75) return 'on-track';
        if (percentageUsed <= 90) return 'warning';
        if (percentageUsed <= 100) return 'near-limit';
        return 'over-budget';
    }

    _calculateOverallBudgetPerformance(budgetPerformance) {
        const totalBudget = budgetPerformance.reduce((sum, bp) => sum + bp.budgetAmount, 0);
        const totalSpent = budgetPerformance.reduce((sum, bp) => sum + bp.actualSpent, 0);
        const overallVariance = totalSpent - totalBudget;
        const overallPercentageUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

        const statusCounts = budgetPerformance.reduce((counts, bp) => {
            counts[bp.status] = (counts[bp.status] || 0) + 1;
            return counts;
        }, {});

        return {
            totalBudget,
            totalSpent,
            overallVariance,
            overallPercentageUsed,
            overallStatus: this._getBudgetStatus(overallPercentageUsed),
            statusBreakdown: statusCounts,
            budgetCount: budgetPerformance.length
        };
    }

    async _getBudgetHistoricalTrends(userId, budgetIds) {
        // Simplified historical trends - could be expanded based on requirements
        const last6Months = [];
        const currentDate = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);
            
            last6Months.push({
                year: monthStart.getFullYear(),
                month: monthStart.getMonth() + 1,
                startDate: monthStart,
                endDate: monthEnd
            });
        }

        // This would need more sophisticated implementation for full historical tracking
        return last6Months;
    }

    _assessGoalTimeline(goal) {
        const now = new Date();
        const timeRemaining = goal.targetDate - now;
        const timeElapsed = now - goal.createdAt;
        const totalTime = goal.targetDate - goal.createdAt;
        
        const timeProgress = timeElapsed / totalTime;
        const amountProgress = goal.currentAmount / goal.targetAmount;
        
        let status = 'on-track';
        let assessment = '';
        
        if (amountProgress >= timeProgress * 1.1) {
            status = 'ahead';
            assessment = 'You are ahead of schedule';
        } else if (amountProgress < timeProgress * 0.9) {
            status = 'behind';
            assessment = 'You are behind schedule';
        } else {
            assessment = 'You are on track';
        }
        
        return {
            status,
            assessment,
            timeProgress: Math.min(timeProgress * 100, 100),
            amountProgress: Math.min(amountProgress * 100, 100),
            daysRemaining: Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)))
        };
    }

    _predictGoalAchievement(goal) {
        const timeElapsed = Date.now() - goal.createdAt;
        const currentProgress = goal.currentAmount / goal.targetAmount;
        
        if (currentProgress === 0 || timeElapsed === 0) {
            return {
                likelihood: 'unknown',
                estimatedCompletionDate: null,
                monthlyRequirement: this._calculateMonthlyRequirement(goal)
            };
        }
        
        const progressRate = currentProgress / timeElapsed; // progress per millisecond
        const remainingProgress = 1 - currentProgress;
        const estimatedTimeToCompletion = remainingProgress / progressRate;
        const estimatedCompletionDate = new Date(Date.now() + estimatedTimeToCompletion);
        
        let likelihood = 'moderate';
        if (estimatedCompletionDate <= goal.targetDate) {
            likelihood = estimatedCompletionDate <= new Date(goal.targetDate.getTime() - (30 * 24 * 60 * 60 * 1000)) ? 'high' : 'moderate';
        } else {
            likelihood = 'low';
        }
        
        return {
            likelihood,
            estimatedCompletionDate,
            onTarget: estimatedCompletionDate <= goal.targetDate,
            monthlyRequirement: this._calculateMonthlyRequirement(goal)
        };
    }

    _calculateMonthlyRequirement(goal) {
        const now = new Date();
        const timeRemaining = goal.targetDate - now;
        const monthsRemaining = Math.max(1, timeRemaining / (1000 * 60 * 60 * 24 * 30));
        const amountRemaining = goal.targetAmount - goal.currentAmount;
        
        return Math.max(0, amountRemaining / monthsRemaining);
    }

    _generateGoalRecommendations(goalProgress) {
        const recommendations = [];
        
        goalProgress.forEach(goal => {
            if (goal.timelineAssessment.status === 'behind') {
                recommendations.push({
                    type: 'increase-contribution',
                    goalId: goal.goalId,
                    message: `Consider increasing monthly contribution to $${goal.monthlyRequirement.toFixed(2)} for ${goal.name}`,
                    priority: 'high'
                });
            }
            
            if (goal.achievementPrediction.likelihood === 'low') {
                recommendations.push({
                    type: 'review-timeline',
                    goalId: goal.goalId,
                    message: `Consider extending the timeline for ${goal.name} or increasing contributions`,
                    priority: 'medium'
                });
            }
            
            if (goal.progressPercentage >= 90) {
                recommendations.push({
                    type: 'near-completion',
                    goalId: goal.goalId,
                    message: `You're almost there! Only $${goal.remainingAmount.toFixed(2)} left for ${goal.name}`,
                    priority: 'positive'
                });
            }
        });
        
        return recommendations;
    }

    async _calculateHistoricalNetWorth(userId, months) {
        const historical = [];
        const currentDate = new Date();
        
        for (let i = months - 1; i >= 0; i--) {
            const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);
            
            const balances = await Transaction.aggregate([
                {
                    $match: {
                        user: new mongoose.Types.ObjectId(userId),
                        date: { $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: '$account',
                        balance: {
                            $sum: {
                                $cond: [
                                    { $eq: ['$type', 'income'] },
                                    '$amount',
                                    { $multiply: ['$amount', -1] }
                                ]
                            }
                        }
                    }
                }
            ]);
            
            const assets = balances.filter(b => b.balance > 0).reduce((sum, b) => sum + b.balance, 0);
            const liabilities = Math.abs(balances.filter(b => b.balance < 0).reduce((sum, b) => sum + b.balance, 0));
            
            historical.push({
                date: endDate,
                netWorth: assets - liabilities,
                assets,
                liabilities
            });
        }
        
        return historical.sort((a, b) => a.date - b.date);
    }

    _analyzeNetWorthTrend(historicalData) {
        if (historicalData.length < 2) {
            return { trend: 'insufficient-data', change: 0, percentageChange: 0 };
        }
        
        const latest = historicalData[historicalData.length - 1];
        const previous = historicalData[historicalData.length - 2];
        const change = latest.netWorth - previous.netWorth;
        const percentageChange = previous.netWorth !== 0 ? (change / Math.abs(previous.netWorth)) * 100 : 0;
        
        let trend = 'stable';
        if (change > 0) trend = 'increasing';
        else if (change < 0) trend = 'decreasing';
        
        // Calculate overall trend for the period
        const first = historicalData[0];
        const overallChange = latest.netWorth - first.netWorth;
        const overallPercentageChange = first.netWorth !== 0 ? (overallChange / Math.abs(first.netWorth)) * 100 : 0;
        
        return {
            trend,
            monthlyChange: change,
            monthlyPercentageChange: percentageChange,
            overallChange,
            overallPercentageChange,
            volatility: this._calculateVolatility(historicalData)
        };
    }

    _calculateVolatility(historicalData) {
        if (historicalData.length < 2) return 0;
        
        const changes = [];
        for (let i = 1; i < historicalData.length; i++) {
            const change = historicalData[i].netWorth - historicalData[i - 1].netWorth;
            changes.push(change);
        }
        
        const meanChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
        const variance = changes.reduce((sum, change) => sum + Math.pow(change - meanChange, 2), 0) / changes.length;
        
        return Math.sqrt(variance);
    }

    _projectNetWorth(historicalData, futureMonths) {
        if (historicalData.length < 3) {
            return null; // Need at least 3 data points for projection
        }
        
        // Simple linear regression for trend
        const n = historicalData.length;
        const sumX = historicalData.reduce((sum, _, i) => sum + i, 0);
        const sumY = historicalData.reduce((sum, data) => sum + data.netWorth, 0);
        const sumXY = historicalData.reduce((sum, data, i) => sum + i * data.netWorth, 0);
        const sumXX = historicalData.reduce((sum, _, i) => sum + i * i, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        const projections = [];
        const lastDate = historicalData[historicalData.length - 1].date;
        
        for (let i = 1; i <= futureMonths; i++) {
            const projectedNetWorth = slope * (n - 1 + i) + intercept;
            const projectionDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + i, lastDate.getDate());
            
            projections.push({
                date: projectionDate,
                projectedNetWorth,
                confidence: Math.max(0.1, 1 - (i * 0.1)) // Decreasing confidence over time
            });
        }
        
        return projections;
    }

    _getMonthsDifference(startDate, endDate) {
        const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                      (endDate.getMonth() - startDate.getMonth());
        return Math.max(1, months);
    }
}

module.exports = new ReportService();