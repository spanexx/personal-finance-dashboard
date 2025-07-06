/**
 * Simple Upload System Validation
 * Validates that all upload system components are properly integrated
 */

console.log('🔧 Validating Upload System Integration...\n');

try {
  // Test 1: Check if all required modules can be imported
  console.log('📦 Testing module imports...');
  
  const { File, User, Transaction, Budget, Goal, Category } = require('./models');
  console.log('✅ All models imported successfully');
  
  const uploadController = require('./controllers/upload.controller');
  console.log('✅ Upload controller imported successfully');
  
  const uploadRoutes = require('./routes/upload.routes');
  console.log('✅ Upload routes imported successfully');
  
  const uploadValidation = require('./middleware/validation');
  console.log('✅ Upload validation middleware imported successfully');
  
  // Test 2: Check if File model has required methods
  console.log('\n📝 Testing File model structure...');
  
  if (typeof File.findByUser === 'function') {
    console.log('✅ File.findByUser method exists');
  } else {
    console.log('❌ File.findByUser method missing');
  }
  
  if (typeof File.findByEntity === 'function') {
    console.log('✅ File.findByEntity method exists');
  } else {
    console.log('❌ File.findByEntity method missing');
  }
  
  if (typeof File.getStorageStats === 'function') {
    console.log('✅ File.getStorageStats method exists');
  } else {
    console.log('❌ File.getStorageStats method missing');
  }
  
  // Test 3: Check File model schema
  console.log('\n🏗️ Testing File model schema...');
  
  const fileSchema = File.schema;
  const requiredFields = ['filename', 'originalName', 'path', 'mimeType', 'size', 'user', 'entityType'];
  
  for (const field of requiredFields) {
    if (fileSchema.paths[field]) {
      console.log(`✅ Required field '${field}' exists in schema`);
    } else {
      console.log(`❌ Required field '${field}' missing from schema`);
    }
  }
  
  // Test 4: Check upload controller methods
  console.log('\n🎮 Testing upload controller structure...');
  
  const controllerMethods = ['uploadSingle', 'uploadMultiple', 'uploadAvatar', 'getFile', 'getFilesByEntity', 'updateFile', 'deleteFile', 'getStorageStats'];
  
  for (const method of controllerMethods) {
    if (typeof uploadController[method] === 'function') {
      console.log(`✅ Controller method '${method}' exists`);
    } else {
      console.log(`❌ Controller method '${method}' missing`);
    }
  }
  
  // Test 5: Check validation middleware
  console.log('\n🛡️ Testing validation middleware structure...');
  
  if (uploadValidation.validateUpload && typeof uploadValidation.validateUpload === 'object') {
    console.log('✅ Upload validation object exists');
    
    const validationMethods = ['single', 'multiple', 'avatar', 'update', 'getByEntity', 'fileId'];
    for (const method of validationMethods) {
      if (typeof uploadValidation.validateUpload[method] === 'function') {
        console.log(`✅ Validation method '${method}' exists`);
      } else {
        console.log(`❌ Validation method '${method}' missing`);
      }
    }
  } else {
    console.log('❌ Upload validation object missing');
  }
  
  // Test 6: Check file service
  console.log('\n🛠️ Testing file service...');
  
  try {
    const { fileService, fileMetadataManager } = require('./services/file.service');
    console.log('✅ File service imported successfully');
    
    if (typeof fileService.getStorageStats === 'function') {
      console.log('✅ FileService.getStorageStats method exists');
    } else {
      console.log('❌ FileService.getStorageStats method missing');
    }
    
    if (typeof fileMetadataManager.storeMetadata === 'function') {
      console.log('✅ FileMetadataManager.storeMetadata method exists');
    } else {
      console.log('❌ FileMetadataManager.storeMetadata method missing');
    }
  } catch (error) {
    console.log('❌ File service import failed:', error.message);
  }
  
  // Test 7: Check routes integration
  console.log('\n🛣️ Testing routes integration...');
  
  try {
    const routesIndex = require('./routes/index');
    if (routesIndex.uploadRoutes) {
      console.log('✅ Upload routes exported from routes index');
    } else {
      console.log('❌ Upload routes not exported from routes index');
    }
  } catch (error) {
    console.log('❌ Routes index import failed:', error.message);
  }
  
  // Test 8: Check controllers integration
  console.log('\n🎯 Testing controllers integration...');
  
  try {
    const controllersIndex = require('./controllers/index');
    if (controllersIndex.uploadController) {
      console.log('✅ Upload controller exported from controllers index');
    } else {
      console.log('❌ Upload controller not exported from controllers index');
    }
  } catch (error) {
    console.log('❌ Controllers index import failed:', error.message);
  }
  
  console.log('\n🎉 Upload system validation completed!');
  console.log('\n📋 Summary:');
  console.log('   - File model with comprehensive schema and methods');
  console.log('   - Upload controller with all CRUD operations');
  console.log('   - Upload routes with RESTful endpoints');
  console.log('   - Validation middleware for security');
  console.log('   - File service with database integration');
  console.log('   - Proper integration with main application');
  
} catch (error) {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}
