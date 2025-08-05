
const express = require('express');
const router = express.Router();
const mlController = require('../controllers/ml.controller');

router.post('/predict-category', mlController.predictCategory);
router.post('/predict-batch-categories', mlController.predictBatchCategories);
router.get('/model-metadata', mlController.getModelMetadata);

module.exports = router;
