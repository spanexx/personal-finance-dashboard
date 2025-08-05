
const Feedback = require('../models/Feedback');

/**
 * Creates a new feedback entry.
 * @param {object} feedbackData - The feedback data.
 * @returns {Promise<Feedback>} - The created feedback entry.
 */
async function createFeedback(feedbackData) {
    const feedback = new Feedback(feedbackData);
    return await feedback.save();
}

/**
 * Gets all feedback entries.
 * @returns {Promise<Array<Feedback>>} - An array of feedback entries.
 */
async function getFeedback() {
    return await Feedback.find().populate('transaction predictedCategory actualCategory user');
}

module.exports = {
    createFeedback,
    getFeedback
};
