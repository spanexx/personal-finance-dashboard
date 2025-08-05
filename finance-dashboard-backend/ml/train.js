
const tf = require('@tensorflow/tfjs-node');
const Transaction = require('../models/Transaction');
const Feedback = require('../models/Feedback');
const Category = require('../models/Category');
const { extractFeatures } = require('./feature.service');
const { createCategorizationModel } = require('./categorization.model');
const fs = require('fs');

async function trainModel() {
    console.log('Starting model training...');

    // 1. Load data
    const transactions = await Transaction.find({}).populate('category');
    const feedbackEntries = await Feedback.find({}).populate('transaction predictedCategory actualCategory');
    const categories = await Category.find({});
    const categoryMap = new Map(categories.map(c => [c._id.toString(), c.name]));

    let descriptions = transactions.map(t => t.description);
    let labels = transactions.map(t => categoryMap.get(t.category._id.toString()));

    // Incorporate feedback into training data
    feedbackEntries.forEach(feedback => {
        // Only use feedback where the predicted category was incorrect
        if (feedback.predictedCategory.toString() !== feedback.actualCategory.toString()) {
            const transaction = feedback.transaction;
            if (transaction && transaction.description && feedback.actualCategory) {
                descriptions.push(transaction.description);
                labels.push(categoryMap.get(feedback.actualCategory._id.toString()));
            }
        }
    });

    // 2. Preprocess data
    const features = descriptions.map(d => extractFeatures(d));

    // Create a vocabulary
    const allTokens = [].concat.apply([], features);
    const uniqueTokens = [...new Set(allTokens)];
    const vocab = Object.fromEntries(uniqueTokens.map((token, i) => [token, i + 1]));
    const vocabSize = uniqueTokens.length + 1;

    // Convert features to sequences of integers
    const sequences = features.map(tokens => 
        tokens.map(token => vocab[token]).filter(v => v)
    );

    // Pad sequences
    const paddedSequences = tf.keras.preprocessing.sequence.padSequences(sequences, { maxlen: 50, padding: 'post' });

    // One-hot encode labels
    const labelToIndex = Object.fromEntries(categories.map((c, i) => [c.name, i]));
    const indexToLabel = Object.fromEntries(categories.map((c, i) => [i, c._id.toString()]));
    const integerLabels = labels.map(label => labelToIndex[label]);
    const oneHotLabels = tf.oneHot(integerLabels, categories.length);

    // 3. Create and train the model
    const model = createCategorizationModel(categories.length, vocabSize);

    const history = await model.fit(paddedSequences, oneHotLabels, {
        epochs: 10,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                console.log(`Epoch ${epoch + 1}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.accuracy.toFixed(4)}, val_loss = ${logs.val_loss.toFixed(4)}, val_accuracy = ${logs.val_accuracy.toFixed(4)}`);
            }
        }
    });

    console.log('Training complete. Final metrics:');
    console.log(`Loss: ${history.history.loss[history.history.loss.length - 1].toFixed(4)}`);
    console.log(`Accuracy: ${history.history.accuracy[history.history.accuracy.length - 1].toFixed(4)}`);
    console.log(`Validation Loss: ${history.history.val_loss[history.history.val_loss.length - 1].toFixed(4)}`);
    console.log(`Validation Accuracy: ${history.history.val_accuracy[history.history.val_accuracy.length - 1].toFixed(4)}`);

    // 4. Save the model and metadata
    await model.save('file://./ml/categorization_model');

    fs.writeFileSync('./ml/categorization_model/vocab.json', JSON.stringify(vocab));
    fs.writeFileSync('./ml/categorization_model/categoryMap.json', JSON.stringify(indexToLabel));
    console.log('Model, vocabulary, and category map trained and saved.');
}

trainModel().catch(console.error);
