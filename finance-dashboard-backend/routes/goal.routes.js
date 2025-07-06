const express = require('express');
const router = express.Router();
const goalController = require('../controllers/goal.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const ValidationMiddleware = require('../middleware/validation.middleware');
const logger = require('../utils/logger');
const { param, check } = require('express-validator');

// Apply authentication middleware to all goal routes
router.use(verifyToken);

// Custom validation middleware for goal contributions
const validateContribution = () => [
  check('amount', 'Contribution amount is required and must be a positive number')
    .isFloat({ min: 0.01 })
    .custom(value => {
      // Validate decimal precision (max 2 decimal places)
      return /^\d+(\.\d{1,2})?$/.test(value.toString());
    })
    .withMessage('Amount must have maximum 2 decimal places'),
  check('date', 'Date must be a valid date')
    .optional()
    .isISO8601()
    .toDate()
    .custom(value => value <= new Date())
    .withMessage('Contribution date cannot be in the future'),
  check('notes', 'Notes cannot exceed 500 characters')
    .optional()
    .isString()
    .isLength({ max: 500 }),
  check('method', 'Method must be one of: manual, automatic, transfer, external')
    .optional()
    .isIn(['manual', 'automatic', 'transfer', 'external']),
  check('source', 'Source cannot exceed 100 characters')
    .optional()
    .isString()
    .isLength({ max: 100 }),
  ValidationMiddleware.handleValidationErrors
];

// Apply authentication middleware to all goal routes
router.use(verifyToken);

/**
 * @route   GET /api/goals
 * @desc    Get all goals for the current user with filtering options
 * @access  Private
 */
router.get('/', 
  ValidationMiddleware.validatePagination(),
  ValidationMiddleware.validateSorting(),
  goalController.getGoals
);

/**
 * @route   GET /api/goals/:id
 * @desc    Get a single goal by ID with detailed analysis
 * @access  Private
 */
router.get('/:id', 
  ValidationMiddleware.validateGoalId(),
  goalController.getGoalById
);

/**
 * @route   POST /api/goals
 * @desc    Create a new goal
 * @access  Private
 */
router.post('/', 
  ValidationMiddleware.validateGoal(),
  goalController.createGoal
);

/**
 * @route   PUT /api/goals/:id
 * @desc    Update an existing goal
 * @access  Private
 */
router.put('/:id', 
  ValidationMiddleware.validateGoalId(),
  ValidationMiddleware.validateGoal(),
  goalController.updateGoal
);

/**
 * @route   DELETE /api/goals/:id
 * @desc    Soft delete a goal
 * @access  Private
 */
router.delete('/:id', 
  ValidationMiddleware.validateGoalId(),
  goalController.deleteGoal
);

/**
 * @route   POST /api/goals/:id/contributions
 * @desc    Add a contribution to a goal
 * @access  Private
 */
router.post('/:id/contributions', 
  ValidationMiddleware.validateGoalId(),
  validateContribution(),
  goalController.addContribution
);

/**
 * @route   PUT /api/goals/:id/contributions/:contributionId
 * @desc    Update an existing contribution
 * @access  Private
 */
router.put('/:id/contributions/:contributionId', 
  ValidationMiddleware.validateGoalId(),
  [
    param('contributionId', 'Invalid contribution ID').isMongoId(),
    ...validateContribution().slice(0, -1), // Remove the last item which is handleValidationErrors
    ValidationMiddleware.handleValidationErrors
  ],
  goalController.updateContribution
);

/**
 * @route   DELETE /api/goals/:id/contributions/:contributionId
 * @desc    Delete a contribution
 * @access  Private
 */
router.delete('/:id/contributions/:contributionId', 
  ValidationMiddleware.validateGoalId(),
  [
    param('contributionId', 'Invalid contribution ID').isMongoId(),
    ValidationMiddleware.handleValidationErrors
  ],
  goalController.deleteContribution
);

/**
 * @route   GET /api/goals/:id/contributions
 * @desc    Get all contributions for a goal with pagination and sorting
 * @access  Private
 */
router.get('/:id/contributions', 
  ValidationMiddleware.validateGoalId(),
  ValidationMiddleware.validatePagination(),
  ValidationMiddleware.validateSorting(),
  goalController.getContributions
);

module.exports = router;
