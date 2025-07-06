import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Angular Material imports
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';

// Services
import { WebSocketService } from '../../../core/services/websocket.service';
import { NotificationService } from '../../../core/services/notification.service';
import { DashboardMetrics } from '../../../shared/models/dashboard-metrics.model';
import { RealtimeDashboardService } from '../../../core/services/realtime-dashboard.service';

@Component({
  selector: 'app-live-dashboard-widget',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatBadgeModule
  ],
  templateUrl: './live-dashboard-widget.component.html',
  styleUrls: ['./live-dashboard-widget.component.scss']
})
export class LiveDashboardWidgetComponent implements OnInit, OnDestroy {
  @Input() widgetType: 'balance' | 'budget' | 'goals' | 'notifications' = 'balance';
  @Input() showHeader = true;
  @Input() compact = false;

  private destroy$ = new Subject<void>();

  metrics: DashboardMetrics | null = null;
  isConnected = false;
  lastUpdate: Date | null = null;
  unreadNotifications = 0;
  recentAlerts: any[] = [];
  isLoading = false;

  widgetConfigs = {
    balance: {
      title: 'Live Balance',
      icon: 'account_balance',
      color: '#2196f3'
    },
    budget: {
      title: 'Budget Alerts',
      icon: 'account_balance_wallet',
      color: '#ff9800'
    },
    goals: {
      title: 'Goal Progress',
      icon: 'flag',
      color: '#4caf50'
    },
    notifications: {
      title: 'Live Notifications',
      icon: 'notifications',
      color: '#9c27b0'
    }
  };

  constructor(
    private realtimeDashboardService: RealtimeDashboardService,
    private webSocketService: WebSocketService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.setupSubscriptions();
    this.initializeWidget();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSubscriptions(): void {
    // Monitor connection status
    this.webSocketService.isConnected
      .pipe(takeUntil(this.destroy$))
      .subscribe(isConnected => {
        this.isConnected = isConnected;
      });

    // Monitor dashboard metrics
    this.realtimeDashboardService.dashboardMetrics
      .pipe(takeUntil(this.destroy$))
      .subscribe(metrics => {
        this.metrics = metrics;
      });

    // Monitor last update time
    this.realtimeDashboardService.lastUpdate
      .pipe(takeUntil(this.destroy$))
      .subscribe(lastUpdate => {
        this.lastUpdate = lastUpdate;
      });

    // Monitor unread notifications
    this.webSocketService.getUnreadNotificationCount()
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        this.unreadNotifications = count;
      });

    // Monitor budget alerts for widget-specific content
    this.webSocketService.budgetAlerts
      .pipe(takeUntil(this.destroy$))
      .subscribe(alert => {
        if (this.widgetType === 'budget') {
          this.recentAlerts.unshift(alert);
          this.recentAlerts = this.recentAlerts.slice(0, 3); // Keep only 3 recent alerts
        }
      });
  }

  private initializeWidget(): void {
    this.isLoading = true;
    // Initialize with sample data - in real app this would come from API
    setTimeout(() => {
      this.isLoading = false;
    }, 1000);
  }

  getWidgetConfig() {
    return this.widgetConfigs[this.widgetType];
  }

  getConnectionStatusIcon(): string {
    return this.isConnected ? 'wifi' : 'wifi_off';
  }

  getConnectionStatusColor(): string {
    return this.isConnected ? '#4caf50' : '#f44336';
  }

  refreshData(): void {
    this.realtimeDashboardService.forceRefresh();
    this.notificationService.info('Refreshing data...', 'Dashboard Update');
  }

  // Widget-specific getter methods
  getBalanceData() {
    if (!this.metrics) return null;
    return {
      current: this.metrics.netWorth,
      change: this.metrics.netWorthChange,
      label: 'Net Worth'
    };
  }

  getBudgetData() {
    if (!this.metrics) return null;
    return {
      compliance: this.metrics.budgetCompliance,
      alertsCount: this.recentAlerts.length,
      recentAlerts: this.recentAlerts
    };
  }

  getGoalsData() {
    if (!this.metrics) return null;
    return {
      progress: this.metrics.savingsGoalProgress,
      emergencyFund: this.metrics.emergencyFundRatio,
      investment: this.metrics.investmentGrowth
    };
  }

  getNotificationsData() {
    return {
      unread: this.unreadNotifications,
      connected: this.isConnected,
      lastUpdate: this.lastUpdate
    };
  }

  // Helper method to determine if data is stale
  isDataStale(): boolean {
    if (!this.lastUpdate) return true;
    const now = new Date();
    const diffMs = now.getTime() - this.lastUpdate.getTime();
    return diffMs > 300000; // 5 minutes
  }

  // Get appropriate alert level color
  getAlertLevelColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return '#f44336';
      case 'high':
        return '#ff9800';
      case 'medium':
        return '#2196f3';
      case 'low':
        return '#4caf50';
      default:
        return '#757575';
    }
  }

  // Formatting helper methods
  formatCurrency(amount: number | undefined | null): string {
    if (amount === null || amount === undefined) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatPercentage(value: number | undefined | null): string {
    if (value === null || value === undefined) return '0%';
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value / 100);
  }

  getChangeColor(change: number): string {
    if (change > 0) return '#4caf50';
    if (change < 0) return '#f44336';
    return '#757575';
  }

  getChangeIcon(change: number): string {
    if (change > 0) return 'trending_up';
    if (change < 0) return 'trending_down';
    return 'trending_flat';
  }

  getTimeAgo(date: Date | null): string {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}
