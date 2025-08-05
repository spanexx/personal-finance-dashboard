# MongoDB Setup Script for Personal Finance Dashboard
# Interactive script to help users choose and set up MongoDB

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "                    MongoDB Setup - Personal Finance Dashboard" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Choose your MongoDB setup option:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Development Mode (Recommended for Development)" -ForegroundColor Green
Write-Host "   - Simple to use, no admin privileges required" -ForegroundColor Gray
Write-Host "   - Easy to start/stop" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Windows Service (Recommended for Production)" -ForegroundColor Green
Write-Host "   - Starts automatically with Windows" -ForegroundColor Gray
Write-Host "   - Most reliable, professional setup" -ForegroundColor Gray
Write-Host "   - Requires administrator privileges" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Docker Setup (Most Reliable)" -ForegroundColor Green
Write-Host "   - Isolated environment" -ForegroundColor Gray
Write-Host "   - Consistent across different machines" -ForegroundColor Gray
Write-Host "   - Requires Docker Desktop" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "Enter your choice (1, 2, or 3)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Setting up Development Mode..." -ForegroundColor Green
        Write-Host ""
        Write-Host "This will start MongoDB in development mode." -ForegroundColor Yellow
        Write-Host "Your .env file is already configured for this setup." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Starting MongoDB now..." -ForegroundColor Cyan
        Start-Sleep -Seconds 2
        .\start-mongodb.ps1
    }
    "2" {
        Write-Host ""
        Write-Host "Windows Service setup requires administrator privileges." -ForegroundColor Yellow
        Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Red
        Write-Host ""
        Write-Host "Steps:" -ForegroundColor Cyan
        Write-Host "1. Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Gray
        Write-Host "2. Navigate to this directory" -ForegroundColor Gray
        Write-Host "3. Run: .\setup-mongodb-service.ps1" -ForegroundColor Gray
        exit 1
    }
    "3" {
        Write-Host ""
        Write-Host "Setting up Docker..." -ForegroundColor Green
        
        # Check if Docker is installed
        try {
            docker --version | Out-Null
            Write-Host "Docker is installed!" -ForegroundColor Green
            
            Write-Host ""
            Write-Host "Starting MongoDB with Docker..." -ForegroundColor Cyan
            docker-compose up -d mongodb
            
            Write-Host ""
            Write-Host "MongoDB is starting up..." -ForegroundColor Yellow
            Write-Host "Updating your .env file for Docker setup..." -ForegroundColor Cyan
            
            # Update .env file for Docker
            $envPath = ".\finance-dashboard-backend\.env"
            if (Test-Path $envPath) {
                $envContent = Get-Content $envPath
                $envContent = $envContent -replace "MONGODB_URI=mongodb://localhost:27017/finance_dashboard_dev", "MONGODB_URI=mongodb://admin:password123@localhost:27017/finance-dashboard"
                $envContent | Set-Content $envPath
                Write-Host "Updated .env file for Docker authentication." -ForegroundColor Green
            }
            
            Write-Host ""
            Write-Host "MongoDB is now running with Docker!" -ForegroundColor Green
            Write-Host "You can access MongoDB Express at: http://localhost:8081" -ForegroundColor Cyan
            Write-Host ""
        } catch {
            Write-Host "Docker is not installed or not running." -ForegroundColor Red
            Write-Host ""
            Write-Host "Please install Docker Desktop from:" -ForegroundColor Yellow
            Write-Host "https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "After installation, run this script again." -ForegroundColor Yellow
            exit 1
        }
    }
    default {
        Write-Host ""
        Write-Host "Invalid choice. Please run the script again and choose 1, 2, or 3." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Setup complete! You can now start your backend server:" -ForegroundColor Green
Write-Host "cd finance-dashboard-backend" -ForegroundColor Cyan
Write-Host "npm start" -ForegroundColor Cyan
Write-Host ""
