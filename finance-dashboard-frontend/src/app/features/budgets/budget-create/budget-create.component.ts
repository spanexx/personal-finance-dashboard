import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, Observable } from 'rxjs';
import { takeUntil, filter, switchMap, take } from 'rxjs/operators';

// NgRx
import { Store } from '@ngrx/store';
import { AppState } from '../../../store/state/app.state';
import { BudgetActions } from '../../../store/actions/budget.actions';
import { selectBudgetLoading, selectBudgetError } from '../../../store/selectors/budget.selectors';

import { BudgetService } from '../budget.service';
import { CreateBudgetRequest } from '../../../shared/models/budget.model';
import { Category } from '../../../shared/models/category.model';
import { MaterialModule, MatSnackBar } from '../../../shared/modules';

// Accessibility imports
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { AccessibilityService, FocusTarget } from '../../../shared/services/accessibility.service';
import { FocusTrapDirective } from '../../../shared/directives/focus-trap.directive';

interface BudgetCategoryForm {
  category: string;
  categoryDetails: {
    name: string;
    color: string;
    icon: string;
  };
  amount: number;
}

@Component({
  selector: 'app-budget-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MaterialModule,
    FocusTrapDirective
  ],
  templateUrl: './budget-create.component.html',
  styleUrls: ['./budget-create.component.scss']
})
export class BudgetCreateComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('pageTitle') pageTitle!: ElementRef<HTMLElement>;
  @ViewChild('firstFormInput') firstFormInput!: ElementRef<HTMLInputElement>;
  budgetForm!: FormGroup;
  categories: Category[] = [];
  availableCategories: Category[] = [];
  saving: boolean = false;
  localError: string | null = null;
  lastRemovedCategory: { category: BudgetCategoryForm; index: number } | null = null;

  isLoading$: Observable<boolean>;
  isSaving$: Observable<boolean>;
  error$: Observable<string | null>;

  periodOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private budgetService: BudgetService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private accessibilityService: AccessibilityService,
    private store: Store<AppState>,
    private liveAnnouncer: LiveAnnouncer
  ) {
    this.budgetForm = this.createForm();
    this.isLoading$ = this.store.select(selectBudgetLoading);
    this.isSaving$ = this.store.select(selectBudgetLoading);
    this.error$ = this.store.select(selectBudgetError);
  }

  loading: boolean = false;
  error: string | null = null;

  ngOnInit(): void {
    this.subscribeToLoadingAndErrors();
    this.loadCategories();
    this.isLoading$.pipe(takeUntil(this.destroy$)).subscribe(loading => this.loading = loading);
    this.isSaving$.pipe(takeUntil(this.destroy$)).subscribe(saving => {
      this.saving = saving;
    });
    this.error$.pipe(takeUntil(this.destroy$)).subscribe(error => this.error = error || null);
  }

  private subscribeToLoadingAndErrors(): void {
    this.isLoading$.pipe(takeUntil(this.destroy$)).subscribe(loading => {
      if (loading) {
         this.accessibilityService.announceOperationStatus('Loading budget data...', 'started');
      }
    });

    this.isSaving$.pipe(takeUntil(this.destroy$)).subscribe(saving => {
      if (saving) {
        this.accessibilityService.announceOperationStatus('Saving budget...', 'started');
      }
    });

    this.error$.pipe(takeUntil(this.destroy$)).subscribe(error => {
      if (error) {
        this.snackBar.open(error, 'Close', { duration: 5000 });
      }
    });
  }

  ngAfterViewInit(): void {
    this.accessibilityService.announceRouteChange('Create New Budget');
    
    if (this.pageTitle) {
      this.pageTitle.nativeElement.focus();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createForm(): FormGroup {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      period: ['monthly', Validators.required],
      startDate: [startOfMonth, Validators.required],
      endDate: [endOfMonth, Validators.required],
      categories: this.fb.array([])
    });
  }

  private loadCategories(): void {
    this.accessibilityService.announceOperationStatus('Loading categories...', 'started');
    this.clearCategoriesFormArray();

    this.budgetService.getExpenseCategories().pipe(takeUntil(this.destroy$)).subscribe({
      next: (categories) => {
        this.categories = categories;
        this.addDefaultCategoryAllocations();
        this.accessibilityService.announceOperationStatus('Categories loaded', 'completed');
        this.focusFirstFormInput();
      },
      error: (err) => {
        this.localError = 'Failed to load categories. Please try again.';
        this.accessibilityService.announceOperationStatus('Loading categories', 'failed');
        this.liveAnnouncer.announce(this.localError, 'assertive');
      }
    });
  }

  retryLoad(): void {
    this.localError = null;
    this.store.dispatch(BudgetActions.clearBudgetError());
    this.loadCategories();
  }

  private addDefaultCategoryAllocations(): void {
    this.clearCategoriesFormArray();
    this.categories.forEach(category => {
      this.addCategoryAllocation(category._id, 0);
    });
  }

  get categoriesFormArray(): FormArray {
    return this.budgetForm.get('categories') as FormArray;
  }

  private clearCategoriesFormArray(): void {
    while (this.categoriesFormArray.length !== 0) {
      this.categoriesFormArray.removeAt(0);
    }
  }

  private addCategoryAllocation(categoryId: string, amount: number = 0): void {
    const category = this.categories.find(c => c._id === categoryId);
    if (!category) {
      console.error(`❌ Category not found: ${categoryId}`);
      return;
    }

    const categoryForm = this.fb.group({
      category: [categoryId, Validators.required],
      categoryDetails: this.fb.group({
        name: [category.name],
        color: [category.color],
        icon: [category.icon]
    }),
      amount: [amount, [Validators.required, Validators.min(0)]]
    });

    this.categoriesFormArray.push(categoryForm);
  }

  addNewCategoryAllocation(): void {
    const allocatedCategoryIds = this.categoriesFormArray.controls.map(
      control => control.get('category')?.value
    );
    const availableCategory = this.categories.find(
      cat => !allocatedCategoryIds.includes(cat._id)
    );
    
    if (availableCategory) {
      this.addCategoryAllocation(availableCategory._id, 0);
      this.accessibilityService.announce(`${availableCategory.name} category added to budget`);
      this.lastRemovedCategory = null;
    }
  }

  updateTotalBudget(): void {
    const totalCategoryAmount = this.categoriesFormArray.controls.reduce((sum, control) => {
      return sum + (control.get('amount')?.value || 0);
    }, 0);

    this.budgetForm.patchValue({
      amount: totalCategoryAmount
    }, { emitEvent: false });
  }

  getTotalAllocated(): number {
    return this.categoriesFormArray.controls.reduce((sum, control) => {
      return sum + (control.get('amount')?.value || 0);
    }, 0);
  }

  getUnallocated(): number {
    return (this.budgetForm.get('amount')?.value || 0) - this.getTotalAllocated();
  }

  isFormValid(): boolean {
    return this.budgetForm.valid && this.categoriesFormArray.length > 0;
  }

  onSubmit(): void {
    if (this.budgetForm.invalid) {
      this.accessibilityService.announceError('Please correct the form errors before submitting');
      this.focusFirstError();
      return;
    }
    this.accessibilityService.announceOperationStatus('Budget saving', 'started');
    const formValue = this.budgetForm.value;
    const budgetPayload = {
      name: formValue.name,
      totalAmount: formValue.amount,
      period: formValue.period,
      startDate: formValue.startDate instanceof Date ? formValue.startDate.toISOString() : formValue.startDate,
      endDate: formValue.endDate instanceof Date ? formValue.endDate.toISOString() : formValue.endDate,
      categoryAllocations: formValue.categories.map((cat: any) => ({
        category: cat.category,
        allocatedAmount: cat.amount
      }))
    };
    console.log('Budget Payload:', JSON.stringify(budgetPayload, null, 2));
    if (!budgetPayload.categoryAllocations || !Array.isArray(budgetPayload.categoryAllocations) || budgetPayload.categoryAllocations.length === 0) {
      console.error('No category allocations provided!');
    } else {
      budgetPayload.categoryAllocations.forEach((alloc, idx) => {
        if (!alloc.category || typeof alloc.category !== 'string') {
          console.error(`Allocation at index ${idx} missing valid categoryId`, alloc);
        }
        if (typeof alloc.allocatedAmount !== 'number') {
          console.error(`Allocation at index ${idx} missing valid allocatedAmount`, alloc);
        }
      });
    }
    this.store.dispatch(BudgetActions.createBudget({ budgetData: budgetPayload as CreateBudgetRequest }));
    this.isSaving$.pipe(
      filter(saving => !saving && (this.budgetForm.dirty || this.budgetForm.touched)),
      take(1),
      switchMap(() => this.error$),
      takeUntil(this.destroy$)
    ).subscribe(error => {
      if (!error) {
        const message = `Budget created successfully.`;
        this.liveAnnouncer.announce(message, 'polite');
        this.snackBar.open(message, 'Close', { duration: 3000 });
        this.router.navigate(['/budgets']);
        this.lastRemovedCategory = null;
        console.log('lastRemovedCategory cleared in onSubmit:', this.lastRemovedCategory);
      }
    });
  }

  private focusFirstFormInput(): void {
    setTimeout(() => {
      if (this.firstFormInput?.nativeElement) {
        this.firstFormInput.nativeElement.focus();
      }
    }, 100);
  }

  private focusFirstError(): void {
    const formErrors = this.getFormErrors();
    if (formErrors.length > 0) {
      const firstErrorField = document.querySelector(`[formControlName="${formErrors[0]}"]`) as HTMLElement;
      if (firstErrorField) {
        firstErrorField.focus();
      }
    }
  }

  private getFormErrors(): string[] {
    const errors: string[] = [];
    Object.keys(this.budgetForm.controls).forEach(key => {
      if (this.budgetForm.get(key)?.invalid) {
        errors.push(key);
      }
    });
    this.categoriesFormArray.controls.forEach((control, index) => {
      if (control.get('amount')?.invalid) {
        errors.push(`categories.${index}.amount`);
      }
    });
    return errors;
  }

  onCategoryAmountChange(): void {
    this.updateTotalBudget();
    const totalAllocated = this.getTotalAllocated();
    const totalBudget = this.budgetForm.get('amount')?.value || 0;
    const unallocated = totalBudget - totalAllocated;
    if (unallocated < 0) {
      this.accessibilityService.announce(`Budget exceeded by ${Math.abs(unallocated).toFixed(2)} dollars`);
    } else if (unallocated === 0) {
      this.accessibilityService.announce('Budget fully allocated');
    }
  }

  removeCategoryAllocation(index: number): void {
    const removedCategoryControl = this.categoriesFormArray.at(index);
    const categoryName = removedCategoryControl.get('categoryDetails.name')?.value;
    this.lastRemovedCategory = {
      category: removedCategoryControl.value,
      index: index
    };
    this.categoriesFormArray.removeAt(index);
    this.updateTotalBudget();
    this.accessibilityService.announce(`${categoryName} category removed from budget. You can undo this action.`);
    console.log('lastRemovedCategory set to:', this.lastRemovedCategory);
  }

  undoRemoveCategoryAllocation(): void {
    if (this.lastRemovedCategory) {
      const { category, index } = this.lastRemovedCategory;
      const categoryFormGroup = this.fb.group({
        category: [category.category, Validators.required],
        categoryDetails: this.fb.group({
          name: [category.categoryDetails.name],
          color: [category.categoryDetails.color],
          icon: [category.categoryDetails.icon]
        }),
        amount: [category.amount, [Validators.required, Validators.min(0)]]
      });
      this.categoriesFormArray.insert(index, categoryFormGroup);
      this.updateTotalBudget();
      this.lastRemovedCategory = null;
      this.accessibilityService.announce(`${category.categoryDetails.name} category restored to budget.`);
      console.log('lastRemovedCategory cleared in undoRemoveCategoryAllocation:', this.lastRemovedCategory);
      this.lastRemovedCategory = null;
    }
  }

  cancel(): void {
    this.router.navigate(['/budgets']);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  onKeyDown(event: KeyboardEvent): void {
  }
}
