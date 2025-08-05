# MongoDB Development Mode Starter
# This script starts MongoDB in development mode without requiring admin privileges

Write-Host "Starting MongoDB in Development Mode..." -ForegroundColor Green

# Create data directory if it doesn't exist
$dataDir = ".\mongodb-data"
if (!(Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir -Force
    Write-Host "Created data directory: $dataDir" -ForegroundColor Yellow
}

# Create log directory if it doesn't exist
$logDir = ".\mongodb-logs"
if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force
    Write-Host "Created log directory: $logDir" -ForegroundColor Yellow
}

# Start MongoDB
Write-Host "Starting MongoDB server..." -ForegroundColor Cyan
Write-Host "Data directory: $dataDir" -ForegroundColor Gray
Write-Host "Log directory: $logDir" -ForegroundColor Gray
Write-Host "Port: 27017" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop MongoDB" -ForegroundColor Yellow
Write-Host ""

try {
    mongod --dbpath $dataDir --logpath "$logDir\mongodb.log" --port 27017 --bind_ip 127.0.0.1
} catch {
    Write-Host "Error starting MongoDB: $_" -ForegroundColor Red
    Write-Host "Make sure MongoDB is installed and the port 27017 is not in use." -ForegroundColor Yellow
    exit 1
}
