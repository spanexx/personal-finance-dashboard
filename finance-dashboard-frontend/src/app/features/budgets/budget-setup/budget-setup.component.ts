import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, Observable } from 'rxjs'; // Observable was already there
import { takeUntil, filter, switchMap, take } from 'rxjs/operators'; // Added switchMap and take

// NgRx
import { Store } from '@ngrx/store';
import { AppState } from '../../../store/state/app.state';
import { BudgetActions } from '../../../store/actions/budget.actions';
import { selectSelectedBudget, selectBudgetLoading, selectBudgetError } from '../../../store/selectors/budget.selectors';

import { BudgetService } from '../budget.service';
import { Budget, CreateBudgetRequest, UpdateBudgetRequest } from '../../../shared/models/budget.model'; // Added UpdateBudgetRequest
import { Category } from '../../../shared/models/category.model';
import { MaterialModule, MatSnackBar } from '../../../shared/modules';

// Accessibility imports
import { LiveAnnouncer } from '@angular/cdk/a11y'; // Import LiveAnnouncer
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
  selector: 'app-budget-setup',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MaterialModule,
    FocusTrapDirective
  ],
  templateUrl: './budget-setup.component.html',
  styleUrls: ['./budget-setup.component.scss']
})
export class BudgetSetupComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('pageTitle') pageTitle!: ElementRef<HTMLElement>;
  @ViewChild('firstFormInput') firstFormInput!: ElementRef<HTMLInputElement>;
  budgetForm!: FormGroup;
  categories: Category[] = [];
  availableCategories: Category[] = [];
  // loading = false;
  saving: boolean = false;
  localError: string | null = null; // For local errors like category loading failure
  lastRemovedCategory: { category: BudgetCategoryForm; index: number } | null = null;

  isLoading$: Observable<boolean>;
  isSaving$: Observable<boolean>;
  error$: Observable<string | null>; // NgRx store error

  private currentBudgetId: string | null = null;

  periodOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private budgetService: BudgetService, // Still used for categories
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private accessibilityService: AccessibilityService,
    private store: Store<AppState>, // Inject Store
    private liveAnnouncer: LiveAnnouncer // Inject LiveAnnouncer
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
    this.loadCategoriesAndDetermineMode();
    this.isLoading$.pipe(takeUntil(this.destroy$)).subscribe(loading => this.loading = loading);
    this.isSaving$.pipe(takeUntil(this.destroy$)).subscribe(saving => {
      this.saving = saving;
    });
    this.error$.pipe(takeUntil(this.destroy$)).subscribe(error => this.error = error || null);
  }

  private subscribeToLoadingAndErrors(): void {
    this.isLoading$.pipe(takeUntil(this.destroy$)).subscribe(loading => {
      if (loading && !this.currentBudgetId) {
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
        // this.accessibilityService.announceError(error); // Using liveAnnouncer directly in onSubmit
        this.snackBar.open(error, 'Close', { duration: 5000 });
      }
    });
  }

  ngAfterViewInit(): void {
    // Announce page load and set initial focus
    this.accessibilityService.announceRouteChange('Budget Setup');
    
    // Focus on page title first, then move to first form input after data loads
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

  // Combined category loading and mode determination (create/edit)
  private loadCategoriesAndDetermineMode(): void {
    this.accessibilityService.announceOperationStatus('Loading data...', 'started');
    this.clearCategoriesFormArray(); // Clear previous form state

    // Category loading still uses BudgetService for now
    this.budgetService.getExpenseCategories().pipe(takeUntil(this.destroy$)).subscribe({
      next: (categories) => {
        this.categories = categories;
        this.determineModeAndLoadBudget();
        this.accessibilityService.announceOperationStatus('Categories loaded', 'completed');
      },
      error: (err) => {
        this.localError = 'Failed to load categories. Please try again.';
        // this.store.dispatch(BudgetActions.loadBudgetFailure({ error: 'Failed to load categories for form.' })); // Avoid dispatching budget load failure for category error
        this.accessibilityService.announceOperationStatus('Loading categories', 'failed');
        this.liveAnnouncer.announce(this.localError, 'assertive');
      }
    });
  }

  retryLoad(): void {
    this.localError = null; // Clear local error
    this.store.dispatch(BudgetActions.clearBudgetError()); // Clear NgRx error state
    if (this.currentBudgetId) {
      // If in edit mode, try to reload the specific budget (which might also re-trigger category load if chained or part of a larger setup)
      this.store.dispatch(BudgetActions.loadBudget({ budgetId: this.currentBudgetId }));
    } else {
      // If in create mode, just re-try loading categories.
      this.loadCategoriesAndDetermineMode();
    }
  }

  private determineModeAndLoadBudget(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = (params as any).get ? (params as any).get('id') : null;
      if (id) {
        this.currentBudgetId = id;
        this.accessibilityService.announceOperationStatus('Loading budget for editing...', 'started');
        this.store.dispatch(BudgetActions.loadBudget({ budgetId: id }));

        this.store.select(selectSelectedBudget).pipe(
          filter((budget): budget is Budget => !!budget && budget._id === this.currentBudgetId),
          takeUntil(this.destroy$) // Ensure unsubscription
        ).subscribe(budgetToEdit => {
          this.loadExistingBudget(budgetToEdit as Budget); // Populate form with loaded budget
          this.accessibilityService.announceOperationStatus('Budget data loaded for editing', 'completed');
          this.focusFirstFormInput();
        });
      } else {
        this.currentBudgetId = null;
        this.store.dispatch(BudgetActions.clearSelectedBudget());
        this.budgetForm.reset(this.createForm().value);
        this.addDefaultCategoryAllocations();
        this.accessibilityService.announceOperationStatus('New budget form ready', 'completed');
        this.focusFirstFormInput();
      }
    });
  }

  // public loadData(): void { ... } // This is now replaced by loadCategoriesAndDetermineMode

  private loadExistingBudget(budget: any): void {
    try {
      this.budgetForm.patchValue({
        name: budget.name,
        amount: budget.totalAmount,
        period: budget.period,
        startDate: new Date(budget.startDate),
        endDate: new Date(budget.endDate)
      });
      this.clearCategoriesFormArray(); // Clear before adding new ones
      // Transform backend categoryAllocations to expected categories array
      const categories = (budget.categoryAllocations || budget.categories || []).map((alloc: any) => ({
        category: alloc.category && alloc.category._id ? alloc.category._id : alloc.category,
        allocated: alloc.allocatedAmount || alloc.allocated || 0
      }));
      categories.forEach((budgetCategory: any) => {
        this.addCategoryAllocation(budgetCategory.category, budgetCategory.allocated);
      });
      const existingCategoryIds = categories.map((bc: any) => bc.category);
      this.categories.forEach(category => {
        if (!existingCategoryIds.includes(category._id)) {
          this.addCategoryAllocation(category._id, 0);
        }
      });
    } catch (error) {
      console.error('❌ Error in loadExistingBudget:', error);
    }
  }

  private addDefaultCategoryAllocations(): void {
    this.clearCategoriesFormArray(); // Clear before adding defaults
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
      this.lastRemovedCategory = null; // Clear undo history on new addition
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
    // Strictly filter outgoing payload to backend-required fields only
    const budgetPayload = {
      name: formValue.name,
      totalAmount: formValue.amount,
      period: formValue.period,
      startDate: formValue.startDate instanceof Date ? formValue.startDate.toISOString() : formValue.startDate,
      endDate: formValue.endDate instanceof Date ? formValue.endDate.toISOString() : formValue.endDate,
      categoryAllocations: formValue.categories.map((cat: any) => ({
        category: cat.category,
        allocatedAmount: cat.amount
        // notes: cat.notes // Uncomment if notes are supported in the form
      }))
    };
    // Debug log: Confirm outgoing payload structure
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
    if (this.currentBudgetId) {
      const updateData: UpdateBudgetRequest = {
        _id: this.currentBudgetId,
        ...budgetPayload
      };
      this.store.dispatch(BudgetActions.updateBudget({ budgetId: this.currentBudgetId, budgetData: updateData }));
    } else {
      this.store.dispatch(BudgetActions.createBudget({ budgetData: budgetPayload as CreateBudgetRequest }));
    }
    // Handle success/failure navigation (can be improved with effects that navigate)
    this.isSaving$.pipe(
      filter(saving => !saving && (this.budgetForm.dirty || this.budgetForm.touched)),
      take(1),
      switchMap(() => this.error$), // Check for errors after the saving attempt has finished
      takeUntil(this.destroy$)
    ).subscribe(error => {
      if (!error) {
        const message = `Budget ${this.currentBudgetId ? 'updated' : 'created'} successfully.`;
        this.liveAnnouncer.announce(message, 'polite');
        this.snackBar.open(message, 'Close', { duration: 3000 });
        this.router.navigate(['/budgets']);
        this.lastRemovedCategory = null; // Clear undo history on successful submission
        console.log('lastRemovedCategory cleared in onSubmit:', this.lastRemovedCategory);
      } else {
        // Error was already announced by the error$ subscription, and snackbar shown.
        // No need to announce again here unless more specific message is needed.
        // For example: this.liveAnnouncer.announce(`Failed to save budget: ${error}`, 'assertive');
        // The existing error$ subscription already announces a generic error.
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
      this.lastRemovedCategory = null; // Clear undo history
      this.accessibilityService.announce(`${category.categoryDetails.name} category restored to budget.`);
      console.log('lastRemovedCategory cleared in undoRemoveCategoryAllocation:', this.lastRemovedCategory);
      this.lastRemovedCategory = null; // Clear undo history
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
    // Focus trap logic is handled by the FocusTrapDirective
  }
}
