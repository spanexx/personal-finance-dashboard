# MongoDB Windows Service Setup Script
# This script sets up MongoDB as a Windows service (requires administrator privileges)

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "This script requires administrator privileges." -ForegroundColor Red
    Write-Host "Please right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "Setting up MongoDB as Windows Service..." -ForegroundColor Green

# Create MongoDB directories
$mongoPath = "C:\Program Files\MongoDB\Server\8.0\bin"
$dataPath = "C:\data\db"
$logPath = "C:\data\log"

Write-Host "Creating MongoDB directories..." -ForegroundColor Cyan

if (!(Test-Path $dataPath)) {
    New-Item -ItemType Directory -Path $dataPath -Force
    Write-Host "Created data directory: $dataPath" -ForegroundColor Yellow
}

if (!(Test-Path $logPath)) {
    New-Item -ItemType Directory -Path $logPath -Force
    Write-Host "Created log directory: $logPath" -ForegroundColor Yellow
}

# Create MongoDB configuration file
$configPath = "C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg"
$configContent = @"
systemLog:
  destination: file
  path: C:\data\log\mongod.log
storage:
  dbPath: C:\data\db
net:
  port: 27017
  bindIp: 127.0.0.1
"@

Write-Host "Creating MongoDB configuration file..." -ForegroundColor Cyan
$configContent | Out-File -FilePath $configPath -Encoding UTF8

# Install MongoDB as Windows service
Write-Host "Installing MongoDB as Windows service..." -ForegroundColor Cyan

try {
    & "$mongoPath\mongod.exe" --config "$configPath" --install --serviceName "MongoDB"
    
    Write-Host "MongoDB service installed successfully!" -ForegroundColor Green
    
    # Start the MongoDB service
    Write-Host "Starting MongoDB service..." -ForegroundColor Cyan
    Start-Service -Name "MongoDB"
    
    # Set service to start automatically
    Set-Service -Name "MongoDB" -StartupType Automatic
    
    Write-Host ""
    Write-Host "MongoDB Windows Service Setup Complete!" -ForegroundColor Green
    Write-Host "- Service Name: MongoDB" -ForegroundColor Gray
    Write-Host "- Status: Running" -ForegroundColor Gray
    Write-Host "- Startup Type: Automatic" -ForegroundColor Gray
    Write-Host "- Port: 27017" -ForegroundColor Gray
    Write-Host "- Data Path: $dataPath" -ForegroundColor Gray
    Write-Host "- Log Path: $logPath\mongod.log" -ForegroundColor Gray
    Write-Host ""
    Write-Host "MongoDB will now start automatically with Windows!" -ForegroundColor Yellow
    
} catch {
    Write-Host "Error installing MongoDB service: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "1. Make sure MongoDB is installed in: $mongoPath" -ForegroundColor Gray
    Write-Host "2. Check if port 27017 is available" -ForegroundColor Gray
    Write-Host "3. Ensure you're running as Administrator" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "You can now start your backend server:" -ForegroundColor Green
Write-Host "cd finance-dashboard-backend" -ForegroundColor Cyan
Write-Host "npm start" -ForegroundColor Cyan
Write-Host ""
