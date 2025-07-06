# PowerShell script to create the backend directory structure
# for Personal Finance Dashboard according to the implementation plan

# Base directory for the backend project
$baseDir = "finance-dashboard-backend"

# Create directories for configuration
$configDirectories = @(
    "$baseDir\config"
)

# Create directories for controllers
$controllerDirectories = @(
    "$baseDir\controllers"
)

# Create directories for middleware
$middlewareDirectories = @(
    "$baseDir\middleware"
)

# Create directories for models
$modelDirectories = @(
    "$baseDir\models"
)

# Create directories for routes
$routeDirectories = @(
    "$baseDir\routes"
)

# Create directories for services
$serviceDirectories = @(
    "$baseDir\services"
)

# Create directories for utils
$utilDirectories = @(
    "$baseDir\utils"
)

# Create directories for tests
$testDirectories = @(
    "$baseDir\tests",
    "$baseDir\tests\unit",
    "$baseDir\tests\integration"
)

# Function to create directory if it doesn't exist
function Create-DirectoryIfNotExists {
    param (
        [string]$path
    )
    
    if (-not (Test-Path -Path $path)) {
        Write-Host "Creating directory: $path"
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    } else {
        Write-Host "Directory already exists: $path"
    }
}

# Create all directories
Write-Host "Creating backend directory structure for Personal Finance Dashboard..."

# Create all directories
foreach ($dir in $configDirectories + $controllerDirectories + $middlewareDirectories + 
                $modelDirectories + $routeDirectories + $serviceDirectories + 
                $utilDirectories + $testDirectories) {
    Create-DirectoryIfNotExists -path $dir
}

# Create placeholder files for important configuration and models
$placeholderFiles = @{
    "$baseDir\config\db.js" = "// Database connection configuration"
    "$baseDir\config\passport.js" = "// Authentication strategy configuration"
    "$baseDir\config\validation.js" = "// Request validation schemas"
    "$baseDir\models\User.js" = "// User model schema"
    "$baseDir\models\Transaction.js" = "// Transaction model schema"
    "$baseDir\models\Budget.js" = "// Budget model schema"
    "$baseDir\models\Category.js" = "// Category model schema"
    "$baseDir\models\Goal.js" = "// Financial goal model schema"
    "$baseDir\routes\auth.routes.js" = "// Authentication routes"
    "$baseDir\routes\user.routes.js" = "// User routes"
    "$baseDir\routes\transaction.routes.js" = "// Transaction routes"
    "$baseDir\routes\budget.routes.js" = "// Budget routes"
    "$baseDir\routes\goal.routes.js" = "// Goal routes"
    "$baseDir\routes\report.routes.js" = "// Report routes"
    "$baseDir\controllers\auth.controller.js" = "// Authentication controller"
    "$baseDir\controllers\user.controller.js" = "// User controller"
    "$baseDir\controllers\transaction.controller.js" = "// Transaction controller"
    "$baseDir\controllers\budget.controller.js" = "// Budget controller"
    "$baseDir\controllers\goal.controller.js" = "// Goal controller"
    "$baseDir\controllers\report.controller.js" = "// Report controller"
    "$baseDir\middleware\auth.middleware.js" = "// JWT verification middleware"
    "$baseDir\middleware\error.middleware.js" = "// Error handling middleware"
    "$baseDir\middleware\validation.middleware.js" = "// Validation middleware"
    "$baseDir\middleware\logger.middleware.js" = "// Logger middleware"
    "$baseDir\services\auth.service.js" = "// Authentication service"
    "$baseDir\services\user.service.js" = "// User service"
    "$baseDir\services\transaction.service.js" = "// Transaction service"
    "$baseDir\services\budget.service.js" = "// Budget service"
    "$baseDir\services\goal.service.js" = "// Goal service"
    "$baseDir\services\report.service.js" = "// Report service"
    "$baseDir\utils\apiResponse.js" = "// Standardized API responses"
    "$baseDir\utils\errorHandler.js" = "// Error handling utilities"
    "$baseDir\utils\logger.js" = "// Logging utilities"
    "$baseDir\utils\validators.js" = "// Custom validators"
    "$baseDir\.env.example" = "# Environment variables example
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/finance-dashboard
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
CORS_ORIGIN=http://localhost:4200"
}

foreach ($file in $placeholderFiles.Keys) {
    if (-not (Test-Path -Path $file)) {
        Write-Host "Creating placeholder file: $file"
        Set-Content -Path $file -Value $placeholderFiles[$file]
    } else {
        Write-Host "File already exists: $file"
    }
}

Write-Host "Directory structure creation completed!"
Write-Host "The backend structure has been set up according to the implementation plan."
