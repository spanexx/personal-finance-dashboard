import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { BudgetHealthScore } from '../../../shared/models/budget.model';

@Component({
  selector: 'app-budget-health-score',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <mat-card class="health-score-card">
      <mat-card-header>
        <mat-card-title class="health-score-title">
          <mat-icon [style.color]="getScoreColor(healthScore?.overallScore || 0)">
            {{ getScoreIcon(healthScore?.overallScore || 0) }}
          </mat-icon>
          Budget Health Score
        </mat-card-title>
        <mat-card-subtitle>{{ getScoreLabel(healthScore?.overallScore || 0) }}</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <div class="score-display">
          <div class="score-circle" [style.background]="getScoreGradient(healthScore?.overallScore || 0)">
            <span class="score-number">{{ healthScore?.overallScore || 0 }}</span>
            <span class="score-max">/100</span>
          </div>
        </div>

        <div class="score-breakdown" *ngIf="healthScore">
          <div class="metric" *ngFor="let metric of getMetrics()">
            <div class="metric-header">
              <span class="metric-name">{{ metric.name }}</span>
              <span class="metric-score">{{ metric.score }}</span>
            </div>
            <mat-progress-bar
              [value]="metric.score"
              [color]="metric.score >= 70 ? 'primary' : metric.score >= 40 ? 'accent' : 'warn'"
              mode="determinate">
            </mat-progress-bar>
          </div>
        </div>        <div class="improvement-chips" *ngIf="healthScore?.improvementAreas?.length">
          <h4>Areas for Improvement</h4>
          <mat-chip-set>
            <mat-chip 
              *ngFor="let area of (healthScore?.improvementAreas || [])"
              [matTooltip]="getImprovementTooltip(area)">
              {{ getImprovementLabel(area) }}
            </mat-chip>
          </mat-chip-set>
        </div>

        <div class="recommendations" *ngIf="healthScore?.recommendations?.length">
          <h4>Quick Actions</h4>
          <div class="recommendation-list">
            <div 
              class="recommendation-item" 
              *ngFor="let recommendation of (healthScore?.recommendations || []).slice(0, 3)">
              <mat-icon class="recommendation-icon">{{ getRecommendationIcon(recommendation) }}</mat-icon>
              <span class="recommendation-text">{{ recommendation }}</span>
            </div>
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styleUrls: ['./budget-health-score.component.scss']
})
export class BudgetHealthScoreComponent implements OnInit, OnChanges {
  @Input() healthScore: BudgetHealthScore | null = null;
  @Input() compact = false;

  ngOnInit(): void {
    // Component initialization
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['healthScore']) {
      // Handle health score changes
    }
  }

  getScoreColor(score: number): string {
    if (score >= 80) return '#4caf50'; // Green
    if (score >= 60) return '#ff9800'; // Orange
    if (score >= 40) return '#f44336'; // Red
    return '#9e9e9e'; // Gray
  }

  getScoreIcon(score: number): string {
    if (score >= 80) return 'sentiment_very_satisfied';
    if (score >= 60) return 'sentiment_satisfied';
    if (score >= 40) return 'sentiment_dissatisfied';
    return 'sentiment_very_dissatisfied';
  }

  getScoreLabel(score: number): string {
    if (score >= 80) return 'Excellent Budget Health';
    if (score >= 60) return 'Good Budget Health';
    if (score >= 40) return 'Fair Budget Health';
    return 'Poor Budget Health';
  }

  getScoreGradient(score: number): string {
    const color = this.getScoreColor(score);
    return `conic-gradient(${color} ${score * 3.6}deg, #e0e0e0 ${score * 3.6}deg)`;
  }

  getMetrics(): Array<{name: string, score: number}> {
    if (!this.healthScore) return [];

    return [
      { name: 'Spending Control', score: this.healthScore.spendingControlScore || 0 },
      { name: 'Savings Rate', score: this.healthScore.savingsRateScore || 0 },
      { name: 'Goal Progress', score: this.healthScore.goalProgressScore || 0 },
      { name: 'Emergency Fund', score: this.healthScore.emergencyFundScore || 0 }
    ];
  }

  getImprovementLabel(area: string): string {
    const labels: { [key: string]: string } = {
      'overspending': 'Overspending',
      'low_savings': 'Low Savings',
      'missed_goals': 'Missed Goals',
      'no_emergency_fund': 'Emergency Fund',
      'irregular_income': 'Income Stability',
      'high_debt': 'Debt Management'
    };
    return labels[area] || area.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getImprovementTooltip(area: string): string {
    const tooltips: { [key: string]: string } = {
      'overspending': 'You\'re spending more than budgeted in some categories',
      'low_savings': 'Your savings rate could be improved',
      'missed_goals': 'Some financial goals are behind schedule',
      'no_emergency_fund': 'Consider building an emergency fund',
      'irregular_income': 'Income varies significantly month to month',
      'high_debt': 'High debt-to-income ratio detected'
    };
    return tooltips[area] || 'Click for more details';
  }

  getRecommendationIcon(recommendation: string): string {
    if (recommendation.toLowerCase().includes('save')) return 'savings';
    if (recommendation.toLowerCase().includes('budget')) return 'account_balance_wallet';
    if (recommendation.toLowerCase().includes('debt')) return 'money_off';
    if (recommendation.toLowerCase().includes('goal')) return 'flag';
    return 'lightbulb';
  }
}