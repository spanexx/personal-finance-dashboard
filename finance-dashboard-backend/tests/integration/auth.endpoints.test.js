/**
 * Authentication Endpoint Integration Tests
 * Tests complete authentication workflow including registration, login, password reset, and token management
 */

const request = require('supertest');
const { app } = require('./setup');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Authentication Endpoints Integration Tests', () => {
  const testUser = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    password: 'Password123!'
  };

  const invalidUser = {
    firstName: '',
    email: 'invalid-email',
    password: '123'
  };

  describe('POST /api/auth/register', () => {
    it('should register a new user with complete workflow', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('registered successfully'),
        data: expect.objectContaining({
          user: expect.objectContaining({
            firstName: testUser.firstName,
            lastName: testUser.lastName,
            email: testUser.email
          }),
          token: expect.any(String)
        })
      });

      // Verify user was created in database
      const createdUser = await User.findOne({ email: testUser.email });
      expect(createdUser).toBeTruthy();
      expect(createdUser.firstName).toBe(testUser.firstName);
      expect(createdUser.email).toBe(testUser.email);
      
      // Verify password was hashed
      expect(createdUser.password).not.toBe(testUser.password);
      const isPasswordValid = await bcrypt.compare(testUser.password, createdUser.password);
      expect(isPasswordValid).toBe(true);

      // Verify token is valid
      const decoded = jwt.verify(response.body.data.token, process.env.JWT_SECRET || 'test-secret');
      expect(decoded.userId).toBe(createdUser._id.toString());
    });

    it('should return validation errors for invalid registration data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('validation'),
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: expect.any(String),
            message: expect.any(String)
          })
        ])
      });

      // Verify no user was created
      const userCount = await User.countDocuments();
      expect(userCount).toBe(0);
    });

    it('should prevent duplicate email registration', async () => {
      // Create user first
      await User.create({
        ...testUser,
        password: await bcrypt.hash(testUser.password, 12)
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('already exists')
      });
    });

    it('should enforce password strength requirements', async () => {
      const weakPasswordUser = {
        ...testUser,
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'password',
            message: expect.stringContaining('strong')
          })
        ])
      );
    });

    it('should handle rate limiting for registration attempts', async () => {
      const requests = Array(6).fill().map(() => 
        request(app)
          .post('/api/auth/register')
          .send({ ...testUser, email: `test${Math.random()}@example.com` })
      );

      const responses = await Promise.all(requests);
      
      // Check if rate limiting is applied (some requests should fail)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create test user before each login test
      await User.create({
        ...testUser,
        password: await bcrypt.hash(testUser.password, 12),
        isEmailVerified: true
      });
    });

    it('should login user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('login successful'),
        data: expect.objectContaining({
          user: expect.objectContaining({
            email: testUser.email,
            firstName: testUser.firstName
          }),
          token: expect.any(String),
          refreshToken: expect.any(String)
        })
      });

      // Verify token is valid
      const decoded = jwt.verify(response.body.data.token, process.env.JWT_SECRET || 'test-secret');
      expect(decoded.userId).toBeTruthy();
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid credentials')
      });
    });

    it('should reject login for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid credentials')
      });
    });

    it('should track failed login attempts and lock account', async () => {
      const failedAttempts = Array(6).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          })
      );

      await Promise.all(failedAttempts);

      // User should be locked after multiple failed attempts
      const lockedUser = await User.findOne({ email: testUser.email });
      expect(lockedUser.accountLocked).toBe(true);
      expect(lockedUser.lockUntil).toBeTruthy();

      // Should reject login even with correct password when locked
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(423);

      expect(response.body.message).toContain('locked');
    });

    it('should update last login timestamp', async () => {
      const userBefore = await User.findOne({ email: testUser.email });
      const initialLastLogin = userBefore.lastLogin;

      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      const userAfter = await User.findOne({ email: testUser.email });
      expect(userAfter.lastLogin).not.toEqual(initialLastLogin);
      expect(userAfter.lastLogin).toBeInstanceOf(Date);
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    let refreshToken;
    let userId;

    beforeEach(async () => {
      const user = await User.create({
        ...testUser,
        password: await bcrypt.hash(testUser.password, 12),
        isEmailVerified: true
      });
      userId = user._id;

      // Generate refresh token
      refreshToken = jwt.sign(
        { userId: userId.toString(), type: 'refresh' },
        process.env.JWT_REFRESH_SECRET || 'test-refresh-secret',
        { expiresIn: '7d' }
      );

      user.refreshTokens = [refreshToken];
      await user.save();
    });

    it('should generate new access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          token: expect.any(String),
          refreshToken: expect.any(String)
        })
      });

      // Verify new token is valid
      const decoded = jwt.verify(response.body.data.token, process.env.JWT_SECRET || 'test-secret');
      expect(decoded.userId).toBe(userId.toString());
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid refresh token')
      });
    });

    it('should reject expired refresh token', async () => {
      const expiredToken = jwt.sign(
        { userId: userId.toString(), type: 'refresh' },
        process.env.JWT_REFRESH_SECRET || 'test-refresh-secret',
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: expiredToken })
        .expect(401);

      expect(response.body.message).toContain('expired');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    beforeEach(async () => {
      await User.create({
        ...testUser,
        password: await bcrypt.hash(testUser.password, 12),
        isEmailVerified: true
      });
    });

    it('should initiate password reset for valid email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('reset email sent')
      });

      // Verify reset token was saved
      const user = await User.findOne({ email: testUser.email });
      expect(user.passwordResetToken).toBeTruthy();
      expect(user.passwordResetExpires).toBeTruthy();
      expect(user.passwordResetExpires).toBeInstanceOf(Date);
    });

    it('should handle non-existent email gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200); // Don't reveal if email exists

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('reset email sent')
      });
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'email',
            message: expect.stringContaining('valid email')
          })
        ])
      );
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let resetToken;
    let user;

    beforeEach(async () => {
      resetToken = 'reset-token-123';
      const hashedResetToken = await bcrypt.hash(resetToken, 12);
      
      user = await User.create({
        ...testUser,
        password: await bcrypt.hash(testUser.password, 12),
        passwordResetToken: hashedResetToken,
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      });
    });

    it('should reset password with valid token', async () => {
      const newPassword = 'NewPassword123!';
      
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: newPassword,
          confirmPassword: newPassword
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('Password reset successful')
      });

      // Verify password was changed
      const updatedUser = await User.findById(user._id);
      const isNewPasswordValid = await bcrypt.compare(newPassword, updatedUser.password);
      expect(isNewPasswordValid).toBe(true);

      // Verify reset token was cleared
      expect(updatedUser.passwordResetToken).toBeUndefined();
      expect(updatedUser.passwordResetExpires).toBeUndefined();
    });

    it('should reject invalid reset token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid or expired')
      });
    });

    it('should reject expired reset token', async () => {
      // Update user with expired token
      user.passwordResetExpires = new Date(Date.now() - 1000); // 1 second ago
      await user.save();

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: 'NewPassword123!',
          confirmPassword: 'NewPassword123!'
        })
        .expect(400);

      expect(response.body.message).toContain('expired');
    });

    it('should validate password confirmation match', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: 'NewPassword123!',
          confirmPassword: 'DifferentPassword123!'
        })
        .expect(400);

      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: expect.stringContaining('match')
          })
        ])
      );
    });
  });

  describe('POST /api/auth/logout', () => {
    let token;
    let refreshToken;
    let user;

    beforeEach(async () => {
      user = await User.create({
        ...testUser,
        password: await bcrypt.hash(testUser.password, 12),
        isEmailVerified: true
      });

      token = jwt.sign(
        { userId: user._id.toString() },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      refreshToken = jwt.sign(
        { userId: user._id.toString(), type: 'refresh' },
        process.env.JWT_REFRESH_SECRET || 'test-refresh-secret',
        { expiresIn: '7d' }
      );

      user.refreshTokens = [refreshToken];
      await user.save();
    });

    it('should logout user and invalidate tokens', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('Logout successful')
      });

      // Verify refresh token was removed
      const updatedUser = await User.findById(user._id);
      expect(updatedUser.refreshTokens).not.toContain(refreshToken);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('authorization')
      });
    });

    it('should handle missing refresh token gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    let verificationToken;
    let user;

    beforeEach(async () => {
      verificationToken = 'verification-token-123';
      const hashedToken = await bcrypt.hash(verificationToken, 12);
      
      user = await User.create({
        ...testUser,
        password: await bcrypt.hash(testUser.password, 12),
        isEmailVerified: false,
        emailVerificationToken: hashedToken,
        emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });
    });

    it('should verify email with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining('Email verified')
      });

      // Verify user email status was updated
      const verifiedUser = await User.findById(user._id);
      expect(verifiedUser.isEmailVerified).toBe(true);
      expect(verifiedUser.emailVerificationToken).toBeUndefined();
      expect(verifiedUser.emailVerificationExpires).toBeUndefined();
    });

    it('should reject invalid verification token', async () => {
      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid-token' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('Invalid or expired')
      });
    });

    it('should reject expired verification token', async () => {
      user.emailVerificationExpires = new Date(Date.now() - 1000);
      await user.save();

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken })
        .expect(400);

      expect(response.body.message).toContain('expired');
    });
  });

  describe('Authentication Security Measures', () => {
    it('should implement rate limiting for login attempts', async () => {
      await User.create({
        ...testUser,
        password: await bcrypt.hash(testUser.password, 12),
        isEmailVerified: true
      });

      const rapidRequests = Array(10).fill().map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(rapidRequests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should prevent timing attacks on login', async () => {
      await User.create({
        ...testUser,
        password: await bcrypt.hash(testUser.password, 12),
        isEmailVerified: true
      });

      const startTime1 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });
      const endTime1 = Date.now();

      const startTime2 = Date.now();
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });
      const endTime2 = Date.now();

      // Response times should be similar to prevent timing attacks
      const timeDiff = Math.abs((endTime1 - startTime1) - (endTime2 - startTime2));
      expect(timeDiff).toBeLessThan(100); // Within 100ms
    });

    it('should sanitize input to prevent injection attacks', async () => {
      const maliciousInput = {
        email: "'; DROP TABLE users; --",
        password: '<script>alert("xss")</script>'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(maliciousInput)
        .expect(400);

      expect(response.body.success).toBe(false);
      // Should have validation errors, not execute malicious code
      expect(response.body.errors).toBeDefined();
    });
  });
});
