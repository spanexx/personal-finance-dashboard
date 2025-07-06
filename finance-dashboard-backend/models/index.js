/**
 * Models Index
 * Exports all model modules for easy importing
 */

const User = require('./User');
const Budget = require('./Budget');
const Goal = require('./Goal');
const Category = require('./Category');
const Transaction = require('./Transaction');
const File = require('./File');

module.exports = {
  User,
  Budget,
  Goal,
  Category,
  Transaction,
  File,
};
