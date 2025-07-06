# Fix test scripts to handle network issues better

# 1. Add the security-tests code snippet to the test-api.js file
Write-Host "Updating test-api.js file with improved error handling..."

# Backup the original file
Copy-Item -Path ".\test-api.js" -Destination ".\test-api.js.bak" -Force

# Get the security tests content
$securityTests = Get-Content -Path ".\security-tests-fix.js" -Raw

# Read the original file
$content = Get-Content -Path ".\test-api.js" -Raw

# Replace the security tests section
$pattern = "(?s)/\*\*\r?\n \* Security Tests\r?\n \*/.*?async function testSecurityFeatures\(\) \{.*?return true;\r?\n\}"
$content = $content -replace $pattern, $securityTests

# Write the content back to the file
Set-Content -Path ".\test-api.js" -Value $content

# 2. Now update the network handling in test-finance-apis.js
Write-Host "Updating test-finance-apis.js with better network error handling..."

# Backup the original file
Copy-Item -Path ".\test-finance-apis.js" -Destination ".\test-finance-apis.js.bak" -Force

# Read the original file
$financeContent = Get-Content -Path ".\test-finance-apis.js" -Raw

# Update the axios client configuration
$newAxiosConfig = @"
// HTTP client with interceptors
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // Increased timeout
  headers: {
    'Content-Type': 'application/json'
  },
  // Additional axios config to handle network issues better
  maxRetries: 3,
  retryDelay: 1000
});

// Add retry functionality to axios
api.interceptors.response.use(undefined, function axiosRetryInterceptor(err) {
  const config = err.config;
  // If config does not exist or the retry option is not set, reject
  if(!config || !config.maxRetries) return Promise.reject(err);
  
  // Set the variable for keeping track of the retry count
  config.__retryCount = config.__retryCount || 0;
  
  // Check if we've maxed out the total number of retries
  if(config.__retryCount >= config.maxRetries) {
    // Reject with the error
    return Promise.reject(err);
  }
  
  // Increase the retry count
  config.__retryCount += 1;
  
  // Create new promise to handle exponential backoff
  const backoff = new Promise(function(resolve) {
    setTimeout(function() {
      resolve();
    }, config.retryDelay || 1000);
  });
  
  // Return the promise in which recalls axios to retry the request
  return backoff.then(function() {
    return api(config);
  });
});
"@

# Replace the axios client configuration
$pattern = "// HTTP client with interceptors.*?api\.interceptors\.response\.use\(\s*\(response\) => response,\s*\(error\) => \{.*?\}\s*\);"
$financeContent = $financeContent -replace "(?s)$pattern", $newAxiosConfig

# Write the content back to the file
Set-Content -Path ".\test-finance-apis.js" -Value $financeContent

# 3. Update test-security.js in a similar way
Write-Host "Updating test-security.js with better network error handling..."

# Backup the original file
Copy-Item -Path ".\test-security.js" -Destination ".\test-security.js.bak" -Force

# Read the original file
$securityContent = Get-Content -Path ".\test-security.js" -Raw

# Replace the axios client configuration
$securityContent = $securityContent -replace "(?s)// HTTP client with interceptors.*?api\.interceptors\.response\.use\(\s*\(response\) => response,\s*\(error\) => \{.*?\}\s*\);", $newAxiosConfig

# Write the content back to the file
Set-Content -Path ".\test-security.js" -Value $securityContent

Write-Host "Updates completed. Original files backed up with .bak extension."
Write-Host "You can now run the test script with: node run-all-api-tests.js"
