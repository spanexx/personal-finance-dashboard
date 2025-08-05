
const tf = require('@tensorflow/tfjs-node');

/**
 * Creates a transaction categorization model.
 * @param {number} numClasses - The number of categories.
 * @param {number} vocabSize - The size of the vocabulary.
 * @returns {tf.Sequential} - A TensorFlow.js model.
 */
function createCategorizationModel(numClasses, vocabSize) {
    const model = tf.sequential();
    model.add(tf.layers.embedding({
        inputDim: vocabSize,
        outputDim: 16,
        inputLength: 50 // Max length of a transaction description
    }));
    model.add(tf.layers.globalAveragePooling1d());
    model.add(tf.layers.dense({
        units: numClasses,
        activation: 'softmax'
    }));

    model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    return model;
}

module.exports = {
    createCategorizationModel
};
