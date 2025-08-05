/**
 * Safe TensorFlow.js loader
 * 
 * This module safely attempts to load TensorFlow.js and provides
 * a way to check if TensorFlow is available without crashing the app.
 */

let tf = null;

try {
  // Attempt to load TensorFlow
  tf = require('@tensorflow/tfjs-node');
  console.log('TensorFlow.js loaded successfully. ML features are enabled.');
} catch (error) {
  console.error('********************************************************************************');
  console.error('*** FAILED TO LOAD TENSORFLOW.JS NATIVE BINDINGS ***');
  console.error('********************************************************************************');
  console.error('Error message:', error.message);
  console.warn('\nThis is often due to an incompatibility between your Node.js version and the pre-compiled TensorFlow binaries.');
  console.warn(`Your current Node.js version: ${process.version}`);
  console.warn('The ML-powered features of this application will be disabled.');
  
  console.info('\nRECOMMENDED ACTION:');
  console.info('Use a Node.js Long-Term Support (LTS) version (e.g., 18.x, 20.x) for full compatibility.');
  console.info('You can use a Node Version Manager (nvm or nvm-windows) to switch versions easily.');
  
  console.info('\nAlternatively, to run the server without ML features, you can start it with:');
  console.info('node server-no-ml.js');
  
  console.error('********************************************************************************\n');

  // Set the global flag to disable ML functionality
  global.ML_DISABLED = true;
  tf = null;
}

/**
 * Check if TensorFlow is available
 * @returns {boolean} True if TensorFlow is loaded successfully
 */
function isTfAvailable() {
  return tf !== null;
}

/**
 * Get the TensorFlow instance if available
 * @returns {object|null} TensorFlow instance or null if not available
 */
function getTf() {
  return tf;
}

module.exports = {
  isTfAvailable,
  getTf
};
