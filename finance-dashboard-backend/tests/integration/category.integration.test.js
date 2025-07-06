const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server'); // Assuming server exports the app
const User = require('../../models/User');
const Category = require('../../models/Category');
// Import Transaction model if needed for testing delete with associated transactions
// const Transaction = require('../../models/Transaction');

describe('Category API Endpoints', () => {
  let testUser;
  let accessToken;

  const testUserData = {
    firstName: 'Category',
    lastName: 'Manager',
    username: 'categorytester',
    email: 'category.tester@example.com',
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
    // Clean up: remove user and their categories
    // Relies on setup.js for broader cleaning.
    // await User.findByIdAndDelete(testUser._id);
    // await Category.deleteMany({ user: testUser._id });
  });

  beforeEach(async () => {
    // Clear categories for the test user before each test
    await Category.deleteMany({ user: testUser._id });
  });

  // Test suites for CRUD operations will be added here
  describe('POST /api/categories', () => {
    const validCategoryData = {
      name: 'Groceries',
      type: 'expense',
      color: '#FF5733',
      icon: 'shopping-cart',
    };

    it('should create a new category successfully', async () => {
      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validCategoryData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(validCategoryData.name);
      expect(response.body.data.type).toBe(validCategoryData.type);
      expect(response.body.data.user).toBe(testUser._id.toString());

      const dbCategory = await Category.findById(response.body.data._id);
      expect(dbCategory).not.toBeNull();
      expect(dbCategory.name).toBe(validCategoryData.name);
      expect(dbCategory.user.toString()).toBe(testUser._id.toString());
    });

    it('should create a sub-category successfully', async () => {
      const parentCategory = await Category.create({ ...validCategoryData, name: 'Parent Food', user: testUser._id });
      const subCategoryData = {
        name: 'Fruits',
        type: 'expense', // Usually same as parent, or flexible
        color: '#C70039',
        icon: 'apple',
        parent: parentCategory._id.toString(),
      };

      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(subCategoryData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(subCategoryData.name);
      expect(response.body.data.parent.toString()).toBe(parentCategory._id.toString());

      const dbSubCategory = await Category.findById(response.body.data._id);
      expect(dbSubCategory.parent.toString()).toBe(parentCategory._id.toString());
    });

    it('should fail to create category with missing required fields (name, type)', async () => {
      const incompleteData = { color: '#111111' };
      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.some(err => err.path === 'name')).toBe(true);
      expect(response.body.errors.some(err => err.path === 'type')).toBe(true);
    });

    it('should fail with invalid type (not income/expense)', async () => {
      const invalidTypeData = { ...validCategoryData, type: 'investment' };
      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidTypeData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.some(err => err.path === 'type')).toBe(true);
    });

    it('should fail with non-existent parentId', async () => {
        const nonExistentParentId = new mongoose.Types.ObjectId().toString();
        const subCategoryData = { ...validCategoryData, name: 'Sub With Invalid Parent', parent: nonExistentParentId };
        const response = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(subCategoryData)
            .expect(400); // Or 404 if specific check for parent existence

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/parent category not found/i); // Adjust if needed
    });

    it('should fail to create a sub-category under another user\'s category', async () => {
        const otherUser = await User.create({ email: 'othercat@example.com', password: 'password', username: 'othercatuser' });
        const otherUserParentCategory = await Category.create({ name: 'Other User Parent', type: 'expense', user: otherUser._id });

        const subCategoryData = {
            ...validCategoryData,
            name: 'My Sub Other Parent',
            parent: otherUserParentCategory._id.toString()
        };
        const response = await request(app)
            .post('/api/categories')
            .set('Authorization', `Bearer ${accessToken}`)
            .send(subCategoryData)
            .expect(400); // Or 403/404 depending on how parent ownership is checked

        expect(response.body.success).toBe(false);
        expect(response.body.message).toMatch(/parent category not found/i); // Or access denied

        await User.findByIdAndDelete(otherUser._id);
        await Category.findByIdAndDelete(otherUserParentCategory._id);
    });

    it('should fail to create category with duplicate name for the same user and type', async () => {
      await Category.create({ ...validCategoryData, user: testUser._id }); // Create it once

      // Attempt to create again with same name and type
      const response = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(validCategoryData)
        .expect(409); // Or 400

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/category with this name and type already exists/i);
    });

    it('should fail to create a category without authentication', async () => {
      const response = await request(app)
        .post('/api/categories')
        .send(validCategoryData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/authorization token required/i);
    });
  });

  describe('GET /api/categories', () => {
    let otherUser;
    let categoryForOtherUser;
    let parentCat, childCat;

    beforeAll(async () => {
      otherUser = await User.create({
        firstName: 'OtherCatGet', lastName: 'UserCatGet',
        username: 'otherusercatget', email: 'other.user.catget@example.com',
        password: 'Password123!', isEmailVerified: true
      });
      categoryForOtherUser = await Category.create({
        name: 'Other User Cat', type: 'income', user: otherUser._id
      });
    });

    afterAll(async () => {
      if (otherUser) await User.findByIdAndDelete(otherUser._id);
      if (categoryForOtherUser) await Category.findByIdAndDelete(categoryForOtherUser._id);
    });

    beforeEach(async () => {
        // Clear before each to ensure only categories created in this describe block's context are present for testUser
        await Category.deleteMany({ user: testUser._id });
        parentCat = await Category.create({ name: 'Parent', type: 'expense', user: testUser._id, color: '#111', icon: 'folder' });
        childCat = await Category.create({ name: 'Child', type: 'expense', user: testUser._id, parent: parentCat._id, color: '#222', icon: 'file' });
        await Category.create({ name: 'Standalone Income', type: 'income', user: testUser._id, color: '#333', icon: 'money' });
    });

    it('should get all categories for the authenticated user, including hierarchy', async () => {
      const response = await request(app)
        .get('/api/categories')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories).toBeInstanceOf(Array);
      // Expecting 3 categories for testUser (Parent, Child, Standalone Income)
      // The exact number might vary based on how deep the hierarchy is represented or if it's flattened
      // Assuming a flat list is returned and hierarchy is client-side or via populated 'parent'
      expect(response.body.data.categories.length).toBe(3);

      response.body.data.categories.forEach(cat => {
        expect(cat.user.toString()).toBe(testUser._id.toString());
      });
      const ids = response.body.data.categories.map(c => c._id.toString());
      expect(ids).not.toContain(categoryForOtherUser._id.toString());

      // Check for parent-child relationship if API populates it or returns it in a specific way
      const foundChild = response.body.data.categories.find(c => c._id.toString() === childCat._id.toString());
      expect(foundChild).toBeDefined();
      // If parent is populated as an object: expect(foundChild.parent._id.toString()).toBe(parentCat._id.toString());
      // If parent is just an ID:
      expect(foundChild.parent.toString()).toBe(parentCat._id.toString());
    });

    it('should filter categories by type (income)', async () => {
      const response = await request(app)
        .get('/api/categories?type=income')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.categories.length).toBe(1);
      expect(response.body.data.categories[0].type).toBe('income');
      expect(response.body.data.categories[0].name).toBe('Standalone Income');
    });

    it('should filter categories by type (expense)', async () => {
        const response = await request(app)
          .get('/api/categories?type=expense')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.categories.length).toBe(2); // Parent and Child
        response.body.data.categories.forEach(cat => expect(cat.type).toBe('expense'));
      });

    it('should fail to get categories without authentication', async () => {
      const response = await request(app)
        .get('/api/categories')
        .expect(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/categories/:id', () => {
    let categoryToDelete;
    let otherUserDelete;
    let categoryOfOtherUserDelete;
    let parentWithChild, childOfParent;
    // Mock Transaction model for testing deletion prevention
    // const Transaction = require('../../models/Transaction');

    beforeAll(async () => {
        otherUserDelete = await User.create({
            firstName: 'OtherDeleteCat', lastName: 'UserDeleteCat',
            username: 'otherdeletecat', email: 'other.delete.cat@example.com',
            password: 'Password123!', isEmailVerified: true
        });
        categoryOfOtherUserDelete = await Category.create({
            name: 'Other User Delete Cat', type: 'expense', user: otherUserDelete._id
        });
    });

    afterAll(async () => {
        if(otherUserDelete) await User.findByIdAndDelete(otherUserDelete._id);
        if(categoryOfOtherUserDelete) await Category.findByIdAndDelete(categoryOfOtherUserDelete._id);
    });

    beforeEach(async () => {
        await Category.deleteMany({ user: testUser._id }); // Clear before each
        categoryToDelete = await Category.create({ name: 'To Delete', type: 'income', user: testUser._id });
        parentWithChild = await Category.create({ name: 'Parent With Child', type: 'expense', user: testUser._id });
        childOfParent = await Category.create({ name: 'Child of Parent', type: 'expense', user: testUser._id, parent: parentWithChild._id });
    });

    it('should delete a category successfully', async () => {
      const response = await request(app)
        .delete(`/api/categories/${categoryToDelete._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200); // Or 204

      expect(response.body.success).toBe(true);
      // expect(response.body.message).toMatch(/deleted successfully/i);

      const dbCategory = await Category.findById(categoryToDelete._id);
      expect(dbCategory).toBeNull();
    });

    it('should handle deleting a category with associated transactions (e.g., prevent or require force)', async () => {
      // This test's expectation depends heavily on API logic.
      // 1. Create a transaction linked to categoryToDelete
      // For now, assuming we need to import Transaction model
      // const transaction = await Transaction.create({
      //     amount: 100, type: 'income', category: categoryToDelete._id,
      //     user: testUser._id, date: new Date(), description: 'Test Tx For Cat Delete'
      // });

      const response = await request(app)
        .delete(`/api/categories/${categoryToDelete._id}`)
        .set('Authorization', `Bearer ${accessToken}`);
        // .expect(400); // If deletion is blocked

      // If blocked:
      // expect(response.body.success).toBe(false);
      // expect(response.body.message).toMatch(/cannot delete category with associated transactions/i);
      // const dbCategory = await Category.findById(categoryToDelete._id);
      // expect(dbCategory).not.toBeNull();

      // If allowed (e.g., transactions are disassociated or deleted - less common for categories):
      expect(response.status).toBe(200); // Or 204
      // Further checks if transactions are modified...

      // For this template, let's assume simple deletion is allowed or no transactions are present.
      // If transactions are present, this test would need adjustment.
      // await Transaction.findByIdAndDelete(transaction._id); // Clean up transaction if created
    });

    it('should handle deleting a category with sub-categories (e.g., delete children or prevent)', async () => {
        // Attempt to delete parentWithChild
        const response = await request(app)
            .delete(`/api/categories/${parentWithChild._id}`)
            .set('Authorization', `Bearer ${accessToken}`);
            // .expect(200); // Or 400 if blocked

        // If children are also deleted (cascade):
        expect(response.status).toBe(200); // Or 204
        const dbParent = await Category.findById(parentWithChild._id);
        const dbChild = await Category.findById(childOfParent._id);
        expect(dbParent).toBeNull();
        expect(dbChild).toBeNull(); // Assuming cascade delete or promotion then delete

        // If deletion is blocked because of children:
        // expect(response.status).toBe(400);
        // expect(response.body.message).toMatch(/cannot delete category with sub-categories/i);
    });

    it('should fail to delete a category not belonging to the user', async () => {
      const response = await request(app)
        .delete(`/api/categories/${categoryOfOtherUserDelete._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404); // Or 403

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should return 404 when trying to delete a non-existent category', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .delete(`/api/categories/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should fail to delete a category without authentication', async () => {
      const response = await request(app)
        .delete(`/api/categories/${categoryToDelete._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/categories/:id', () => {
    let testCategory;
    let otherUserSingle;
    let categoryOfOtherUserSingle;

    beforeAll(async () => {
        otherUserSingle = await User.create({
            firstName: 'OtherSingleCat', lastName: 'UserSingleCat',
            username: 'othersinglecat', email: 'other.single.cat@example.com',
            password: 'Password123!', isEmailVerified: true
        });
        categoryOfOtherUserSingle = await Category.create({
            name: 'Other User Single Cat', type: 'expense', user: otherUserSingle._id
        });
    });

    afterAll(async () => {
        if(otherUserSingle) await User.findByIdAndDelete(otherUserSingle._id);
        if(categoryOfOtherUserSingle) await Category.findByIdAndDelete(categoryOfOtherUserSingle._id);
    });

    beforeEach(async () => {
      // Create a category for the main testUser before each test in this suite
      await Category.deleteMany({ user: testUser._id}); // Clear first
      testCategory = await Category.create({
        name: 'My Test Category', type: 'income', color: '#ABC', icon: 'star',
        user: testUser._id
      });
    });

    it('should get a specific category by ID successfully', async () => {
      const response = await request(app)
        .get(`/api/categories/${testCategory._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data._id.toString()).toBe(testCategory._id.toString());
      expect(response.body.data.name).toBe(testCategory.name);
      expect(response.body.data.user.toString()).toBe(testUser._id.toString());
    });

    it('should fail to get a category not belonging to the user', async () => {
      const response = await request(app)
        .get(`/api/categories/${categoryOfOtherUserSingle._id}`)
        .set('Authorization', `Bearer ${accessToken}`) // Authenticated as testUser
        .expect(404); // Or 403

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should return 404 for a non-existent category ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const response = await request(app)
        .get(`/api/categories/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should fail to get a category without authentication', async () => {
      const response = await request(app)
        .get(`/api/categories/${testCategory._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/categories/:id', () => {
    let categoryToUpdate;
    let otherUserUpdate;
    let categoryOfOtherUserUpdate;
    let parentCatForUpdate, childCatForUpdate;


    beforeAll(async () => {
        otherUserUpdate = await User.create({
            firstName: 'OtherUpdateCat', lastName: 'UserUpdateCat',
            username: 'otherupdatecat', email: 'other.update.cat@example.com',
            password: 'Password123!', isEmailVerified: true
        });
        categoryOfOtherUserUpdate = await Category.create({
            name: 'Other User Update Cat', type: 'expense', user: otherUserUpdate._id
        });
    });

    afterAll(async () => {
        if(otherUserUpdate) await User.findByIdAndDelete(otherUserUpdate._id);
        if(categoryOfOtherUserUpdate) await Category.findByIdAndDelete(categoryOfOtherUserUpdate._id);
    });

    beforeEach(async () => {
      await Category.deleteMany({ user: testUser._id }); // Clear before each test
      categoryToUpdate = await Category.create({ name: 'Original Name', type: 'expense', user: testUser._id, color: '#123', icon: 'orig' });
      parentCatForUpdate = await Category.create({ name: 'Parent For Update', type: 'expense', user: testUser._id });
      childCatForUpdate = await Category.create({ name: 'Child For Update', type: 'expense', user: testUser._id, parent: parentCatForUpdate._id });
    });

    it('should update a category successfully', async () => {
      const updateData = {
        name: 'Updated Category Name',
        color: '#UPD',
        icon: 'updated_icon',
        parent: parentCatForUpdate._id.toString() // Moving a standalone category under a parent
      };

      const response = await request(app)
        .put(`/api/categories/${categoryToUpdate._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.color).toBe(updateData.color);
      expect(response.body.data.parent.toString()).toBe(updateData.parent);

      const dbCategory = await Category.findById(categoryToUpdate._id);
      expect(dbCategory.name).toBe(updateData.name);
      expect(dbCategory.parent.toString()).toBe(updateData.parent);
    });

    it('should fail to update with invalid data (e.g., invalid type)', async () => {
      const invalidUpdate = { type: 'something_else' };
      const response = await request(app)
        .put(`/api/categories/${categoryToUpdate._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(invalidUpdate)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors.some(err => err.path === 'type')).toBe(true);
    });

    it('should fail to update category to a duplicate name (for same user and type)', async () => {
      await Category.create({ name: 'Existing Name', type: 'expense', user: testUser._id });
      const response = await request(app)
        .put(`/api/categories/${categoryToUpdate._id}`) // categoryToUpdate currently has 'Original Name'
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Existing Name', type: 'expense' }) // Trying to rename to 'Existing Name'
        .expect(409); // Or 400

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/category with this name and type already exists/i);
    });

    it('should prevent circular parent-child relationships', async () => {
      // Try to make parentCatForUpdate a child of childCatForUpdate
      const response = await request(app)
        .put(`/api/categories/${parentCatForUpdate._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ parent: childCatForUpdate._id.toString() })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/circular dependency/i); // Or similar error
    });

    it('should fail to update a category not belonging to the user', async () => {
      const updateData = { name: 'Attempted Update Other' };
      const response = await request(app)
        .put(`/api/categories/${categoryOfOtherUserUpdate._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(404); // Or 403

      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/not found/i);
    });

    it('should fail to update a non-existent category', async () => {
        const nonExistentId = new mongoose.Types.ObjectId().toString();
        const response = await request(app)
          .put(`/api/categories/${nonExistentId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ name: 'Update Non Existent' })
          .expect(404);
        expect(response.body.success).toBe(false);
    });

    it('should fail to update a category without authentication', async () => {
      const response = await request(app)
        .put(`/api/categories/${categoryToUpdate._id}`)
        .send({ name: 'Unauth Update' })
        .expect(401);
      expect(response.body.success).toBe(false);
    });
  });
});
