const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server'); // Assuming server exports the app
const User = require('../../models/User');
const Goal = require('../../models/Goal');

describe('Goal API Endpoints', () => {
  let testUser;
  let accessToken;

  const testUserData = {
    firstName: 'Goal',
    lastName: 'Setter',
    username: 'goaltester',
    email: 'goal.tester@example.com',
    password: 'Password123!',
  };

  beforeAll(async () => {
    // Create user
    await User.deleteMany({ email: testUserData.email }); // Clean up if exists
    testUser = await User.create({ ...testUserData, isEmailVerified: true });

    // Log in user to get accessToken
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: testUserData.email, password: testUserData.password });
    accessToken = loginResponse.body.data.tokens.accessToken;
    expect(accessToken).toBeDefined();
  });

  afterAll(async () => {
    // Clean up: remove user and their goals
    // Relies on setup.js for broader cleaning but can be specific if needed
    // await User.findByIdAndDelete(testUser._id);
    // await Goal.deleteMany({ user: testUser._id });
  });

  beforeEach(async () => {
    // Clear goals for the test user before each test to ensure isolation
    await Goal.deleteMany({ user: testUser._id });
  });

  // Test suites for CRUD operations and contributions will be added here
  describe('POST /api/goals', () => {
    const validGoalData = {
      name: 'Vacation to Hawaii',
      targetAmount: 3000,
      targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(), // One year from now
      description: 'Saving up for a trip to Hawaii.',
      // Assuming other fields like currentAmount, status are handled by backend defaults
    };

    it('should create a new goal successfully', async () => {
      const response = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validGoalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(validGoalData.name);
      expect(response.body.data.targetAmount).toBe(validGoalData.targetAmount);
      expect(response.body.data.user).toBe(testUser._id.toString());
      expect(response.body.data.currentAmount).toBe(0); // Assuming default
      expect(response.body.data.status).toBe('in-progress'); // Assuming default

      const dbGoal = await Goal.findById(response.body.data._id);
      expect(dbGoal).not.toBeNull();
      expect(dbGoal.name).toBe(validGoalData.name);
      expect(dbGoal.user.toString()).toBe(testUser._id.toString());
    });

    it('should fail to create a goal with missing required fields', async () => {
      const incompleteData = { name: 'Missing Fields Goal' }; // Missing targetAmount, targetDate
      const response = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(err => err.path === 'targetAmount')).toBe(true);
      expect(response.body.errors.some(err => err.path === 'targetDate')).toBe(true);
    });

    it('should fail with invalid data types (e.g., non-numeric targetAmount)', async () => {
      const invalidData = { ...validGoalData, targetAmount: 'not-a-number' };
      const response = await request(app)
        .post('/api/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(err => err.path === 'targetAmount')).toBe(true);
    });

    it('should fail if targetDate is in the past', async () => {
        const pastDateData = {
            ...validGoalData,
            targetDate: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString()
        };
        const response = await request(app)
            .post('/api/goals')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(pastDateData)
            .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
        // Assuming a specific error message or path for targetDate validation
        expect(response.body.errors.some(err => err.path === 'targetDate' && err.message.includes('future'))).toBe(true);
    });

    it('should fail to create a goal without authentication', async () => {
      const response = await request(app)
        .post('/api/goals')
        .send(validGoalData) // No Authorization header
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/authorization token required/i);
    });
  });

  describe('GET /api/goals', () => {
    let otherUser;
    let goalForOtherUser;

    beforeAll(async () => {
      // Create another user for testing goal isolation
      otherUser = await User.create({
        firstName: 'OtherGoal', lastName: 'UserGoal',
        username: 'otherusergoal', email: 'other.user.goal@example.com',
        password: 'Password123!', isEmailVerified: true
      });
      goalForOtherUser = await Goal.create({
        name: 'Other User Goal', targetAmount: 100, targetDate: new Date(),
        user: otherUser._id
      });
    });

    afterAll(async () => {
      if (otherUser) await User.findByIdAndDelete(otherUser._id);
      if (goalForOtherUser) await Goal.findByIdAndDelete(goalForOtherUser._id);
    });

    it('should get all goals for the authenticated user', async () => {
      await Goal.create({ name: 'Goal 1', targetAmount: 1000, targetDate: new Date(), user: testUser._id });
      await Goal.create({ name: 'Goal 2', targetAmount: 2000, targetDate: new Date(), user: testUser._id, status: 'completed' });

      const response = await request(app)
        .get('/api/goals')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.goals).toBeInstanceOf(Array);
      expect(response.body.data.goals.length).toBe(2);
      response.body.data.goals.forEach(goal => {
        expect(goal.user.toString()).toBe(testUser._id.toString());
      });
      const ids = response.body.data.goals.map(g => g._id.toString());
      expect(ids).not.toContain(goalForOtherUser._id.toString());
    });

    it('should filter goals by status (e.g., completed)', async () => {
      await Goal.create({ name: 'In-Progress Goal', targetAmount: 1000, targetDate: new Date(), user: testUser._id, status: 'in-progress' });
      await Goal.create({ name: 'Completed Goal', targetAmount: 2000, targetDate: new Date(), user: testUser._id, status: 'completed' });

      const response = await request(app)
        .get('/api/goals?status=completed')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.goals.length).toBe(1);
      expect(response.body.data.goals[0].status).toBe('completed');
      expect(response.body.data.goals[0].name).toBe('Completed Goal');
    });

    it('should return empty array if no goals match filter', async () => {
        await Goal.create({ name: 'In-Progress Goal Filter', targetAmount: 1000, targetDate: new Date(), user: testUser._id, status: 'in-progress' });
        const response = await request(app)
          .get('/api/goals?status=achieved') // Assuming 'achieved' is not a status used or no goals have it
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.goals).toBeInstanceOf(Array);
        expect(response.body.data.goals.length).toBe(0);
      });

    it('should fail to get goals without authentication', async () => {
      const response = await request(app)
        .get('/api/goals')
        .expect(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/goals/:id', () => {
    let goalToDelete;
    let otherUserForDelete;
    let goalOfOtherUserForDelete;

    beforeAll(async () => {
        otherUserForDelete = await User.create({
            firstName: 'OtherDeleteGoal', lastName: 'UserDeleteGoal',
            username: 'otherdeletegoal', email: 'other.delete.goal@example.com',
            password: 'Password123!', isEmailVerified: true
        });
        goalOfOtherUserForDelete = await Goal.create({
            name: 'Other User Delete Goal', targetAmount: 800, targetDate: new Date(),
            user: otherUserForDelete._id
        });
    });

    afterAll(async () => {
        if(otherUserForDelete) await User.findByIdAndDelete(otherUserForDelete._id);
        if(goalOfOtherUserForDelete) await Goal.findByIdAndDelete(goalOfOtherUserForDelete._id);
    });

    beforeEach(async () => {
      goalToDelete = await Goal.create({
        name: 'Goal to Delete', targetAmount: 1800,
        targetDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
        user: testUser._id
      });
    });

    it('should delete a goal successfully', async () => {
      const response = await request(app)
        .delete(`/api/goals/${goalToDelete._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200); // Or 204 if no content is returned

      expect(response.body.success).toBe(true);
      // if (response.status === 200) { // Message might only be on 200
      //   expect(response.body.message).toMatch(/deleted successfully/i);
      // }

      const dbGoal = await Goal.findById(goalToDelete._id);
      expect(dbGoal).toBeNull();
    });

    it('should fail to delete a goal not belonging to the user', async () => {
      const response = await request(app)
        .delete(`/api/goals/${goalOfOtherUserForDelete._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404); // Or 403

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should return 404 when trying to delete a non-existent goal', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/goals/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should fail to delete a goal without authentication', async () => {
      const response = await request(app)
        .delete(`/api/goals/${goalToDelete._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/goals/:id', () => {
    let goalToUpdate;
    let otherUserForUpdate;
    let goalOfOtherUserForUpdate;

    beforeAll(async () => {
        otherUserForUpdate = await User.create({
            firstName: 'OtherUpdateGoal', lastName: 'UserUpdateGoal',
            username: 'otherupdategoal', email: 'other.update.goal@example.com',
            password: 'Password123!', isEmailVerified: true
        });
        goalOfOtherUserForUpdate = await Goal.create({
            name: 'Other User Update Goal', targetAmount: 700, targetDate: new Date(),
            user: otherUserForUpdate._id
        });
    });

    afterAll(async () => {
        if(otherUserForUpdate) await User.findByIdAndDelete(otherUserForUpdate._id);
        if(goalOfOtherUserForUpdate) await Goal.findByIdAndDelete(goalOfOtherUserForUpdate._id);
    });

    beforeEach(async () => {
      goalToUpdate = await Goal.create({
        name: 'Goal to Update', targetAmount: 1200,
        targetDate: new Date(new Date().setMonth(new Date().getMonth() + 3)),
        user: testUser._id, currentAmount: 100
      });
    });

    it('should update a goal successfully', async () => {
      const updateData = {
        name: 'Updated Goal Name',
        targetAmount: 1300,
        currentAmount: 150, // Assuming direct update to currentAmount is allowed
        status: 'on-hold' // Example of updating status
      };

      const response = await request(app)
        .put(`/api/goals/${goalToUpdate._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data._id.toString()).toBe(goalToUpdate._id.toString());
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.targetAmount).toBe(updateData.targetAmount);
      expect(response.body.data.currentAmount).toBe(updateData.currentAmount);
      expect(response.body.data.status).toBe(updateData.status);

      const dbGoal = await Goal.findById(goalToUpdate._id);
      expect(dbGoal.name).toBe(updateData.name);
      expect(dbGoal.currentAmount).toBe(updateData.currentAmount);
    });

    it('should fail to update with invalid data (e.g., past targetDate)', async () => {
      const invalidUpdateData = { targetDate: new Date(new Date().setFullYear(new Date().getFullYear() -1)).toISOString() };
      const response = await request(app)
        .put(`/api/goals/${goalToUpdate._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(err => err.path === 'targetDate')).toBe(true);
    });

    it('should fail to update a goal not belonging to the user', async () => {
      const updateData = { name: 'Attempted Update' };
      const response = await request(app)
        .put(`/api/goals/${goalOfOtherUserForUpdate._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(404); // Or 403

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should fail to update a non-existent goal', async () => {
        const nonExistentId = new mongoose.Types.ObjectId().toString();
        const updateData = { name: 'Non Existent Update' };
        const response = await request(app)
          .put(`/api/goals/${nonExistentId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/not found/i);
      });

    it('should fail to update a goal without authentication', async () => {
      const updateData = { name: 'Unauthenticated Update' };
      const response = await request(app)
        .put(`/api/goals/${goalToUpdate._id}`)
        .send(updateData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // Correcting order: GET /api/goals/:id should be before PUT /api/goals/:id
  describe('GET /api/goals/:id', () => {
    let testGoal;
    let otherUserForSingleGet;
    let goalOfOtherUserForSingleGet;

    beforeAll(async () => {
        otherUserForSingleGet = await User.create({
            firstName: 'OtherSingleGoal', lastName: 'UserSingleGoal',
            username: 'othersinglegoal', email: 'other.single.goal@example.com',
            password: 'Password123!', isEmailVerified: true
        });
        goalOfOtherUserForSingleGet = await Goal.create({
            name: 'Other User Single Goal', targetAmount: 500, targetDate: new Date(),
            user: otherUserForSingleGet._id
        });
    });

    afterAll(async () => {
        if(otherUserForSingleGet) await User.findByIdAndDelete(otherUserForSingleGet._id);
        if(goalOfOtherUserForSingleGet) await Goal.findByIdAndDelete(goalOfOtherUserForSingleGet._id);
    });

    beforeEach(async () => {
      // Create a goal for the main testUser before each test in this suite
      testGoal = await Goal.create({
        name: 'My Single Test Goal', targetAmount: 1500,
        targetDate: new Date(new Date().setMonth(new Date().getMonth() + 6)), // 6 months from now
        user: testUser._id
      });
    });

    it('should get a specific goal by ID successfully', async () => {
      const response = await request(app)
        .get(`/api/goals/${testGoal._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data._id.toString()).toBe(testGoal._id.toString());
      expect(response.body.data.name).toBe(testGoal.name);
      expect(response.body.data.user.toString()).toBe(testUser._id.toString());
    });

    it('should fail to get a goal not belonging to the user', async () => {
      const response = await request(app)
        .get(`/api/goals/${goalOfOtherUserForSingleGet._id}`)
        .set('Authorization', `Bearer ${accessToken}`) // Authenticated as testUser
        .expect(404); // Or 403, API dependent

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i); // Or "access denied"
    });

    it('should return 404 for a non-existent goal ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/goals/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should fail to get a goal without authentication', async () => {
      const response = await request(app)
        .get(`/api/goals/${testGoal._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  // POST /api/goals/:id/contributions tests
  describe('POST /api/goals/:id/contributions', () => {
    let goalForContribution;
    const contributionData = {
      amount: 50,
      date: new Date().toISOString(),
      description: 'Weekly contribution'
    };

    beforeEach(async () => {
      goalForContribution = await Goal.create({
        name: 'Goal for Contributions', targetAmount: 500, currentAmount: 100,
        targetDate: new Date(new Date().setMonth(new Date().getMonth() + 2)),
        user: testUser._id,
        contributions: [] // Ensure it starts with an empty array or as defined in schema
      });
    });

    it('should add a contribution to a goal successfully', async () => {
      const response = await request(app)
        .post(`/api/goals/${goalForContribution._id}/contributions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(contributionData)
        .expect(200); // Or 201 if a contribution resource is created

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.currentAmount).toBe(goalForContribution.currentAmount + contributionData.amount);
      expect(response.body.data.contributions).toBeInstanceOf(Array);
      expect(response.body.data.contributions.length).toBeGreaterThan(0);
      // Check if the last contribution matches what was sent (details depend on response structure)
      const lastContribution = response.body.data.contributions[response.body.data.contributions.length - 1];
      expect(lastContribution.amount).toBe(contributionData.amount);
      // expect(new Date(lastContribution.date).toISOString()).toBe(contributionData.date); // Date comparison can be tricky

      const dbGoal = await Goal.findById(goalForContribution._id);
      expect(dbGoal.currentAmount).toBe(goalForContribution.currentAmount + contributionData.amount);
      expect(dbGoal.contributions.length).toBe(1);
      expect(dbGoal.contributions[0].amount).toBe(contributionData.amount);
    });

    it('should fail to add contribution with invalid data (e.g., negative amount)', async () => {
      const invalidContribution = { ...contributionData, amount: -50 };
      const response = await request(app)
        .post(`/api/goals/${goalForContribution._id}/contributions`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidContribution)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(err => err.path === 'amount')).toBe(true);
    });

    it('should fail to add contribution to a goal not belonging to the user', async () => {
      // Create a goal for another user
      const otherUser = await User.create({ email: 'othercontrib@example.com', password: 'password', username: 'othercontrib' });
      const otherUserGoal = await Goal.create({ name: 'Other User Goal Contrib', targetAmount: 100, user: otherUser._id, targetDate: new Date() });

      const response = await request(app)
        .post(`/api/goals/${otherUserGoal._id}/contributions`)
        .set('Authorization', `Bearer ${accessToken}`) // Authenticated as testUser
        .send(contributionData)
        .expect(404); // Or 403

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
      await User.findByIdAndDelete(otherUser._id); // Cleanup
      await Goal.findByIdAndDelete(otherUserGoal._id);
    });

    it('should fail to add contribution without authentication', async () => {
      const response = await request(app)
        .post(`/api/goals/${goalForContribution._id}/contributions`)
        .send(contributionData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});
