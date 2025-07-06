const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server'); // Assuming server exports the app
const User = require('../../models/User');
const bcrypt = require('bcryptjs'); // For verifying password change

describe('User Profile and Preference API Endpoints', () => {
  let primaryTestUser;
  let accessToken;

  const primaryUserData = {
    firstName: 'Primary',
    lastName: 'User',
    username: 'primaryuser',
    email: 'primary.user@example.com',
    password: 'Password123!',
    preferences: { // Example preferences structure
      currency: 'USD',
      language: 'en',
      theme: 'light',
      notifications: {
        email: true,
        sms: false
      }
    }
  };

  beforeAll(async () => {
    // Create primary user
    await User.deleteMany({ email: primaryUserData.email });
    // Manually hash password for creation if pre-save hook isn't automatically doing it or for consistency
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(primaryUserData.password, salt);
    primaryTestUser = await User.create({
        ...primaryUserData,
        // password: hashedPassword, // Use if manually hashing
        isEmailVerified: true
    });

    // Log in primary user
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: primaryUserData.email, password: primaryUserData.password });
    accessToken = loginResponse.body.data.tokens.accessToken;
    expect(accessToken).toBeDefined();
  });

  afterAll(async () => {
    // Clean up primary user
    // Relies on global setup.js but can be explicit
    // if (primaryTestUser) await User.findByIdAndDelete(primaryTestUser._id);
  });

  beforeEach(async () => {
    // For most tests, we want the user to be in a known state.
    // Re-fetch or ensure user state if tests modify it extensively and don't clean up.
    // For now, assuming beforeAll setup is sufficient and tests clean up their specific modifications if needed.
  });

  // Test suites will be added here
  describe('GET /api/users/me (User Profile)', () => {
    it('should get the current user\'s profile successfully', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(primaryUserData.email);
      expect(response.body.data.user.firstName).toBe(primaryUserData.firstName);
      expect(response.body.data.user.lastName).toBe(primaryUserData.lastName);
      expect(response.body.data.user.preferences.currency).toBe(primaryUserData.preferences.currency);

      // Ensure sensitive data is NOT present
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.user.refreshToken).toBeUndefined(); // If refresh tokens are stored on user model
      expect(response.body.data.user.resetPasswordToken).toBeUndefined();
    });

    it('should fail to get profile without authentication', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/authorization token required/i);
    });

    // Optional: Test getting another user's profile (if such an endpoint exists and is admin-only or forbidden)
    // This assumes an endpoint like /api/users/:id/profile or /api/users/:id
    // For now, this test is commented out as it depends on a different endpoint structure.
    /*
    it('should fail to get another user\'s profile (if not admin)', async () => {
      const otherUser = await User.create({
          email: 'other.profile@example.com', password: 'password',
          firstName: 'Other', lastName: 'ProfileUser', isEmailVerified: true
      });

      const response = await request(app)
        .get(`/api/users/${otherUser._id}`) // Assuming this endpoint structure
        .set('Authorization', `Bearer ${accessToken}`) // Authenticated as primaryTestUser
        .expect(403); // Or 404 if users can't see other profiles at all

      expect(response.body.success).toBe(false);
      // Appropriate error message check

      await User.findByIdAndDelete(otherUser._id);
    });
    */
  });

  describe('PUT /api/users/me (Update User Profile)', () => {
    const profileUpdateData = {
      firstName: 'PrimaryUpdated',
      lastName: 'UserUpdated',
      preferences: {
        currency: 'EUR',
        language: 'de',
        theme: 'dark',
        notifications: {
          email: false,
          sms: true
        }
      }
    };

    it('should update the user\'s profile successfully', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(profileUpdateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.firstName).toBe(profileUpdateData.firstName);
      expect(response.body.data.user.lastName).toBe(profileUpdateData.lastName);
      expect(response.body.data.user.preferences.currency).toBe(profileUpdateData.preferences.currency);
      expect(response.body.data.user.preferences.theme).toBe(profileUpdateData.preferences.theme);
      expect(response.body.data.user.preferences.notifications.email).toBe(profileUpdateData.preferences.notifications.email);

      const dbUser = await User.findById(primaryTestUser._id);
      expect(dbUser.firstName).toBe(profileUpdateData.firstName);
      expect(dbUser.preferences.currency).toBe(profileUpdateData.preferences.currency);
    });

    it('should fail to update profile with invalid data (e.g., invalid currency code)', async () => {
      const invalidData = { preferences: { currency: 'INVALID_CURRENCY_CODE' } };
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      // Check for specific error related to preferences.currency
      expect(response.body.errors.some(err => err.path === 'preferences.currency')).toBe(true);
    });

    it('should fail to update email to an existing one (if email is updatable and unique)', async () => {
      // 1. Create another user
      const otherUserEmail = 'other.user.email@example.com';
      const otherUser = await User.create({
        email: otherUserEmail, password: 'password',
        firstName: 'Other', lastName: 'EmailUser', username: 'otheremailuser', isEmailVerified: true
      });

      // 2. Attempt to update primaryTestUser's email to otherUserEmail
      // This assumes email is part of the /api/users/me updatable fields.
      // If email update is a separate process (e.g. with verification), this test would change.
      const updateToExistingEmail = { email: otherUserEmail };
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateToExistingEmail)
        .expect(409); // Or 400

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/email already in use/i);

      await User.findByIdAndDelete(otherUser._id); // Clean up other user
      // Restore original email for primaryTestUser for subsequent tests if it was actually changed
      // This might be tricky if the update partially succeeded or if the DB layer rejected it.
      // Best to ensure the test user is in a consistent state.
      // For now, re-fetch and update primaryTestUser object in memory if needed, or rely on DB rejection.
      const currentPrimaryUser = await User.findById(primaryTestUser._id);
      expect(currentPrimaryUser.email).toBe(primaryUserData.email); // Verify it wasn't changed
    });


    it('should fail to update profile without authentication', async () => {
      const response = await request(app)
        .put('/api/users/me')
        .send(profileUpdateData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/users/change-password', () => {
    const currentPassword = primaryUserData.password; // Original password
    const newValidPassword = 'NewPassword456!';

    afterEach(async () => {
      // Ensure primaryTestUser's password is reset to original if a test changes it and fails mid-way
      // or if we want a consistent starting password for each test in this block.
      // This might be complex if the test itself is for successful password change.
      // For now, we'll handle password state carefully within tests.
      // If a test successfully changes the password, subsequent tests in this block might need adjustment
      // or the user's password needs to be programmatically reset.
      // A simpler approach is to re-login if token becomes invalid due to password change.
      // Or, ensure the "successful change" test is last or cleans up by changing back.
    });

    it('should change the user\'s password successfully', async () => {
      const response = await request(app)
        .put('/api/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: currentPassword,
          newPassword: newValidPassword,
          confirmNewPassword: newValidPassword,
        })
        .expect(200); // Or 204

      expect(response.body.success).toBe(true);
      // expect(response.body.message).toMatch(/password changed successfully/i); // If message is sent

      const dbUser = await User.findById(primaryTestUser._id);
      const isMatch = await bcrypt.compare(newValidPassword, dbUser.password);
      expect(isMatch).toBe(true);

      // Try logging in with the new password
      const loginWithNewPassResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: primaryUserData.email, password: newValidPassword })
        .expect(200);
      expect(loginWithNewPassResponse.body.success).toBe(true);
      // Update accessToken for subsequent tests if needed, though typically test suites are isolated.
      accessToken = loginWithNewPassResponse.body.data.tokens.accessToken;


      // Try logging in with the old password - should fail
      await request(app)
        .post('/api/auth/login')
        .send({ email: primaryUserData.email, password: currentPassword })
        .expect(401); // Assuming login fails with 401 for wrong password

      // IMPORTANT: Change password back to original for subsequent tests if this is not the last test
      // or if other describe blocks rely on the original password.
      // This is crucial for test independence.
      const revertResponse = await request(app)
        .put('/api/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`) // using new token
        .send({ currentPassword: newValidPassword, newPassword: currentPassword, confirmNewPassword: currentPassword })
        .expect(200);
      expect(revertResponse.body.success).toBe(true);
      // Re-login with original password to ensure token is valid for other tests
        const reLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({ email: primaryUserData.email, password: currentPassword })
        .expect(200);
        accessToken = reLoginResponse.body.data.tokens.accessToken;

    });

    it('should fail to change password with incorrect current password', async () => {
      const response = await request(app)
        .put('/api/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongOldPassword123!',
          newPassword: newValidPassword,
          confirmNewPassword: newValidPassword,
        })
        .expect(400); // Or 401

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/incorrect current password/i);
    });

    it('should fail if new password and confirmation do not match', async () => {
      const response = await request(app)
        .put('/api/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: currentPassword,
          newPassword: newValidPassword,
          confirmNewPassword: 'DoesNotMatchPassword123!',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/passwords do not match/i);
    });

    it('should fail with a weak new password (if password policy is enforced)', async () => {
      const response = await request(app)
        .put('/api/users/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: currentPassword,
          newPassword: 'weak',
          confirmNewPassword: 'weak',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      // This message depends on your validation library (e.g., express-validator, joi)
      expect(response.body.message).toMatch(/password is too weak/i); // Or specific criteria not met
    });

    it('should fail to change password without authentication', async () => {
      const response = await request(app)
        .put('/api/users/change-password')
        .send({
          currentPassword: currentPassword,
          newPassword: newValidPassword,
          confirmNewPassword: newValidPassword,
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
