/**
 * Authentication Service Unit Tests
 * Tests JWT token generation, verification, and authentication logic
 */

const AuthService = require('../../services/auth.service');
const PasswordService = require('../../services/password.service');
const User = require('../../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../utils/logger');
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set environment variables for tests
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
  });

  describe('Token Generation', () => {
    describe('generateTokens', () => {
      it('should generate valid access and refresh tokens', () => {
        const payload = { userId: '123', email: 'test@example.com' };
        const mockAccessToken = 'mock.access.token';
        const mockRefreshToken = 'mock.refresh.token';

        jwt.sign
          .mockReturnValueOnce(mockAccessToken)
          .mockReturnValueOnce(mockRefreshToken);

        const result = AuthService.generateTokens(payload);

        expect(jwt.sign).toHaveBeenCalledTimes(2);
        expect(jwt.sign).toHaveBeenNthCalledWith(
          1,
          payload,
          process.env.JWT_ACCESS_SECRET,
          { expiresIn: '15m' }
        );
        expect(jwt.sign).toHaveBeenNthCalledWith(
          2,
          { userId: payload.userId },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: '7d' }
        );

        expect(result).toEqual({
          accessToken: mockAccessToken,
          refreshToken: mockRefreshToken
        });
      });

      it('should handle missing user ID in payload', () => {
        const payload = { email: 'test@example.com' };

        expect(() => {
          AuthService.generateTokens(payload);
        }).toThrow('User ID is required for token generation');
      });

      it('should generate tokens with custom expiry times', () => {
        process.env.JWT_ACCESS_EXPIRY = '30m';
        process.env.JWT_REFRESH_EXPIRY = '14d';

        const payload = { userId: '123', email: 'test@example.com' };
        AuthService.generateTokens(payload);

        expect(jwt.sign).toHaveBeenNthCalledWith(
          1,
          payload,
          process.env.JWT_ACCESS_SECRET,
          { expiresIn: '30m' }
        );
        expect(jwt.sign).toHaveBeenNthCalledWith(
          2,
          { userId: payload.userId },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: '14d' }
        );
      });
    });

    describe('generateTokenPair', () => {
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        save: jest.fn()
      };

      beforeEach(() => {
        mockUser.save.mockClear();
      });

      it('should generate token pair and save refresh token', async () => {
        const mockTokens = {
          accessToken: 'mock.access.token',
          refreshToken: 'mock.refresh.token'
        };

        const generateTokensSpy = jest.spyOn(AuthService, 'generateTokens');
        generateTokensSpy.mockReturnValue(mockTokens);

        const saveRefreshTokenSpy = jest.spyOn(AuthService, 'saveRefreshToken');
        saveRefreshTokenSpy.mockResolvedValue();

        const clientInfo = {
          userAgent: 'Test Browser',
          ipAddress: '127.0.0.1'
        };

        const result = await AuthService.generateTokenPair(mockUser, clientInfo);

        expect(generateTokensSpy).toHaveBeenCalledWith({
          userId: mockUser._id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName
        });

        expect(saveRefreshTokenSpy).toHaveBeenCalledWith(
          mockUser._id,
          mockTokens.refreshToken
        );

        expect(result).toEqual({
          accessToken: mockTokens.accessToken,
          refreshToken: mockTokens.refreshToken,
          user: {
            id: mockUser._id,
            email: mockUser.email,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName
          }
        });
      });

      it('should handle errors during token pair generation', async () => {
        const generateTokensSpy = jest.spyOn(AuthService, 'generateTokens');
        generateTokensSpy.mockImplementation(() => {
          throw new Error('Token generation failed');
        });

        await expect(
          AuthService.generateTokenPair(mockUser)
        ).rejects.toThrow('Failed to generate token pair: Token generation failed');
      });
    });
  });

  describe('Token Verification', () => {
    describe('verifyToken', () => {
      it('should verify valid access tokens', () => {
        const mockToken = 'valid.access.token';
        const mockPayload = {
          userId: '123',
          email: 'test@example.com',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 900
        };

        jwt.verify.mockReturnValue(mockPayload);

        const result = AuthService.verifyToken(mockToken, 'access');

        expect(jwt.verify).toHaveBeenCalledWith(
          mockToken,
          process.env.JWT_ACCESS_SECRET
        );
        expect(result).toEqual(mockPayload);
      });

      it('should verify valid refresh tokens', () => {
        const mockToken = 'valid.refresh.token';
        const mockPayload = {
          userId: '123',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 604800
        };

        jwt.verify.mockReturnValue(mockPayload);

        const result = AuthService.verifyToken(mockToken, 'refresh');

        expect(jwt.verify).toHaveBeenCalledWith(
          mockToken,
          process.env.JWT_REFRESH_SECRET
        );
        expect(result).toEqual(mockPayload);
      });

      it('should throw error for expired tokens', () => {
        const expiredError = new Error('jwt expired');
        expiredError.name = 'TokenExpiredError';
        jwt.verify.mockImplementation(() => {
          throw expiredError;
        });

        expect(() => {
          AuthService.verifyToken('expired.token', 'access');
        }).toThrow('Token has expired');
      });

      it('should throw error for invalid tokens', () => {
        const invalidError = new Error('invalid signature');
        invalidError.name = 'JsonWebTokenError';
        jwt.verify.mockImplementation(() => {
          throw invalidError;
        });

        expect(() => {
          AuthService.verifyToken('invalid.token', 'access');
        }).toThrow('Invalid token');
      });

      it('should throw error for malformed tokens', () => {
        const malformedError = new Error('jwt malformed');
        malformedError.name = 'JsonWebTokenError';
        jwt.verify.mockImplementation(() => {
          throw malformedError;
        });

        expect(() => {
          AuthService.verifyToken('malformed.token', 'access');
        }).toThrow('Invalid token');
      });
    });

    describe('validateTokenPayload', () => {
      it('should validate valid token payload', () => {
        const validPayload = {
          userId: '123',
          email: 'test@example.com',
          iat: 1234567890
        };

        const result = AuthService.validateTokenPayload(validPayload);
        expect(result).toBe(true);
      });

      it('should reject payload missing required fields', () => {
        const invalidPayloads = [
          { email: 'test@example.com', iat: 1234567890 }, // missing userId
          { userId: '123', iat: 1234567890 }, // missing email
          { userId: '123', email: 'test@example.com' }, // missing iat
          null,
          undefined,
          'string payload',
          123
        ];

        invalidPayloads.forEach(payload => {
          const result = AuthService.validateTokenPayload(payload);
          expect(result).toBe(false);
        });
      });
    });
  });

  describe('User Authentication', () => {
    describe('loginUser', () => {
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        password: 'hashedPassword',
        firstName: 'John',
        lastName: 'Doe',
        isVerified: true,
        loginAttempts: 0,
        lockUntil: undefined,
        save: jest.fn()
      };

      beforeEach(() => {
        User.findOne.mockReset();
        bcrypt.compare.mockReset();
        mockUser.save.mockClear();
      });

      it('should login user with valid credentials', async () => {
        User.findOne.mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser)
        });
        bcrypt.compare.mockResolvedValue(true);

        const generateTokenPairSpy = jest.spyOn(AuthService, 'generateTokenPair');
        generateTokenPairSpy.mockResolvedValue({
          accessToken: 'access.token',
          refreshToken: 'refresh.token',
          user: { id: '123', email: 'test@example.com' }
        });

        const credentials = {
          email: 'test@example.com',
          password: 'validPassword'
        };

        const clientInfo = {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Browser'
        };

        const result = await AuthService.loginUser(credentials, clientInfo);

        expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
        expect(bcrypt.compare).toHaveBeenCalledWith('validPassword', 'hashedPassword');
        expect(generateTokenPairSpy).toHaveBeenCalledWith(mockUser, clientInfo);
        expect(result.success).toBe(true);
        expect(result.user).toBeDefined();
        expect(result.tokens).toBeDefined();
      });

      it('should reject login with invalid email', async () => {
        User.findOne.mockReturnValue({
          select: jest.fn().mockResolvedValue(null)
        });

        const credentials = {
          email: 'nonexistent@example.com',
          password: 'password'
        };

        await expect(
          AuthService.loginUser(credentials)
        ).rejects.toThrow('Invalid email or password');
      });

      it('should reject login with invalid password', async () => {
        User.findOne.mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser)
        });
        bcrypt.compare.mockResolvedValue(false);

        const credentials = {
          email: 'test@example.com',
          password: 'wrongPassword'
        };

        await expect(
          AuthService.loginUser(credentials)
        ).rejects.toThrow('Invalid email or password');
      });

      it('should reject login for unverified user', async () => {
        const unverifiedUser = { ...mockUser, isVerified: false };
        User.findOne.mockReturnValue({
          select: jest.fn().mockResolvedValue(unverifiedUser)
        });

        const credentials = {
          email: 'test@example.com',
          password: 'validPassword'
        };

        await expect(
          AuthService.loginUser(credentials)
        ).rejects.toThrow('Please verify your email before logging in');
      });

      it('should reject login for locked account', async () => {
        const lockedUser = {
          ...mockUser,
          lockUntil: new Date(Date.now() + 900000) // 15 minutes from now
        };
        User.findOne.mockReturnValue({
          select: jest.fn().mockResolvedValue(lockedUser)
        });

        const credentials = {
          email: 'test@example.com',
          password: 'validPassword'
        };

        await expect(
          AuthService.loginUser(credentials)
        ).rejects.toThrow('Account is temporarily locked due to multiple failed login attempts');
      });
    });

    describe('registerUser', () => {
      beforeEach(() => {
        User.findOne.mockReset();
        User.prototype.save = jest.fn();
      });

      it('should register new user successfully', async () => {
        // Mock user doesn't exist
        User.findOne.mockResolvedValue(null);

        // Mock password validation
        const validatePasswordStrengthSpy = jest.spyOn(PasswordService, 'validatePasswordStrength');
        validatePasswordStrengthSpy.mockReturnValue({
          isValid: true,
          score: 8,
          errors: []
        });

        // Mock password hashing
        const hashPasswordSpy = jest.spyOn(PasswordService, 'hashPassword');
        hashPasswordSpy.mockResolvedValue('hashedPassword');

        // Mock user creation
        const mockUser = {
          _id: '123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          save: jest.fn().mockResolvedValue(),
          generateEmailVerificationToken: jest.fn().mockReturnValue('verification.token')
        };

        User.mockImplementation(() => mockUser);

        const userData = {
          email: 'test@example.com',
          password: 'strongPassword123!',
          firstName: 'John',
          lastName: 'Doe'
        };

        const clientInfo = {
          ipAddress: '127.0.0.1',
          userAgent: 'Test Browser'
        };

        const result = await AuthService.registerUser(userData, clientInfo);

        expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
        expect(validatePasswordStrengthSpy).toHaveBeenCalled();
        expect(hashPasswordSpy).toHaveBeenCalledWith('strongPassword123!');
        expect(result.success).toBe(true);
        expect(result.user.email).toBe('test@example.com');
      });

      it('should reject registration with existing email', async () => {
        User.findOne.mockResolvedValue({ email: 'test@example.com' });

        const userData = {
          email: 'test@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe'
        };

        await expect(
          AuthService.registerUser(userData)
        ).rejects.toThrow('User with this email already exists');
      });

      it('should reject registration with weak password', async () => {
        User.findOne.mockResolvedValue(null);

        const validatePasswordStrengthSpy = jest.spyOn(PasswordService, 'validatePasswordStrength');
        validatePasswordStrengthSpy.mockReturnValue({
          isValid: false,
          score: 2,
          errors: ['Password too weak']
        });

        const userData = {
          email: 'test@example.com',
          password: 'weak',
          firstName: 'John',
          lastName: 'Doe'
        };

        await expect(
          AuthService.registerUser(userData)
        ).rejects.toThrow('Password does not meet security requirements');
      });
    });
  });

  describe('Token Management', () => {
    describe('refreshToken', () => {
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        refreshTokens: []
      };

      beforeEach(() => {
        User.findById.mockReset();
      });

      it('should refresh valid token', async () => {
        const oldToken = 'old.refresh.token';
        const mockPayload = { userId: '123' };

        const verifyTokenSpy = jest.spyOn(AuthService, 'verifyToken');
        verifyTokenSpy.mockReturnValue(mockPayload);

        const isTokenBlacklistedSpy = jest.spyOn(AuthService, 'isTokenBlacklisted');
        isTokenBlacklistedSpy.mockResolvedValue(false);

        User.findById.mockResolvedValue(mockUser);

        const generateTokensSpy = jest.spyOn(AuthService, 'generateTokens');
        generateTokensSpy.mockReturnValue({
          accessToken: 'new.access.token',
          refreshToken: 'new.refresh.token'
        });

        const saveRefreshTokenSpy = jest.spyOn(AuthService, 'saveRefreshToken');
        saveRefreshTokenSpy.mockResolvedValue();

        const blacklistTokenSpy = jest.spyOn(AuthService, 'blacklistToken');
        blacklistTokenSpy.mockResolvedValue();

        const result = await AuthService.refreshToken(oldToken);

        expect(verifyTokenSpy).toHaveBeenCalledWith(oldToken, 'refresh');
        expect(isTokenBlacklistedSpy).toHaveBeenCalledWith(oldToken);
        expect(User.findById).toHaveBeenCalledWith('123');
        expect(blacklistTokenSpy).toHaveBeenCalledWith(oldToken);
        expect(result.accessToken).toBe('new.access.token');
        expect(result.refreshToken).toBe('new.refresh.token');
      });

      it('should reject blacklisted refresh token', async () => {
        const blacklistedToken = 'blacklisted.token';
        const mockPayload = { userId: '123' };

        const verifyTokenSpy = jest.spyOn(AuthService, 'verifyToken');
        verifyTokenSpy.mockReturnValue(mockPayload);

        const isTokenBlacklistedSpy = jest.spyOn(AuthService, 'isTokenBlacklisted');
        isTokenBlacklistedSpy.mockResolvedValue(true);

        await expect(
          AuthService.refreshToken(blacklistedToken)
        ).rejects.toThrow('Refresh token has been revoked');
      });

      it('should reject refresh token for non-existent user', async () => {
        const token = 'valid.token';
        const mockPayload = { userId: '999' };

        const verifyTokenSpy = jest.spyOn(AuthService, 'verifyToken');
        verifyTokenSpy.mockReturnValue(mockPayload);

        const isTokenBlacklistedSpy = jest.spyOn(AuthService, 'isTokenBlacklisted');
        isTokenBlacklistedSpy.mockResolvedValue(false);

        User.findById.mockResolvedValue(null);

        await expect(
          AuthService.refreshToken(token)
        ).rejects.toThrow('User not found');
      });
    });

    describe('logoutUser', () => {
      it('should blacklist refresh token on logout', async () => {
        const refreshToken = 'valid.refresh.token';

        const blacklistTokenSpy = jest.spyOn(AuthService, 'blacklistToken');
        blacklistTokenSpy.mockResolvedValue();

        await AuthService.logoutUser(refreshToken);

        expect(blacklistTokenSpy).toHaveBeenCalledWith(refreshToken);
      });

      it('should handle logout with no token gracefully', async () => {
        const blacklistTokenSpy = jest.spyOn(AuthService, 'blacklistToken');
        blacklistTokenSpy.mockResolvedValue();

        await expect(
          AuthService.logoutUser(null)
        ).resolves.not.toThrow();
      });
    });
  });

  describe('Token Blacklisting', () => {
    describe('blacklistToken', () => {
      it('should add token to blacklist', async () => {
        const token = 'token.to.blacklist';
        const mockPayload = {
          exp: Math.floor(Date.now() / 1000) + 900
        };

        jwt.decode.mockReturnValue(mockPayload);

        await AuthService.blacklistToken(token);

        // Verify token was added to blacklist
        const isBlacklisted = await AuthService.isTokenBlacklisted(token);
        expect(isBlacklisted).toBe(true);
      });

      it('should handle tokens without expiration', async () => {
        const token = 'token.without.exp';

        jwt.decode.mockReturnValue({ userId: '123' });

        await expect(
          AuthService.blacklistToken(token)
        ).resolves.not.toThrow();
      });
    });

    describe('isTokenBlacklisted', () => {
      it('should return true for blacklisted tokens', async () => {
        const token = 'blacklisted.token';
        
        // First blacklist the token
        const mockPayload = {
          exp: Math.floor(Date.now() / 1000) + 900
        };
        jwt.decode.mockReturnValue(mockPayload);
        await AuthService.blacklistToken(token);

        const result = await AuthService.isTokenBlacklisted(token);
        expect(result).toBe(true);
      });

      it('should return false for non-blacklisted tokens', async () => {
        const token = 'valid.token';

        const result = await AuthService.isTokenBlacklisted(token);
        expect(result).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during authentication', async () => {
      User.findOne.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const credentials = {
        email: 'test@example.com',
        password: 'password'
      };

      await expect(
        AuthService.loginUser(credentials)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle JWT signing errors', () => {
      jwt.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      const payload = { userId: '123', email: 'test@example.com' };

      expect(() => {
        AuthService.generateTokens(payload);
      }).toThrow('JWT signing failed');
    });
  });

  describe('Performance Tests', () => {
    it('should generate tokens within performance threshold', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      jwt.sign.mockReturnValue('mock.token');

      const startTime = Date.now();
      AuthService.generateTokens(payload);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should verify tokens within performance threshold', () => {
      const token = 'test.token';
      const mockPayload = { userId: '123', iat: 1234567890, exp: 9999999999 };
      jwt.verify.mockReturnValue(mockPayload);

      const startTime = Date.now();
      AuthService.verifyToken(token, 'access');
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(50); // Should complete within 50ms
    });
  });
});
