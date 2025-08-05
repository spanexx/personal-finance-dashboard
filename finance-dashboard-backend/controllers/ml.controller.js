
const predictionService = require('../ml/prediction.service');

/**
 * Predicts the category for a single transaction description.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @returns {Promise<void>}
 */
async function predictCategory(req, res) {
    try {
        const { description } = req.body;
        if (!description) {
            return res.status(400).json({ message: 'Transaction description is required.' });
        }
        const predictedCategoryId = await predictionService.predictSingleCategory(description);
        if (predictedCategoryId) {
            res.status(200).json({ predictedCategory: predictedCategoryId });
        } else {
            res.status(404).json({ message: 'Could not predict category.' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

/**
 * Predicts categories for a batch of transaction descriptions.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @returns {Promise<void>}
 */
async function predictBatchCategories(req, res) {
    try {
        const { descriptions } = req.body;
        if (!Array.isArray(descriptions) || descriptions.length === 0) {
            return res.status(400).json({ message: 'An array of descriptions is required.' });
        }
        const predictedCategories = await predictionService.predictBatchCategories(descriptions);
        res.status(200).json({ predictedCategories });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

/**
 * Gets metadata about the loaded ML model.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @returns {Promise<void>}
 */
async function getModelMetadata(req, res) {
    try {
        const metadata = predictionService.getModelMetadata();
        res.status(200).json(metadata);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    predictCategory,
    predictBatchCategories,
    getModelMetadata
};
