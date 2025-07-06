import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject, takeUntil, filter, map } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';

import { Goal } from '../../../shared/models';
import { ChartComponent, ChartData } from '../../../shared/components/chart/chart.component';
import { AppState } from '../../../store/state/app.state';
import * as GoalActions from '../../../store/actions/goal.actions';
import * as GoalSelectors from '../../../store/selectors/goal.selectors';

@Component({
  selector: 'app-goal-detail',
  standalone: true,  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatDialogModule,
    ChartComponent
  ],
  template: `    <div class="detail-container">
      @if (goal$ | async; as goal) {        <mat-card>
          <mat-card-header>
            <div mat-card-avatar class="goal-avatar">
              <mat-icon [style.color]="goal.color">{{ goal.icon }}</mat-icon>
            </div>
            <mat-card-title>{{ goal.name }}</mat-card-title>
            <mat-card-subtitle>{{ goal.category }} • {{ goal.priority | titlecase }} Priority</mat-card-subtitle>
          </mat-card-header>

          <mat-card-content>
            <div class="description-section" *ngIf="goal.description">
              <p>{{ goal.description }}</p>
            </div>            <div class="progress-section">
              <h3>Progress</h3>
              <mat-progress-bar
                [value]="goal.progressPercentage"
                [color]="getProgressColor(goal)"
              ></mat-progress-bar>
              <div class="progress-details">
                <div class="amount-info">
                  <div class="label">Current Amount</div>
                  <div class="value">{{ goal.currentAmount | currency }}</div>
                </div>
                <div class="amount-info">
                  <div class="label">Target Amount</div>
                  <div class="value">{{ goal.targetAmount | currency }}</div>
                </div>
                <div class="amount-info">
                  <div class="label">Progress</div>
                  <div class="value">{{ goal.progressPercentage.toFixed(1) }}%</div>
                </div>
              </div>
              
              <!-- Progress Chart -->
              <div class="progress-chart" *ngIf="progressChartData">
                <h4>Progress Visualization</h4>
                <div class="chart-wrapper">
                  <app-chart 
                    type="doughnut" 
                    [data]="progressChartData"
                    [options]="chartOptions">
                  </app-chart>
                </div>
              </div>
            </div>

            <div class="timeline-section">
              <h3>Timeline</h3>
              <div class="timeline-details">
                <div class="label">Target Date</div>
                <div class="value">{{ goal.targetDate | date:'mediumDate' }}</div>
              </div>              <div class="timeline-details">
                <div class="label">Days Remaining</div>
                <div class="value">{{ getDaysRemaining(goal) }} days</div>
              </div>
              <div class="timeline-details">
                <div class="label">Created</div>
                <div class="value">{{ goal.createdAt | date:'mediumDate' }}</div>
              </div>
            </div>            <div class="stats-section">
              <h3>Statistics</h3>
              <div class="stats-grid">
                <div class="stat-item">
                  <div class="label">Amount Needed</div>
                  <div class="value">{{ goal.targetAmount - goal.currentAmount | currency }}</div>
                </div>
                <div class="stat-item">
                  <div class="label">Monthly Required</div>
                  <div class="value">{{ getMonthlyContributionNeeded(goal) | currency }}</div>
                </div>
                <div class="stat-item">
                  <div class="label">Total Contributions</div>
                  <div class="value">{{ goal.contributions.length }}</div>
                </div>
              </div>
            </div>

            <div class="contributions-section" *ngIf="goal.contributions.length > 0">
              <h3>Recent Contributions</h3>
              <div class="contributions-list">
                <div class="contribution-item" *ngFor="let contribution of goal.contributions.slice(-5)">
                  <div class="contribution-amount">{{ contribution.amount | currency }}</div>
                  <div class="contribution-date">{{ contribution.date | date:'shortDate' }}</div>
                  <div class="contribution-notes">{{ contribution.note }}</div>
                </div>
              </div>
            </div>
          </mat-card-content>

          <mat-card-actions>
            <button mat-button (click)="goBack()">
              <mat-icon>arrow_back</mat-icon>
              Back
            </button>            <button mat-raised-button color="primary" (click)="updateProgress(goal)">
              Update Progress
            </button>
            <button mat-button color="warn" (click)="deleteGoal(goal)">
              Delete Goal
            </button>
          </mat-card-actions>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .detail-container {
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
    }

    .progress-section,
    .timeline-section,
    .stats-section {
      margin: 24px 0;
    }

    .progress-details,
    .timeline-details {
      display: flex;
      justify-content: space-between;
      margin-top: 16px;
    }

    .amount-info {
      text-align: center;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-top: 16px;
    }    .stat-item {
      text-align: center;
      padding: 16px;
      background-color: #f5f5f5;
      border-radius: 4px;
    }

    .contributions-section {
      margin-top: 24px;

      .contributions-list {
        margin-top: 16px;
      }

      .contribution-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid #e0e0e0;

        &:last-child {
          border-bottom: none;
        }

        .contribution-amount {
          font-weight: 500;
          color: #2e7d32;
        }

        .contribution-date {
          color: rgba(0, 0, 0, 0.6);
          font-size: 0.875rem;
        }

        .contribution-notes {
          color: rgba(0, 0, 0, 0.8);
          font-size: 0.875rem;
          flex: 1;
          margin: 0 16px;
        }
      }
    }

    .goal-avatar {
      background-color: #f5f5f5;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
    }

    .description-section {
      margin-bottom: 24px;
      padding: 16px;
      background-color: #f9f9f9;
      border-radius: 4px;
    }

    .label {
      color: rgba(0, 0, 0, 0.6);
      font-size: 0.9em;
      margin-bottom: 4px;
    }

    .value {
      font-size: 1.2em;
      font-weight: 500;
    }    mat-card-actions {
      display: flex;
      justify-content: space-between;
      padding: 16px;
    }

    .progress-chart {
      margin-top: 24px;
      
      h4 {
        margin-bottom: 16px;
        color: rgba(0, 0, 0, 0.8);
      }
      
      .chart-wrapper {
        height: 300px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  `]
})
export class GoalDetailComponent implements OnInit, OnDestroy {  goal$: Observable<Goal | null>;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;
  progressChartData?: ChartData;
  private goalId: string | null = null;
  private destroy$ = new Subject<void>();
  
  chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const
      }
    }
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private store: Store<AppState>
  ) {
    this.loading$ = this.store.select(GoalSelectors.selectGoalLoading);
    this.error$ = this.store.select(GoalSelectors.selectGoalError);
    this.goal$ = this.store.select(GoalSelectors.selectSelectedGoal);
  }

  ngOnInit(): void {
    this.goalId = this.route.snapshot.paramMap.get('id');
    if (this.goalId) {
      this.store.dispatch(GoalActions.loadGoal({ id: this.goalId }));
      
      // Setup chart when goal data loads
      this.goal$.pipe(
        takeUntil(this.destroy$),
        filter(goal => !!goal)
      ).subscribe(goal => {
        if (goal) {
          this.setupProgressChart(goal);
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.store.dispatch(GoalActions.clearSelectedGoal());
  }

  getProgressColor(goal: Goal): 'primary' | 'accent' | 'warn' {
    if (goal.progressPercentage >= 75) return 'primary';
    if (goal.progressPercentage >= 25) return 'accent';
    return 'warn';
  }

  getDaysRemaining(goal: Goal): number {
    const today = new Date();
    const deadline = new Date(goal.targetDate);
    const diff = deadline.getTime() - today.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  getMonthlyContributionNeeded(goal: Goal): number {
    const remainingAmount = goal.targetAmount - goal.currentAmount;
    const today = new Date();
    const targetDate = new Date(goal.targetDate);
    const monthsRemaining = (targetDate.getFullYear() - today.getFullYear()) * 12 + (targetDate.getMonth() - today.getMonth());
    return monthsRemaining > 0 ? remainingAmount / monthsRemaining : remainingAmount;
  }

  updateProgress(goal: Goal): void {
    const amount = prompt(`How much would you like to add to "${goal.name}"?`);
    if (amount && !isNaN(Number(amount))) {
      this.store.dispatch(GoalActions.addContribution({
        goalId: goal._id,
        amount: Number(amount),
        notes: 'Manual contribution' // Corrected back to 'notes'
      }));
    }
  }

  deleteGoal(goal: Goal): void {
    if (confirm(`Are you sure you want to delete "${goal.name}"?`)) {
      this.store.dispatch(GoalActions.deleteGoal({ id: goal._id }));
      // Navigate back after successful deletion
      this.router.navigate(['/goals']);
    }
  }

  goBack(): void {
    this.router.navigate(['/goals']);
  }

  private setupProgressChart(goal: Goal): void {
    const currentAmount = goal.currentAmount;
    const remainingAmount = goal.targetAmount - currentAmount;
    
    this.progressChartData = {
      labels: ['Achieved', 'Remaining'],
      datasets: [{
        label: 'Goal Progress',
        data: [currentAmount, remainingAmount],
        backgroundColor: [
          goal.color || '#1976d2',
          '#e0e0e0'
        ],
        borderColor: [
          goal.color || '#1976d2',
          '#bdbdbd'
        ],
        borderWidth: 1
      }]
    };
  }
}
