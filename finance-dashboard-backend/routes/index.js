/**
 * Routes Index
 * Exports all route modules for easy importing
 */

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const categoryRoutes = require('./category.routes');
const transactionRoutes = require('./transaction.routes');
const budgetRoutes = require('./budget.routes');
const goalRoutes = require('./goal.routes');
const reportRoutes = require('./report.routes');
const emailPreferencesRoutes = require('./emailPreferences.routes');
const emailVerificationRoutes = require('./emailVerification.routes');
const uploadRoutes = require('./upload.routes');
const exportImportRoutes = require('./exportImport.routes');

module.exports = {
  authRoutes,
  userRoutes,
  categoryRoutes,
  transactionRoutes,
  budgetRoutes,
  goalRoutes,
  reportRoutes,
  emailPreferencesRoutes,
  emailVerificationRoutes,
  uploadRoutes,
  exportImportRoutes,
};
