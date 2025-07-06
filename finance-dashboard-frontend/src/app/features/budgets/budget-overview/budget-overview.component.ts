import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, Observable } from 'rxjs'; // Added Observable
import { takeUntil, filter } from 'rxjs/operators'; // Added filter

// NgRx
import { Store } from '@ngrx/store';
import { AppState } from '../../../store/state/app.state';
import { BudgetActions } from '../../../store/actions/budget.actions';
import { selectSelectedBudget, selectBudgetLoading, selectBudgetError } from '../../../store/selectors/budget.selectors';

import { MaterialModule } from '../../../shared/modules';

import { BudgetService } from '../budget.service'; // Still used for calculateBudgetProgress, getCategoryStatus
import { Budget, CategoryAllocation } from '../../../shared/models/budget.model';

@Component({
  selector: 'app-budget-overview',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MaterialModule
  ],
  templateUrl: './budget-overview.component.html',
  styleUrls: ['./budget-overview.component.scss', './budget.component.scss']
})
export class BudgetOverviewComponent implements OnInit, OnDestroy {
  // currentBudget: Budget | null = null; // Replaced by selectedBudget$
  selectedBudget$: Observable<Budget | null>;
  budgetProgress: any = null; // Remains, calculated locally
  isLoading$: Observable<boolean>;
  error$: Observable<string | null>;
  Math = Math; // For template usage

  private destroy$ = new Subject<void>();

  constructor(
    public budgetService: BudgetService, // Still used for helper methods
    private store: Store<AppState>
  ) {
    this.selectedBudget$ = this.store.select(selectSelectedBudget);
    this.isLoading$ = this.store.select(selectBudgetLoading); // General budget loading
    this.error$ = this.store.select(selectBudgetError);     // General budget error
  }

  ngOnInit(): void {
    this.dispatchLoadCurrentBudget();

    this.selectedBudget$.pipe(takeUntil(this.destroy$)).subscribe(budget => {
      // this.currentBudget = budget; // Template can use async pipe with selectedBudget$
      if (budget) {
        this.budgetProgress = this.budgetService.calculateBudgetProgress(budget);
      } else {
        this.budgetProgress = null;
      }
    });

    // Optionally, handle loading and error display based on isLoading$ and error$
    // For example, if an error occurs during loadCurrentBudget, error$ will emit.
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  dispatchLoadCurrentBudget(): void {
    this.store.dispatch(BudgetActions.loadCurrentBudget());
  }

  // loadCurrentBudget(): void { ... } // Replaced by dispatchLoadCurrentBudget and selectedBudget$ subscription

  getCategoryStatusClass(category: CategoryAllocation): string {
    const status = this.budgetService.getCategoryStatus(category);
    return `status-${status}`;
  }
  getCategoryProgressPercentage(category: CategoryAllocation): number {
    if (category.allocated <= 0) return 0;
    return Math.min((category.spent / category.allocated) * 100, 100);
  }

  getOverallProgressColor(): string {
    if (!this.budgetProgress) return 'primary';
    
    const percentage = this.budgetProgress.percentageSpent;
    if (percentage > 100) return 'warn';
    if (percentage > 80) return 'accent';
    return 'primary';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
  formatDate(date: string | Date | undefined | null): string {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  navigateToSetup(): void {
    // Navigation will be handled by router
  }

  navigateToAnalysis(): void {
    // Navigation will be handled by router
  }

  // Helper methods for category display
  getCategoryIcon(category: CategoryAllocation): string {
    // Return a default icon based on category name
    const categoryIcons: { [key: string]: string } = {
      'housing': 'home',
      'food': 'restaurant',
      'transportation': 'directions_car',
      'utilities': 'electrical_services',
      'entertainment': 'movie',
      'healthcare': 'local_hospital',
      'savings': 'savings',
      'debt': 'payment',
      'insurance': 'security',
      'shopping': 'shopping_cart',
      'education': 'school',
      'travel': 'flight',
      'groceries': 'local_grocery_store'
    };
    
    const categoryName = category.category.toLowerCase();
    return categoryIcons[categoryName] || 'category';
  }

  getCategoryColor(category: CategoryAllocation): string {
    // Return a color based on category name or use a default
    const categoryColors: { [key: string]: string } = {
      'housing': '#E91E63',
      'food': '#4CAF50',
      'transportation': '#2196F3',
      'utilities': '#FF9800',
      'entertainment': '#9C27B0',
      'healthcare': '#F44336',
      'savings': '#4CAF50',
      'debt': '#FF5722',
      'insurance': '#607D8B',
      'shopping': '#E91E63',
      'education': '#673AB7',
      'travel': '#00BCD4',
      'groceries': '#8BC34A'
    };
    
    const categoryName = category.category.toLowerCase();
    return categoryColors[categoryName] || '#757575';
  }

  getCategoryDisplayName(category: CategoryAllocation): string {
    // Convert category name to display format
    return category.category.charAt(0).toUpperCase() + category.category.slice(1);
  }
}
