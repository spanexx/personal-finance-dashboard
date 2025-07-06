import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';

import { BudgetService } from '../../../core/services/budget.service';
import { 
  OptimizationRecommendations, 
  ScenarioAnalysis, 
  ScenarioInput,
  SavingsOpportunity,
  EducationalContent,
  PersonalizedInsight
} from '../../../shared/models/budget.model';
import { BudgetHealthScoreComponent } from '../budget-health-score/budget-health-score.component';

@Component({
  selector: 'app-budget-optimization',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatSliderModule,
    MatChipsModule,
    MatProgressBarModule,
    // BudgetHealthScoreComponent
  ],
  template: `
    <div class="optimization-container">
      <div class="optimization-header">
        <h1>Budget Optimization & Recommendations</h1>
        <p>AI-powered insights to optimize your budget and achieve your financial goals</p>
      </div>

      <mat-tab-group class="optimization-tabs">
        <!-- Optimization Recommendations Tab -->
        <mat-tab label="Recommendations">
          <div class="tab-content">
            <div class="recommendations-grid" *ngIf="optimizationData">
              <mat-card *ngFor="let recommendation of optimizationData.recommendations" class="recommendation-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar [color]="getRecommendationColor(recommendation.priority)">
                    {{ getRecommendationIcon(recommendation.type) }}
                  </mat-icon>
                  <mat-card-title>{{ recommendation.title }}</mat-card-title>
                  <mat-card-subtitle>{{ recommendation.category }} • {{ recommendation.priority }} Priority</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <p>{{ recommendation.description }}</p>
                  <div class="impact-metrics" *ngIf="recommendation.potentialSavings">
                    <div class="metric">
                      <span class="label">Potential Savings:</span>
                      <span class="value">\${{ recommendation.potentialSavings | number:'1.2-2' }}</span>
                    </div>
                    <div class="metric" *ngIf="recommendation.implementationEffort">
                      <span class="label">Effort:</span>
                      <span class="value">{{ recommendation.implementationEffort }}</span>
                    </div>
                  </div>
                </mat-card-content>
                <mat-card-actions>
                  <button mat-button color="primary" (click)="implementRecommendation(recommendation)">
                    Apply
                  </button>
                  <button mat-button (click)="dismissRecommendation(recommendation)">
                    Dismiss
                  </button>
                </mat-card-actions>
              </mat-card>
            </div>
          </div>
        </mat-tab>

        <!-- Scenario Planning Tab -->
        <mat-tab label="What-If Analysis">
          <div class="tab-content">
            <div class="scenario-planning">
              <mat-card class="scenario-input-card">
                <mat-card-header>
                  <mat-card-title>Scenario Planning</mat-card-title>
                  <mat-card-subtitle>Test different budget scenarios</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="scenarioForm" class="scenario-form">
                    <mat-form-field>
                      <mat-label>Scenario Name</mat-label>
                      <input matInput formControlName="name" placeholder="e.g., Increase Savings">
                    </mat-form-field>
                    
                    <div class="category-adjustments">
                      <h4>Category Adjustments</h4>
                      <div class="adjustment-item" *ngFor="let category of budgetCategories">
                        <span class="category-name">{{ category.name }}</span>
                        <mat-slider
                          [min]="-50"
                          [max]="50"
                          [step]="5"
                          [discrete]="true"
                          [showTickMarks]="true"
                          class="adjustment-slider">
                          <input matSliderThumb [value]="0">
                        </mat-slider>
                        <span class="adjustment-value">0%</span>
                      </div>
                    </div>
                  </form>
                </mat-card-content>
                <mat-card-actions>
                  <button mat-raised-button color="primary" (click)="runScenarioAnalysis()">
                    Run Analysis
                  </button>
                </mat-card-actions>
              </mat-card>

              <mat-card class="scenario-results-card" *ngIf="scenarioResults">
                <mat-card-header>
                  <mat-card-title>Scenario Results</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="results-grid">
                    <div class="result-metric">
                      <span class="metric-label">Projected Savings</span>
                      <span class="metric-value positive">\${{ scenarioResults.projectedSavings | number:'1.2-2' }}</span>
                    </div>
                    <div class="result-metric">
                      <span class="metric-label">Budget Health Score</span>
                      <span class="metric-value">{{ scenarioResults.healthScoreChange }}%</span>
                    </div>
                    <div class="result-metric">
                      <span class="metric-label">Risk Level</span>
                      <span class="metric-value" [class]="scenarioResults.riskLevel.toLowerCase()">
                        {{ scenarioResults.riskLevel }}
                      </span>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </mat-tab>

        <!-- Savings Opportunities Tab -->
        <mat-tab label="Savings Opportunities">
          <div class="tab-content">
            <div class="savings-grid" *ngIf="savingsOpportunities?.length">
              <mat-card *ngFor="let opportunity of savingsOpportunities" class="savings-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar color="accent">savings</mat-icon>
                  <mat-card-title>{{ opportunity.title }}</mat-card-title>
                  <mat-card-subtitle>{{ opportunity.category }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <p>{{ opportunity.description }}</p>
                  <div class="savings-metrics">
                    <div class="metric">
                      <span class="label">Potential Monthly Savings:</span>
                      <span class="value highlight">\${{ opportunity.potentialMonthlySavings | number:'1.2-2' }}</span>
                    </div>
                    <div class="metric">
                      <span class="label">Annual Impact:</span>
                      <span class="value">\${{ opportunity.potentialAnnualSavings | number:'1.2-2' }}</span>
                    </div>
                  </div>
                </mat-card-content>
                <mat-card-actions>
                  <button mat-button color="primary" (click)="exploreSavingsOpportunity(opportunity)">
                    Learn More
                  </button>
                </mat-card-actions>
              </mat-card>
            </div>
          </div>
        </mat-tab>

        <!-- Educational Content Tab -->
        <mat-tab label="Financial Education">
          <div class="tab-content">
            <div class="education-content" *ngIf="educationalContent?.length">
              <mat-card *ngFor="let content of educationalContent" class="education-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar color="primary">school</mat-icon>
                  <mat-card-title>{{ content.title }}</mat-card-title>
                  <mat-card-subtitle>{{ content.category }} • {{ content.readingTime }} min read</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <p>{{ content.summary }}</p>
                  <mat-chip-set *ngIf="content.tags?.length">
                    <mat-chip *ngFor="let tag of content.tags">{{ tag }}</mat-chip>
                  </mat-chip-set>
                </mat-card-content>
                <mat-card-actions>
                  <button mat-button color="primary" (click)="openEducationalContent(content)">
                    Read Article
                  </button>
                </mat-card-actions>
              </mat-card>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styleUrls: ['./budget-optimization.component.scss']
})
export class BudgetOptimizationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  optimizationData: OptimizationRecommendations | null = null;
  scenarioResults: ScenarioAnalysis | null = null;
  savingsOpportunities: SavingsOpportunity[] = [];
  educationalContent: EducationalContent[] = [];
  personalizedInsights: PersonalizedInsight[] = [];

  scenarioForm: FormGroup;
  budgetCategories = [
    { id: 'food', name: 'Food & Dining' },
    { id: 'transportation', name: 'Transportation' },
    { id: 'entertainment', name: 'Entertainment' },
    { id: 'shopping', name: 'Shopping' },
    { id: 'utilities', name: 'Utilities' }
  ];

  constructor(
    private budgetService: BudgetService,
    private fb: FormBuilder
  ) {
    this.scenarioForm = this.fb.group({
      name: [''],
      adjustments: this.fb.group({})
    });
  }

  ngOnInit(): void {
    this.loadOptimizationData();
    this.loadSavingsOpportunities();
    this.loadEducationalContent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  private loadOptimizationData(): void {
    // Mock optimization recommendations
    this.optimizationData = {
      recommendations: [
        {
          type: 'opportunity',
          category: 'budget_structure',
          priority: 'high',
          title: 'Reduce Dining Out Expenses',
          description: 'You\'re spending 40% more on dining out than similar users. Consider meal planning to save money.',
          action: 'Set a weekly meal planning schedule and cooking budget',
          impact: 'financial_health',
          potentialSavings: 180.50,
          implementationEffort: 'medium'
        },
        {
          type: 'insight',
          category: 'pattern_analysis',
          priority: 'medium',
          title: 'Transportation Optimization Opportunity',
          description: 'Your transportation costs have increased 25% this quarter.',
          action: 'Consider carpooling or public transit alternatives',
          impact: 'budget_adherence',
          potentialSavings: 95.00,
          implementationEffort: 'low'
        }
      ],
      summary: 'Found 2 optimization opportunities with potential savings of $275.50',
      analysisDate: new Date(),
      budgetsAnalyzed: 1
    };
  }

  private loadSavingsOpportunities(): void {
    // Mock savings opportunities
    this.savingsOpportunities = [
      {
        category: 'Food & Dining',
        title: 'Meal Planning Challenge',
        description: 'Plan meals weekly and cook at home 5 days per week to reduce dining expenses.',
        currentSpending: 450,
        benchmarkSpending: 320,
        potentialSavings: 130,
        potentialMonthlySavings: 130,
        potentialAnnualSavings: 1560,
        savingsPercentage: 28.9,
        difficulty: 'moderate',
        timeline: 'short_term',
        suggestions: [
          'Create weekly meal plans',
          'Batch cook on weekends',
          'Use grocery list apps'
        ],
        impact: 'high'
      },
      {
        category: 'Subscriptions',
        title: 'Subscription Audit',
        description: 'Review and cancel unused subscriptions and memberships.',
        currentSpending: 85,
        benchmarkSpending: 45,
        potentialSavings: 40,
        potentialMonthlySavings: 40,
        potentialAnnualSavings: 480,
        savingsPercentage: 47.1,
        difficulty: 'easy',
        timeline: 'immediate',
        suggestions: [
          'List all active subscriptions',
          'Cancel unused services',
          'Negotiate better rates'
        ],
        impact: 'medium'
      }
    ];
  }

  private loadEducationalContent(): void {
    // Mock educational content
    this.educationalContent = [
      {
        id: '1',
        title: 'Smart Budgeting Strategies for Beginners',
        summary: 'Learn the fundamentals of creating and maintaining an effective budget.',
        type: 'article',
        category: 'budgeting',
        difficulty: 'beginner',
        content: 'Full article content here...',
        tags: ['budgeting', 'personal-finance', 'money-management'],
        relevanceScore: 95,
        isPersonalized: true,
        readingTime: 8,
        actionItems: [
          'Create your first budget',
          'Track expenses for one week',
          'Set up emergency fund'
        ]
      },
      {
        id: '2',
        title: 'Advanced Expense Tracking Techniques',
        summary: 'Discover advanced methods to track and categorize your expenses effectively.',
        type: 'tutorial',
        category: 'expense-tracking',
        difficulty: 'intermediate',
        content: 'Full tutorial content here...',
        tags: ['expense-tracking', 'categorization', 'automation'],
        relevanceScore: 87,
        isPersonalized: false,
        readingTime: 12,
        actionItems: [
          'Set up automatic categorization',
          'Use receipt scanning apps',
          'Review weekly expense reports'
        ]
      }
    ];
  }
  runScenarioAnalysis(): void {
    const scenarioInput: ScenarioInput = {
      name: this.scenarioForm.get('name')?.value || 'Unnamed Scenario',
      description: 'Budget optimization scenario analysis',
      changes: this.budgetCategories.map(category => ({
        categoryId: category.id,
        changeType: 'increase' as const,
        value: 0,
        reason: 'No changes'
      })),
      timeframe: 'current'
    };

    // For now, we'll generate mock analysis since we don't have a real budget ID
    // In a real implementation, you would call:
    // this.budgetService.performScenarioAnalysis('budget-id', scenarioInput)
    this.generateMockScenarioAnalysis(scenarioInput);
  }

  private generateMockScenarioAnalysis(input: ScenarioInput): void {
    // Generate mock analysis for demonstration
    this.scenarioResults = {
      scenarioName: input.name,
      description: input.description,
      projectedSavings: 150.00,
      healthScoreChange: 5,
      riskLevel: 'low',
      assumptions: input.changes.map(change => ({
        category: change.categoryId,
        changeType: 'percentage',
        changeValue: change.value,
        reason: change.reason || 'Optimization adjustment'
      })),
      projectedOutcome: {
        totalBudget: 2500,
        categoryBreakdown: this.budgetCategories.map(category => ({
          category: category.name,
          originalAmount: 500,
          projectedAmount: 525,
          change: 25
        })),
        riskAssessment: {
          level: 'low',
          factors: ['Conservative changes', 'Well within spending patterns']
        },
        feasibilityScore: 85
      }
    };
  }

  implementRecommendation(recommendation: any): void {
    console.log('Implementing recommendation:', recommendation);
  }

  dismissRecommendation(recommendation: any): void {
    console.log('Dismissing recommendation:', recommendation);
  }

  exploreSavingsOpportunity(opportunity: SavingsOpportunity): void {
    console.log('Exploring savings opportunity:', opportunity);
  }

  openEducationalContent(content: EducationalContent): void {
    console.log('Opening educational content:', content);
  }

  getRecommendationColor(priority: string): string {
    switch (priority?.toLowerCase()) {
      case 'high': return 'warn';
      case 'medium': return 'accent';
      case 'low': return 'primary';
      default: return 'primary';
    }
  }

  getRecommendationIcon(type: string): string {
    switch (type) {
      case 'overspending': return 'warning';
      case 'savings': return 'savings';
      case 'goal': return 'flag';
      case 'category': return 'category';
      default: return 'lightbulb';
    }
  }
}