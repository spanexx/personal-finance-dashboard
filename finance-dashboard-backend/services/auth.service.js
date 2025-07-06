const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const redis = require('redis');
const logger = require('../utils/logger');

/**
 * Token Blacklist Storage
 * Uses Redis in production for better performance and persistence
 * Falls back to in-memory storage for development
 */
class TokenBlacklist {
  constructor() {
    this.useRedis = process.env.REDIS_ENABLED === 'true' && process.env.NODE_ENV !== 'test';
    this.redisClient = null;
    
    // In-memory fallback
    this.blacklistedTokens = new Set();
    this.tokenExpiry = new Map();
    this.cleanupInterval = null;
    
    if (this.useRedis) {
      this.initRedis();
    } else {
      // Clean up expired tokens every hour for in-memory storage (only if not in test mode)
      if (process.env.NODE_ENV !== 'test') {
        this.cleanupInterval = setInterval(() => {
          this.cleanupExpiredTokens();
        }, 60 * 60 * 1000);
      }
    }
  }
  
  async initRedis() {
    try {
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Could not connect to Redis after multiple attempts. Falling back to in-memory storage.');
              this.useRedis = false;
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });
      
      this.redisClient.on('error', (err) => {
        logger.error('Redis client error:', err);
        if (this.useRedis) {
          logger.warn('Falling back to in-memory token blacklist');
          this.useRedis = false;
        }
      });
      
      this.redisClient.on('connect', () => {
        logger.info('Connected to Redis for token blacklist storage');
      });
      
      await this.redisClient.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.useRedis = false;
    }
  }

  async add(token, expiresAt) {
    if (this.useRedis && this.redisClient && this.redisClient.isOpen) {
      try {
        // Calculate TTL in seconds
        const now = Date.now();
        const ttl = Math.floor((expiresAt - now) / 1000);
        
        if (ttl > 0) {
          const key = `blacklist:${token}`;
          await this.redisClient.set(key, '1', { EX: ttl });
          logger.debug('Token added to Redis blacklist', { ttl });
        }
      } catch (error) {
        logger.error('Redis blacklist add error:', error);
        // Fallback to in-memory
        this.blacklistedTokens.add(token);
        this.tokenExpiry.set(token, expiresAt);
      }
    } else {
      // In-memory storage
      this.blacklistedTokens.add(token);
      this.tokenExpiry.set(token, expiresAt);
    }
  }

  async has(token) {
    if (this.useRedis && this.redisClient && this.redisClient.isOpen) {
      try {
        const key = `blacklist:${token}`;
        const result = await this.redisClient.get(key);
        return result !== null;
      } catch (error) {
        logger.error('Redis blacklist check error:', error);
        // Fallback to in-memory
        return this.blacklistedTokens.has(token);
      }
    } else {
      // In-memory check
      return this.blacklistedTokens.has(token);
    }
  }
  cleanupExpiredTokens() {
    // This is only needed for in-memory storage
    // Redis handles expiration automatically
    if (!this.useRedis) {
      const now = Date.now();
      for (const [token, expiresAt] of this.tokenExpiry.entries()) {
        if (expiresAt < now) {
          this.blacklistedTokens.delete(token);
          this.tokenExpiry.delete(token);
        }
      }
    }
  }
  clear() {
    if (this.useRedis && this.redisClient && this.redisClient.isOpen) {
      // In Redis, we would need to scan and delete all blacklist keys
      // This could be an expensive operation, so we might skip it in production
      logger.warn('Redis blacklist clear operation skipped (not implemented)');
    } else {
      // In-memory clear
      this.blacklistedTokens.clear();
      this.tokenExpiry.clear();
    }
  }
    async shutdown() {
    // Clear cleanup interval if it exists
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.redisClient && this.redisClient.isOpen) {
      try {
        await this.redisClient.quit();
        logger.info('Redis client for token blacklist closed');
      } catch (error) {
        logger.error('Error closing Redis client:', error);
      }
    }
  }
}

const tokenBlacklist = new TokenBlacklist();

/**
 * Authentication Service
 * Handles JWT token generation, verification, and management
 */
class AuthService {
  /**
   * Generate access token
   * @param {Object} payload - Token payload
   * @param {string} payload.userId - User ID
   * @param {string} payload.email - User email
   * @param {string} payload.role - User role
   * @returns {string} JWT access token
   */
  static generateAccessToken(payload) {
    try {
      const { userId, email, role = 'user' } = payload;
      
      if (!userId || !email) {
        throw new Error('Invalid payload: userId and email are required');
      }

      return jwt.sign(
        {
          userId,
          email,
          role,
          type: 'access',
          iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_ACCESS_SECRET,
        {
          expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
          issuer: 'finance-dashboard',
          audience: 'finance-dashboard-users'
        }
      );
    } catch (error) {
      throw new Error(`Failed to generate access token: ${error.message}`);
    }
  }

  /**
   * Generate refresh token
   * @param {Object} payload - Token payload
   * @param {string} payload.userId - User ID
   * @param {string} payload.email - User email
   * @returns {string} JWT refresh token
   */
  static generateRefreshToken(payload) {
    try {
      const { userId, email } = payload;
      
      if (!userId || !email) {
        throw new Error('Invalid payload: userId and email are required');
      }

      return jwt.sign(
        {
          userId,
          email,
          type: 'refresh',
          tokenId: crypto.randomUUID(),
          iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_REFRESH_SECRET,
        {
          expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
          issuer: 'finance-dashboard',
          audience: 'finance-dashboard-users'
        }
      );
    } catch (error) {
      throw new Error(`Failed to generate refresh token: ${error.message}`);
    }
  }

  /**
   * Generate token pair (access + refresh)
   * @param {Object} user - User object
   * @param {Object} clientInfo - Client information
   * @param {string} clientInfo.userAgent - User agent
   * @param {string} clientInfo.ipAddress - IP address
   * @returns {Object} Token pair with access and refresh tokens
   */
  static async generateTokenPair(user, clientInfo = {}) {
    try {
      const payload = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      };

      const accessToken = this.generateAccessToken(payload);
      const refreshToken = this.generateRefreshToken(payload);

      // Store refresh token in database
      await this.storeRefreshToken(user._id, refreshToken, clientInfo);

      return {
        accessToken,
        refreshToken,
        expiresIn: this.getTokenExpiration('access'),
        tokenType: 'Bearer'
      };
    } catch (error) {
      throw new Error(`Failed to generate token pair: ${error.message}`);
    }
  }

  /**
   * Generate tokens (unified method for controller)
   * @param {Object} payload - Token payload
   * @returns {Object} Token pair
   */
  static generateTokens(payload) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);
    
    return {
      accessToken,
      refreshToken
    };
  }

  /**
   * Save refresh token to user
   * @param {string} userId - User ID
   * @param {string} refreshToken - Refresh token
   */
  static async saveRefreshToken(userId, refreshToken) {
    try {
      await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            refreshTokens: {
              token: refreshToken,
              createdAt: new Date()
            }
          }
        }
      );
    } catch (error) {
      throw new Error(`Failed to save refresh token: ${error.message}`);
    }
  }
  /**
   * Rotate refresh token (remove old, add new)
   * @param {string} userId - User ID
   * @param {string} oldToken - Old refresh token
   * @param {string} newToken - New refresh token
   */
  static async rotateRefreshToken(userId, oldToken, newToken) {
    try {
      // Remove old token
      await this.removeRefreshToken(userId, oldToken);
      
      // Add new token
      await this.saveRefreshToken(userId, newToken);
      
      // Blacklist old token
      await this.blacklistToken(oldToken);
    } catch (error) {
      throw new Error(`Failed to rotate refresh token: ${error.message}`);
    }
  }

  /**
   * Revoke refresh token
   * @param {string} userId - User ID
   * @param {string} refreshToken - Refresh token to revoke
   */
  static async revokeRefreshToken(userId, refreshToken) {
    try {
      await this.removeRefreshToken(userId, refreshToken);
      await this.blacklistToken(refreshToken);
    } catch (error) {
      throw new Error(`Failed to revoke refresh token: ${error.message}`);
    }
  }

  /**
   * Revoke all refresh tokens for user
   * @param {string} userId - User ID
   */
  static async revokeAllRefreshTokens(userId) {
    try {
      await this.removeAllRefreshTokens(userId);
    } catch (error) {
      throw new Error(`Failed to revoke all refresh tokens: ${error.message}`);
    }
  }

  /**
   * Set refresh token cookie
   * @param {Object} res - Express response object
   * @param {string} refreshToken - Refresh token
   */
  static setRefreshTokenCookie(res, refreshToken) {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.getTokenExpiration('refresh') * 1000 // Convert to milliseconds
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);
  }

  /**
   * Clear refresh token cookie
   * @param {Object} res - Express response object
   */
  static clearRefreshTokenCookie(res) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
  }
  /**
   * Verify access token
   * @param {string} token - JWT access token
   * @returns {Object} Decoded token payload
   */
  static async verifyAccessToken(token) {
    try {
      if (!token) {
        throw new Error('Token is required');
      }

      // Check if token is blacklisted
      const isBlacklisted = await tokenBlacklist.has(token);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
        issuer: 'finance-dashboard',
        audience: 'finance-dashboard-users'
      });

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - JWT refresh token
   * @returns {Object} Decoded token payload
   */
  static async verifyRefreshToken(token) {
    try {
      if (!token) {
        throw new Error('Refresh token is required');
      }

      // Check if token is blacklisted
      const isBlacklisted = await tokenBlacklist.has(token);
      if (isBlacklisted) {
        throw new Error('Refresh token has been revoked');
      }

      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
        issuer: 'finance-dashboard',
        audience: 'finance-dashboard-users'
      });

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token (with rotation)
   * @param {string} refreshToken - Current refresh token
   * @param {Object} clientInfo - Client information
   * @returns {Object} New token pair
   */
  static async refreshAccessToken(refreshToken, clientInfo = {}) {
    try {
      // Verify refresh token
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // Get user from database
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('User account is inactive');
      }

      // Verify refresh token exists in user's stored tokens
      const storedToken = user.refreshTokens.find(rt => {
        try {
          const storedDecoded = jwt.verify(rt.token, process.env.JWT_REFRESH_SECRET);
          return storedDecoded.tokenId === decoded.tokenId;
        } catch {
          return false;
        }
      });

      if (!storedToken) {
        throw new Error('Refresh token not found in user records');
      }      // Blacklist old refresh token
      await this.blacklistToken(refreshToken);

      // Remove old refresh token from user
      await this.removeRefreshToken(user._id, refreshToken);

      // Generate new token pair (refresh token rotation)
      const newTokenPair = await this.generateTokenPair(user, clientInfo);

      return newTokenPair;
    } catch (error) {
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
  }

  /**
   * Store refresh token in database
   * @param {string} userId - User ID
   * @param {string} refreshToken - Refresh token
   * @param {Object} clientInfo - Client information
   */
  static async storeRefreshToken(userId, refreshToken, clientInfo = {}) {
    try {
      const { userAgent = 'Unknown', ipAddress = 'Unknown' } = clientInfo;
      
      await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            refreshTokens: {
              token: refreshToken,
              userAgent,
              ipAddress,
              createdAt: new Date()
            }
          }
        },
        { new: true }
      );
    } catch (error) {
      throw new Error(`Failed to store refresh token: ${error.message}`);
    }
  }

  /**
   * Remove refresh token from database
   * @param {string} userId - User ID
   * @param {string} refreshToken - Refresh token to remove
   */
  static async removeRefreshToken(userId, refreshToken) {
    try {
      await User.findByIdAndUpdate(
        userId,
        {
          $pull: {
            refreshTokens: { token: refreshToken }
          }
        }
      );
    } catch (error) {
      throw new Error(`Failed to remove refresh token: ${error.message}`);
    }
  }
  /**
   * Remove all refresh tokens for a user (logout from all devices)
   * @param {string} userId - User ID
   */
  static async removeAllRefreshTokens(userId) {
    try {
      const user = await User.findById(userId);
      if (user && user.refreshTokens.length > 0) {
        // Blacklist all refresh tokens
        for (const rt of user.refreshTokens) {
          await this.blacklistToken(rt.token);
        }

        // Remove all refresh tokens from database
        await User.findByIdAndUpdate(
          userId,
          { $set: { refreshTokens: [] } }
        );
      }
    } catch (error) {
      throw new Error(`Failed to remove all refresh tokens: ${error.message}`);
    }
  }
  /**
   * Check if a token is blacklisted
   * @param {string} token - Token to check
   * @returns {Promise<boolean>} True if token is blacklisted
   */
  static async isTokenBlacklisted(token) {
    try {
      return await tokenBlacklist.has(token);
    } catch (error) {
      logger.error('Error checking token blacklist:', error);
      // Default to true in case of error (safer)
      return true;
    }
  }

  /**
   * Blacklist a token
   * @param {string} token - Token to blacklist
   */
  static async blacklistToken(token) {
    try {
      // Decode token to get expiration time (without verification)
      const decoded = jwt.decode(token);
      if (decoded && decoded.exp) {
        const expiresAt = decoded.exp * 1000; // Convert to milliseconds
        await tokenBlacklist.add(token, expiresAt);
      }
    } catch (error) {
      // If we can't decode the token, add it with a default expiration
      const defaultExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
      await tokenBlacklist.add(token, defaultExpiry);
      logger.warn('Error decoding token for blacklist:', error.message);
    }
  }

  /**
   * Extract token from Authorization header
   * @param {string} authHeader - Authorization header value
   * @returns {string|null} Extracted token
   */
  static extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Get token expiration time in seconds
   * @param {string} tokenType - 'access' or 'refresh'
   * @returns {number} Expiration time in seconds
   */
  static getTokenExpiration(tokenType) {
    const expiresIn = tokenType === 'access' 
      ? process.env.JWT_ACCESS_EXPIRES_IN || '15m'
      : process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    
    // Convert to seconds
    if (expiresIn.endsWith('m')) {
      return parseInt(expiresIn) * 60;
    }
    if (expiresIn.endsWith('h')) {
      return parseInt(expiresIn) * 60 * 60;
    }
    if (expiresIn.endsWith('d')) {
      return parseInt(expiresIn) * 24 * 60 * 60;
    }
    return parseInt(expiresIn); // Assume seconds
  }

  /**
   * Validate token payload
   * @param {Object} payload - Token payload to validate
   * @returns {boolean} True if valid
   */
  static validateTokenPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const requiredFields = ['userId', 'email', 'iat'];
    return requiredFields.every(field => payload.hasOwnProperty(field));
  }
  /**
   * Clean up expired refresh tokens for a user
   * @param {string} userId - User ID
   */
  static async cleanupExpiredRefreshTokens(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const validTokens = [];
      const now = Date.now();

      for (const refreshTokenData of user.refreshTokens) {
        try {
          // Check if token is expired or invalid
          jwt.verify(refreshTokenData.token, process.env.JWT_REFRESH_SECRET);
          
          // Check if token is older than 7 days from creation
          const tokenAge = now - refreshTokenData.createdAt.getTime();
          const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
          
          if (tokenAge < maxAge) {
            validTokens.push(refreshTokenData);
          } else {
            // Blacklist expired token
            await this.blacklistToken(refreshTokenData.token);
          }
        } catch (error) {
          // Token is invalid or expired, don't include it
          await this.blacklistToken(refreshTokenData.token);
        }
      }

      // Update user with only valid tokens
      if (validTokens.length !== user.refreshTokens.length) {
        await User.findByIdAndUpdate(
          userId,
          { $set: { refreshTokens: validTokens } }
        );
      }
    } catch (error) {
      logger.error(`Failed to cleanup expired refresh tokens: ${error.message}`);
    }
  }
  /**
   * Register a new user
   * @param {Object} userData - User data for registration
   * @param {Object} clientInfo - Client information
   * @returns {Object} Result with user data and tokens
   */  static async registerUser(userData, clientInfo = {}) {
    try {
      const { email, password, firstName, lastName, username } = userData;

      // Check if user already exists
      const existingUser = await User.findOne({ 
        $or: [{ email }, { username }] 
      });
      if (existingUser) {
        if (existingUser.email === email) {
          throw new Error('User with this email already exists');
        }
        if (existingUser.username === username) {
          throw new Error('Username is already taken');
        }
      }

      // Validate password strength
      const userInfo = { firstName, lastName, email, username };
      const passwordValidation = require('./password.service').validatePasswordStrength(password, userInfo);
      
      if (!passwordValidation.isValid) {
        throw new Error('Password does not meet security requirements');
      }

      // Hash password
      const hashedPassword = await require('./password.service').hashPassword(password);

      // Create user
      const user = new User({
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName
      });
      
      await user.save();

      // Generate email verification token
      const verificationToken = user.generateEmailVerificationToken();
      await user.save();

      // Send email verification
      require('./emailQueue.service').addToQueue({
        templateName: 'email-verification',
        templateData: {
          user,
          token: verificationToken
        }
      }, { priority: 'high' });

      // Log registration activity
      require('./securityMonitor.service').logActivity(user._id.toString(), {
        type: 'registration',
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        success: true
      });

      // Generate tokens
      const tokens = this.generateTokens({
        userId: user._id,
        email: user.email
      });      // Save refresh token
      await this.saveRefreshToken(user._id, tokens.refreshToken);

      // Generate session ID for tracking
      const sessionId = `session_${user._id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isVerified: user.isVerified,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt
        },
        tokens,
        sessionId,
        emailVerificationSent: true
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Login user with email and password
   * @param {Object} credentials - Login credentials
   * @param {Object} clientInfo - Client information
   * @returns {Object} Result with user data and tokens
   */  static async loginUser(credentials, clientInfo = {}) {
    try {
      const { email, password } = credentials;
      const { ipAddress, userAgent } = clientInfo;

      console.log('🔐 AUTH SERVICE: Starting login process for:', email);

      // Check for IP-based login attempts
      const securityMonitor = require('./securityMonitor.service');
      const loginStatus = securityMonitor.trackFailedLogin(ipAddress, email);
      
      if (loginStatus.blocked) {
        console.log('🚫 AUTH SERVICE: Login blocked due to rate limiting for:', email);
        throw new Error('Too many failed login attempts. Account temporarily locked.');
      }

      console.log('🔍 AUTH SERVICE: Looking up user in database...');
      // Find user and include password for verification
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        console.log('❌ AUTH SERVICE: User not found for email:', email);
        // Log failed login attempt
        securityMonitor.logActivity('unknown', {
          type: 'login',
          ipAddress,
          userAgent,
          success: false
        });

        throw new Error('Invalid email or password');
      }

      console.log('✅ AUTH SERVICE: User found, verifying password...');
      // Verify password
      const bcrypt = require('bcryptjs');
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        console.log('❌ AUTH SERVICE: Invalid password for user:', email);
        // Log failed login attempt
        securityMonitor.logActivity(user._id.toString(), {
          type: 'login',
          ipAddress,
          userAgent,
          success: false
        });

        throw new Error('Invalid email or password');
      }

      console.log('✅ AUTH SERVICE: Password valid, proceeding with login...');
      // Reset login attempts on successful login
      securityMonitor.resetLoginAttempts(ipAddress, email);

      // Log successful login
      securityMonitor.logActivity(user._id.toString(), {
        type: 'login',
        ipAddress,
        userAgent,
        success: true      });

      console.log('🔑 AUTH SERVICE: Generating tokens...');
      // Generate tokens
      const tokens = this.generateTokens({
        userId: user._id,
        email: user.email
      });
      console.log('✅ AUTH SERVICE: Tokens generated successfully');

      console.log('💾 AUTH SERVICE: Saving refresh token...');
      // Save refresh token
      await this.saveRefreshToken(user._id, tokens.refreshToken);      
      
      console.log('📅 AUTH SERVICE: Updating last login time...');
      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      // Generate session ID for tracking
      const sessionId = `session_${user._id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('🆔 AUTH SERVICE: Generated session ID:', sessionId);      const result = {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          isVerified: user.isVerified,
          isEmailVerified: user.isEmailVerified,
          lastLoginAt: user.lastLoginAt
        },
        tokens,
        sessionId
      };
      
      console.log('🎉 AUTH SERVICE: Login completed successfully for user:', user.email);
      return result;
    } catch (error) {
      console.log('❌ AUTH SERVICE: Login failed with error:', {
        email: credentials.email,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Refresh user access token
   * @param {string} refreshToken - Current refresh token
   * @returns {Object} New tokens
   */  static async refreshUserToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = await this.verifyRefreshToken(refreshToken);
      
      // Validate token payload
      if (!this.validateTokenPayload(decoded)) {
        throw new Error('Invalid refresh token payload');
      }

      // Check if refresh token exists in database
      const user = await User.findById(decoded.userId);
      if (!user || !user.refreshTokens.some(rt => rt.token === refreshToken)) {
        throw new Error('Invalid refresh token');
      }

      // Generate new tokens
      const newTokens = this.generateTokens({
        userId: user._id,
        email: user.email,
        role: user.role
      });

      // Rotate refresh token
      await this.rotateRefreshToken(user._id, refreshToken, newTokens.refreshToken);

      return newTokens;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user sessions
   * @param {string} userId - User ID
   * @param {string} currentRefreshToken - Current refresh token
   * @returns {Array} List of sessions
   */
  static async getUserSessions(userId, currentRefreshToken) {
    try {
      const user = await User.findById(userId).select('refreshTokens');
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const sessions = user.refreshTokens.map((token, index) => {
        try {
          const decoded = this.verifyRefreshToken(token);
          return {
            id: index,
            createdAt: new Date(decoded.iat * 1000),
            expiresAt: new Date(decoded.exp * 1000),
            isCurrentSession: token === currentRefreshToken
          };
        } catch (error) {
          return null;
        }
      }).filter(session => session !== null);

      return {
        sessions,
        count: sessions.length
      };
    } catch (error) {
      throw error;
    }
  }
  /**
   * Revoke a session by its index in the user's refreshTokens array
   * @param {string} userId - User ID
   * @param {number} sessionIndex - Index of the session in the array
   */
  static async revokeSessionByIndex(userId, sessionIndex) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      if (!user.refreshTokens[sessionIndex]) {
        throw new Error('Session not found');
      }
      
      const tokenToRevoke = user.refreshTokens[sessionIndex];
      await this.revokeRefreshToken(userId, tokenToRevoke);
      
      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Shutdown Redis connections
   */
  static async shutdown() {
    await tokenBlacklist.shutdown();
  }
}

module.exports = AuthService;
