const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const User = require('../models/User');
const ApiResponse = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/errorHandler');

// @route   GET /api/users/profile-image/:id
// @desc    Get user's profile image filename
// @access  Private
router.get('/profile-image/:id', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('profileImage');
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return ApiResponse.success(res, { profileImage: user.profileImage }, 'Profile image retrieved successfully');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
