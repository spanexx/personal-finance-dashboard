/**
 * Master API Test Runner
 * Runs all API test suites in sequence
 */

const { runAllTests: runAuthAndUserTests } = require('./test-api');
const { runAllTests: runFinanceTests } = require('./test-finance-apis');
const { runAllSecurityTests } = require('./test-security');

async function runAllApiTests() {
  console.log('🔍 COMPREHENSIVE API TEST SUITE');
  console.log('==============================');
  console.log(`Starting comprehensive API testing at: ${new Date().toISOString()}`);
  
  console.log('\n\n📌 RUNNING AUTH & USER API TESTS');
  console.log('===============================');
  try {
    await runAuthAndUserTests();
  } catch (error) {
    console.error('❌ Auth & User API tests failed:', error.message);
  }
  
  console.log('\n\n📌 RUNNING FINANCE API TESTS');
  console.log('===========================');
  try {
    await runFinanceTests();
  } catch (error) {
    console.error('❌ Finance API tests failed:', error.message);
  }
  
  console.log('\n\n📌 RUNNING SECURITY API TESTS');
  console.log('============================');
  try {
    await runAllSecurityTests();
  } catch (error) {
    console.error('❌ Security API tests failed:', error.message);
  }
  
  console.log('\n\n🏁 ALL API TESTS COMPLETED');
  console.log('=========================');
  console.log(`Test suite completed at: ${new Date().toISOString()}`);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run all tests when this script is executed directly
if (require.main === module) {
  runAllApiTests().catch(console.error);
}

module.exports = { runAllApiTests };
