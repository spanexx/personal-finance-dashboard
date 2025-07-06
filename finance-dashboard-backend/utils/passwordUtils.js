/**
 * Password Utilities
 * Helper functions for password strength meter and validation
 */

/**
 * Calculate password strength score based on various criteria
 * @param {string} password - Password to evaluate
 * @returns {Object} - Score and analysis details
 */
function calculatePasswordStrength(password) {
  let score = 0;
  const analysis = {
    length: false,
    uppercase: false,
    lowercase: false,
    numbers: false,
    symbols: false,
    commonPassword: false,
    repetitive: false,
    sequential: false
  };

  // Length criteria (0-3 points)
  if (password.length >= 8) {
    score += 1;
    analysis.length = true;
  }
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Character variety (1 point each)
  if (/[a-z]/.test(password)) {
    score += 1;
    analysis.lowercase = true;
  }
  if (/[A-Z]/.test(password)) {
    score += 1;
    analysis.uppercase = true;
  }
  if (/\d/.test(password)) {
    score += 1;
    analysis.numbers = true;
  }
  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1;
    analysis.symbols = true;
  }

  // Penalty for repetitive patterns
  if (/(.)\1{2,}/.test(password)) {
    score -= 1;
    analysis.repetitive = true;
  }

  // Penalty for sequential patterns
  const sequential = ['123', '234', '345', '456', '567', '678', '789', '890',
                     'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij', 'ijk'];
  if (sequential.some(seq => password.toLowerCase().includes(seq))) {
    score -= 1;
    analysis.sequential = true;
  }

  // Ensure minimum score is 0
  score = Math.max(0, score);

  return {
    score,
    maxScore: 9,
    analysis
  };
}

/**
 * Get password strength level based on score
 * @param {number} score - Password strength score
 * @param {number} maxScore - Maximum possible score
 * @returns {string} - Strength level
 */
function getPasswordStrengthLevel(score, maxScore = 9) {
  const percentage = (score / maxScore) * 100;
  
  if (percentage < 30) return 'Very Weak';
  if (percentage < 50) return 'Weak';
  if (percentage < 70) return 'Medium';
  if (percentage < 85) return 'Strong';
  return 'Very Strong';
}

/**
 * Get color for password strength level
 * @param {string} strength - Strength level
 * @returns {string} - Color code
 */
function getPasswordStrengthColor(strength) {
  const colors = {
    'Very Weak': '#dc3545',   // Bootstrap danger
    'Weak': '#fd7e14',        // Bootstrap warning
    'Medium': '#ffc107',      // Bootstrap warning
    'Strong': '#20c997',      // Bootstrap info
    'Very Strong': '#28a745'  // Bootstrap success
  };
  
  return colors[strength] || '#dc3545';
}

/**
 * Generate password strength suggestions
 * @param {Object} analysis - Password analysis results
 * @param {string} password - The password
 * @returns {Array} - Array of suggestions
 */
function generatePasswordSuggestions(analysis, password) {
  const suggestions = [];

  if (!analysis.length || password.length < 12) {
    suggestions.push('Use at least 12 characters for better security');
  }

  if (!analysis.uppercase) {
    suggestions.push('Add uppercase letters (A-Z)');
  }

  if (!analysis.lowercase) {
    suggestions.push('Add lowercase letters (a-z)');
  }

  if (!analysis.numbers) {
    suggestions.push('Add numbers (0-9)');
  }

  if (!analysis.symbols) {
    suggestions.push('Add special characters (!@#$%^&*)');
  }

  if (analysis.repetitive) {
    suggestions.push('Avoid repeating characters');
  }

  if (analysis.sequential) {
    suggestions.push('Avoid sequential patterns like "123" or "abc"');
  }

  if (suggestions.length === 0) {
    suggestions.push('Your password meets all security requirements');
  }

  return suggestions;
}

/**
 * Generate a secure random password
 * @param {number} length - Password length (default: 16)
 * @param {Object} options - Generation options
 * @returns {string} - Generated password
 */
function generateSecurePassword(length = 16, options = {}) {
  const defaults = {
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeSimilar: true, // Exclude similar looking characters
    excludeAmbiguous: true // Exclude ambiguous characters
  };

  const settings = { ...defaults, ...options };
  
  let charset = '';
  
  if (settings.lowercase) {
    charset += settings.excludeSimilar ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  }
  
  if (settings.uppercase) {
    charset += settings.excludeSimilar ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  
  if (settings.numbers) {
    charset += settings.excludeSimilar ? '23456789' : '0123456789';
  }
  
  if (settings.symbols) {
    charset += settings.excludeAmbiguous ? '!@#$%^&*()_+-=[]{}|;:,.<>?' : '!@#$%^&*()_+-=[]{}|;:,.<>?`~"\'\\';
  }

  if (!charset) {
    throw new Error('At least one character type must be enabled');
  }

  let password = '';
  const crypto = require('crypto');
  
  // Ensure at least one character from each enabled type
  const requiredChars = [];
  if (settings.lowercase) requiredChars.push(charset.match(/[a-z]/g)[0]);
  if (settings.uppercase) requiredChars.push(charset.match(/[A-Z]/g)[0]);
  if (settings.numbers) requiredChars.push(charset.match(/[0-9]/g)[0]);
  if (settings.symbols) requiredChars.push(charset.match(/[^a-zA-Z0-9]/g)[0]);

  // Add required characters first
  for (const char of requiredChars) {
    password += char;
  }

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }

  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => crypto.randomInt(0, 3) - 1).join('');
}

/**
 * Check if password contains personal information
 * @param {string} password - Password to check
 * @param {Object} userInfo - User information
 * @returns {boolean} - True if contains personal info
 */
function containsPersonalInformation(password, userInfo = {}) {
  const lowerPassword = password.toLowerCase();
  const personalData = [
    userInfo.firstName?.toLowerCase(),
    userInfo.lastName?.toLowerCase(),
    userInfo.email?.split('@')[0]?.toLowerCase(),
    userInfo.username?.toLowerCase()
  ].filter(Boolean);

  return personalData.some(data => {
    if (!data || data.length < 3) return false;
    return lowerPassword.includes(data);
  });
}

/**
 * Create a password strength meter object for frontend
 * @param {string} password - Password to evaluate
 * @param {Object} userInfo - User information for personal data check
 * @returns {Object} - Complete password meter data
 */
function createPasswordMeter(password, userInfo = {}) {
  const strengthData = calculatePasswordStrength(password);
  const strength = getPasswordStrengthLevel(strengthData.score, strengthData.maxScore);
  const color = getPasswordStrengthColor(strength);
  const suggestions = generatePasswordSuggestions(strengthData.analysis, password);
  const hasPersonalInfo = containsPersonalInformation(password, userInfo);

  return {
    score: strengthData.score,
    maxScore: strengthData.maxScore,
    percentage: Math.round((strengthData.score / strengthData.maxScore) * 100),
    strength,
    color,
    suggestions,
    analysis: {
      ...strengthData.analysis,
      personalInfo: hasPersonalInfo
    },
    isSecure: strengthData.score >= 6 && !hasPersonalInfo
  };
}

module.exports = {
  calculatePasswordStrength,
  getPasswordStrengthLevel,
  getPasswordStrengthColor,
  generatePasswordSuggestions,
  generateSecurePassword,
  containsPersonalInformation,
  createPasswordMeter
};
