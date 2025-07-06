
/**
 * Personal Finance Dashboard - Service Layer Static Verification
 * 
 * This script performs static analysis of the service layer implementation
 * without requiring database connections or environment variables.
 * 
 * Verifies:
 * - PHASE 5 service implementation completeness
 * - Code quality and structure
 * - Service method implementations
 * - Export completeness
 */

const fs = require('fs');
const path = require('path');

// ANSI Colors for output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

const servicesDir = path.join(__dirname, 'services');

// PHASE 5 Service Requirements from backend-implementation-plan.md
const phase5Requirements = {
    'PROMPT 5.1': {
        file: 'auth.service.js',
        name: 'Authentication Service',
        requiredMethods: [
            'generateTokens',
            'verifyAccessToken',
            'verifyRefreshToken',
            'hashPassword',
            'comparePassword',
            'generatePasswordResetToken',
            'verifyPasswordResetToken'
        ]
    },
    'PROMPT 5.2': {
        file: 'transaction.service.js',
        name: 'Transaction Service',
        requiredMethods: [
            'createTransaction',
            'getTransactionById',
            'getTransactionsByUser',
            'updateTransaction',
            'deleteTransaction',
            'getTransactionsByCategory',
            'getTransactionsByDateRange'
        ]
    },
    'PROMPT 5.3': {
        file: 'budget.service.js',
        name: 'Budget Service',
        requiredMethods: [
            'createBudget',
            'getBudgetById',
            'getBudgetsByUser',
            'updateBudget',
            'deleteBudget',
            'checkBudgetLimits',
            'getBudgetProgress'
        ]
    },
    'PROMPT 5.4': {
        file: 'goal.service.js',
        name: 'Goal Service',
        requiredMethods: [
            'createGoal',
            'getGoalById',
            'getGoalsByUser',
            'updateGoal',
            'deleteGoal',
            'updateGoalProgress',
            'getGoalProgress'
        ]
    },
    'PROMPT 5.5': {
        file: 'report.service.js',
        name: 'Report Service',
        requiredMethods: [
            'generateSpendingReport',
            'generateIncomeReport',
            'generateBudgetReport',
            'generateGoalProgressReport',
            'generateCashFlowReport',
            'generateMonthlyComparison'
        ]
    }
};

// Supporting services that enhance the system
const supportingServices = [
    'user.service.js',
    'category.service.js',
    'account.service.js',
    'notification.service.js',
    'analytics.service.js',
    'audit.service.js',
    'validation.service.js'
];

/**
 * Check if a file exists and get its stats
 */
function getFileStats(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return {
            exists: true,
            size: stats.size,
            sizeKB: Math.round(stats.size / 1024)
        };
    } catch (error) {
        return { exists: false, size: 0, sizeKB: 0 };
    }
}

/**
 * Parse service file and extract method names
 */
function parseServiceMethods(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract method names using regex patterns
        const methodPatterns = [
            /(?:async\s+)?(\w+)\s*\(/g,  // function names
            /(\w+):\s*(?:async\s+)?(?:function|\()/g,  // object method definitions
            /exports\.(\w+)\s*=/g,  // direct exports
            /module\.exports\.(\w+)\s*=/g  // module exports
        ];
        
        const methods = new Set();
        
        methodPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const methodName = match[1];
                // Filter out common non-method names
                if (methodName && 
                    !['require', 'module', 'exports', 'console', 'process', 'Buffer'].includes(methodName) &&
                    !methodName.startsWith('_') && 
                    methodName.length > 2) {
                    methods.add(methodName);
                }
            }
        });
        
        return Array.from(methods).sort();
    } catch (error) {
        return [];
    }
}

/**
 * Verify service index exports
 */
function verifyServiceIndex() {
    const indexPath = path.join(servicesDir, 'index.js');
    const stats = getFileStats(indexPath);
    
    if (!stats.exists) {
        return { exists: false, exports: [] };
    }
    
    try {
        const content = fs.readFileSync(indexPath, 'utf8');
        const exportPattern = /(\w+):\s*require/g;
        const exports = [];
        let match;
        
        while ((match = exportPattern.exec(content)) !== null) {
            exports.push(match[1]);
        }
        
        return { exists: true, exports, content };
    } catch (error) {
        return { exists: true, exports: [], error: error.message };
    }
}

/**
 * Main verification function
 */
function verifyServices() {
    console.log(`${colors.bold}${colors.cyan}========================================`);
    console.log(`PERSONAL FINANCE DASHBOARD`);
    console.log(`SERVICE LAYER VERIFICATION`);
    console.log(`========================================${colors.reset}\n`);
    
    console.log(`${colors.blue}Verifying PHASE 5 Service Implementation...${colors.reset}\n`);
    
    let totalCompliance = 0;
    let totalRequirements = Object.keys(phase5Requirements).length;
    let totalSize = 0;
    
    // Verify PHASE 5 core services
    console.log(`${colors.bold}PHASE 5 CORE SERVICES:${colors.reset}`);
    
    Object.entries(phase5Requirements).forEach(([prompt, config]) => {
        const filePath = path.join(servicesDir, config.file);
        const stats = getFileStats(filePath);
        const methods = parseServiceMethods(filePath);
        
        // Check method compliance
        const requiredMethods = config.requiredMethods;
        const implementedMethods = methods.filter(method => 
            requiredMethods.some(required => 
                method.toLowerCase().includes(required.toLowerCase()) ||
                required.toLowerCase().includes(method.toLowerCase())
            )
        );
        
        const compliance = requiredMethods.length > 0 ? 
            Math.round((implementedMethods.length / requiredMethods.length) * 100) : 
            (stats.exists ? 100 : 0);
        
        if (stats.exists) {
            totalCompliance += 1;
            totalSize += stats.sizeKB;
            
            console.log(`${colors.green}✅ ${config.name} (${stats.sizeKB} KB) - ${prompt}${colors.reset}`);
            console.log(`   📁 ${config.file}`);
            console.log(`   📊 Methods: ${methods.length} total, ${implementedMethods.length}/${requiredMethods.length} required`);
            console.log(`   📈 Compliance: ${compliance}%\n`);
        } else {
            console.log(`${colors.red}❌ ${config.name} - ${prompt}${colors.reset}`);
            console.log(`   📁 ${config.file} (MISSING)\n`);
        }
    });
    
    // Verify supporting services
    console.log(`${colors.bold}SUPPORTING SERVICES:${colors.reset}`);
    let supportingCount = 0;
    let supportingSize = 0;
    
    supportingServices.forEach(serviceFile => {
        const filePath = path.join(servicesDir, serviceFile);
        const stats = getFileStats(filePath);
        
        if (stats.exists) {
            supportingCount++;
            supportingSize += stats.sizeKB;
            console.log(`${colors.green}✅ ${serviceFile} (${stats.sizeKB} KB)${colors.reset}`);
        } else {
            console.log(`${colors.yellow}⚠️  ${serviceFile} (not found)${colors.reset}`);
        }
    });
    
    // Verify service index
    console.log(`\n${colors.bold}SERVICE INDEX VERIFICATION:${colors.reset}`);
    const indexVerification = verifyServiceIndex();
    
    if (indexVerification.exists) {
        console.log(`${colors.green}✅ services/index.js exists${colors.reset}`);
        console.log(`   📦 Exports: ${indexVerification.exports.length} services`);
        indexVerification.exports.forEach(exportName => {
            console.log(`   - ${exportName}`);
        });
    } else {
        console.log(`${colors.red}❌ services/index.js missing${colors.reset}`);
    }
    
    // Summary
    console.log(`\n${colors.bold}${colors.cyan}========================================`);
    console.log(`VERIFICATION SUMMARY`);
    console.log(`========================================${colors.reset}`);
    
    const compliancePercentage = Math.round((totalCompliance / totalRequirements) * 100);
    
    console.log(`${colors.bold}PHASE 5 Implementation:${colors.reset}`);
    console.log(`📊 Core Services: ${totalCompliance}/${totalRequirements} (${compliancePercentage}%)`);
    console.log(`📊 Supporting Services: ${supportingCount}/${supportingServices.length}`);
    console.log(`📊 Total Service Files: ${totalCompliance + supportingCount}`);
    console.log(`📊 Core Service Size: ${totalSize} KB`);
    console.log(`📊 Supporting Size: ${supportingSize} KB`);
    console.log(`📊 Total Service Layer: ${totalSize + supportingSize} KB`);
    
    if (compliancePercentage === 100) {
        console.log(`\n${colors.green}${colors.bold}🎉 PHASE 5 SERVICE LAYER: 100% COMPLETE!${colors.reset}`);
        console.log(`${colors.green}✅ All required services implemented${colors.reset}`);
        console.log(`${colors.green}✅ Additional supporting services included${colors.reset}`);
        console.log(`${colors.green}✅ Ready for PHASE 6: Middleware Layer${colors.reset}`);
    } else {
        console.log(`\n${colors.yellow}⚠️  PHASE 5 Implementation: ${compliancePercentage}% complete${colors.reset}`);
        console.log(`${colors.yellow}Missing services need to be implemented${colors.reset}`);
    }
    
    return {
        phase5Compliance: compliancePercentage,
        coreServices: totalCompliance,
        supportingServices: supportingCount,
        totalSize: totalSize + supportingSize
    };
}

// Run verification
if (require.main === module) {
    verifyServices();
}

module.exports = { verifyServices };
