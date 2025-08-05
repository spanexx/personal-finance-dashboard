
const { getTf, isTfAvailable } = require('./tf-loader');
const { extractFeatures } = require('./feature.service');
const Category = require('../models/Category');

const tf = getTf();
let categorizationModel = null;
let vocabulary = null;
let categoryMap = null;
let modelVersion = 'N/A';
let modelLoadTimestamp = null;

async function loadCategorizationModel() {
    try {
        if (!isTfAvailable()) {
            console.error('TensorFlow.js is not available. ML categorization will not function.');
            return false;
        }
        
        categorizationModel = await tf.loadLayersModel('file://./ml/categorization_model/model.json');
        vocabulary = require('./categorization_model/vocab.json');
        categoryMap = require('./categorization_model/categoryMap.json');
        modelVersion = process.env.ML_MODEL_VERSION || '1.0.0'; // Example versioning
        modelLoadTimestamp = new Date();
        console.log(`ML Categorization Model (Version: ${modelVersion}) loaded successfully at ${modelLoadTimestamp.toISOString()}.`);
        return true;
    } catch (error) {
        console.warn('Could not load ML Categorization Model:', error.message);
        categorizationModel = null;
        vocabulary = null;
        categoryMap = null;
        modelVersion = 'N/A';
        modelLoadTimestamp = null;
    }
}

// Load the model when the service is initialized
loadCategorizationModel();

/**
 * Predicts the category for a single transaction description.
 * @param {string} description - The transaction description.
 * @returns {Promise<string|null>} - The predicted category ID or null if prediction fails.
 */
async function predictSingleCategory(description) {
    if (!categorizationModel || !vocabulary || !categoryMap) {
        console.warn('ML Categorization Model or its components not loaded. Cannot predict category.');
        return null;
    }

    try {
        const features = extractFeatures(description);
        const sequences = features.map(token => vocabulary[token]).filter(v => v);
        const paddedSequences = tf.keras.preprocessing.sequence.padSequences([sequences], { maxlen: 50, padding: 'post' });

        const prediction = categorizationModel.predict(tf.tensor2d(paddedSequences));
        const predictedCategoryIndex = prediction.argMax(-1).dataSync()[0];
        const predictedCategoryId = categoryMap[predictedCategoryIndex];

        return predictedCategoryId;
    } catch (error) {
        console.error('Error predicting single category:', error);
        return null;
    }
}

/**
 * Predicts categories for a batch of transaction descriptions.
 * @param {Array<string>} descriptions - An array of transaction descriptions.
 * @returns {Promise<Array<string|null>>} - An array of predicted category IDs or null for failed predictions.
 */
async function predictBatchCategories(descriptions) {
    if (!categorizationModel || !vocabulary || !categoryMap) {
        console.warn('ML Categorization Model or its components not loaded. Cannot perform batch prediction.');
        return descriptions.map(() => null);
    }

    try {
        const featuresBatch = descriptions.map(d => extractFeatures(d));
        const sequencesBatch = featuresBatch.map(tokens => 
            tokens.map(token => vocabulary[token]).filter(v => v)
        );
        const paddedSequencesBatch = tf.keras.preprocessing.sequence.padSequences(sequencesBatch, { maxlen: 50, padding: 'post' });

        const predictions = categorizationModel.predict(tf.tensor2d(paddedSequencesBatch));
        const predictedCategoryIndices = predictions.argMax(-1).dataSync();

        return Array.from(predictedCategoryIndices).map(index => categoryMap[index]);
    } catch (error) {
        console.error('Error predicting batch categories:', error);
        return descriptions.map(() => null);
    }
}

/**
 * Returns metadata about the loaded ML model.
 * @returns {Object} - Model metadata.
 */
function getModelMetadata() {
    return {
        version: modelVersion,
        loadTimestamp: modelLoadTimestamp,
        isLoaded: !!categorizationModel,
        vocabularySize: vocabulary ? Object.keys(vocabulary).length : 0,
        numCategories: categoryMap ? Object.keys(categoryMap).length : 0
    };
}

module.exports = {
    loadCategorizationModel,
    predictSingleCategory,
    predictBatchCategories,
    getModelMetadata
};
