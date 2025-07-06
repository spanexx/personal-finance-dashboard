# PowerShell script to create the frontend directory structure
# for Personal Finance Dashboard according to the implementation plan

# Base directory for the frontend project
$baseDir = "finance-dashboard-frontend"
$srcDir = "$baseDir\src"
$appDir = "$srcDir\app"

# Create directories for core functionality
$coreDirectories = @(
    "$appDir\core",
    "$appDir\core\auth",
    "$appDir\core\interceptors",
    "$appDir\core\services"
)

# Create directories for shared components
$sharedDirectories = @(
    "$appDir\shared",
    "$appDir\shared\components",
    "$appDir\shared\directives",
    "$appDir\shared\pipes",
    "$appDir\shared\models"
)

# Create directories for feature modules
$featureDirectories = @(
    "$appDir\features",
    "$appDir\features\auth",
    "$appDir\features\dashboard",
    "$appDir\features\transactions",
    "$appDir\features\budgets",
    "$appDir\features\goals",
    "$appDir\features\reports"
)

# Create directories for NgRx store
$storeDirectories = @(
    "$appDir\store",
    "$appDir\store\actions",
    "$appDir\store\effects",
    "$appDir\store\reducers",
    "$appDir\store\selectors",
    "$appDir\store\state"
)

# Create directories for assets
$assetDirectories = @(
    "$srcDir\assets",
    "$srcDir\assets\images",
    "$srcDir\assets\icons",
    "$srcDir\assets\styles"
)

# Create directories for environments
$envDirectories = @(
    "$srcDir\environments"
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
Write-Host "Creating frontend directory structure for Personal Finance Dashboard..."

# Create all core directories
foreach ($dir in $coreDirectories) {
    Create-DirectoryIfNotExists -path $dir
}

# Create all shared directories
foreach ($dir in $sharedDirectories) {
    Create-DirectoryIfNotExists -path $dir
}

# Create all feature directories
foreach ($dir in $featureDirectories) {
    Create-DirectoryIfNotExists -path $dir
}

# Create all store directories
foreach ($dir in $storeDirectories) {
    Create-DirectoryIfNotExists -path $dir
}

# Create all asset directories
foreach ($dir in $assetDirectories) {
    Create-DirectoryIfNotExists -path $dir
}

# Create all environment directories
foreach ($dir in $envDirectories) {
    Create-DirectoryIfNotExists -path $dir
}

# Create placeholder files for important configuration
$placeholderFiles = @{
    "$appDir\store\state\app.state.ts" = "// Root state interface for the application"
    "$appDir\store\state\auth.state.ts" = "// Authentication state definition"
    "$appDir\store\state\transaction.state.ts" = "// Transactions state definition"
    "$appDir\store\state\budget.state.ts" = "// Budgets state definition"
    "$appDir\store\state\goal.state.ts" = "// Goals state definition"
    "$srcDir\environments\environment.ts" = "// Development environment configuration"
    "$srcDir\environments\environment.prod.ts" = "// Production environment configuration"
    "$srcDir\assets\styles\_variables.scss" = "// Global SCSS variables for theming"
    "$srcDir\assets\styles\_mixins.scss" = "// Global SCSS mixins"
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
Write-Host "The frontend structure has been set up according to the implementation plan."
