/**
 * Services Index
 * Exports all service modules for easy importing
 */

const authService = require('./auth.service');
const transactionService = require('./transaction.service');
const budgetService = require('./budget.service');
const goalService = require('./goal.service');
const reportService = require('./report.service');
const BudgetAlertService = require('./budgetAlert.service');
const emailService = require('./email.service');
const emailQueueService = require('./emailQueue.service');
const schedulerService = require('./scheduler.service');
const securityMonitorService = require('./securityMonitor.service');
const passwordService = require('./password.service');
const userService = require('./user.service');
const categoryService = require('./category.service');
const emailVerificationService = require('./emailVerification.service');
const emailPreferencesService = require('./emailPreferences.service');
const transactionAttachmentService = require('./transactionAttachment.service');
const transactionImportService = require('./transactionImport.service');
const exportService = require('./export.service');
const importService = require('./import.service');
const cleanupService = require('./exportCleanup.service');
const GoalReminderService = require('./goalReminder.service');
const fileService = require('./file.service');
const socketService = require('./socket.service');
const socketEventsService = require('./socketEvents.service');

module.exports = {
  authService,
  transactionService,
  budgetService,
  goalService,
  reportService,
  budgetAlertService: new BudgetAlertService(),
  emailService,
  emailQueueService,
  schedulerService,
  securityMonitorService,
  passwordService,
  userService,
  categoryService,
  emailVerificationService,
  emailPreferencesService,
  transactionAttachmentService,
  transactionImportService,  exportService,
  importService,
  cleanupService,
  goalReminderService: new GoalReminderService(),
  fileService,
  socketService,
  socketEventsService,
};
