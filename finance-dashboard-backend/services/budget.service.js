const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const mongoose = require('mongoose');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  DatabaseError 
} = require('../utils/errorHandler');

/**
 * Budget Service
 * Provides business logic and helper functions for budget operations
 */
class BudgetService {
  /**
   * Validate budget data before creation/update
   * @param {Object} budgetData - Budget data to validate
   * @param {string} userId - User ID
   * @param {string} budgetId - Budget ID (for updates)
   * @returns {Object} Validation result
   */
  static async validateBudgetData(budgetData, userId, budgetId = null) {
    const errors = [];

    // Validate date range
    if (budgetData.startDate && budgetData.endDate) {
      const startDate = new Date(budgetData.startDate);
      const endDate = new Date(budgetData.endDate);

      if (startDate >= endDate) {
        errors.push('Start date must be before end date');
      }

      // Check for overlapping budgets
      const overlappingBudgets = await Budget.find({
        user: userId,
        isDeleted: { $ne: true },
        ...(budgetId && { _id: { $ne: budgetId } }),
        $or: [
          {
            startDate: { $lte: endDate },
            endDate: { $gte: startDate }
          }
        ]
      });

      if (overlappingBudgets.length > 0) {
        errors.push(`Budget period overlaps with existing budget(s): ${overlappingBudgets.map(b => b.name).join(', ')}`);
      }
    }

    // Validate category allocations
    if (budgetData.categoryAllocations && budgetData.totalAmount) {
      const totalAllocated = budgetData.categoryAllocations.reduce(
        (sum, allocation) => sum + allocation.allocatedAmount, 0
      );

      if (Math.abs(totalAllocated - budgetData.totalAmount) > 0.01) {
        errors.push('Total category allocations must equal total budget amount');
      }

      // Check for duplicate categories
      const categoryIds = budgetData.categoryAllocations.map(a => a.category.toString());
      const uniqueCategories = [...new Set(categoryIds)];
      if (categoryIds.length !== uniqueCategories.length) {
        errors.push('Duplicate categories found in allocations');
      }

      // Validate category existence
      const categories = await Category.find({
        _id: { $in: categoryIds },
        $or: [
          { user: userId },
          { isDefault: true }
        ]
      });

      const foundCategoryIds = categories.map(c => c._id.toString());
      const missingCategories = categoryIds.filter(id => !foundCategoryIds.includes(id));
      if (missingCategories.length > 0) {
        errors.push(`Invalid categories: ${missingCategories.join(', ')}`);
      }
    }

    // Validate alert thresholds
    if (budgetData.alertSettings?.thresholds) {
      const { warning, critical } = budgetData.alertSettings.thresholds;
      if (warning && critical && warning >= critical) {
        errors.push('Warning threshold must be less than critical threshold');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate budget performance metrics
   * @param {Object} budget - Budget object
   * @param {Date} asOfDate - Date to calculate performance as of
   * @returns {Object} Performance metrics
   */
  static async calculateBudgetPerformance(budget, asOfDate = new Date()) {
    const performance = await budget.getBudgetPerformance();
    
    // Calculate additional metrics
    const timeElapsed = Math.max(0, asOfDate - budget.startDate);
    const totalTime = budget.endDate - budget.startDate;
    const timeProgress = Math.min(100, (timeElapsed / totalTime) * 100);
    
    // Calculate spending velocity
    const daysElapsed = Math.max(1, Math.ceil(timeElapsed / (1000 * 60 * 60 * 24)));
    const dailySpendingRate = performance.totalSpent / daysElapsed;
    const projectedEndSpending = dailySpendingRate * Math.ceil(totalTime / (1000 * 60 * 60 * 24));
    
    // Calculate burn rate
    const burnRate = performance.totalSpent / budget.totalAmount * 100;
    const idealBurnRate = timeProgress;
    const burnRateVariance = burnRate - idealBurnRate;

    // Fix: Ensure category analysis uses categoryAllocations
    let categoryUtilization = [];
    if (Array.isArray(budget.categoryAllocations)) {
      categoryUtilization = budget.categoryAllocations.map(allocation => {
        const spent = allocation.spentAmount || 0;
        const allocated = allocation.allocatedAmount || 0;
        const utilization = allocated > 0 ? (spent / allocated) * 100 : 0;
        return {
          categoryId: allocation.category && allocation.category._id ? allocation.category._id : allocation.category,
          categoryName: allocation.category && allocation.category.name ? allocation.category.name : undefined,
          spentAmount: spent,
          allocatedAmount: allocated,
          utilizationPercentage: utilization
        };
      });
    }
    
    return {
      ...performance,
      timeProgress,
      dailySpendingRate,
      projectedEndSpending,
      burnRate,
      idealBurnRate,
      burnRateVariance,
      isOnTrack: Math.abs(burnRateVariance) <= 10, // Within 10% variance
      daysRemaining: budget.daysRemaining,
      projectedOverrun: Math.max(0, projectedEndSpending - budget.totalAmount),
      categoryUtilization // Added for dashboard/report use
    };
  }

  /**
   * Generate budget optimization recommendations
   * @param {string} userId - User ID
   * @param {Array} budgetIds - Specific budget IDs to analyze
   * @returns {Object} Optimization recommendations
   */
  static async generateOptimizationRecommendations(userId, budgetIds = null) {
    // Get user's budgets
    const filter = { 
      user: userId, 
      isActive: true, 
      isDeleted: { $ne: true } 
    };
    if (budgetIds) {
      filter._id = { $in: budgetIds };
    }

    const budgets = await Budget.find(filter)
      .populate('categoryAllocations.category')
      .sort({ startDate: -1 });

    if (budgets.length === 0) {
      return {
        recommendations: [],
        summary: 'No active budgets found for analysis'
      };
    }

    const recommendations = [];

    // Analyze each budget
    for (const budget of budgets) {
      const performance = await this.calculateBudgetPerformance(budget);
      
      // Over-budget recommendations
      if (performance.utilizationRate > 100) {
        recommendations.push({
          type: 'warning',
          category: 'overspending',
          budgetId: budget._id,
          budgetName: budget.name,
          priority: 'high',
          title: 'Budget Exceeded',
          description: `Budget "${budget.name}" is ${(performance.utilizationRate - 100).toFixed(1)}% over budget`,
          action: 'Consider reducing spending in high-variance categories or increasing budget allocation',
          impact: 'financial_health',
          metadata: {
            overageAmount: performance.totalSpent - budget.totalAmount,
            utilizationRate: performance.utilizationRate
          }
        });
      }

      // High burn rate recommendations
      if (performance.burnRateVariance > 20) {
        recommendations.push({
          type: 'warning',
          category: 'burn_rate',
          budgetId: budget._id,
          budgetName: budget.name,
          priority: 'medium',
          title: 'High Spending Rate',
          description: `Spending rate is ${performance.burnRateVariance.toFixed(1)}% above ideal`,
          action: 'Review recent transactions and reduce discretionary spending',
          impact: 'budget_adherence',
          metadata: {
            currentBurnRate: performance.burnRate,
            idealBurnRate: performance.idealBurnRate,
            projectedOverrun: performance.projectedOverrun
          }
        });
      }

      // Category-specific recommendations
      for (const allocation of budget.categoryAllocations) {
        if (allocation.spentAmount > allocation.allocatedAmount) {
          recommendations.push({
            type: 'action',
            category: 'category_overspend',
            budgetId: budget._id,
            budgetName: budget.name,
            priority: 'medium',
            title: `${allocation.category.name} Category Over Budget`,
            description: `${allocation.category.name} is $${(allocation.spentAmount - allocation.allocatedAmount).toFixed(2)} over budget`,
            action: `Reduce spending in ${allocation.category.name} or reallocate funds from under-utilized categories`,
            impact: 'category_balance',
            metadata: {
              categoryId: allocation.category._id,
              categoryName: allocation.category.name,
              overage: allocation.spentAmount - allocation.allocatedAmount,
              utilizationRate: (allocation.spentAmount / allocation.allocatedAmount) * 100
            }
          });
        }
      }

      // Under-utilized budget recommendations
      if (performance.utilizationRate < 50 && performance.timeProgress > 75) {
        recommendations.push({
          type: 'opportunity',
          category: 'underutilization',
          budgetId: budget._id,
          budgetName: budget.name,
          priority: 'low',
          title: 'Budget Under-Utilized',
          description: `Only ${performance.utilizationRate.toFixed(1)}% of budget used with ${(100 - performance.timeProgress).toFixed(1)}% time remaining`,
          action: 'Consider reallocating unused funds to savings or investment goals',
          impact: 'optimization',
          metadata: {
            remainingAmount: budget.totalAmount - performance.totalSpent,
            utilizationRate: performance.utilizationRate,
            timeProgress: performance.timeProgress
          }
        });
      }
    }

    // Global recommendations based on spending patterns
    const globalRecommendations = await this.generateGlobalRecommendations(userId, budgets);
    recommendations.push(...globalRecommendations);

    // Sort recommendations by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    recommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    return {
      recommendations: recommendations.slice(0, 20), // Limit to top 20
      summary: this.generateRecommendationSummary(recommendations),
      analysisDate: new Date(),
      budgetsAnalyzed: budgets.length
    };
  }

  /**
   * Generate global recommendations based on user's overall spending patterns
   * @param {string} userId - User ID
   * @param {Array} budgets - User's budgets
   * @returns {Array} Global recommendations
   */
  static async generateGlobalRecommendations(userId, budgets) {
    const recommendations = [];

    // Analyze category performance across budgets
    const categoryPerformance = {};
    
    for (const budget of budgets) {
      for (const allocation of budget.categoryAllocations) {
        const categoryId = allocation.category._id.toString();
        if (!categoryPerformance[categoryId]) {
          categoryPerformance[categoryId] = {
            category: allocation.category,
            totalAllocated: 0,
            totalSpent: 0,
            budgetCount: 0
          };
        }
        
        categoryPerformance[categoryId].totalAllocated += allocation.allocatedAmount;
        categoryPerformance[categoryId].totalSpent += allocation.spentAmount;
        categoryPerformance[categoryId].budgetCount++;
      }
    }

    // Identify consistently over-performing categories
    for (const [categoryId, performance] of Object.entries(categoryPerformance)) {
      const utilizationRate = (performance.totalSpent / performance.totalAllocated) * 100;
      
      if (utilizationRate > 120 && performance.budgetCount >= 2) {
        recommendations.push({
          type: 'insight',
          category: 'pattern_analysis',
          priority: 'medium',
          title: `Consistent Overspending in ${performance.category.name}`,
          description: `${performance.category.name} consistently exceeds budget by ${(utilizationRate - 100).toFixed(1)}% across multiple budgets`,
          action: `Consider increasing allocation for ${performance.category.name} by 20-30% in future budgets`,
          impact: 'budget_accuracy',
          metadata: {
            categoryId,
            categoryName: performance.category.name,
            avgUtilizationRate: utilizationRate,
            budgetsAffected: performance.budgetCount
          }
        });
      }
    }

    // Budget frequency recommendations
    if (budgets.length >= 3) {
      const avgBudgetDuration = budgets.reduce((sum, budget) => {
        return sum + (budget.endDate - budget.startDate);
      }, 0) / budgets.length;

      const avgDurationDays = avgBudgetDuration / (1000 * 60 * 60 * 24);
      
      if (avgDurationDays > 90) {
        recommendations.push({
          type: 'suggestion',
          category: 'budget_structure',
          priority: 'low',
          title: 'Consider Shorter Budget Periods',
          description: 'Your budgets average more than 3 months. Shorter periods may improve tracking accuracy',
          action: 'Try monthly budgets for better control and more frequent adjustments',
          impact: 'budget_control',
          metadata: {
            avgDurationDays: Math.round(avgDurationDays)
          }
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate recommendation summary
   * @param {Array} recommendations - List of recommendations
   * @returns {string} Summary text
   */
  static generateRecommendationSummary(recommendations) {
    const counts = {
      high: recommendations.filter(r => r.priority === 'high').length,
      medium: recommendations.filter(r => r.priority === 'medium').length,
      low: recommendations.filter(r => r.priority === 'low').length
    };

    const types = {
      warning: recommendations.filter(r => r.type === 'warning').length,
      action: recommendations.filter(r => r.type === 'action').length,
      opportunity: recommendations.filter(r => r.type === 'opportunity').length,
      insight: recommendations.filter(r => r.type === 'insight').length,
      suggestion: recommendations.filter(r => r.type === 'suggestion').length
    };

    let summary = `Found ${recommendations.length} recommendations: `;
    
    if (counts.high > 0) summary += `${counts.high} high priority, `;
    if (counts.medium > 0) summary += `${counts.medium} medium priority, `;
    if (counts.low > 0) summary += `${counts.low} low priority. `;

    if (types.warning > 0) summary += `${types.warning} warnings require immediate attention. `;
    if (types.opportunity > 0) summary += `${types.opportunity} opportunities for optimization identified.`;

    return summary.trim();
  }

  /**
   * Calculate budget health score
   * @param {Object} budget - Budget object
   * @returns {Object} Health score and details
   */
  static async calculateBudgetHealthScore(budget) {
    const performance = await this.calculateBudgetPerformance(budget);
    let score = 100;
    const factors = [];

    // Utilization rate factor (ideal: 80-100%)
    if (performance.utilizationRate > 100) {
      const penalty = Math.min(30, (performance.utilizationRate - 100) * 2);
      score -= penalty;
      factors.push({
        factor: 'Over Budget',
        impact: -penalty,
        description: `${(performance.utilizationRate - 100).toFixed(1)}% over budget`
      });
    } else if (performance.utilizationRate < 50 && performance.timeProgress > 75) {
      const penalty = 10;
      score -= penalty;
      factors.push({
        factor: 'Under-Utilized',
        impact: -penalty,
        description: 'Significant unused budget allocation'
      });
    }

    // Burn rate factor
    if (Math.abs(performance.burnRateVariance) > 20) {
      const penalty = Math.min(20, Math.abs(performance.burnRateVariance) / 2);
      score -= penalty;
      factors.push({
        factor: 'Poor Pacing',
        impact: -penalty,
        description: `Spending ${performance.burnRateVariance > 0 ? 'too fast' : 'too slow'}`
      });
    }

    // Category balance factor
    const categoryVariances = budget.categoryAllocations.map(allocation => {
      const utilization = (allocation.spentAmount / allocation.allocatedAmount) * 100;
      return Math.abs(utilization - 100);
    });
    const avgCategoryVariance = categoryVariances.reduce((sum, variance) => sum + variance, 0) / categoryVariances.length;
    
    if (avgCategoryVariance > 25) {
      const penalty = Math.min(15, avgCategoryVariance / 5);
      score -= penalty;
      factors.push({
        factor: 'Category Imbalance',
        impact: -penalty,
        description: 'Uneven spending across categories'
      });
    }

    // Ensure score doesn't go below 0
    score = Math.max(0, Math.round(score));

    // Determine health level
    let healthLevel;
    if (score >= 90) healthLevel = 'Excellent';
    else if (score >= 75) healthLevel = 'Good';
    else if (score >= 60) healthLevel = 'Fair';
    else if (score >= 40) healthLevel = 'Poor';
    else healthLevel = 'Critical';

    return {
      score,
      healthLevel,
      factors,
      lastCalculated: new Date()
    };
  }

  /**
   * Detect budget conflicts and overlaps
   * @param {Object} budgetData - Budget data to check
   * @param {string} userId - User ID
   * @param {string} excludeBudgetId - Budget ID to exclude from conflict check
   * @returns {Object} Conflict detection results
   */
  static async detectBudgetConflicts(budgetData, userId, excludeBudgetId = null) {
    const conflicts = [];
    const warnings = [];

    // Check for period overlaps
    const filter = {
      user: userId,
      isDeleted: { $ne: true },
      ...(excludeBudgetId && { _id: { $ne: excludeBudgetId } })
    };

    if (budgetData.startDate && budgetData.endDate) {
      const overlappingBudgets = await Budget.find({
        ...filter,
        $or: [
          {
            startDate: { $lte: new Date(budgetData.endDate) },
            endDate: { $gte: new Date(budgetData.startDate) }
          }
        ]
      }).select('name startDate endDate totalAmount period');

      overlappingBudgets.forEach(budget => {
        conflicts.push({
          type: 'period_overlap',
          severity: 'high',
          conflictingBudget: {
            id: budget._id,
            name: budget.name,
            period: budget.period,
            startDate: budget.startDate,
            endDate: budget.endDate
          },
          description: `Period overlaps with existing budget "${budget.name}"`
        });
      });
    }

    // Check for similar budget names
    if (budgetData.name) {
      const similarBudgets = await Budget.find({
        ...filter,
        name: { $regex: budgetData.name, $options: 'i' }
      }).select('name');

      similarBudgets.forEach(budget => {
        warnings.push({
          type: 'similar_name',
          severity: 'low',
          description: `Similar budget name exists: "${budget.name}"`
        });
      });
    }

    // Check for excessive budget count in period
    const samePeriodBudgets = await Budget.countDocuments({
      user: userId,
      period: budgetData.period,
      isActive: true,
      isDeleted: { $ne: true },
      ...(excludeBudgetId && { _id: { $ne: excludeBudgetId } })
    });

    if (samePeriodBudgets >= 3) {
      warnings.push({
        type: 'excessive_budgets',
        severity: 'medium',
        description: `You already have ${samePeriodBudgets} active ${budgetData.period} budgets`
      });
    }

    return {
      hasConflicts: conflicts.length > 0,
      hasWarnings: warnings.length > 0,
      conflicts,
      warnings,
      canProceed: conflicts.length === 0
    };
  }

  /**
   * Generate budget rollover data
   * @param {Object} sourceBudget - Source budget to roll over
   * @param {Object} rolloverOptions - Rollover configuration
   * @returns {Object} New budget data
   */
  static generateBudgetRollover(sourceBudget, rolloverOptions = {}) {
    const {
      startDate,
      carryOverUnspent = false,
      adjustForInflation = false,
      inflationRate = 3,
      adjustments = {}
    } = rolloverOptions;

    // Calculate new period dates based on source budget period
    const newStartDate = new Date(startDate);
    let newEndDate;

    switch (sourceBudget.period) {
      case 'weekly':
        newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + 7);
        break;
      case 'monthly':
        newEndDate = new Date(newStartDate);
        newEndDate.setMonth(newEndDate.getMonth() + 1);
        break;
      case 'quarterly':
        newEndDate = new Date(newStartDate);
        newEndDate.setMonth(newEndDate.getMonth() + 3);
        break;
      case 'yearly':
        newEndDate = new Date(newStartDate);
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        break;
      default:
        newEndDate = new Date(newStartDate);
        newEndDate.setMonth(newEndDate.getMonth() + 1);
    }

    // Calculate inflation adjustment
    const inflationMultiplier = adjustForInflation ? (1 + (inflationRate / 100)) : 1;

    // Process category allocations
    const newAllocations = sourceBudget.categoryAllocations.map(allocation => {
      let newAmount = allocation.allocatedAmount * inflationMultiplier;

      // Apply specific adjustments
      if (adjustments[allocation.category.toString()]) {
        const adjustment = adjustments[allocation.category.toString()];
        if (adjustment.type === 'percentage') {
          newAmount *= (1 + (adjustment.value / 100));
        } else if (adjustment.type === 'amount') {
          newAmount += adjustment.value;
        }
      }

      // Carry over unspent amount
      if (carryOverUnspent) {
        const unspent = Math.max(0, allocation.allocatedAmount - allocation.spentAmount);
        newAmount += unspent;
      }

      return {
        category: allocation.category,
        allocatedAmount: Math.round(newAmount * 100) / 100,
        spentAmount: 0,
        percentage: null // Will be calculated after total
      };
    });

    // Calculate new total amount
    const newTotalAmount = newAllocations.reduce((sum, allocation) => sum + allocation.allocatedAmount, 0);

    // Update percentages
    newAllocations.forEach(allocation => {
      allocation.percentage = (allocation.allocatedAmount / newTotalAmount) * 100;
    });

    return {
      name: `${sourceBudget.name} - ${newStartDate.getFullYear()}/${String(newStartDate.getMonth() + 1).padStart(2, '0')}`,
      description: `Rolled over from: ${sourceBudget.name}`,
      period: sourceBudget.period,
      startDate: newStartDate,
      endDate: newEndDate,
      totalAmount: newTotalAmount,
      categoryAllocations: newAllocations,
      alertSettings: sourceBudget.alertSettings,
      rolloverSettings: {
        enabled: true,
        sourceBudgetId: sourceBudget._id,
        carryOverUnspent,
        adjustForInflation,
        inflationRate: adjustForInflation ? inflationRate : null,
        adjustments: Object.keys(adjustments).length > 0 ? adjustments : null
      },
      isActive: true
    };
  }

  /**
   * Get user budgets with filtering and performance analysis
   * @param {string} userId - User ID
   * @param {Object} queryParams - Query parameters for filtering
   * @returns {Object} Budgets with pagination info
   */
  static async getBudgets(userId, queryParams) {
    const {
      period,
      status = 'active',
      includeExpired = false,
      includeInactive = false,
      page = 1,
      limit = 20,
      sortBy = 'startDate',
      sortOrder = 'desc',
      search
    } = queryParams;

    // Build filter query
    const filter = {
      user: userId,
      isDeleted: { $ne: true }
    };

    // Filter by period
    if (period) {
      filter.period = period;
    }

    // Filter by status
    if (status === 'active') {
      filter.isActive = true;
      if (!includeExpired) {
        filter.endDate = { $gte: new Date() };
      }
    } else if (status === 'inactive' && !includeInactive) {
      filter.isActive = false;
    }

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    try {
      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Get budgets with population
      const budgets = await Budget.find(filter)
        .populate('categoryAllocations.category', 'name type color icon')
        .sort(sortOptions)
        .limit(parseInt(limit))
        .skip(skip)
        .lean();

      // Get total count for pagination
      const totalCount = await Budget.countDocuments(filter);

      // Calculate performance for each budget
      const budgetsWithPerformance = await Promise.all(
        budgets.map(async (budget) => {
          const budgetDoc = await Budget.findById(budget._id);
          const performance = await budgetDoc.getBudgetPerformance();
          
          return {
            ...budget,
            performance: {
              utilizationPercentage: performance.budget.utilizationPercentage,
              status: performance.variance.status,
              daysRemaining: performance.period.daysRemaining,
              projectedSpending: performance.daily.projectedSpending,
              alerts: performance.alerts.length
            }
          };
        })
      );

      // Calculate summary statistics
      const summary = {
        totalBudgets: totalCount,
        activeBudgets: budgetsWithPerformance.filter(b => b.isActive && new Date(b.endDate) >= new Date()).length,
        expiredBudgets: budgetsWithPerformance.filter(b => new Date(b.endDate) < new Date()).length,
        totalAllocated: budgetsWithPerformance.reduce((sum, b) => sum + b.totalAmount, 0),
        totalSpent: budgetsWithPerformance.reduce((sum, b) => sum + b.totalSpent, 0),
        overBudgetCount: budgetsWithPerformance.filter(b => b.performance.status === 'over-budget').length
      };

      return {
        budgets: budgetsWithPerformance,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNextPage: skip + budgetsWithPerformance.length < totalCount,
          hasPrevPage: parseInt(page) > 1
        },
        summary
      };
    } catch (error) {
      throw new DatabaseError('Failed to retrieve budgets', error);
    }
  }

  /**
   * Get detailed budget information with real-time calculations
   * @param {string} budgetId - Budget ID
   * @param {string} userId - User ID
   * @param {Object} options - Additional options for details
   * @returns {Object} Budget details with performance metrics
   */
  static async getBudgetDetails(budgetId, userId, options = {}) {
    const { includeProjections = true, includeTrends = true } = options;
    console.log('[BudgetService] getBudgetDetails incoming budgetId:', budgetId, 'isValid:', mongoose.Types.ObjectId.isValid(budgetId));
    if (!mongoose.Types.ObjectId.isValid(budgetId)) {
      throw new ValidationError('Invalid budget ID format');
    }

    // Use the static method to get a fresh budget with up-to-date spent amounts
    const budget = await Budget.getFreshBudgetById(budgetId);
    if (!budget || budget.user.toString() !== userId.toString() || budget.isDeleted) {
      throw new NotFoundError('Budget not found');
    }

    // Ensure spent amounts are recalculated before returning details
    await budget.calculateSpentAmount();
    // Debug: Log spent amounts after recalculation
    console.log('[BudgetService] After calculateSpentAmount:', {
      totalSpent: budget.totalSpent,
      categoryAllocations: budget.categoryAllocations.map(a => ({
        category: a.category && a.category.name ? a.category.name : a.category,
        spentAmount: a.spentAmount,
        allocatedAmount: a.allocatedAmount
      }))
    });
    
    try {
      // Get comprehensive performance analysis
      const performance = await budget.getBudgetPerformance();
      
      // Get budget violations and alerts
      const violations = await budget.checkBudgetViolations();
      
      // Get remaining budget breakdown
      const remaining = await budget.getRemainingBudget();

      // Calculate spending trends if requested
      let trends = null;
      if (includeTrends) {
        trends = await this.calculateSpendingTrends(budget);
      }

      // Calculate projections if requested
      let projections = null;
      if (includeProjections) {
        projections = await this.calculateBudgetProjections(budget);
      }

      // Get recent transactions for this budget
      const recentTransactions = await Transaction.find({
        user: userId,
        type: 'expense',
        category: { $in: budget.categoryAllocations.map(alloc => alloc.category._id) },
        date: { $gte: budget.startDate, $lte: budget.endDate },
        status: 'completed',
        isDeleted: { $ne: true }
      })
      .populate('category', 'name color icon')
      .sort({ date: -1 })
      .limit(10)
      .lean();
      
      // Generate recommendations
      const recommendations = await this.generateBudgetRecommendations(budget, performance);

      return {
        budget: budget.toJSON(),
        performance,
        violations,
        remaining,
        recentTransactions,
        recommendations,
        ...(trends && { trends }),
        ...(projections && { projections })
      };
    } catch (error) {
      throw new DatabaseError('Failed to retrieve budget details', error);
    }
  }

  /**
   * Calculate spending trends for a budget
   * @param {Object} budget - Budget object
   * @returns {Object} Spending trends
   */
  static async calculateSpendingTrends(budget) {
    // Create date range for trend analysis
    const startDate = new Date(budget.startDate);
    const endDate = new Date(Math.min(new Date(), budget.endDate));
    const dayRange = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
    // Use aggregate to get spending by day
    const dailySpending = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(budget.user),
          type: 'expense',
          category: { $in: budget.categoryAllocations.map(a => new mongoose.Types.ObjectId(a.category)) },
          date: { $gte: startDate, $lte: endDate },
          status: 'completed',
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            day: { $dayOfMonth: '$date' }
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Format daily data for trend chart
    const dailyData = dailySpending.map(day => ({
      date: `${day._id.year}-${String(day._id.month).padStart(2, '0')}-${String(day._id.day).padStart(2, '0')}`,
      amount: day.totalAmount,
      count: day.count
    }));

    // Get spending by category
    const categorySpending = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(budget.user),
          type: 'expense',
          category: { $in: budget.categoryAllocations.map(a => new mongoose.Types.ObjectId(a.category)) },
          date: { $gte: startDate, $lte: endDate },
          status: 'completed',
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $project: {
          category: { $arrayElemAt: ['$categoryInfo', 0] },
          totalAmount: 1,
          count: 1
        }
      },
      {
        $project: {
          categoryId: '$_id',
          categoryName: '$category.name',
          categoryColor: '$category.color',
          totalAmount: 1,
          count: 1
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    // Calculate averages and projections
    const totalDays = Math.max(1, dayRange);
    const totalSpent = dailySpending.reduce((sum, day) => sum + day.totalAmount, 0);
    const averageDailySpending = totalDays > 0 ? totalSpent / totalDays : 0;
    const daysInBudgetPeriod = Math.ceil((budget.endDate - budget.startDate) / (1000 * 60 * 60 * 24));
    const projectedTotalSpending = averageDailySpending * daysInBudgetPeriod;

    return {
      dailySpending: dailyData,
      categorySpending,
      trends: {
        totalDays,
        totalSpent,
        averageDailySpending,
        projectedTotalSpending,
        projectedVariance: budget.totalAmount - projectedTotalSpending
      }
    };
  }

  /**
   * Calculate budget projections
   * @param {Object} budget - Budget object
   * @returns {Object} Budget projections
   */
  static async calculateBudgetProjections(budget) {
    const today = new Date();
    const startDate = new Date(budget.startDate);
    const endDate = new Date(budget.endDate);
    
    // Skip projections if budget hasn't started yet or has already ended
    if (today < startDate || today > endDate) {
      return {
        canProject: false,
        reason: today < startDate ? 'Budget has not started yet' : 'Budget has already ended'
      };
    }

    // Calculate days elapsed and remaining
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((today - startDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
    const percentComplete = (daysElapsed / totalDays) * 100;

    // Get transactions to date
    const transactions = await Transaction.find({
      user: budget.user,
      type: 'expense',
      category: { $in: budget.categoryAllocations.map(a => a.category) },
      date: { $gte: startDate, $lte: today },
      status: 'completed',
      isDeleted: { $ne: true }
    });

    // Calculate spending metrics
    const totalSpentToDate = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const dailySpendingRate = daysElapsed > 0 ? totalSpentToDate / daysElapsed : 0;
    const projectedAdditionalSpending = dailySpendingRate * daysRemaining;
    const projectedTotalSpending = totalSpentToDate + projectedAdditionalSpending;
    const projectedVariance = budget.totalAmount - projectedTotalSpending;
    const projectedUtilization = (projectedTotalSpending / budget.totalAmount) * 100;

    // Category-specific projections
    const categoryProjections = [];
    
    for (const allocation of budget.categoryAllocations) {
      const categoryTransactions = transactions.filter(tx => 
        tx.category.toString() === allocation.category.toString()
      );
      
      const categorySpent = categoryTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      const categoryDailyRate = daysElapsed > 0 ? categorySpent / daysElapsed : 0;
      const categoryProjectedSpending = categorySpent + (categoryDailyRate * daysRemaining);
      const categoryVariance = allocation.allocatedAmount - categoryProjectedSpending;
      const categoryUtilization = (categoryProjectedSpending / allocation.allocatedAmount) * 100;
      
      categoryProjections.push({
        categoryId: allocation.category,
        spentToDate: categorySpent,
        dailyRate: categoryDailyRate,
        projectedSpending: categoryProjectedSpending,
        allocatedAmount: allocation.allocatedAmount,
        variance: categoryVariance,
        utilization: categoryUtilization,
        status: categoryUtilization > 100 ? 'over-budget' : 
                categoryUtilization > 90 ? 'warning' : 'on-track'
      });
    }

    return {
      canProject: true,
      timeProgress: {
        daysElapsed,
        daysRemaining,
        totalDays,
        percentComplete
      },
      spendingProjections: {
        spentToDate: totalSpentToDate,
        dailySpendingRate,
        projectedAdditionalSpending,
        projectedTotalSpending,
        projectedVariance,
        projectedUtilization,
        status: projectedUtilization > 100 ? 'over-budget' : 
               projectedUtilization > 90 ? 'warning' : 'on-track'
      },
      categoryProjections
    };
  }

  /**
   * Generate budget recommendations
   * @param {Object} budget - Budget object
   * @param {Object} performance - Budget performance metrics
   * @returns {Array} Budget recommendations
   */
  static async generateBudgetRecommendations(budget, performance) {
    const recommendations = [];

    // Check if over budget
    if (performance.budget.utilizationPercentage > 100) {
      recommendations.push({
        type: 'warning',
        category: 'overspending',
        title: 'Budget Exceeded',
        description: `Your budget "${budget.name}" has exceeded its limit by ${(performance.budget.utilizationPercentage - 100).toFixed(1)}%`,
        action: 'Review your spending in high-variance categories or consider increasing your budget allocation'
      });
    }
    
    // Check if almost over budget
    else if (performance.budget.utilizationPercentage > 90) {
      recommendations.push({
        type: 'warning',
        category: 'approaching_limit',
        title: 'Approaching Budget Limit',
        description: `Your budget "${budget.name}" is at ${performance.budget.utilizationPercentage.toFixed(1)}% of its limit`,
        action: 'Monitor your spending closely to avoid exceeding your budget'
      });
    }

    // Check spend rate vs time progress
    if (performance.variance.spendingRateVariance > 20) {
      recommendations.push({
        type: 'warning',
        category: 'high_burn_rate',
        title: 'High Spending Rate',
        description: `You're spending at a rate ${performance.variance.spendingRateVariance.toFixed(1)}% faster than ideal`,
        action: 'Consider reducing your spending rate to stay on track'
      });
    }

    // Check for categories that are over budget
    const overBudgetCategories = performance.categories
      .filter(cat => cat.utilizationPercentage > 100)
      .sort((a, b) => b.utilizationPercentage - a.utilizationPercentage);

    if (overBudgetCategories.length > 0) {
      // Add recommendation for top 3 over-budget categories
      overBudgetCategories.slice(0, 3).forEach(cat => {
        recommendations.push({
          type: 'warning',
          category: 'category_overspend',
          title: 'Category Overspending',
          description: `Category "${cat.name}" has exceeded its budget by ${(cat.utilizationPercentage - 100).toFixed(1)}%`,
          action: 'Review transactions in this category or reallocate funds from under-utilized categories'
        });
      });
    }

    // Check for categories with a lot of remaining budget
    const underUtilizedCategories = performance.categories
      .filter(cat => cat.utilizationPercentage < 50 && performance.period.timeElapsedPercentage > 75)
      .sort((a, b) => a.utilizationPercentage - b.utilizationPercentage);

    if (underUtilizedCategories.length > 0) {
      recommendations.push({
        type: 'suggestion',
        category: 'underutilized_categories',
        title: 'Underutilized Categories',
        description: `You have ${underUtilizedCategories.length} categories with less than 50% utilization`,
        action: 'Consider reallocating funds from these categories to others that need it'
      });
    }

    // Budget optimization suggestion
    if (performance.variance.status === 'under-budget' && performance.period.timeElapsedPercentage > 75) {
      recommendations.push({
        type: 'suggestion',
        category: 'budget_optimization',
        title: 'Budget Optimization',
        description: 'You\'re consistently under budget',
        action: 'Consider optimizing your next budget based on your actual spending patterns'
      });
    }

    return recommendations;
  }

  /**
   * Create a new budget
   * @param {Object} budgetData - Budget data
   * @param {string} userId - User ID
   * @returns {Object} Created budget
   */
  static async createBudget(budgetData, userId) {
    // Log incoming budgetData and userId
    console.log('[BudgetService] createBudget called with:', JSON.stringify(budgetData, null, 2));
    console.log('[BudgetService] userId:', userId);
    const {
      name,
      description,
      totalAmount,
      period,
      startDate,
      endDate,
      categoryAllocations,
      tags = [],
      rolloverEnabled = false,
      autoAdjustAllocations = false,
      alertThreshold = 80,
      templateBudgetId,
      applyPreviousRollover = false
    } = budgetData;

    try {
      // Check for period conflicts
      await this.checkPeriodConflicts(userId, period, new Date(startDate), new Date(endDate));

      // Validate category allocations
      await this.validateCategoryAllocations(userId, categoryAllocations, totalAmount);

      // Create budget from template if specified
      if (templateBudgetId) {
        const newBudget = await Budget.createFromTemplate(templateBudgetId, {
          user: userId,
          name,
          totalAmount,
          period,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          description,
          tags: tags.map(tag => tag.toLowerCase().trim()),
          rolloverEnabled,
          autoAdjustAllocations,
          alertThreshold
        });

        return newBudget;
      }

      // Create new budget
      const budget = new Budget({
        user: userId,
        name: name.trim(),
        totalAmount,
        period,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        categoryAllocations: categoryAllocations.map(alloc => ({
          category: alloc.category,
          allocatedAmount: alloc.allocatedAmount,
          notes: alloc.notes || ''
        })),
        description: description?.trim(),
        tags: tags.map(tag => tag.toLowerCase().trim()),
        rolloverEnabled,
        autoAdjustAllocations,
        alertThreshold
      });

      try {
        await budget.save();
      } catch (err) {
        console.error('[BudgetService] Error during budget.save():', err && err.stack ? err.stack : err);
        if (err && err.errors) {
          Object.keys(err.errors).forEach(key => {
            console.error(`[BudgetService] Validation error for ${key}:`, err.errors[key].message, err.errors[key]);
          });
        }
        // Log the full error object for deep inspection
        console.error('[BudgetService] Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
        throw err;
      }

      // Apply rollover from previous budget if requested
      if (applyPreviousRollover && rolloverEnabled) {
        const previousBudget = await Budget.findOne({
          user: userId,
          period,
          endDate: { $lt: new Date(startDate) },
          isDeleted: { $ne: true }
        }).sort({ endDate: -1 });

        if (previousBudget) {
          await budget.applyRollover(previousBudget._id);
        }
      }

      // Populate and return the created budget
      await budget.populate('categoryAllocations.category', 'name type color icon');

      return budget;
    } catch (error) {
      // Log the error in detail before throwing DatabaseError
      console.error('[BudgetService] Caught error in createBudget:', error && error.stack ? error.stack : error);
      if (error && error.errors) {
        Object.keys(error.errors).forEach(key => {
          console.error(`[BudgetService] Validation error for ${key}:`, error.errors[key].message, error.errors[key]);
        });
      }
      console.error('[BudgetService] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      if (error.code === 11000) {
        throw new ConflictError('A budget for this period already exists');
      }
      throw new DatabaseError('Failed to create budget', error);
    }
  }

  /**
   * Update an existing budget
   * @param {string} budgetId - Budget ID
   * @param {Object} budgetData - Budget data to update
   * @param {string} userId - User ID
   * @returns {Object} Updated budget with change information
   */
  static async updateBudget(budgetId, budgetData, userId) {
    if (!mongoose.Types.ObjectId.isValid(budgetId)) {
      throw new ValidationError('Invalid budget ID format');
    }


    const budget = await Budget.findOne({
      _id: budgetId,
      user: userId,
      isDeleted: { $ne: true }
    });
    if (!budget) {
      // Extra logging if not found
      const foundById = await Budget.findById(budgetId);
      if (foundById) {
        console.error('[BudgetService] Budget found by _id only:', foundById);
        if (foundById.user?.toString() !== userId.toString()) {
          console.error('[BudgetService] User mismatch:', {
            expected: userId,
            actual: foundById.user
          });
        }
        if (foundById.isDeleted) {
          console.error('[BudgetService] Budget is marked as deleted');
        }
      } else {
        console.error('[BudgetService] No budget found with _id:', budgetId);
      }
      throw new NotFoundError('Budget not found');
    }

    const {
      name,
      totalAmount,
      categoryAllocations,
      description,
      tags,
      alertThreshold,
      rolloverEnabled,
      autoAdjustAllocations,
      isActive
    } = budgetData;

    try {
      // Store original state for impact analysis
      const originalBudget = budget.toObject();

      // Update basic fields
      if (name !== undefined) budget.name = name.trim();
      if (description !== undefined) budget.description = description?.trim();
      if (tags !== undefined) budget.tags = tags.map(tag => tag.toLowerCase().trim());
      if (alertThreshold !== undefined) budget.alertThreshold = alertThreshold;
      if (rolloverEnabled !== undefined) budget.rolloverEnabled = rolloverEnabled;
      if (autoAdjustAllocations !== undefined) budget.autoAdjustAllocations = autoAdjustAllocations;
      if (isActive !== undefined) budget.isActive = isActive;

      // Update total amount with validation
      if (totalAmount !== undefined && totalAmount !== budget.totalAmount) {
        if (categoryAllocations) {
          await this.validateCategoryAllocations(userId, categoryAllocations, totalAmount);
        } else {
          // Check if current allocations exceed new total
          const currentTotal = budget.categoryAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
          if (currentTotal > totalAmount) {
            throw new ValidationError('New total amount is less than current category allocations. Please update category allocations first.');
          }
        }
        budget.totalAmount = totalAmount;
      }

      // Update category allocations
      if (categoryAllocations) {
        await this.validateCategoryAllocations(userId, categoryAllocations, budget.totalAmount);
        
        // Calculate impact of allocation changes
        const allocationImpact = this.calculateAllocationImpact(
          originalBudget.categoryAllocations,
          categoryAllocations
        );

        budget.categoryAllocations = categoryAllocations.map(alloc => ({
          category: alloc.categoryId || alloc.category,
          allocatedAmount: alloc.amount !== undefined ? alloc.amount : alloc.allocatedAmount,
          notes: alloc.notes || '',
          spentAmount: 0 // Will be recalculated
        }));

        // Store impact information for response
        budget._allocationImpact = allocationImpact;
      }

      // Recalculate spent amounts before saving
      await budget.calculateSpentAmount();

      try {
        await budget.save();
        console.log('[BudgetService] Budget saved successfully.');
      } catch (saveError) {
        console.error('[BudgetService] Error during budget.save():', saveError);
        throw saveError; // Re-throw to be caught by the outer handler
      }

      // After saving, check if the document was updated and trigger the alert
      if (budget._updated) {
        try {
          // const BudgetAlertService = require('./budgetAlert.service');
          // const budgetAlertServiceInstance = new BudgetAlertService();
          // await budgetAlertServiceInstance.checkAndSendBudgetAlerts(budget.user, budget._id);
          // console.log('[BudgetService] Budget alerts checked and sent successfully.');
          delete budget._updated; // Clean up the flag
        } catch (alertError) {
          console.error('[BudgetService] Error during budgetAlertService.checkAndSendBudgetAlerts:', alertError);
          throw alertError; // Re-throw to be caught by the outer handler
        }
      }
      
      // Populate and prepare response
      await budget.populate('categoryAllocations.category', 'name type color icon');

      const responseData = { 
        budget,
        changes: this.identifyChanges(originalBudget, budget.toObject())
      };

      // Include allocation impact if category allocations were changed
      if (budget._allocationImpact) {
        responseData.allocationImpact = budget._allocationImpact;
        delete budget._allocationImpact;
      }

      return responseData;
    } catch (error) {
      throw new DatabaseError('Failed to update budget', error);
    }
  }

  /**
   * Delete a budget with impact assessment
   * @param {string} budgetId - Budget ID
   * @param {string} userId - User ID
   * @param {boolean} permanent - Whether to permanently delete
   * @returns {Object} Impact assessment
   */
  static async deleteBudget(budgetId, userId, permanent = false) {
    if (!mongoose.Types.ObjectId.isValid(budgetId)) {
      throw new ValidationError('Invalid budget ID format');
    }

    const budget = await Budget.findOne({
      _id: budgetId,
      user: userId,
      isDeleted: { $ne: true }
    });

    if (!budget) {
      throw new NotFoundError('Budget not found');
    }

    try {
      // Assess impact on related transactions
      const transactionCount = await Transaction.countDocuments({
        user: userId,
        type: 'expense',
        category: { $in: budget.categoryAllocations.map(alloc => alloc.category) },
        date: { $gte: budget.startDate, $lte: budget.endDate },
        isDeleted: { $ne: true }
      });

      const impact = {
        transactionsAffected: transactionCount,
        hasTransactions: transactionCount > 0,
        budgetPeriod: `${budget.startDate.toISOString().split('T')[0]} to ${budget.endDate.toISOString().split('T')[0]}`,
        totalAmount: budget.totalAmount,
        totalSpent: budget.totalSpent
      };

      if (permanent) {
        // Permanent deletion
        await Budget.findByIdAndDelete(budgetId);
      } else {
        // Soft deletion
        await budget.softDelete();
      }
      
      return impact;
    } catch (error) {
      throw new DatabaseError('Failed to delete budget', error);
    }
  }

  /**
   * Restore a soft-deleted budget
   * @param {string} budgetId - Budget ID
   * @param {string} userId - User ID
   * @returns {Object} Restored budget
   */
  static async restoreBudget(budgetId, userId) {
    if (!mongoose.Types.ObjectId.isValid(budgetId)) {
      throw new ValidationError('Invalid budget ID format');
    }

    const budget = await Budget.findOne({
      _id: budgetId,
      user: userId,
      isDeleted: true
    });

    if (!budget) {
      throw new NotFoundError('Deleted budget not found');
    }

    try {
      // Check if there's a conflict with current budgets
      const conflictingBudget = await Budget.findOne({
        user: userId,
        period: budget.period,
        startDate: { $lte: budget.endDate },
        endDate: { $gte: budget.startDate },
        isDeleted: { $ne: true }
      });

      if (conflictingBudget) {
        throw new ConflictError('Cannot restore budget: conflicts with an existing active budget', {
          conflictingBudget: {
            id: conflictingBudget._id,
            name: conflictingBudget.name,
            period: `${conflictingBudget.startDate.toISOString().split('T')[0]} to ${conflictingBudget.endDate.toISOString().split('T')[0]}`
          }
        });
      }

      budget.isDeleted = false;
      budget.deletedAt = null;
      await budget.save();

      return budget;
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      throw new DatabaseError('Failed to restore budget', error);
    }
  }

  /**
   * Duplicate an existing budget
   * @param {string} budgetId - Budget ID to duplicate
   * @param {string} userId - User ID
   * @param {Object} newBudgetData - New budget data overrides
   * @returns {Object} Duplicated budget
   */
  static async duplicateBudget(budgetId, userId, newBudgetData) {
    if (!mongoose.Types.ObjectId.isValid(budgetId)) {
      throw new ValidationError('Invalid budget ID format');
    }

    const sourceBudget = await Budget.findOne({
      _id: budgetId,
      user: userId,
      isDeleted: { $ne: true }
    }).populate('categoryAllocations.category', 'name');

    if (!sourceBudget) {
      throw new NotFoundError('Source budget not found');
    }

    const {
      name = `Copy of ${sourceBudget.name}`,
      period = sourceBudget.period,
      startDate,
      endDate,
      totalAmount = sourceBudget.totalAmount,
      adjustAllocations = true,
      copyNotes = true,
      resetSpending = true
    } = newBudgetData;

    // Validate dates
    if (!startDate || !endDate) {
      throw new ValidationError('Start date and end date are required');
    }

    try {
      // Check for period conflicts
      await this.checkPeriodConflicts(userId, period, new Date(startDate), new Date(endDate));

      // Create new budget from source
      const budgetData = {
        user: userId,
        name: name.trim(),
        totalAmount,
        period,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        categoryAllocations: sourceBudget.categoryAllocations.map(alloc => {
          let amount = alloc.allocatedAmount;
          
          // Adjust allocations if needed
          if (adjustAllocations && sourceBudget.totalAmount !== totalAmount) {
            amount = (alloc.allocatedAmount / sourceBudget.totalAmount) * totalAmount;
          }
          
          return {
            category: alloc.category._id,
            allocatedAmount: amount,
            notes: copyNotes ? alloc.notes : '',
            spentAmount: resetSpending ? 0 : alloc.spentAmount
          };
        }),
        description: sourceBudget.description,
        tags: sourceBudget.tags,
        rolloverEnabled: sourceBudget.rolloverEnabled,
        autoAdjustAllocations: sourceBudget.autoAdjustAllocations,
        alertThreshold: sourceBudget.alertThreshold,
        isActive: true
      };

      const newBudget = new Budget(budgetData);
      await newBudget.save();

      // Populate category details
      await newBudget.populate('categoryAllocations.category', 'name type color icon');

      return {
        newBudget,
        source: {
          id: sourceBudget._id,
          name: sourceBudget.name,
          period: `${sourceBudget.startDate.toISOString().split('T')[0]} to ${sourceBudget.endDate.toISOString().split('T')[0]}`
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to duplicate budget', error);
    }
  }

  /**
   * Check for period conflicts with existing budgets
   * @param {string} userId - User ID
   * @param {string} period - Budget period
   * @param {Date} startDate - Budget start date
   * @param {Date} endDate - Budget end date
   */
  static async checkPeriodConflicts(userId, period, startDate, endDate) {
    // Check for overlapping budgets with the same period
    const overlappingBudgets = await Budget.find({
      user: userId,
      period,
      isDeleted: { $ne: true },
      $or: [
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
      ]
    });

    if (overlappingBudgets.length > 0) {
      throw new ConflictError('Budget period overlaps with existing budget(s)', {
        conflictingBudgets: overlappingBudgets.map(b => ({
          id: b._id,
          name: b.name,
          period: `${b.startDate.toISOString().split('T')[0]} to ${b.endDate.toISOString().split('T')[0]}`
        }))
      });
    }
  }

  /**
   * Validate category allocations
   * @param {string} userId - User ID
   * @param {Array} allocations - Category allocations
   * @param {number} totalAmount - Total budget amount
   */
  static async validateCategoryAllocations(userId, allocations, totalAmount) {
    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      throw new ValidationError('At least one category allocation is required');
    }
    // Log all allocations for debugging
    console.log('[validateCategoryAllocations] allocations:', JSON.stringify(allocations, null, 2));
    // Calculate total allocated amount
    const totalAllocated = allocations.reduce((sum, alloc) => sum + (alloc.allocatedAmount || 0), 0);
    // Validate total allocation doesn't exceed budget
    if (totalAllocated > totalAmount) {
      throw new ValidationError(`Total allocated amount (${totalAllocated}) exceeds budget total (${totalAmount})`);
    }
    // Validate individual allocations
    for (const allocation of allocations) {
      if (typeof allocation.allocatedAmount !== 'number' || allocation.allocatedAmount <= 0) {
        throw new ValidationError(`Invalid allocation amount for category ${allocation.category}`);
      }
      // Verify the category exists and belongs to the user
      const category = await Category.findOne({
        _id: new mongoose.Types.ObjectId(allocation.category),
        user: new mongoose.Types.ObjectId(userId),
        isActive: true
      });
      if (!category) {
        throw new ValidationError(`Category not found or not accessible: ${allocation.category}`);
      }
    }
    // Check for duplicate categories
    const categoryIds = allocations.map(a => a.category);
    const uniqueCategoryIds = new Set(categoryIds);
    if (categoryIds.length !== uniqueCategoryIds.size) {
      throw new ValidationError('Duplicate category allocations detected');
    }
  }

  /**
   * Get comprehensive budget analysis
   * @param {string} userId - User ID
   * @param {Object} options - Analysis options
   * @returns {Object} Budget analysis
   */
  static async getBudgetAnalysis(userId, options = {}) {
    const {
      period = 'monthly',
      months = 12,
      includeProjections = true,
      includeComparisons = true
    } = options;

    try {
      // Get user's budget analytics
      const analytics = await Budget.getBudgetAnalytics(userId, { period, months });

      // Get current active budgets
      const activeBudgets = await Budget.findActiveBudgets(userId, { period });

      // Calculate comprehensive analysis
      const analysis = {
        overview: {
          totalBudgets: analytics.reduce((sum, item) => sum + item.budgetCount, 0),
          avgMonthlyBudget: analytics.length > 0 ? 
            analytics.reduce((sum, item) => sum + item.totalBudget, 0) / analytics.length : 0,
          avgMonthlySpending: analytics.length > 0 ? 
            analytics.reduce((sum, item) => sum + item.totalSpent, 0) / analytics.length : 0,
          avgUtilization: analytics.length > 0 ? 
            analytics.reduce((sum, item) => sum + item.avgUtilization, 0) / analytics.length : 0
        },
        trends: analytics.map(item => ({
          period: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
          totalBudget: item.totalBudget,
          totalSpent: item.totalSpent,
          utilization: item.avgUtilization,
          budgetCount: item.budgetCount,
          variance: item.totalBudget - item.totalSpent
        })),
        activeBudgets: activeBudgets.map(budget => ({
          id: budget._id,
          name: budget.name,
          period: budget.period,
          startDate: budget.startDate,
          endDate: budget.endDate,
          totalAmount: budget.totalAmount,
          totalSpent: budget.totalSpent,
          utilizationRate: (budget.totalSpent / budget.totalAmount) * 100,
          daysRemaining: budget.daysRemaining
        }))
      };

      // Calculate spending projections if requested
      if (includeProjections) {
        const projections = await this.calculateSpendingProjections(userId);
        analysis.projections = projections;
      }

      // Calculate period-to-period comparisons if requested
      if (includeComparisons) {
        const comparisons = await this.calculatePeriodComparisons(userId, { period, months });
        analysis.comparisons = comparisons;
      }

      return analysis;
    } catch (error) {
      throw new DatabaseError('Failed to retrieve budget analysis', error);
    }
  }

  /**
   * Calculate spending projections
   * @param {string} userId - User ID
   * @returns {Object} Spending projections
   */
  static async calculateSpendingProjections(userId) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get historical data for the last 6 months
    const sixMonthsAgo = new Date(currentYear, currentMonth - 6, 1);
    
    const transactions = await Transaction.find({
      user: userId,
      date: { $gte: sixMonthsAgo },
      isDeleted: { $ne: true }
    });
    
    // Group transactions by month
    const monthlyData = {};
    
    transactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const month = txDate.getMonth();
      const year = txDate.getFullYear();
      const key = `${year}-${month}`;
      
      if (!monthlyData[key]) {
        monthlyData[key] = {
          income: 0,
          expense: 0,
          savings: 0
        };
      }
      
      if (tx.type === 'income') {
        monthlyData[key].income += tx.amount;
      } else if (tx.type === 'expense') {
        monthlyData[key].expense += tx.amount;
      }
    });
    
    // Calculate monthly savings
    Object.keys(monthlyData).forEach(key => {
      monthlyData[key].savings = monthlyData[key].income - monthlyData[key].expense;
    });
    
    // Calculate averages for projection
    const months = Object.keys(monthlyData);
    const avgIncome = months.length > 0 
      ? months.reduce((sum, key) => sum + monthlyData[key].income, 0) / months.length 
      : 0;
    const avgExpense = months.length > 0 
      ? months.reduce((sum, key) => sum + monthlyData[key].expense, 0) / months.length 
      : 0;
    const avgSavings = avgIncome - avgExpense;
    
    // Project next 6 months
    const projections = [];
    
    for (let i = 1; i <= 6; i++) {
      const projectionDate = new Date(currentYear, currentMonth + i, 1);
      
      projections.push({
        period: `${projectionDate.getFullYear()}-${String(projectionDate.getMonth() + 1).padStart(2, '0')}`,
        projectedIncome: avgIncome,
        projectedExpense: avgExpense,
        projectedSavings: avgSavings,
        projectedSavingsRate: avgIncome > 0 ? (avgSavings / avgIncome) * 100 : 0
      });
    }
    
    return {
      historical: Object.keys(monthlyData).map(key => ({
        period: key,
        income: monthlyData[key].income,
        expense: monthlyData[key].expense,
        savings: monthlyData[key].savings,
        savingsRate: monthlyData[key].income > 0 
          ? (monthlyData[key].savings / monthlyData[key].income) * 100 
          : 0
      })),
      averages: {
        avgIncome,
        avgExpense,
        avgSavings,
        avgSavingsRate: avgIncome > 0 ? (avgSavings / avgIncome) * 100 : 0
      },
      projections
    };
  }

  /**
   * Calculate period-to-period comparisons
   * @param {string} userId - User ID
   * @param {Object} options - Comparison options
   * @returns {Object} Period comparisons
   */
  static async calculatePeriodComparisons(userId, options = {}) {
    const { period = 'monthly', months = 3 } = options;
    const now = new Date();
    
    // Calculate date ranges based on period
    let currentPeriodStart, currentPeriodEnd, previousPeriodStart, previousPeriodEnd;
    
    if (period === 'monthly') {
      currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === 'quarterly') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      currentPeriodStart = new Date(now.getFullYear(), currentQuarter * 3, 1);
      currentPeriodEnd = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
      previousPeriodStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1);
      previousPeriodEnd = new Date(now.getFullYear(), currentQuarter * 3, 0);
    } else if (period === 'yearly') {
      currentPeriodStart = new Date(now.getFullYear(), 0, 1);
      currentPeriodEnd = new Date(now.getFullYear(), 11, 31);
      previousPeriodStart = new Date(now.getFullYear() - 1, 0, 1);
      previousPeriodEnd = new Date(now.getFullYear() - 1, 11, 31);
    }
    
    // Get transactions for both periods
    const currentTransactions = await Transaction.find({
      user: userId,
      date: { $gte: currentPeriodStart, $lte: currentPeriodEnd },
      isDeleted: { $ne: true }
    });
    
    const previousTransactions = await Transaction.find({
      user: userId,
      date: { $gte: previousPeriodStart, $lte: previousPeriodEnd },
      isDeleted: { $ne: true }
    });
    
    // Calculate totals
    const currentTotals = {
      income: currentTransactions
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + tx.amount, 0),
      expense: currentTransactions
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0)
    };
    currentTotals.savings = currentTotals.income - currentTotals.expense;
    
    const previousTotals = {
      income: previousTransactions
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + tx.amount, 0),
      expense: previousTransactions
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + tx.amount, 0)
    };
    previousTotals.savings = previousTotals.income - previousTotals.expense;
    
    // Calculate changes
    const changes = {
      income: currentTotals.income - previousTotals.income,
      expense: currentTotals.expense - previousTotals.expense,
      savings: currentTotals.savings - previousTotals.savings
    };
    
    // Calculate percentage changes
    const percentChanges = {
      income: previousTotals.income !== 0 
        ? (changes.income / previousTotals.income) * 100 
        : null,
      expense: previousTotals.expense !== 0 
        ? (changes.expense / previousTotals.expense) * 100 
        : null,
      savings: previousTotals.savings !== 0 
        ? (changes.savings / previousTotals.savings) * 100 
        : null
    };
    
    return {
      currentPeriod: {
        start: currentPeriodStart,
        end: currentPeriodEnd,
        income: currentTotals.income,
        expense: currentTotals.expense,
        savings: currentTotals.savings,
        savingsRate: currentTotals.income > 0 
          ? (currentTotals.savings / currentTotals.income) * 100 
          : 0
      },
      previousPeriod: {
        start: previousPeriodStart,
        end: previousPeriodEnd,
        income: previousTotals.income,
        expense: previousTotals.expense,
        savings: previousTotals.savings,
        savingsRate: previousTotals.income > 0 
          ? (previousTotals.savings / previousTotals.income) * 100 
          : 0
      },
      changes,
      percentChanges
    };
  }

  /**
   * Update budget alert preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - Alert preferences
   * @returns {Object} Updated preferences
   */
  static async updateBudgetAlertPreferences(userId, preferences) {
    const {
      budgetExceededAlerts,
      budgetWarningAlerts,
      categoryOverspendAlerts,
      monthlyBudgetSummary,
      warningThreshold,
      alertFrequency
    } = preferences;

    // Validate warning threshold
    if (warningThreshold !== undefined && (warningThreshold < 50 || warningThreshold > 100)) {
      throw new ValidationError('Warning threshold must be between 50% and 100%');
    }

    // Validate alert frequency
    if (alertFrequency !== undefined && !['immediate', 'daily', 'weekly'].includes(alertFrequency)) {
      throw new ValidationError('Alert frequency must be one of: immediate, daily, weekly');
    }

    try {
      const User = require('../models/User');
      
      // Update user's email preferences
      const updateData = {
        'emailPreferences.budgetExceededAlerts': budgetExceededAlerts,
        'emailPreferences.budgetWarningAlerts': budgetWarningAlerts,
        'emailPreferences.categoryOverspendAlerts': categoryOverspendAlerts,
        'emailPreferences.monthlyBudgetSummary': monthlyBudgetSummary,
        'emailPreferences.warningThreshold': warningThreshold,
        'emailPreferences.alertFrequency': alertFrequency,
        'emailPreferences.updatedAt': new Date()
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('emailPreferences');

      if (!updatedUser) {
        throw new NotFoundError('User not found');
      }

      return {
        budgetExceededAlerts: updatedUser.emailPreferences?.budgetExceededAlerts,
        budgetWarningAlerts: updatedUser.emailPreferences?.budgetWarningAlerts,
        categoryOverspendAlerts: updatedUser.emailPreferences?.categoryOverspendAlerts,
        monthlyBudgetSummary: updatedUser.emailPreferences?.monthlyBudgetSummary,
        warningThreshold: updatedUser.emailPreferences?.warningThreshold,
        alertFrequency: updatedUser.emailPreferences?.alertFrequency,
        updatedAt: updatedUser.emailPreferences?.updatedAt
      };
    } catch (error) {
      throw new DatabaseError('Failed to update budget alert preferences', error);
    }
  }

  // Stub for calculateAllocationImpact to prevent runtime errors
  static calculateAllocationImpact(originalAllocations, newAllocations) {
    // TODO: Implement actual impact calculation logic
    return {};
  }

  /**
   * Identify changes between original and updated budget
   * @param {Object} original - Original budget
   * @param {Object} updated - Updated budget
   * @returns {Object} Object with changed fields
   */
  static identifyChanges(original, updated) {
    const changes = {};
    // Check basic fields
    const fieldsToCheck = [
      'name', 'description', 'totalAmount', 'period', 'startDate', 'endDate',
      'tags', 'alertThreshold', 'rolloverEnabled', 'autoAdjustAllocations', 'isActive'
    ];
    fieldsToCheck.forEach(field => {
      if (JSON.stringify(updated[field]) !== JSON.stringify(original[field])) {
        changes[field] = {
          from: original[field],
          to: updated[field]
        };
      }
    });
    // Check categoryAllocations (shallow compare)
    if (JSON.stringify(updated.categoryAllocations) !== JSON.stringify(original.categoryAllocations)) {
      changes.categoryAllocations = {
        from: original.categoryAllocations,
        to: updated.categoryAllocations
      };
    }
    return changes;
  }
}

module.exports = BudgetService;
