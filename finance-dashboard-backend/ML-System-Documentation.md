# ML-Powered Financial Intelligence System Documentation

This document outlines the architecture, components, and usage of the Machine Learning (ML) powered financial intelligence system integrated into the Personal Finance Dashboard backend.

## 1. System Requirements

**IMPORTANT:** The ML features of this application rely on `@tensorflow/tfjs-node`, which has native C++ bindings. Compatibility is highly dependent on your Node.js version and operating system.

- **Recommended Node.js Version:** **Node.js v20.x (LTS)**. Pre-compiled binaries for TensorFlow.js are readily available for this version, ensuring a smooth installation. Node.js v22+ is **not currently supported** and will cause errors.
- **Supported Operating Systems:** Linux, macOS, and Windows.
- **Dependencies:**
  - `python`: Required for `node-gyp`.
  - `node-gyp`: For compiling native addons.
  - On Windows, **Visual Studio Build Tools** with the "Desktop development with C++" workload may be required if pre-compiled binaries are not found.

If you are using a non-LTS or very recent version of Node.js (like v22+), you will likely encounter installation issues, especially on Windows. See the **Troubleshooting** section for solutions.

## 2. Overview

The ML system enhances the financial dashboard by providing:
- **Automated Transaction Categorization**: Predicts categories for new transactions.
- **Rule-Based Anomaly Detection**: Identifies unusual financial activities.
- **Enhanced LLM Integration**: Uses specialized financial prompts for relevant AI responses.
- **Feedback Mechanism**: Collects user feedback on AI predictions for continuous model improvement.
- **Model Serving**: Provides API endpoints for single and batch predictions.
- **Graceful Degradation**: The application remains fully functional (minus ML features) if TensorFlow.js fails to load.

## 3. Architecture

The ML components are primarily located in the `finance-dashboard-backend/ml` directory.

```
finance-dashboard-backend/
├── ml/
│   ├── tf-loader.js                    # Safely loads TensorFlow.js native bindings
│   ├── prediction.service.js           # Manages model loading, versioning, and predictions
│   ├── categorization.model.js         # Defines the TensorFlow.js model architecture
│   ├── feature.service.js              # Handles feature extraction from transaction descriptions
│   └── train.js                        # Script for training, evaluating, and saving the ML model
│   └── categorization_model/           # Directory for the trained model and metadata
│       ├── model.json
│       ├── weights.bin
│       ├── vocab.json
│       └── categoryMap.json
├── services/
│   ├── ai.service.js                   # Integrates ML predictions and LLM prompts
│   └── transaction.service.js          # Integrates ML categorization into transaction creation
├── controllers/
│   └── ml.controller.js                # API controllers for model predictions and metadata
├── routes/
│   └── ml.routes.js                    # API routes for ML model serving
...
```

## 4. Components

### 4.1 Safe TensorFlow.js Loader (`ml/tf-loader.js`)
- **Purpose**: Safely attempts to load `@tensorflow/tfjs-node`. If it fails (e.g., due to version incompatibility), it sets a global flag `global.ML_DISABLED = true` to prevent the application from crashing and logs detailed instructions for the developer.

### 4.2 Prediction Service (`ml/prediction.service.js`)
- **Purpose**: A centralized service for all ML prediction tasks.
- **Responsibilities**:
    - Loads the categorization model, vocabulary, and category map using the `tf-loader`.
    - Implements basic model versioning and provides metadata.
    - Exposes `predictSingleCategory` and `predictBatchCategories` functions.
    - Handles graceful degradation if the model fails to load.

### 4.3 Model Training and Evaluation (`ml/train.js`)
- **Purpose**: Script to train the categorization model.
- **Process**:
    1. Loads transactions, categories, and user feedback from the database.
    2. Extracts features and builds a vocabulary.
    3. Splits data into training (80%) and validation (20%) sets.
    4. Trains the model and evaluates its accuracy on the validation set.
    5. Saves the trained model, vocabulary, and category map.
- **Usage**: `npm run train-ml-model`

### 4.4 Model Serving Infrastructure (`controllers/ml.controller.js`, `routes/ml.routes.js`)
- **Purpose**: Exposes the ML model's capabilities via a REST API.
- **Endpoints**:
    - `GET /api/ml/predict/single`: Predicts a category for a single transaction description.
    - `POST /api/ml/predict/batch`: Predicts categories for multiple descriptions.
    - `GET /api/ml/metadata`: Returns metadata about the currently loaded model.

## 5. Usage and Workflow

### 5.1 With Full ML Functionality (Recommended)
1.  **Setup Environment**: Ensure you are using a compatible Node.js LTS version (e.g., v20.x). Use a version manager like `nvm` or `nvm-windows` if needed.
    ```bash
    nvm install 20
    nvm use 20
    ```
2.  **Install Dependencies**:
    ```bash
    cd finance-dashboard-backend
    npm install
    ```
3.  **Train the Model**:
    ```bash
    npm run train-ml-model
    ```
4.  **Start the Server**:
    ```bash
    npm start
    ```
    The server will start, and the `tf-loader.js` will successfully load TensorFlow.js, enabling all ML features.

### 5.2 In ML-Disabled Mode (Graceful Degradation)
If you cannot change your Node.js version, you can still run the application with ML features disabled.
1.  **Start the Server**:
    ```bash
    cd finance-dashboard-backend
    node server-no-ml.js
    ```
    or simply `npm start`, and the `tf-loader.js` will automatically handle the error.
    The server will start, but any calls to ML-related API endpoints (`/api/ml/*`) will return a 503 Service Unavailable response, and ML-driven features will be disabled throughout the application.

## 6. Troubleshooting

### Error: `The specified module could not be found. ... tfjs_binding.node`
- **Cause**: This error occurs when Node.js cannot load the native TensorFlow.js module. It's almost always caused by an incompatibility between your Node.js version and the available pre-compiled binaries for `@tensorflow/tfjs-node`. **Node.js v22 and newer are not currently supported.**
- **Solution**:
    1.  **Switch to Node.js LTS**: The most reliable solution is to use a Node Version Manager (`nvm` for Linux/macOS, `nvm-windows` for Windows) to install and use the latest Long-Term Support (LTS) version of Node.js.
        ```bash
        # Example using nvm
        nvm install 20
        nvm use 20
        
        # Then, reinstall dependencies
        rm -rf node_modules
        npm install
        ```
    2.  **Run in ML-Disabled Mode**: If you must use your current Node.js version, the server will automatically detect the issue and start in ML-disabled mode.
    3.  **(Advanced) Build from Source**: If you are an advanced user, you can attempt to compile the native bindings from source. This requires installing Python, Visual Studio Build Tools (on Windows), and other dependencies. Refer to the official `@tensorflow/tfjs-node` documentation for instructions.