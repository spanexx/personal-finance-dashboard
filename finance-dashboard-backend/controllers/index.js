/**
 * Controllers Index
 * Exports all controller modules for easy importing
 */

const authController = require('./auth.controller');
const userController = require('./user.controller');
const transactionController = require('./transaction.controller');
const budgetController = require('./budget.controller');
const goalController = require('./goal.controller');
const reportController = require('./report.controller');
const categoryController = require('./category.controller');
const emailVerificationController = require('./emailVerification.controller');
const emailPreferencesController = require('./emailPreferences.controller');
const uploadController = require('./upload.controller');
const exportImportController = require('./exportImport.controller');
const cashflowController = require('./cashflow.controller');

module.exports = {
  authController,
  userController,
  transactionController,
  budgetController,
  goalController,
  reportController,
  categoryController,
  emailVerificationController,
  emailPreferencesController,
  uploadController,
  exportImportController,
  cashflowController,
};

