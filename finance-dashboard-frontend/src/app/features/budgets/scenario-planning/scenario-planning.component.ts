import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { 
  ScenarioInput, 
  ScenarioResult, 
  Budget 
} from '../../../shared/models/budget.model';
import { BudgetService } from '../../../core/services/budget.service';

interface CategoryAdjustment {
  categoryId: string;
  categoryName: string;
  currentAmount: number;
  adjustmentPercentage: number;
  newAmount: number;
  changeType: 'percentage' | 'amount';
}

@Component({
  selector: 'app-scenario-planning',
  standalone: true,  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTabsModule
  ],
  templateUrl: './scenario-planning.component.html',
  styleUrls: ['./scenario-planning.component.scss']
})
export class ScenarioPlanningComponent implements OnInit, OnDestroy {
  @Input() currentBudget: Budget | null = null;
  @Output() scenarioApplied = new EventEmitter<ScenarioResult>();

  private destroy$ = new Subject<void>();
  scenarioForm: FormGroup;
  categoryAdjustments: CategoryAdjustment[] = [];
  analysisResult: ScenarioResult | null = null;
  isAnalyzing = false;
  savedScenarios: any[] = [];
  Math = Math;

  constructor(
    private fb: FormBuilder,
    private budgetService: BudgetService
  ) {
    this.scenarioForm = this.fb.group({
      name: [''],
      timeframe: ['monthly']
    });
  }

  ngOnInit(): void {
    this.initializeCategoryAdjustments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }  private initializeCategoryAdjustments(): void {
    if (this.currentBudget?.categories) {
      this.categoryAdjustments = this.currentBudget.categories.map(cat => ({
        categoryId: cat.category,
        categoryName: cat.category, // We'll use category string as name for now
        currentAmount: cat.allocated,
        adjustmentPercentage: 0,
        newAmount: cat.allocated,
        changeType: 'percentage' as 'percentage' | 'amount'
      }));
    } else {
      // Default categories if no budget provided
      this.categoryAdjustments = [
        { categoryId: 'food', categoryName: 'Food & Dining', currentAmount: 500, adjustmentPercentage: 0, newAmount: 500, changeType: 'percentage' },
        { categoryId: 'transport', categoryName: 'Transportation', currentAmount: 300, adjustmentPercentage: 0, newAmount: 300, changeType: 'percentage' },
        { categoryId: 'entertainment', categoryName: 'Entertainment', currentAmount: 200, adjustmentPercentage: 0, newAmount: 200, changeType: 'percentage' },
        { categoryId: 'shopping', categoryName: 'Shopping', currentAmount: 250, adjustmentPercentage: 0, newAmount: 250, changeType: 'percentage' },
        { categoryId: 'savings', categoryName: 'Savings', currentAmount: 800, adjustmentPercentage: 0, newAmount: 800, changeType: 'percentage' }
      ];
    }
  }

  onAdjustmentChange(index: number, newPercentage: number): void {
    const adjustment = this.categoryAdjustments[index];
    adjustment.adjustmentPercentage = newPercentage;
    adjustment.newAmount = adjustment.currentAmount * (1 + newPercentage / 100);
  }

  applyPresetScenario(preset: string): void {
    switch (preset) {
      case 'conservative':
        this.applyAdjustments({ 'savings': 10, 'entertainment': -5 });
        break;
      case 'aggressive':
        this.applyAdjustments({ 'savings': 25, 'food': -10, 'entertainment': -15 });
        break;
      case 'reduce_dining':
        this.applyAdjustments({ 'food': -30, 'savings': 15 });
        break;
      case 'increase_entertainment':
        this.applyAdjustments({ 'entertainment': 20, 'food': -10 });
        break;
      case 'reset':
        this.resetScenario();
        break;
    }
    
    // Update scenario name
    const presetNames: { [key: string]: string } = {
      'conservative': 'Conservative Savings Boost',
      'aggressive': 'Aggressive Savings Plan',
      'reduce_dining': 'Reduce Dining Expenses',
      'increase_entertainment': 'Increase Entertainment Budget'
    };
    
    if (preset !== 'reset' && presetNames[preset]) {
      this.scenarioForm.patchValue({ name: presetNames[preset] });
    }
  }

  private applyAdjustments(adjustments: { [key: string]: number }): void {
    this.categoryAdjustments.forEach(adj => {
      const categoryKey = adj.categoryName.toLowerCase().split(' ')[0]; // Get first word
      if (adjustments[categoryKey] !== undefined) {
        this.onAdjustmentChange(
          this.categoryAdjustments.indexOf(adj), 
          adjustments[categoryKey]
        );
      }
    });
  }

  resetScenario(): void {
    this.categoryAdjustments.forEach((adj, index) => {
      this.onAdjustmentChange(index, 0);
    });
    this.scenarioForm.reset({ timeframe: 'monthly' });
    this.analysisResult = null;
  }
  runAnalysis(): void {
    if (!this.scenarioForm.valid || !this.currentBudget) return;

    this.isAnalyzing = true;
    
    const scenarioInput: ScenarioInput = {
      name: this.scenarioForm.value.name || 'Unnamed Scenario',
      description: `Scenario analysis for ${this.currentBudget.name}`,
      changes: this.categoryAdjustments.map(adj => ({
        categoryId: adj.categoryId,
        changeType: adj.adjustmentPercentage >= 0 ? 'increase' : 'decrease',
        value: Math.abs(adj.adjustmentPercentage),
        reason: `Adjust ${adj.categoryName} by ${adj.adjustmentPercentage}%`
      })),
      timeframe: this.scenarioForm.value.timeframe || 'current'
    };

    this.budgetService.performScenarioAnalysis(this.currentBudget._id, scenarioInput)
      .pipe(takeUntil(this.destroy$))
      .subscribe({        next: (result) => {
          this.analysisResult = result;
          this.isAnalyzing = false;
        },
        error: (error) => {
          console.error('Scenario analysis failed:', error);
          this.isAnalyzing = false;
          // Mock result for demonstration
          this.generateMockAnalysis(scenarioInput);
        }
      });
  }
  private generateMockAnalysis(input: ScenarioInput): void {
    const totalChange = this.categoryAdjustments.reduce((sum, adj) => {
      return sum + (adj.newAmount - adj.currentAmount);
    }, 0);

    this.analysisResult = {
      scenario: input,
      projectedBudget: {
        totalAmount: (this.currentBudget?.totalAmount || 0) + totalChange,
        categories: this.categoryAdjustments.map(adj => ({
          categoryId: adj.categoryId,
          categoryName: adj.categoryName,
          originalAmount: adj.currentAmount,
          newAmount: adj.newAmount,
          change: adj.newAmount - adj.currentAmount,
          changePercentage: adj.adjustmentPercentage
        }))
      },
      impact: {
        financialImpact: totalChange,
        riskLevel: Math.abs(totalChange) > 500 ? 'high' : Math.abs(totalChange) > 200 ? 'medium' : 'low',
        feasibility: Math.max(0, Math.min(100, 100 - Math.abs(totalChange) / 50)),
        recommendations: this.generateRecommendations(totalChange)
      },
      comparison: {
        vsCurrentBudget: {
          totalChange: totalChange,
          categoryChanges: this.categoryAdjustments.filter(adj => adj.adjustmentPercentage !== 0).length,
          riskChange: totalChange > 0 ? 1 : totalChange < 0 ? -1 : 0
        }
      }
    };
  }
  private generateRecommendations(totalChange: number): string[] {
    const recommendations = [];
    
    if (totalChange > 200) {
      recommendations.push('Great Savings Potential: This scenario could significantly improve your financial health.');
    } else if (totalChange < -200) {
      recommendations.push('Increased Spending Risk: Consider balancing increased spending with cuts in other areas.');
    }
    
    return recommendations;
  }
  getHealthScoreColor(change: number): string {
    return change >= 0 ? 'primary' : 'warn';
  }

  getRiskLevelColor(level: string): string {
    switch (level.toLowerCase()) {
      case 'low': return 'primary';
      case 'medium': return 'accent';
      case 'high': return 'warn';
      default: return 'primary';
    }
  }

  getRecommendationSeverity(type: string): string {
    switch (type) {
      case 'warning': return 'warn';
      case 'success': return 'primary';
      default: return 'accent';
    }
  }

  getRecommendationIcon(type: string): string {
    switch (type) {
      case 'warning': return 'warning';
      case 'success': return 'check_circle';
      default: return 'info';
    }
  }

  canApplyScenario(): boolean {
    return this.analysisResult !== null && this.analysisResult.impact.riskLevel !== 'high';
  }

  shareScenario(): void {
    // Implementation for sharing scenario
    console.log('Sharing scenario:', this.analysisResult);
  }

  saveScenario(): void {
    // Implementation for saving scenario
    console.log('Saving scenario:', this.analysisResult);
  }

  applyScenario(): void {
    if (this.analysisResult && this.canApplyScenario()) {
      this.scenarioApplied.emit(this.analysisResult);
    }
  }

  // Utility Methods for Template
  getAmountChangeClass(originalAmount: number, newAmount: number): string {
    if (newAmount > originalAmount) {
      return 'positive';
    } else if (newAmount < originalAmount) {
      return 'negative';
    }
    return 'neutral';
  }

  getChangeIcon(originalAmount: number, newAmount: number): string {
    if (newAmount > originalAmount) {
      return 'trending_up';
    } else if (newAmount < originalAmount) {
      return 'trending_down';
    }
    return 'remove';
  }
  getRiskColor(riskLevel: string): string {
    switch (riskLevel.toLowerCase()) {
      case 'low': return 'primary';
      case 'medium': return 'accent';
      case 'high': return 'warn';
      default: return 'primary';
    }
  }

  getImpactLevel(changePercentage: number): string {
    const absChange = Math.abs(changePercentage);
    if (absChange >= 20) {
      return 'High';
    } else if (absChange >= 10) {
      return 'Medium';
    } else {
      return 'Low';
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatPercentage(value: number): string {
    return `${Math.round(value)}%`;
  }

  loadSavedScenarios(): void {
    // Implementation for loading saved scenarios
    console.log('Loading saved scenarios...');
  }

  exportScenario(): void {
    if (this.analysisResult) {
      // Implementation for exporting scenario
      console.log('Exporting scenario:', this.analysisResult);
    }
  }

  loadScenario(scenario: any): void {
    // Implementation for loading a saved scenario
    console.log('Loading scenario:', scenario);
  }

  duplicateScenario(scenario: any): void {
    // Implementation for duplicating a scenario
    console.log('Duplicating scenario:', scenario);
  }

  deleteScenario(scenario: any): void {
    // Implementation for deleting a scenario
    console.log('Deleting scenario:', scenario);
  }
}
