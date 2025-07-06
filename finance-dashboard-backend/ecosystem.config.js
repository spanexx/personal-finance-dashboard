module.exports = {
  apps: [
    {
      // Application Configuration
      name: 'finance-dashboard-api',
      script: 'server.js',
      cwd: '/path/to/your/finance-dashboard-backend',
      
      // Environment Configuration
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
        MONGODB_URI: 'mongodb://localhost:27017/finance_dashboard_dev'
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 5001,
        MONGODB_URI: 'mongodb://localhost:27017/finance_dashboard_staging'
      },
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        MONGODB_URI: 'mongodb://localhost:27017/finance_dashboard_prod'
      },
      
      // Process Management
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster', // Enable cluster mode for better performance
      
      // Auto-restart Configuration
      autorestart: true,
      watch: false, // Disable file watching in production
      max_memory_restart: '1G', // Restart if memory usage exceeds 1GB
      
      // Restart Strategy
      min_uptime: '10s', // Minimum uptime before considering a restart successful
      max_restarts: 10, // Maximum number of unstable restarts
      restart_delay: 4000, // Delay between restarts (4 seconds)
      
      // Logging Configuration
      log_file: './logs/pm2-combined.log',
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true, // Merge logs from all instances
      
      // Performance Monitoring
      pmx: true, // Enable PMX monitoring
      monitoring: {
        http: true, // Enable HTTP monitoring
        https: false,
        ports: [5000], // Monitor specific ports
      },
      
      // Health Check
      health_check_grace_period: 3000, // Grace period for health checks
      
      // Process Behavior
      kill_timeout: 5000, // Time to wait before force killing
      listen_timeout: 3000, // Time to wait for app to start listening
      
      // Environment Variables Override
      env_file: '.env',
      
      // Source Control
      post_update: ['npm install', 'npm run build'], // Commands to run after git pull
      
      // Advanced Configuration
      node_args: ['--max-old-space-size=1024'], // Node.js arguments
      
      // Cron Jobs (if needed)
      cron_restart: '0 3 * * *', // Restart daily at 3 AM
      
      // Error Handling
      error_tolerance: 5, // Number of consecutive errors before stopping
      
      // Performance Tuning
      vizion: false, // Disable versioning (reduces memory usage)
      automation: false, // Disable automation features
      
      // Custom Metrics
      custom_metrics: {
        'Memory Usage': function() {
          return process.memoryUsage().heapUsed;
        },
        'Uptime': function() {
          return process.uptime();
        }
      }
    }
  ],

  // Deployment Configuration
  deploy: {
    // Development Environment
    development: {
      user: 'node',
      host: 'dev.yourdomain.com',
      ref: 'origin/development',
      repo: 'git@github.com:yourusername/finance-dashboard.git',
      path: '/var/www/finance-dashboard-dev',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env development',
      'pre-setup': '',
      env: {
        NODE_ENV: 'development'
      }
    },

    // Staging Environment
    staging: {
      user: 'node',
      host: 'staging.yourdomain.com',
      ref: 'origin/staging',
      repo: 'git@github.com:yourusername/finance-dashboard.git',
      path: '/var/www/finance-dashboard-staging',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging',
      'pre-setup': '',
      env: {
        NODE_ENV: 'staging'
      }
    },

    // Production Environment
    production: {
      user: 'node',
      host: ['prod1.yourdomain.com', 'prod2.yourdomain.com'], // Multiple hosts for load balancing
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/finance-dashboard.git',
      path: '/var/www/finance-dashboard-prod',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};

/*
PM2 Commands Reference:

1. Start the application:
   pm2 start ecosystem.config.js

2. Start with specific environment:
   pm2 start ecosystem.config.js --env production

3. Restart the application:
   pm2 restart finance-dashboard-api

4. Stop the application:
   pm2 stop finance-dashboard-api

5. Delete the application:
   pm2 delete finance-dashboard-api

6. Monitor applications:
   pm2 monit

7. View logs:
   pm2 logs finance-dashboard-api

8. Reload with zero downtime:
   pm2 reload finance-dashboard-api

9. Show application info:
   pm2 show finance-dashboard-api

10. Save PM2 configuration:
    pm2 save

11. Resurrect saved processes:
    pm2 resurrect

12. Deploy to production:
    pm2 deploy production

13. Setup deployment:
    pm2 deploy production setup

14. Update and deploy:
    pm2 deploy production update

Environment-specific startup commands:
- Development: pm2 start ecosystem.config.js --env development
- Staging: pm2 start ecosystem.config.js --env staging  
- Production: pm2 start ecosystem.config.js --env production
*/
