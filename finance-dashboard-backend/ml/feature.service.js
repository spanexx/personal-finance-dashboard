
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

/**
 * Extracts features from a transaction description.
 * @param {string} description - The transaction description.
 * @returns {Array<string>} - An array of tokens (words).
 */
function extractFeatures(description) {
    if (!description) {
        return [];
    }
    return tokenizer.tokenize(description.toLowerCase());
}

module.exports = {
    extractFeatures
};
