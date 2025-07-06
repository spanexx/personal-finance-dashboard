import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { DashboardMetrics } from '../../shared/models/dashboard-metrics.model';

@Injectable({ providedIn: 'root' })
export class RealtimeDashboardService {
  private _dashboardMetrics = new BehaviorSubject<DashboardMetrics | null>(null);
  private _lastUpdate = new BehaviorSubject<Date | null>(null);

  get dashboardMetrics(): Observable<DashboardMetrics | null> {
    return this._dashboardMetrics.asObservable();
  }

  get lastUpdate(): Observable<Date | null> {
    return this._lastUpdate.asObservable();
  }

  forceRefresh(): void {
    // Simulate refresh
    this._dashboardMetrics.next({
      netWorth: 10000,
      netWorthChange: 200,
      budgetCompliance: 85,
      savingsGoalProgress: 60,
      emergencyFundRatio: 30,
      investmentGrowth: 10
    });
    this._lastUpdate.next(new Date());
  }

  constructor() {
    // Simulate initial data
    this.forceRefresh();
  }
}
