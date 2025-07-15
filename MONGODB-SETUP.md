# MongoDB Setup Guide - Personal Finance Dashboard

## The Problem
MongoDB permission errors occur because the default installation tries to use system directories that require administrator privileges.

## Permanent Solutions

### ⭐ Option 1: Windows Service (Recommended for Production)

**Pros:** 
- Starts automatically with Windows
- Most reliable
- Professional setup

**Steps:**
1. Right-click PowerShell and select "Run as Administrator"
2. Navigate to your project directory
3. Run: `.\setup-mongodb-service.ps1`
4. MongoDB will start automatically and persist across reboots

### 🔧 Option 2: Development Mode (Recommended for Development)

**Pros:**
- Simple to use
- No admin privileges required
- Easy to start/stop

**Steps:**
1. Run: `.\start-mongodb.ps1`
2. Keep the terminal open while developing
3. Press Ctrl+C to stop MongoDB when done

### 🐳 Option 3: Docker (Most Reliable)

**Pros:**
- Isolated environment
- Consistent across different machines
- Includes MongoDB management interface

**Requirements:**
- Install Docker Desktop from https://www.docker.com/products/docker-desktop

**Steps:**
1. Install Docker Desktop
2. Run: `docker-compose up -d mongodb`
3. MongoDB will be available at `mongodb://admin:password123@localhost:27017/finance-dashboard`

**Update your .env file for Docker:**
```
MONGODB_URI=mongodb://admin:password123@localhost:27017/finance-dashboard
```

## Quick Start

Run this command to choose your preferred setup:
```powershell
.\setup-mongodb.ps1
```

## Troubleshooting

### If you get permission errors:
- Use Option 2 (Development Mode) - it doesn't require admin privileges
- Or run PowerShell as Administrator for Option 1

### If MongoDB won't start:
- Check if port 27017 is already in use: `netstat -an | findstr 27017`
- Kill any existing MongoDB processes in Task Manager

### If connection fails:
- Verify MongoDB is running: `mongo --eval "db.adminCommand('ismaster')"`
- Check your .env MONGODB_URI matches your setup

## Starting Your Backend After MongoDB is Running

Once MongoDB is set up and running, start your backend:

```bash
cd finance-dashboard-backend
npm start
```

## Files Created

- `setup-mongodb-service.ps1` - Windows Service installer (requires admin)
- `start-mongodb.ps1` - Development mode starter
- `docker-compose.yml` - Docker configuration
- `setup-mongodb.ps1` - Interactive setup script

Choose the option that best fits your workflow!
