/**
 * Goal Management Controller
 * Handles all goal-related operations including CRUD, contribution management,
 * progress tracking, and timeline projections.
 */

const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const ApiResponse = require('../utils/apiResponse');
const { 
  ErrorHandler, 
  ValidationError, 
  AuthorizationError, 
  NotFoundError,
  ConflictError,
  DatabaseError 
} = require('../utils/errorHandler');
const GoalService = require('../services/goal.service');

/**
 * Get all goals for the current user with filtering options
 * @route GET /api/goals
 * @access Private
 */
exports.getGoals = ErrorHandler.asyncHandler(async (req, res) => {
  logger.debug('Fetching goals with filters', { userId: req.user.id, filters: req.query });

  // Use service to get goals with filtering, sorting, and pagination
  const result = await GoalService.getGoals(req.user.id, req.query);
  
  logger.info(`Retrieved ${result.goals.length} goals for user ${req.user.id}`);

  // Return paginated response
  return ApiResponse.paginated(
    res,
    result.goals,
    result.pagination,
    'Goals retrieved successfully'
  );
});

/**
 * Get a single goal by ID with detailed analysis
 * @route GET /api/goals/:id
 * @access Private
 */
exports.getGoalById = ErrorHandler.asyncHandler(async (req, res) => {
  const goalId = req.params.id;
  
  logger.debug('Fetching goal details', { goalId, userId: req.user.id });

  // Use service to get goal with detailed metrics
  const result = await GoalService.getGoalById(goalId, req.user.id);
  
  logger.info(`Retrieved goal details for ${goalId}`);
  
  return ApiResponse.success(res, result, 'Goal retrieved successfully');
});

/**
 * Create a new goal
 * @route POST /api/goals
 * @access Private
 */
exports.createGoal = ErrorHandler.asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Goal validation failed', { errors: errors.array() });
    throw new ValidationError('Validation errors', errors.array());
  }

  logger.debug('Creating new goal', { userId: req.user.id });
  console.log('Request Body:', req.body);
  
  // Use service to create goal
  const goal = await GoalService.createGoal(req.body, req.user.id);
  console.log('req  body:', goal);

  logger.info('New goal created', { goalId: goal._id, userId: req.user.id });
  
  // Calculate feasibility analysis
  const totalDays = Math.ceil((new Date(goal.targetDate) - new Date(goal.startDate)) / (1000 * 60 * 60 * 24));
  const monthsToTarget = totalDays / 30;
  const requiredMonthlyContribution = goal.targetAmount / monthsToTarget;
  
  const responseData = {
    goal,
    feasibilityAnalysis: {
      totalDays,
      monthsToTarget: parseFloat(monthsToTarget.toFixed(1)),
      requiredMonthlyContribution: parseFloat(requiredMonthlyContribution.toFixed(2)),
      achievementProbability: goal.achievementProbability
    }
  };
  console.log('Response Data:', responseData);

  // Send notification to user via WebSocket
  const socketService = require('../services/socket.service');
  if (socketService && typeof socketService.emitToUser === 'function') {
    socketService.emitToUser(
      req.user.id,
      'goal:created',
      {
        message: `Your goal '${goal.name}' was created.`,
        goalId: goal._id,
        timestamp: new Date().toISOString()
      }
    );
  }

  return ApiResponse.created(res, responseData, 'Goal created successfully');
});

/**
 * Update an existing goal
 * @route PUT /api/goals/:id
 * @access Private
 */
exports.updateGoal = ErrorHandler.asyncHandler(async (req, res) => {
  const goalId = req.params.id;
  
  logger.debug('Updating goal', { goalId, userId: req.user.id });
  
  // Use service to update goal
  const result = await GoalService.updateGoal(goalId, req.body, req.user.id);
  
  logger.info('Goal updated successfully', { goalId, userId: req.user.id });
  
  // Prepare impact analysis based on changes
  const impactAnalysis = {};
  
  // Check date changes
  if (result.changes.targetDate || result.changes.startDate) {
    const metrics = GoalService.calculateProgressMetrics(result.goal);
    impactAnalysis.timeline = {
      daysRemaining: metrics.daysRemaining,
      monthsRemaining: parseFloat((metrics.daysRemaining / 30).toFixed(1)),
      requiredMonthlyContribution: parseFloat(metrics.requiredMonthlyContribution.toFixed(2))
    };
  }
  
  // Check amount changes
  if (result.changes.targetAmount || result.changes.currentAmount) {
    impactAnalysis.progress = {
      newProgressPercentage: parseFloat(result.goal.progressPercentage.toFixed(2)),
      amountRemaining: parseFloat((result.goal.targetAmount - result.goal.currentAmount).toFixed(2))
    };
  }
  
  const responseData = {
    goal: result.goal,
    impactAnalysis: Object.keys(impactAnalysis).length > 0 ? impactAnalysis : undefined,
    changes: result.changes
  };

  // Send notification to user via WebSocket
  const socketService = require('../services/socket.service');
  if (socketService && typeof socketService.emitToUser === 'function') {
    socketService.emitToUser(
      req.user.id,
      'goal:updated',
      {
        message: `Your goal '${result.goal.name}' was updated.`,
        goalId: result.goal._id,
        timestamp: new Date().toISOString()
      }
    );
  }

  return ApiResponse.success(res, responseData, 'Goal updated successfully');
});

/**
 * Delete a goal (soft delete)
 * @route DELETE /api/goals/:id
 * @access Private
 */
exports.deleteGoal = ErrorHandler.asyncHandler(async (req, res) => {
  const goalId = req.params.id;
  
  logger.debug('Attempting to delete goal', { goalId, userId: req.user.id });
  
  // Use service to delete goal (soft delete by default)
  const result = await GoalService.deleteGoal(goalId, req.user.id);
  
  logger.info('Goal deleted successfully', { goalId, userId: req.user.id });
  
  const responseData = {
    goalId: result.goalId,
    name: result.goalName,
    deletedAt: result.deletedAt
  };

  // Send notification to user via WebSocket
  const socketService = require('../services/socket.service');
  if (socketService && typeof socketService.emitToUser === 'function') {
    socketService.emitToUser(
      req.user.id,
      'goal:deleted',
      {
        message: `Your goal '${result.goalName}' was deleted.`,
        goalId: result.goalId,
        timestamp: new Date().toISOString()
      }
    );
  }

  return ApiResponse.success(res, responseData, 'Goal deleted successfully');
});

/**
 * Add a contribution to a goal
 * @route POST /api/goals/:id/contributions
 * @access Private
 */
exports.addContribution = ErrorHandler.asyncHandler(async (req, res) => {
  const goalId = req.params.id;
  
  // Validate request body
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Contribution validation failed', { errors: errors.array() });
    throw new ValidationError('Validation error', errors.array());
  }
  
  logger.debug('Adding contribution to goal', { 
    goalId, 
    amount: req.body.amount, 
    userId: req.user.id 
  });
  
  // Use service to add contribution
  const result = await GoalService.addContribution(goalId, req.body, req.user.id);
  
  // Check if goal is now completed
  const goalCompleted = result.goal.status === 'completed';
  
  logger.info('Contribution added to goal', { 
    goalId, 
    contributionAmount: req.body.amount, 
    goalCompleted,
    userId: req.user.id 
  });
  
  // Prepare response data
  const responseData = {
    goal: {
      id: result.goal._id,
      name: result.goal.name,
      currentAmount: result.goal.currentAmount,
      targetAmount: result.goal.targetAmount,
      progressPercentage: result.goal.progressPercentage,
      status: result.goal.status
    },
    contribution: result.contribution,
    goalCompleted
  };

  const message = goalCompleted 
    ? 'Contribution added and goal completed! Congratulations!' 
    : 'Contribution added successfully';
  
  return ApiResponse.success(res, responseData, message);
});

/**
 * Update a contribution
 * @route PUT /api/goals/:id/contributions/:contributionId
 * @access Private
 */
exports.updateContribution = ErrorHandler.asyncHandler(async (req, res) => {
  const { id: goalId, contributionId } = req.params;
  
  logger.debug('Updating contribution', { goalId, contributionId, userId: req.user.id });
  
  // Use service to update contribution
  const result = await GoalService.updateContribution(goalId, contributionId, req.body, req.user.id);
  
  logger.info('Contribution updated', { 
    goalId, 
    contributionId, 
    amountDifference: result.amountDifference,
    userId: req.user.id
  });
  
  const responseData = {
    goal: {
      id: result.goal._id,
      name: result.goal.name,
      currentAmount: result.goal.currentAmount,
      targetAmount: result.goal.targetAmount,
      progressPercentage: result.goal.progressPercentage,
      status: result.goal.status
    },
    contribution: result.contribution,
    amountDifference: result.amountDifference
  };
  
  return ApiResponse.success(res, responseData, 'Contribution updated successfully');
});

/**
 * Delete a contribution
 * @route DELETE /api/goals/:id/contributions/:contributionId
 * @access Private
 */
exports.deleteContribution = ErrorHandler.asyncHandler(async (req, res) => {
  const { id: goalId, contributionId } = req.params;
  
  logger.debug('Deleting contribution', { goalId, contributionId, userId: req.user.id });
  
  // Use service to delete contribution
  const result = await GoalService.deleteContribution(goalId, contributionId, req.user.id);
  
  logger.info('Contribution deleted', { 
    goalId, 
    contributionId, 
    amountAdjustment: result.amountAdjustment,
    userId: req.user.id
  });
  
  const responseData = {
    goal: {
      id: result.goal._id,
      name: result.goal.name,
      currentAmount: result.goal.currentAmount,
      targetAmount: result.goal.targetAmount,
      progressPercentage: result.goal.progressPercentage,
      status: result.goal.status
    },
    deletedContribution: result.deletedContribution,
    amountAdjustment: result.amountAdjustment
  };
  
  return ApiResponse.success(res, responseData, 'Contribution deleted successfully');
});

/**
 * Get all contributions for a goal
 * @route GET /api/goals/:id/contributions
 * @access Private
 */
exports.getContributions = ErrorHandler.asyncHandler(async (req, res) => {
  const goalId = req.params.id;
  
  logger.debug('Fetching contributions for goal', { goalId, userId: req.user.id });
  
  // Use service to get contributions with filtering and pagination
  const result = await GoalService.getContributions(goalId, req.user.id, req.query);
  
  logger.info(`Retrieved ${result.contributions.length} contributions for goal ${goalId}`);
  
  const responseData = {
    goal: result.goal,
    contributions: result.contributions,
    pagination: result.pagination,
    summary: result.summary
  };
  
  return ApiResponse.success(res, responseData, 'Goal contributions retrieved successfully');
});
