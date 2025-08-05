
const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedback.controller');

router.post('/', feedbackController.createFeedback);
router.get('/', feedbackController.getFeedback);

module.exports = router;
