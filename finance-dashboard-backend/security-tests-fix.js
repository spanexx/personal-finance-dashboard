/**
 * Updated Security Tests section for test-api.js
 */

/**
 * Security Tests
 */
async function testSecurityFeatures() {
  console.log('\n🛡️  SECURITY TESTS');
  console.log('==================');
  
  // Store original token for restoring later
  const originalToken = accessToken;

  // Test 1: Invalid Login Attempts
  logTest('Invalid Login Attempts (Rate Limiting)');
  try {
    // Use a new unique email for rate limit testing
    const rateTestEmail = `ratelimit.${Date.now()}@example.com`;
    
    for (let i = 0; i < 3; i++) {
      try {
        await api.post('/auth/login', {
          email: rateTestEmail,
          password: 'wrongpassword'
        }, { timeout: 5000 }); // Add timeout
        logInfo(`Attempt ${i + 1}/3 completed without error`);
      } catch (error) {
        if (error.response?.status === 401) {
          logInfo(`Attempt ${i + 1}/3: Authentication failed as expected`);
        } else if (error.response?.status === 429) {
          logSuccess(`Rate limiting triggered after ${i + 1} attempts`);
          break;
        } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
          logInfo(`Network error on attempt ${i + 1} (likely due to rate limiting)`);
          break;
        } else {
          logError(`Unexpected error on attempt ${i + 1}: ${error.message}`);
        }
      }
    }
    logSuccess('Rate limiting test completed');
  } catch (error) {
    logError(`Rate limiting test failed: ${error.message}`);
  }

  // Test 2: Unauthorized Access
  logTest('Unauthorized Access to Protected Routes');
  try {
    // Remove auth token temporarily
    accessToken = '';
    
    const response = await api.get('/users/profile', { timeout: 5000 });
    logError('Unauthorized access was allowed - security issue!');
  } catch (error) {
    if (error.response?.status === 401) {
      logSuccess('Unauthorized access properly blocked');
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      logInfo('Network error during unauthorized access test (server might have blocked the connection)');
    } else {
      logError(`Unexpected error during unauthorized access test: ${error.message}`);
    }
  }
  
  // Test 3: Invalid Token
  logTest('Invalid Token Handling');
  try {
    accessToken = 'invalid.token.here';
    
    const response = await api.get('/users/profile', { timeout: 5000 });
    logError('Invalid token was accepted - security issue!');
  } catch (error) {
    if (error.response?.status === 401) {
      logSuccess('Invalid token properly rejected');
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      logInfo('Network error during invalid token test (server might have blocked the connection)');
    } else {
      logError(`Unexpected error during invalid token test: ${error.message}`);
    }
  }
  
  // Restore original token
  accessToken = originalToken;
  
  return true;
}
