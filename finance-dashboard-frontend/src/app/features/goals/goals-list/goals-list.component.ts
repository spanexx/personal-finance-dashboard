import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';

import { Goal } from '../../../shared/models';
import { AppState } from '../../../store/state/app.state';
import * as GoalActions from '../../../store/actions/goal.actions';
import * as GoalSelectors from '../../../store/selectors/goal.selectors';

@Component({
  selector: 'app-goals-list',
  standalone: true,  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatDialogModule
  ],
  template: `
    <div class="goals-container">
      <div class="goals-header">
        <h1 class="page-title">Financial Goals</h1>
        <button mat-raised-button color="primary" routerLink="create">
          <mat-icon>add</mat-icon>
          Create New Goal
        </button>
      </div>      <!-- Goals List -->
      <div class="goals-grid">        <mat-card class="goal-card" *ngFor="let goal of goals$ | async">
          <mat-card-header>
            <div mat-card-avatar class="goal-avatar">
              <mat-icon [style.color]="goal.color">{{ goal.icon }}</mat-icon>
            </div>
            <mat-card-title>{{ goal.name }}</mat-card-title>
            <mat-card-subtitle>Target: {{ formatCurrency(goal.targetAmount) }}</mat-card-subtitle>
          </mat-card-header>
          
          <mat-card-content>
            <div class="goal-progress">
              <mat-progress-bar
                mode="determinate"
                [value]="goal.progressPercentage"
                [color]="getProgressColor(goal)">
              </mat-progress-bar>
              <div class="progress-label">
                {{ formatCurrency(goal.currentAmount) }} of {{ formatCurrency(goal.targetAmount) }}
              </div>
            </div>

            <div class="goal-details">
              <p class="completion-date">
                Target Date: {{ goal.targetDate | date:'shortDate' }}
              </p>
              <p class="remaining-amount">
                Remaining: {{ formatCurrency(goal.targetAmount - goal.currentAmount) }}
              </p>
              <p class="category">
                Category: {{ goal.category }}
              </p>
            </div>
          </mat-card-content>

          <mat-card-actions>
            <button mat-button [routerLink]="['detail', goal._id]">
              <mat-icon>visibility</mat-icon>
              View Details
            </button>
            <button mat-button color="primary" (click)="openAddFundsDialog(goal)">
              <mat-icon>add</mat-icon>
              Add Funds
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .goals-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .goals-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .page-title {
      margin: 0;
      font-size: 2.5rem;
      font-weight: 300;
    }

    .goals-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px;
    }    .goal-card {
      transition: transform 0.2s ease-in-out;

      &:hover {
        transform: translateY(-2px);
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

      mat-card-content {
        padding: 16px;
      }

      .goal-progress {
        margin: 16px 0;

        mat-progress-bar {
          height: 8px;
          border-radius: 4px;
        }

        .progress-label {
          margin-top: 8px;
          font-size: 0.875rem;
          color: rgba(0, 0, 0, 0.6);
          text-align: center;
        }
      }

      .goal-details {
        margin-top: 16px;
        font-size: 0.875rem;

        p {
          margin: 4px 0;
          display: flex;
          justify-content: space-between;
        }
      }
    }
  `]
})
export class GoalsListComponent implements OnInit {
  goals$: Observable<Goal[]>;
  loading$: Observable<boolean>;
  error$: Observable<string | null>;

  constructor(
    private store: Store<AppState>,
    private dialog: MatDialog
  ) {
    this.goals$ = this.store.select(GoalSelectors.selectAllGoals);
    this.loading$ = this.store.select(GoalSelectors.selectGoalLoading);
    this.error$ = this.store.select(GoalSelectors.selectGoalError);
  }

  ngOnInit(): void {
    this.store.dispatch(GoalActions.loadGoals());
  }

  openAddFundsDialog(goal: Goal): void {
    // TODO: Implement add funds dialog
    const amount = prompt(`How much would you like to add to "${goal.name}"?`);
    if (amount && !isNaN(Number(amount))) {
      this.store.dispatch(GoalActions.addContribution({
        goalId: goal._id,
        amount: Number(amount),
        notes: 'Manual contribution'
      }));
    }
  }

  getProgressColor(goal: Goal): string {
    if (goal.progressPercentage >= 75) return 'primary';
    if (goal.progressPercentage >= 50) return 'accent';
    return 'warn';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
