import { Component, OnInit, Inject, OnDestroy } from '@angular/core'; // Added OnDestroy
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject } from 'rxjs';
import { takeUntil, filter, switchMap, take } from 'rxjs/operators'; // Added take
import { Store } from '@ngrx/store';

import { Category, TransactionService } from '../services/transaction.service'; // Transaction model comes from shared
import { CreateTransactionRequest, Transaction } from '../../../shared/models/transaction.model';
import { PaymentMethod } from '../transaction-form/transaction-form.component';
import { AppState } from '../../../store/state/app.state';
import * as TransactionActions from '../../../store/actions/transaction.actions';
import { getTransactionLoading, getTransactionError } from '../../../store/selectors/transaction.selectors';

@Component({
  selector: 'app-quick-add-transaction',
  templateUrl: './quick-add-transaction.component.html',
  styleUrl: './quick-add-transaction.component.scss'
})
export class QuickAddTransactionComponent implements OnInit, OnDestroy { // Implemented OnDestroy
  quickAddForm!: FormGroup;
  categories: Category[] = [];
  expenseCategories: Category[] = [];
  incomeCategories: Category[] = [];
  // isSubmitting = false; // Replaced by isLoading$
  
  isLoading$: Observable<boolean>;
  error$: Observable<any | null>;
  private destroyed$ = new Subject<void>();

  paymentMethods: PaymentMethod[] = [
    { id: 'cash', name: 'Cash', type: 'cash', icon: 'payments' },
    { id: 'credit_card', name: 'Credit Card', type: 'credit_card', icon: 'credit_card' },
    { id: 'debit_card', name: 'Debit Card', type: 'debit_card', icon: 'credit_card' },
    { id: 'bank_transfer', name: 'Bank Transfer', type: 'bank_transfer', icon: 'account_balance' }
  ];
  
  currencySymbol = '$';

  constructor(
    private fb: FormBuilder,
    private transactionService: TransactionService, // Still used for categories
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<QuickAddTransactionComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private store: Store<AppState>
  ) {
    this.createForm();
    this.isLoading$ = this.store.select(getTransactionLoading);
    this.error$ = this.store.select(getTransactionError);
  }

  ngOnInit(): void {
    this.loadCategories();
    
    if (this.data) {
      this.quickAddForm.patchValue(this.data);
    }

    this.isLoading$.pipe(takeUntil(this.destroyed$)).subscribe(loading => {
      // this.isSubmitting = loading; // Update if a local submitting flag is still used in template
    });

    // Potentially handle errors if submission fails
    this.error$.pipe(takeUntil(this.destroyed$)).subscribe(error => {
      if (error && this.quickAddForm.dirty) { // Check if form was submitted
         this.snackBar.open('Error adding transaction', 'Close', { duration: 3000 });
         console.error('Error creating transaction:', error);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  createForm(): void {
    this.quickAddForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]],
      type: ['expense', Validators.required],
      category: ['', Validators.required],
      description: ['', [Validators.required, Validators.maxLength(100)]],
      payee: ['', [Validators.required, Validators.maxLength(50)]],
      paymentMethod: ['cash', Validators.required],
      date: [new Date(), Validators.required]
    });

    // Update available categories when transaction type changes
    this.quickAddForm.get('type')?.valueChanges.subscribe(type => {
      this.updateCategoryOptions(type);
    });
  }

  loadCategories(): void {
    this.transactionService.getCategories().subscribe(categories => {
      this.categories = categories;
      this.expenseCategories = categories.filter(c => c.type === 'expense');
      this.incomeCategories = categories.filter(c => c.type === 'income');
      
      // Set initial category options based on transaction type
      this.updateCategoryOptions(this.quickAddForm.get('type')?.value);
    });
  }

  updateCategoryOptions(type: string): void {
    // Clear current category selection
    this.quickAddForm.get('category')?.setValue('');
  }

  onAmountInput(event: any): void {
    const value = event.target.value;
    // Remove any non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    event.target.value = numericValue;
    this.quickAddForm.get('amount')?.setValue(parseFloat(numericValue) || null);
  }

  get isSubmitting() {
    let loading: boolean = false;
    this.isLoading$.subscribe(val => loading = val).unsubscribe();
    return loading;
  }

  onSubmit(): void {
    if (this.quickAddForm.invalid) {
      this.quickAddForm.markAllAsTouched();
      return;
    }
    const formData = this.quickAddForm.value;
    const transactionData: CreateTransactionRequest = {
      amount: formData.amount,
      type: formData.type,
      category: formData.category, // Corrected from categoryId to category
      date: formData.date,
      description: formData.description,
      // payee: formData.payee, // Payee is not in CreateTransactionRequest in shared/models/transaction.model.ts
      paymentMethod: formData.paymentMethod,
      // notes, tags, etc. are optional or not in this quick form
    };
    this.store.dispatch(TransactionActions.createTransaction({ transaction: transactionData }));

    // Listen for success/failure to close dialog
    this.store.select(getTransactionLoading).pipe(
      filter(loading => !loading && this.quickAddForm.dirty), // Wait for loading to finish after submit
      take(1),
      switchMap(() => this.store.select(getTransactionError)),
      takeUntil(this.destroyed$)
    ).subscribe(error => {
      if (!error) {
        this.snackBar.open('Transaction added successfully', 'Close', { duration: 3000 });
        // Assuming createTransactionSuccess action updates the store, and the effect might return the created transaction
        // For now, just closing. If the created transaction is needed by the caller, it's more complex.
        this.dialogRef.close(true); // Close with a success indicator
      } else {
        // Error already handled by the general error$ subscription, but explicit log here is fine.
        console.error('Error creating transaction via quick add:', error);
      }
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  getErrorMessage(controlName: string): string {
    const control = this.quickAddForm.get(controlName);
    if (!control || !control.errors || !control.touched) {
      return '';
    }

    if (control.errors['required']) {
      return `${controlName} is required`;
    }
    if (control.errors['min']) {
      return 'Amount must be greater than 0';
    }
    if (control.errors['maxlength']) {
      return `${controlName} is too long`;
    }

    return 'Invalid input';
  }
}
