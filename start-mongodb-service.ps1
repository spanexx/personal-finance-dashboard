# Start MongoDB Windows Service
# This script starts the MongoDB Windows service if it exists

Write-Host "Checking MongoDB Windows Service..." -ForegroundColor Cyan

# Check if MongoDB service exists
$service = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue

if ($service) {
    Write-Host "MongoDB service found!" -ForegroundColor Green
    
    if ($service.Status -eq "Running") {
        Write-Host "MongoDB service is already running." -ForegroundColor Yellow
        Write-Host "Status: $($service.Status)" -ForegroundColor Gray
    } else {
        Write-Host "Starting MongoDB service..." -ForegroundColor Cyan
        try {
            Start-Service -Name "MongoDB"
            Write-Host "MongoDB service started successfully!" -ForegroundColor Green
            
            # Wait a moment and check status
            Start-Sleep -Seconds 3
            $service = Get-Service -Name "MongoDB"
            Write-Host "Status: $($service.Status)" -ForegroundColor Gray
            
        } catch {
            Write-Host "Error starting MongoDB service: $_" -ForegroundColor Red
            Write-Host "You may need to run this as Administrator." -ForegroundColor Yellow
            exit 1
        }
    }
    
    Write-Host ""
    Write-Host "MongoDB is now running on port 27017" -ForegroundColor Green
    Write-Host "You can now start your backend server:" -ForegroundColor Yellow
    Write-Host "cd finance-dashboard-backend" -ForegroundColor Cyan
    Write-Host "npm start" -ForegroundColor Cyan
    
} else {
    Write-Host "MongoDB service not found." -ForegroundColor Red
    Write-Host ""
    Write-Host "To install MongoDB as a Windows service:" -ForegroundColor Yellow
    Write-Host "1. Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Gray
    Write-Host "2. Run: .\setup-mongodb-service.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or use development mode:" -ForegroundColor Yellow
    Write-Host ".\start-mongodb.ps1" -ForegroundColor Gray
    exit 1
}

Write-Host ""
