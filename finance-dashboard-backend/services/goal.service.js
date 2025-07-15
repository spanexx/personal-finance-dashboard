/**
 * Goal Service
 * Provides business logic for goal-related operations including calculation
 * of progress metrics, timeline projections, and contribution analysis.
 */

const Goal = require('../models/Goal');
const mongoose = require('mongoose');
const { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  AuthorizationError,
  DatabaseError 
} = require('../utils/errorHandler');

class GoalService {
  /**
   * Calculate progress metrics for a goal
   * @param {Object} goal - The goal document
   * @returns {Object} Progress metrics
   */
  static calculateProgressMetrics(goal) {
    const today = new Date();
    const startDate = new Date(goal.startDate);
    const targetDate = new Date(goal.targetDate);
    
    // Basic timeline calculations
    const totalDays = Math.ceil((targetDate - startDate) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.max(0, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(0, Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24)));
    
    // Financial calculations
    const amountRemaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    const progressPercentage = goal.targetAmount > 0 
      ? Math.min(200, (goal.currentAmount / goal.targetAmount) * 100) 
      : 0;
    
    // Timeline progress
    const timelineProgress = totalDays > 0 
      ? Math.min(100, (daysElapsed / totalDays) * 100) 
      : 100;
    
    // Required contributions
    const monthsRemaining = Math.max(daysRemaining / 30, 0.1); // Avoid division by zero
    const requiredMonthlyContribution = amountRemaining > 0 
      ? (amountRemaining / monthsRemaining) 
      : 0;
    
    return {
      amountRemaining,
      progressPercentage,
      daysElapsed,
      daysRemaining,
      timelineProgress,
      requiredMonthlyContribution,
      isAchievable: daysRemaining > 0,
      isBehindSchedule: progressPercentage < timelineProgress
    };
  }

  /**
   * Calculate achievement probability for a goal
   * @param {Object} goal - The goal document
   * @param {Object} metrics - Pre-calculated metrics (optional)
   * @returns {Number} Achievement probability (0-100)
   */
  static calculateAchievementProbability(goal, metrics = null) {
    // Use provided metrics or calculate them
    const {
      progressPercentage,
      timelineProgress,
      requiredMonthlyContribution,
      daysRemaining
    } = metrics || this.calculateProgressMetrics(goal);
    
    // Default to 100% for completed goals or 0% for past-due goals
    if (goal.status === 'completed' || progressPercentage >= 100) {
      return 100;
    }
    
    if (daysRemaining <= 0 && progressPercentage < 100) {
      return 0;
    }
    
    // Base probability calculation
    let probability = 100;
    
    // If behind schedule, reduce probability
    if (progressPercentage < timelineProgress) {
      const progressDeficit = timelineProgress - progressPercentage;
      probability -= progressDeficit * 2; // Each 1% behind reduces probability by 2%
    }
    
    // Consider contribution trend vs required
    const averageMonthlyContribution = goal.averageMonthlyContribution || 0;
    if (requiredMonthlyContribution > 0 && averageMonthlyContribution < requiredMonthlyContribution) {
      const contributionRatio = averageMonthlyContribution / requiredMonthlyContribution;
      probability *= contributionRatio;
    }
    
    // Ensure probability is within 0-100 range
    return Math.min(100, Math.max(0, probability));
  }

  /**
   * Generate milestone checkpoints for a goal
   * @param {Object} goal - The goal document
   * @returns {Array} Milestone checkpoints with achievement status
   */
  static generateMilestoneCheckpoints(goal) {
    const milestones = goal.milestonePercentages?.length 
      ? goal.milestonePercentages 
      : [25, 50, 75, 100]; // Default milestones
    
    return milestones.map(percentage => {
      const milestoneAmount = (percentage / 100) * goal.targetAmount;
      const isAchieved = goal.currentAmount >= milestoneAmount;
      
      // Find the contribution that achieved this milestone
      let achievedDate = null;
      if (isAchieved && goal.contributions.length > 0) {
        let runningTotal = 0;
        // Sort contributions by date (oldest first)
        const sortedContributions = [...goal.contributions].sort((a, b) => 
          new Date(a.date) - new Date(b.date)
        );
        
        // Find when the milestone was reached
        for (const contribution of sortedContributions) {
          runningTotal += contribution.amount;
          if (runningTotal >= milestoneAmount) {
            achievedDate = contribution.date;
            break;
          }
        }
      }
      
      return {
        percentage,
        amount: parseFloat(milestoneAmount.toFixed(2)),
        isAchieved,
        achievedDate
      };
    });
  }

  /**
   * Update goal analytics based on contributions
   * @param {string} goalId - The goal ID
   * @returns {Promise<Object>} Updated goal
   */
  static async updateGoalAnalytics(goalId) {
    const goal = await Goal.findById(goalId);
    
    if (!goal) {
      throw new NotFoundError('Goal not found');
    }
    
    // Calculate current amount from contributions
    const totalContributions = goal.contributions.reduce((sum, contribution) => 
      sum + contribution.amount, 0
    );
    
    // Update current amount
    goal.currentAmount = parseFloat(totalContributions.toFixed(2));
    
    // Calculate progress percentage
    goal.progressPercentage = goal.targetAmount > 0 
      ? Math.min(200, (goal.currentAmount / goal.targetAmount) * 100) 
      : 0;
    
    // Check if goal is completed
    if (goal.progressPercentage >= 100 && goal.status !== 'completed') {
      goal.status = 'completed';
      goal.achievementDate = new Date();
    }
    
    // Calculate overachievement
    goal.overachievementAmount = goal.currentAmount > goal.targetAmount 
      ? goal.currentAmount - goal.targetAmount 
      : 0;
    
    // Calculate average monthly contribution
    if (goal.contributions.length > 0) {
      const today = new Date();
      const startDate = new Date(goal.startDate);
      const monthsActive = Math.max(
        (today - startDate) / (1000 * 60 * 60 * 24 * 30), 
        0.1
      ); // Avoid division by zero
      
      goal.averageMonthlyContribution = goal.currentAmount / monthsActive;
    }
    
    // Calculate achievement probability
    const metrics = this.calculateProgressMetrics(goal);
    goal.achievementProbability = this.calculateAchievementProbability(goal, metrics);
    
    // Estimate completion date
    if (goal.averageMonthlyContribution > 0 && goal.currentAmount < goal.targetAmount) {
      const amountRemaining = goal.targetAmount - goal.currentAmount;
      const monthsToCompletion = amountRemaining / goal.averageMonthlyContribution;
      
      const estimatedDate = new Date();
      estimatedDate.setMonth(estimatedDate.getMonth() + monthsToCompletion);
      goal.estimatedCompletionDate = estimatedDate;
    } else if (goal.status === 'completed') {
      goal.estimatedCompletionDate = goal.achievementDate;
    } else {
      goal.estimatedCompletionDate = goal.targetDate;
    }
    
    // Update last calculated timestamp
    goal.lastCalculated = new Date();
    
    // Save and return updated goal
    await goal.save();
    return goal;
  }



  /**
   * Get all goals with filtering, sorting, and pagination
   * @param {string} userId - User ID
   * @param {Object} queryParams - Query parameters for filtering
   * @returns {Promise<Object>} Goals with pagination data
   */
  static async getGoals(userId, queryParams = {}) {
    const { 
      status, 
      priority, 
      type, 
      startDateFrom, 
      startDateTo, 
      targetDateFrom, 
      targetDateTo,
      minProgress,
      maxProgress,
      minAmount,
      maxAmount,
      sortBy = 'targetDate',
      sortDirection = 'asc',
      page = 1,
      limit = 10,
      search
    } = queryParams;

    // Build filter query
    const filter = { 
      user: userId,
      isDeleted: false
    };

    // Status filtering
    if (status) {
      if (Array.isArray(status)) {
        filter.status = { $in: status };
      } else {
        filter.status = status;
      }
    }

    // Priority filtering
    if (priority) {
      if (Array.isArray(priority)) {
        filter.priority = { $in: priority };
      } else {
        filter.priority = priority;
      }
    }

    // Goal type filtering
    if (type) {
      if (Array.isArray(type)) {
        filter.goalType = { $in: type };
      } else {
        filter.goalType = type;
      }
    }

    // Date range filtering
    if (startDateFrom || startDateTo) {
      filter.startDate = {};
      if (startDateFrom) filter.startDate.$gte = new Date(startDateFrom);
      if (startDateTo) filter.startDate.$lte = new Date(startDateTo);
    }

    if (targetDateFrom || targetDateTo) {
      filter.targetDate = {};
      if (targetDateFrom) filter.targetDate.$gte = new Date(targetDateFrom);
      if (targetDateTo) filter.targetDate.$lte = new Date(targetDateTo);
    }

    // Progress range filtering
    if (minProgress !== undefined || maxProgress !== undefined) {
      filter.progressPercentage = {};
      if (minProgress !== undefined) filter.progressPercentage.$gte = Number(minProgress);
      if (maxProgress !== undefined) filter.progressPercentage.$lte = Number(maxProgress);
    }

    // Amount range filtering
    if (minAmount !== undefined || maxAmount !== undefined) {
      filter.targetAmount = {};
      if (minAmount !== undefined) filter.targetAmount.$gte = Number(minAmount);
      if (maxAmount !== undefined) filter.targetAmount.$lte = Number(maxAmount);
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
      // Set up pagination
      const currentPage = parseInt(page);
      const itemsPerPage = parseInt(limit);
      const skip = (currentPage - 1) * itemsPerPage;

      // Set up sorting
      const sortOptions = {};
      sortOptions[sortBy || 'targetDate'] = sortDirection === 'desc' ? -1 : 1;

      // Get goals with pagination
      const goals = await Goal.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(itemsPerPage)
        .lean();

      // Get total count for pagination
      const totalCount = await Goal.countDocuments(filter);

      // Calculate additional metrics for each goal
      const goalsWithMetrics = goals.map(goal => {
        const metrics = this.calculateProgressMetrics(goal);
        const milestones = this.generateMilestoneCheckpoints(goal);
        
        return {
          ...goal,
          metrics,
          milestones
        };
      });

      // Prepare summary statistics
      const summary = {
        totalGoals: totalCount,
        activeGoals: goalsWithMetrics.filter(g => g.status === 'active').length,
        completedGoals: goalsWithMetrics.filter(g => g.status === 'completed').length,
        totalTargetAmount: goalsWithMetrics.reduce((sum, g) => sum + g.targetAmount, 0),
        totalCurrentAmount: goalsWithMetrics.reduce((sum, g) => sum + g.currentAmount, 0),
      };

      return {
        goals: goalsWithMetrics,
        pagination: {
          page: currentPage,
          limit: itemsPerPage,
          totalItems: totalCount,
          totalPages: Math.ceil(totalCount / itemsPerPage),
          hasNextPage: skip + goals.length < totalCount,
          hasPrevPage: currentPage > 1
        },
        summary
      };
    } catch (error) {
      throw new DatabaseError('Failed to retrieve goals', error);
    }
  }

  /**
   * Get a goal by ID with detailed metrics
   * @param {string} goalId - Goal ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Goal with detailed metrics
   */
  static async getGoalById(goalId, userId) {
    if (!mongoose.Types.ObjectId.isValid(goalId)) {
      throw new ValidationError('Invalid goal ID format');
    }

    const goal = await Goal.findOne({
      _id: goalId,
      user: userId,
      isDeleted: false
    });

    if (!goal) {
      throw new NotFoundError('Goal not found');
    }

    try {
      // Calculate comprehensive metrics
      const metrics = this.calculateProgressMetrics(goal);
      const probability = this.calculateAchievementProbability(goal, metrics);
      const milestones = this.generateMilestoneCheckpoints(goal);

      // Get recent contributions (last 5)
      const recentContributions = goal.contributions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

      // Calculate monthly contribution trends
      const contributionTrends = this.calculateContributionTrends(goal);

      return {
        goal: goal.toObject(),
        metrics,
        probability,
        milestones,
        recentContributions,
        contributionTrends
      };
    } catch (error) {
      throw new DatabaseError('Failed to retrieve goal details', error);
    }
  }

  /**
   * Calculate monthly contribution trends for a goal
   * @param {Object} goal - Goal document
   * @returns {Array} Monthly contribution data
   */
  static calculateContributionTrends(goal) {
    if (!goal.contributions || goal.contributions.length === 0) {
      return [];
    }

    // Group contributions by month
    const monthlyData = {};
    
    goal.contributions.forEach(contribution => {
      const date = new Date(contribution.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          total: 0,
          count: 0
        };
      }
      
      monthlyData[monthKey].total += contribution.amount;
      monthlyData[monthKey].count++;
    });
    
    // Convert to array and sort by month
    return Object.values(monthlyData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(item => ({
        month: item.month,
        totalAmount: item.total,
        contributionCount: item.count,
        averageAmount: item.total / item.count
      }));
  }

  /**
   * Create a new goal
   * @param {Object} goalData - Goal data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created goal
   */
  static async createGoal(goalData, userId) {
    console.log('Creating goal with data:', goalData);
    try {
      // Validate goal data
      this.validateGoalData(goalData);
      
      // Create new goal
      const goal = new Goal({
        user: userId,
        name: goalData.name.trim(),
        description: goalData.description?.trim(),
        targetAmount: goalData.targetAmount,
        currentAmount: goalData.currentAmount || 0,
        startDate: new Date(goalData.startDate),
        targetDate: new Date(goalData.targetDate),
        status: goalData.status || 'active',
        priority: goalData.priority || 'medium',
        goalType: goalData.goalType || 'savings',
        colorTheme: goalData.colorTheme || '#3498db',
        icon: goalData.icon || 'savings',
        tags: goalData.tags?.map(tag => tag.toLowerCase().trim()) || [],
        milestonePercentages: goalData.milestonePercentages || [25, 50, 75, 100],
        autoContributionSettings: goalData.autoContributionSettings || null,
        notificationSettings: goalData.notificationSettings || {
          reminderFrequency: 'weekly',
          milestoneAlerts: true
        },
        notes: goalData.notes?.trim(),
        category: goalData.category // <-- ensure category is saved
      });
      
      // Calculate initial progress percentage
      goal.progressPercentage = goal.targetAmount > 0 
        ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) 
        : 0;
      
      // Add initial contribution if currentAmount > 0
      if (goal.currentAmount > 0) {
        goal.contributions.push({
          amount: goal.currentAmount,
          date: new Date(),
          notes: 'Initial amount',
          method: 'manual'
        });
      }
      
      // Calculate achievement probability and other metrics
      const metrics = this.calculateProgressMetrics(goal);
      goal.achievementProbability = this.calculateAchievementProbability(goal, metrics);
      
      await goal.save();
      return goal;
    } catch (error) {
      console.error('Error creating goal:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to create goal', error);
    }
  }

  /**
   * Validate goal data
   * @param {Object} goalData - Goal data to validate
   * @throws {ValidationError} If validation fails
   */
  static validateGoalData(goalData) {
    const errors = [];
    
    // Required fields
    if (!goalData.name) {
      errors.push('Goal name is required');
    }
    
    if (!goalData.targetAmount || goalData.targetAmount <= 0) {
      errors.push('Target amount must be greater than zero');
    }
    
    if (!goalData.startDate) {
      errors.push('Start date is required');
    }
    
    if (!goalData.targetDate) {
      errors.push('Target date is required');
    }
    
    // Date validation
    if (goalData.startDate && goalData.targetDate) {
      const startDate = new Date(goalData.startDate);
      const targetDate = new Date(goalData.targetDate);
      
      if (startDate >= targetDate) {
        errors.push('Start date must be before target date');
      }
    }
    
    // Status validation
    if (goalData.status && !['active', 'completed', 'paused', 'cancelled'].includes(goalData.status)) {
      errors.push('Invalid status value');
    }
    
    // Priority validation
    if (goalData.priority && !['high', 'medium', 'low'].includes(goalData.priority)) {
      errors.push('Invalid priority value');
    }
    
    // Goal type validation
    if (goalData.goalType && !['savings', 'debt_payoff', 'investment', 'purchase', 'emergency_fund', 'other'].includes(goalData.goalType)) {
      errors.push('Invalid goal type');
    }
    
    // Current amount validation
    if (goalData.currentAmount && goalData.currentAmount < 0) {
      errors.push('Current amount cannot be negative');
    }
    
    if (errors.length > 0) {
      throw new ValidationError('Goal validation failed', errors);
    }
  }

  /**
   * Update a goal
   * @param {string} goalId - Goal ID
   * @param {Object} goalData - Updated goal data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated goal
   */
  static async updateGoal(goalId, goalData, userId) {
    if (!mongoose.Types.ObjectId.isValid(goalId)) {
      throw new ValidationError('Invalid goal ID format');
    }

    const goal = await Goal.findOne({
      _id: goalId,
      user: userId,
      isDeleted: false
    });

    if (!goal) {
      throw new NotFoundError('Goal not found');
    }

    try {
      // Track changes for response
      const originalGoal = goal.toObject();
      
      // Update basic fields
      if (goalData.name !== undefined) goal.name = goalData.name.trim();
      if (goalData.description !== undefined) goal.description = goalData.description?.trim();
      if (goalData.targetAmount !== undefined) {
        // Validate new target amount
        if (goalData.targetAmount <= 0) {
          throw new ValidationError('Target amount must be greater than zero');
        }
        goal.targetAmount = goalData.targetAmount;
      }
      
      // Handle date updates with validation
      if (goalData.startDate || goalData.targetDate) {
        const newStartDate = goalData.startDate ? new Date(goalData.startDate) : goal.startDate;
        const newTargetDate = goalData.targetDate ? new Date(goalData.targetDate) : goal.targetDate;
        
        if (newStartDate >= newTargetDate) {
          throw new ValidationError('Start date must be before target date');
        }
        
        if (goalData.startDate) goal.startDate = newStartDate;
        if (goalData.targetDate) goal.targetDate = newTargetDate;
      }
      
      // Update status
      if (goalData.status !== undefined) {
        if (!['active', 'paused', 'completed', 'abandoned'].includes(goalData.status)) {
          throw new ValidationError('Invalid status value');
        }
        goal.status = goalData.status;
        
        // Handle completion
        if (goalData.status === 'completed' && originalGoal.status !== 'completed') {
          goal.achievementDate = new Date();
        } else if (goalData.status !== 'completed' && originalGoal.status === 'completed') {
          goal.achievementDate = null;
        }
      }
      
      // Update other fields
      if (goalData.priority !== undefined) {
        if (!['high', 'medium', 'low'].includes(goalData.priority)) {
          throw new ValidationError('Invalid priority value');
        }
        goal.priority = goalData.priority;
      }
      
      if (goalData.goalType !== undefined) {
        if (!['savings', 'debt_payment', 'investment', 'purchase', 'emergency_fund', 'education', 'retirement', 'other'].includes(goalData.goalType)) {
          throw new ValidationError('Invalid goal type');
        }
        goal.goalType = goalData.goalType;
      }
      
      if (goalData.colorTheme !== undefined) goal.colorTheme = goalData.colorTheme;
      if (goalData.icon !== undefined) goal.icon = goalData.icon;
      
      if (goalData.tags !== undefined) {
        goal.tags = goalData.tags.map(tag => tag.toLowerCase().trim());
      }
      
      if (goalData.milestonePercentages !== undefined) {
        goal.milestonePercentages = goalData.milestonePercentages;
      }
      
      if (goalData.autoContributionSettings !== undefined) {
        goal.autoContributionSettings = goalData.autoContributionSettings;
      }
      
      if (goalData.notificationSettings !== undefined) {
        goal.notificationSettings = {
          ...goal.notificationSettings,
          ...goalData.notificationSettings
        };
      }
      
      if (goalData.notes !== undefined) goal.notes = goalData.notes?.trim();
      
      // Recalculate metrics
      goal.progressPercentage = goal.targetAmount > 0 
        ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) 
        : 0;
      
      const metrics = this.calculateProgressMetrics(goal);
      goal.achievementProbability = this.calculateAchievementProbability(goal, metrics);
      goal.lastUpdated = new Date();
      
      await goal.save();
      
      // Identify changes for response
      const changes = this.identifyChanges(originalGoal, goal.toObject());
      
      return {
        goal: goal.toObject(),
        changes
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update goal', error);
    }
  }

  /**
   * Identify changes between original and updated goal
   * @param {Object} original - Original goal
   * @param {Object} updated - Updated goal
   * @returns {Object} Object with changed fields
   */
  static identifyChanges(original, updated) {
    const changes = {};
    
    // Check basic fields
    const fieldsToCheck = [
      'name', 'description', 'targetAmount', 'status', 'priority', 
      'goalType', 'colorTheme', 'icon', 'notes'
    ];
    
    fieldsToCheck.forEach(field => {
      if (updated[field] !== original[field]) {
        changes[field] = {
          from: original[field],
          to: updated[field]
        };
      }
    });
    
    // Check dates
    ['startDate', 'targetDate'].forEach(dateField => {
      const originalDate = original[dateField] ? new Date(original[dateField]) : null;
      const updatedDate = updated[dateField] ? new Date(updated[dateField]) : null;
      
      if (originalDate && updatedDate && originalDate.getTime() !== updatedDate.getTime()) {
        changes[dateField] = {
          from: originalDate.toISOString(),
          to: updatedDate.toISOString()
        };
      }
    });
    
    // Check arrays
    if (JSON.stringify(updated.tags) !== JSON.stringify(original.tags)) {
      changes.tags = {
        from: original.tags,
        to: updated.tags
      };
    }
    
    if (JSON.stringify(updated.milestonePercentages) !== JSON.stringify(original.milestonePercentages)) {
      changes.milestonePercentages = {
        from: original.milestonePercentages,
        to: updated.milestonePercentages
      };
    }
    
    // Check nested objects
    if (JSON.stringify(updated.autoContributionSettings) !== JSON.stringify(original.autoContributionSettings)) {
      changes.autoContributionSettings = {
        from: original.autoContributionSettings,
        to: updated.autoContributionSettings
      };
    }
    
    if (JSON.stringify(updated.notificationSettings) !== JSON.stringify(original.notificationSettings)) {
      changes.notificationSettings = {
        from: original.notificationSettings,
        to: updated.notificationSettings
      };
    }
    
    return changes;
  }

  /**
   * Delete a goal (soft or permanent)
   * @param {string} goalId - Goal ID
   * @param {string} userId - User ID
   * @param {boolean} permanent - Whether to permanently delete
   * @returns {Promise<Object>} Deletion result
   */
  static async deleteGoal(goalId, userId, permanent = false) {
    if (!mongoose.Types.ObjectId.isValid(goalId)) {
      throw new ValidationError('Invalid goal ID format');
    }

    const goal = await Goal.findOne({
      _id: goalId,
      user: userId,
      ...(permanent ? {} : { isDeleted: false })
    });

    if (!goal) {
      throw new NotFoundError('Goal not found');
    }

    try {
      if (permanent) {
        // Permanent deletion
        await Goal.deleteOne({ _id: goalId });
        return { 
          message: 'Goal permanently deleted', 
          goalId,
          goalName: goal.name
        };
      } else {
        // Soft deletion
        goal.isDeleted = true;
        goal.deletedAt = new Date();
        await goal.save();
        
        return { 
          message: 'Goal deleted (can be restored within 30 days)', 
          goalId,
          goalName: goal.name,
          deletedAt: goal.deletedAt
        };
      }
    } catch (error) {
      throw new DatabaseError('Failed to delete goal', error);
    }
  }

  /**
   * Add a contribution to a goal
   * @param {string} goalId - Goal ID
   * @param {Object} contributionData - Contribution data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated goal with contribution
   */
  static async addContribution(goalId, contributionData, userId) {
    if (!mongoose.Types.ObjectId.isValid(goalId)) {
      throw new ValidationError('Invalid goal ID format');
    }

    const goal = await Goal.findOne({
      _id: goalId,
      user: userId,
      isDeleted: false
    });

    if (!goal) {
      throw new NotFoundError('Goal not found');
    }

    try {
      // Validate contribution data
      this.validateContributionData(contributionData);
      
      // Create contribution object
      const contribution = {
        _id: new mongoose.Types.ObjectId(),
        amount: contributionData.amount,
        date: new Date(contributionData.date || new Date()),
        notes: contributionData.notes?.trim(),
        method: contributionData.method || 'manual',
        transactionId: contributionData.transactionId
      };
      
      // Add contribution to goal
      goal.contributions.push(contribution);
      
      // Update goal metrics
      await this.updateGoalAnalytics(goalId);
      
      // Get updated goal
      const updatedGoal = await Goal.findById(goalId);
      
      return {
        goal: updatedGoal,
        contribution,
        metrics: this.calculateProgressMetrics(updatedGoal)
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to add contribution', error);
    }
  }

  /**
   * Validate contribution data
   * @param {Object} contributionData - Contribution data to validate
   * @throws {ValidationError} If validation fails
   */
  static validateContributionData(contributionData) {
    const errors = [];
    
    if (!contributionData.amount || contributionData.amount <= 0) {
      errors.push('Contribution amount must be greater than zero');
    }
    
    if (contributionData.date) {
      const contributionDate = new Date(contributionData.date);
      if (isNaN(contributionDate.getTime())) {
        errors.push('Invalid contribution date');
      }
    }
    
    if (contributionData.method && !['manual', 'automatic', 'bank_transfer', 'cash', 'other'].includes(contributionData.method)) {
      errors.push('Invalid contribution method');
    }
    
    if (errors.length > 0) {
      throw new ValidationError('Contribution validation failed', errors);
    }
  }

  /**
   * Update a contribution
   * @param {string} goalId - Goal ID
   * @param {string} contributionId - Contribution ID
   * @param {Object} contributionData - Updated contribution data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated goal with contribution
   */
  static async updateContribution(goalId, contributionId, contributionData, userId) {
    if (!mongoose.Types.ObjectId.isValid(goalId) || !mongoose.Types.ObjectId.isValid(contributionId)) {
      throw new ValidationError('Invalid ID format');
    }

    const goal = await Goal.findOne({
      _id: goalId,
      user: userId,
      isDeleted: false
    });

    if (!goal) {
      throw new NotFoundError('Goal not found');
    }

    // Find contribution in goal
    const contributionIndex = goal.contributions.findIndex(
      c => c._id.toString() === contributionId
    );

    if (contributionIndex === -1) {
      throw new NotFoundError('Contribution not found');
    }

    try {
      // Validate updated contribution data
      this.validateContributionData(contributionData);
      
      // Store original contribution for response
      const originalContribution = { ...goal.contributions[contributionIndex].toObject() };
      
      // Update contribution fields
      if (contributionData.amount !== undefined) {
        goal.contributions[contributionIndex].amount = contributionData.amount;
      }
      
      if (contributionData.date !== undefined) {
        goal.contributions[contributionIndex].date = new Date(contributionData.date);
      }
      
      if (contributionData.notes !== undefined) {
        goal.contributions[contributionIndex].notes = contributionData.notes.trim();
      }
      
      if (contributionData.method !== undefined) {
        goal.contributions[contributionIndex].method = contributionData.method;
      }
      
      // Update goal metrics
      await this.updateGoalAnalytics(goalId);
      
      // Get updated goal
      const updatedGoal = await Goal.findById(goalId);
      
      // Get updated contribution
      const updatedContribution = updatedGoal.contributions.find(
        c => c._id.toString() === contributionId
      );
      
      return {
        goal: updatedGoal,
        contribution: updatedContribution,
        changes: this.identifyContributionChanges(originalContribution, updatedContribution.toObject()),
        metrics: this.calculateProgressMetrics(updatedGoal)
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update contribution', error);
    }
  }

  /**
   * Identify changes between original and updated contribution
   * @param {Object} original - Original contribution
   * @param {Object} updated - Updated contribution
   * @returns {Object} Object with changed fields
   */
  static identifyContributionChanges(original, updated) {
    const changes = {};
    
    // Check basic fields
    const fieldsToCheck = ['amount', 'notes', 'method'];
    
    fieldsToCheck.forEach(field => {
      if (updated[field] !== original[field]) {
        changes[field] = {
          from: original[field],
          to: updated[field]
        };
      }
    });
    
    // Check date
    const originalDate = original.date ? new Date(original.date) : null;
    const updatedDate = updated.date ? new Date(updated.date) : null;
    
    if (originalDate && updatedDate && originalDate.getTime() !== updatedDate.getTime()) {
      changes.date = {
        from: originalDate.toISOString(),
        to: updatedDate.toISOString()
      };
    }
    
    return changes;
  }

  /**
   * Delete a contribution
   * @param {string} goalId - Goal ID
   * @param {string} contributionId - Contribution ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated goal without contribution
   */
  static async deleteContribution(goalId, contributionId, userId) {
    if (!mongoose.Types.ObjectId.isValid(goalId) || !mongoose.Types.ObjectId.isValid(contributionId)) {
      throw new ValidationError('Invalid ID format');
    }

    const goal = await Goal.findOne({
      _id: goalId,
      user: userId,
      isDeleted: false
    });

    if (!goal) {
      throw new NotFoundError('Goal not found');
    }

    // Find contribution in goal
    const contributionIndex = goal.contributions.findIndex(
      c => c._id.toString() === contributionId
    );

    if (contributionIndex === -1) {
      throw new NotFoundError('Contribution not found');
    }

    try {
      // Store deleted contribution for response
      const deletedContribution = { ...goal.contributions[contributionIndex].toObject() };
      
      // Remove contribution
      goal.contributions.splice(contributionIndex, 1);
      
      // Update goal metrics
      await this.updateGoalAnalytics(goalId);
      
      // Get updated goal
      const updatedGoal = await Goal.findById(goalId);
      
      return {
        goal: updatedGoal,
        deletedContribution,
        metrics: this.calculateProgressMetrics(updatedGoal)
      };
    } catch (error) {
      throw new DatabaseError('Failed to delete contribution', error);
    }
  }

  /**
   * Get contributions for a goal with filtering and pagination
   * @param {string} goalId - Goal ID
   * @param {string} userId - User ID
   * @param {Object} queryParams - Query parameters for filtering
   * @returns {Promise<Object>} Contributions with pagination
   */
  static async getContributions(goalId, userId, queryParams = {}) {
    if (!mongoose.Types.ObjectId.isValid(goalId)) {
      throw new ValidationError('Invalid goal ID format');
    }

    const goal = await Goal.findOne({
      _id: goalId,
      user: userId,
      isDeleted: false
    });

    if (!goal) {
      throw new NotFoundError('Goal not found');
    }

    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'date',
        sortDirection = 'desc',
        fromDate,
        toDate,
        minAmount,
        maxAmount,
        method
      } = queryParams;

      // Filter contributions
      let contributions = [...goal.contributions];
      
      // Filter by date range
      if (fromDate || toDate) {
        contributions = contributions.filter(contribution => {
          const contributionDate = new Date(contribution.date);
          
          if (fromDate && toDate) {
            return contributionDate >= new Date(fromDate) && contributionDate <= new Date(toDate);
          } else if (fromDate) {
            return contributionDate >= new Date(fromDate);
          } else if (toDate) {
            return contributionDate <= new Date(toDate);
          }
          
          return true;
        });
      }
      
      // Filter by amount range
      if (minAmount !== undefined || maxAmount !== undefined) {
        contributions = contributions.filter(contribution => {
          if (minAmount !== undefined && maxAmount !== undefined) {
            return contribution.amount >= Number(minAmount) && contribution.amount <= Number(maxAmount);
          } else if (minAmount !== undefined) {
            return contribution.amount >= Number(minAmount);
          } else if (maxAmount !== undefined) {
            return contribution.amount <= Number(maxAmount);
          }
          
          return true;
        });
      }
      
      // Filter by method
      if (method) {
        if (Array.isArray(method)) {
          contributions = contributions.filter(c => method.includes(c.method));
        } else {
          contributions = contributions.filter(c => c.method === method);
        }
      }
      
      // Sort contributions
      contributions.sort((a, b) => {
        if (sortBy === 'date') {
          return sortDirection === 'desc' 
            ? new Date(b.date) - new Date(a.date)
            : new Date(a.date) - new Date(b.date);
        } else if (sortBy === 'amount') {
          return sortDirection === 'desc'
            ? b.amount - a.amount
            : a.amount - b.amount;
        }
        
        return 0;
      });
      
      // Apply pagination
      const totalCount = contributions.length;
      const currentPage = parseInt(page);
      const itemsPerPage = parseInt(limit);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      
      const paginatedContributions = contributions.slice(startIndex, endIndex);
      
      return {
        contributions: paginatedContributions,
        pagination: {
          page: currentPage,
          limit: itemsPerPage,
          totalItems: totalCount,
          totalPages: Math.ceil(totalCount / itemsPerPage),
          hasNextPage: endIndex < totalCount,
          hasPrevPage: currentPage > 1
        },
        summary: {
          totalContributions: totalCount,
          totalAmount: contributions.reduce((sum, c) => sum + c.amount, 0),
          averageAmount: totalCount > 0 
            ? contributions.reduce((sum, c) => sum + c.amount, 0) / totalCount
            : 0,
          firstContribution: totalCount > 0 
            ? new Date(Math.min(...contributions.map(c => new Date(c.date))))
            : null,
          lastContribution: totalCount > 0
            ? new Date(Math.max(...contributions.map(c => new Date(c.date))))
            : null
        }
      };
    } catch (error) {
      throw new DatabaseError('Failed to retrieve contributions', error);
    }
  }
}

module.exports = GoalService;
