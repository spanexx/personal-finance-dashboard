
const feedbackService = require('../services/feedback.service');

/**
 * Creates a new feedback entry.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @returns {Promise<void>}
 */
async function createFeedback(req, res) {
    try {
        const feedback = await feedbackService.createFeedback(req.body);
        res.status(201).json(feedback);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

/**
 * Gets all feedback entries.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @returns {Promise<void>}
 */
async function getFeedback(req, res) {
    try {
        const feedback = await feedbackService.getFeedback();
        res.status(200).json(feedback);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    createFeedback,
    getFeedback
};
