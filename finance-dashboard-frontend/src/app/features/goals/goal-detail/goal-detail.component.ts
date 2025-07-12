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
  templateUrl: './goal-detail.component.html',
  styleUrls: ['./goal-detail.component.css']
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
        console.log('Goal loaded:', goal);
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
