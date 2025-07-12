import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef, OnDestroy } from '@angular/core'; // Added OnDestroy
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatDialog } from '@angular/material/dialog';
import { ENTER, COMMA } from '@angular/cdk/keycodes';
import { Observable, combineLatest, Subject } from 'rxjs';
import { map, startWith, takeUntil, first, debounceTime, distinctUntilChanged, switchMap, filter, take } from 'rxjs/operators'; // Added filter, take
import { Store } from '@ngrx/store';

import { TransactionService } from '../services/transaction.service'; // Remove Category import from here
import { Category } from '../../../shared/models/category.model'; // Use only this Category
import { Transaction, CreateTransactionRequest, UpdateTransactionRequest } from '../../../shared/models/transaction.model'; // NgRx uses these
import { AccessibilityService } from '../../../shared/services/accessibility.service';
import { AppState } from '../../../store/state/app.state';
import { selectIsAuthenticated, selectAuthError } from '../../../store/selectors/auth.selectors';
import * as TransactionActions from '../../../store/actions/transaction.actions';
import { getSelectedTransaction, getTransactionLoading, getTransactionError } from '../../../store/selectors/transaction.selectors';
import { CreateCategoryModalComponent } from '../create-category-modal/create-category-modal.component';
import { CategoryService } from '../../../core/services/category.service';

// Enhanced interfaces for PROMPT 3.2 features
export interface PaymentMethod {
  id: string;
  name: string;
  type: 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'check' | 'digital_wallet' | 'other';
  icon?: string;
}

export interface SplitTransaction {
  categoryId: string;
  amount: number;
  description?: string;
}

export interface TransactionSuggestion {
  description: string;
  categoryId: string;
  payee: string;
  amount?: number;
  frequency: number;
}

export interface AttachmentFile {
  id?: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

@Component({
  selector: 'app-transaction-form',
  templateUrl: './transaction-form.component.html',
  styleUrl: './transaction-form.component.scss',
  host: { role: 'main' }
})
export class TransactionFormComponent implements OnInit, AfterViewInit, OnDestroy { // Implemented OnDestroy
  transactionForm!: FormGroup;
  categories: Category[] = [];
  expenseCategories: Category[] = [];
  incomeCategories: Category[] = [];
  isEditMode = false;
  transactionId: string | null = null;
  pageTitle = 'Add Transaction';
  // isLoading = false; // Replaced by isLoading$
  // isSubmitting = false;  // Replaced by isLoading$
  separatorKeysCodes: number[] = [ENTER, COMMA];
  tags: string[] = [];
  isSubmitting = false;
  isLoading = false; // This will be managed by NgRx state

  // NgRx State Observables
  selectedTransaction$: Observable<Transaction | null>;
  isLoading$: Observable<boolean>;
  error$: Observable<any | null>;
  
  
  // PROMPT 3.2: Enhanced features
  paymentMethods: PaymentMethod[] = [
    { id: 'cash', name: 'Cash', type: 'cash', icon: 'payments' },
    { id: 'credit_card', name: 'Credit Card', type: 'credit_card', icon: 'credit_card' },
    { id: 'debit_card', name: 'Debit Card', type: 'debit_card', icon: 'credit_card' },
    { id: 'bank_transfer', name: 'Bank Transfer', type: 'bank_transfer', icon: 'account_balance' },
    { id: 'check', name: 'Check', type: 'check', icon: 'receipt' },
    { id: 'digital_wallet', name: 'Digital Wallet', type: 'digital_wallet', icon: 'account_balance_wallet' }
  ];
  
  attachments: AttachmentFile[] = [];
  maxFileSize = 10 * 1024 * 1024; // 10MB
  allowedFileTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  
  // Autocomplete observables
  filteredDescriptions$!: Observable<string[]>;
  descriptionSuggestions: string[] = [];
  
  // Split transaction functionality
  isSplitTransaction = false;
  splitTransactions: SplitTransaction[] = [];
  
  // Smart features
  duplicateTransactions: Transaction[] = [];
  suggestedCategories: Category[] = [];
  merchantSuggestions: string[] = [];
  
  // Currency formatting
  currencySymbol = '$'; // This could be dynamic based on user settings
  
  // Authentication state observables
  isAuthenticated$ = this.store.select(selectIsAuthenticated);
  authError$ = this.store.select(selectAuthError);
  private destroy$ = new Subject<void>();
  
  // Today's date for the date picker default
  today = new Date();
  
  // Form error messages
  formErrors: { [key: string]: { type: string; message: string; }[] } = {
    amount: [
      { type: 'required', message: 'Amount is required' },
      { type: 'min', message: 'Amount must be greater than 0' }
    ],
    description: [
      { type: 'required', message: 'Description is required' },
      { type: 'maxlength', message: 'Description cannot exceed 100 characters' }
    ],
    date: [
      { type: 'required', message: 'Date is required' }
    ],
    category: [
      { type: 'required', message: 'Category is required' }
    ],
    payee: [
      { type: 'required', message: 'Payee is required' },
      { type: 'maxlength', message: 'Payee cannot exceed 50 characters' }
    ]
  };

  @ViewChild('amountInput') amountInput!: ElementRef;
  private unsubscribe$ = new Subject<void>();  constructor(
    private fb: FormBuilder,
    private categoryService: CategoryService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private accessibilityService: AccessibilityService,
    private store: Store<AppState>,
    private dialog: MatDialog
  ) {
    this.createForm();
    this.isLoading$ = this.store.select(getTransactionLoading);
    this.error$ = this.store.select(getTransactionError);
    this.selectedTransaction$ = this.store.select(getSelectedTransaction);
  }

  ngOnInit(): void {
    this.loadCategories(); // Keep for now, can be refactored to NgRx later

    // Handle route parameter changes first to set edit mode correctly
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params.get('id');
      console.log('Route parameter changed. ID:', id); // Debug log
      if (id) {
        this.transactionId = id;
        this.isEditMode = true;
        this.pageTitle = 'Edit Transaction';
        console.log('Dispatching loadTransaction action for ID:', id); // Debug log
        this.store.dispatch(TransactionActions.loadTransaction({ transactionId: id }));
      } else {
        this.isEditMode = false;
        this.pageTitle = 'Add Transaction';
        this.transactionForm.reset(this.initialFormValues()); // Reset to defaults for new transaction
        this.store.dispatch(TransactionActions.clearSelectedTransaction());
      }
    });

    // Add separate subscription to debug transaction loading
    this.selectedTransaction$.pipe(takeUntil(this.destroy$)).subscribe(transactionData => {
      // Handle both wrapped and unwrapped transaction data
      const actualTransaction = (transactionData as any)?.transaction || transactionData;
      console.log('Selected transaction changed:', { 
        rawData: transactionData, 
        actualTransaction 
      }); // Debug log
    });

    // Add subscription to debug loading state
    this.isLoading$.pipe(takeUntil(this.destroy$)).subscribe(loading => {
      console.log('Loading state changed:', loading); // Debug log
    });

    // Add subscription to debug errors
    this.error$.pipe(takeUntil(this.destroy$)).subscribe(error => {
      console.log('Error state changed:', error); // Debug log
    });

    // Use combineLatest to ensure both conditions are met before patching form
    combineLatest([
      this.selectedTransaction$,
      this.route.paramMap
    ]).pipe(
      takeUntil(this.destroy$),
      filter(([transactionData, params]) => {
        const id = params.get('id');
        // Handle both wrapped and unwrapped transaction data
        const actualTransaction = (transactionData as any)?.transaction || transactionData;
        console.log('CombineLatest filter check:', { 
          transactionData, 
          actualTransaction, 
          id, 
          isEditMode: this.isEditMode, 
          transactionId: actualTransaction?._id 
        }); // Debug log
        return !!(actualTransaction && id && this.isEditMode && actualTransaction._id === id);
      })
    ).subscribe(([transactionData, params]) => {
      // Handle both wrapped and unwrapped transaction data
      const actualTransaction = (transactionData as any)?.transaction || transactionData;
      console.log('Transaction loaded for form patching:', actualTransaction); // Debug log
      this.patchFormWithTransaction(actualTransaction);
    });
    
    this.isLoading$.pipe(takeUntil(this.destroy$)).subscribe(loading => {
      if (loading) {
        this.accessibilityService.announce('Processing transaction...');
      }
      this.cdr.markForCheck();
    });

    this.error$.pipe(takeUntil(this.destroy$)).subscribe(error => {
      if (error && this.transactionForm.dirty) { // Only show error if form was interacted with or submitted
        const errorMessage = error.message || (typeof error === 'string' ? error : 'Failed to save transaction.');
        this.snackBar.open(errorMessage, 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
        this.accessibilityService.announceError(errorMessage);
      }
      this.cdr.markForCheck();
    });

    this.transactionForm.get('type')?.valueChanges.subscribe(type => {
      this.updateCategoryOptions(type);
    });

    // Check authentication status
    this.store.select(selectIsAuthenticated).pipe(takeUntil(this.unsubscribe$)).subscribe(isAuthenticated => {
      if (!isAuthenticated) {
        this.snackBar.open('You must be logged in to access this feature', 'Close', {
          duration: 5000
        });
        this.router.navigate(['/login']);
      }
    });
  }

  ngAfterViewInit(): void {
    // Focus on the amount input field after view init
    if (this.amountInput && this.amountInput.nativeElement) {
      // Delay focus to avoid potential issues with change detection
      setTimeout(() => {
        this.amountInput.nativeElement.focus();
        this.cdr.detectChanges();
      });
    }

    // Set focus to the page title after loading
    setTimeout(() => {
      const title = document.getElementById('form-title');
      if (title) {
        title.focus();
      }
    });
  }
  createForm(): void {    this.transactionForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]],
      type: ['expense', Validators.required],
      category: ['', Validators.required],
      date: [this.today, Validators.required],
      description: ['', [Validators.required, Validators.maxLength(100)]],
      notes: [''],
      payee: ['', [Validators.required, Validators.maxLength(50)]],
      paymentMethod: ['', Validators.required], // PROMPT 3.2: Payment method selection
      isRecurring: [false],
      recurringDetails: this.fb.group({
        frequency: ['monthly', Validators.required],
        interval: [1, [Validators.required, Validators.min(1)]],
        endDate: [null]
      }),
      tags: [this.tags],
      // PROMPT 3.2: Split transaction support
      isSplitTransaction: [false],
      splitTransactions: this.fb.array([])
    });

    // Setup autocomplete for description field
    this.setupDescriptionAutocomplete();

    // Add validator for recurring details when isRecurring is true
    this.transactionForm.get('isRecurring')?.valueChanges.subscribe(isRecurring => {
      const recurringDetailsGroup = this.transactionForm.get('recurringDetails');
      if (isRecurring) {
        recurringDetailsGroup?.enable();
        this.accessibilityService.announceSuccess('Recurring transaction options enabled');
      } else {
        recurringDetailsGroup?.disable();
        this.accessibilityService.announceSuccess('Recurring transaction options disabled');
      }
    });

    // Handle split transaction toggle
    this.transactionForm.get('isSplitTransaction')?.valueChanges.subscribe(isSplit => {
      this.isSplitTransaction = isSplit;
      if (isSplit) {
        this.addSplitTransaction();
        this.accessibilityService.announceSuccess('Split transaction mode enabled');
      } else {
        this.clearSplitTransactions();
        this.accessibilityService.announceSuccess('Split transaction mode disabled');
      }
    });
  }
  loadCategories(): void {
    this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories;
      this.expenseCategories = categories.filter(c => c.type === 'expense');
      this.incomeCategories = categories.filter(c => c.type === 'income');
      this.updateCategoryOptions(this.transactionForm.get('type')?.value);
    });
  }

  loadCategoriesForType(type: string): void {
    // Load categories without clearing the current selection (for edit mode)
    this.categoryService.getCategories().subscribe(categories => {
      this.categories = categories;
      this.expenseCategories = categories.filter(c => c.type === 'expense');
      this.incomeCategories = categories.filter(c => c.type === 'income');
      // Don't call updateCategoryOptions to avoid clearing selection
    });
  }

  updateCategoryOptions(type: string): void {
    // Clear current category selection
    this.transactionForm.get('category')?.setValue('');
    
    // Update available categories
    if (type === 'income') {
      // If there are no income categories, alert the user
      if (this.incomeCategories.length === 0) {
        this.snackBar.open('No income categories found. Please create one first.', 'Close', {
          duration: 5000
        });
      }
    } else {
      // If there are no expense categories, alert the user
      if (this.expenseCategories.length === 0) {
        this.snackBar.open('No expense categories found. Please create one first.', 'Close', {
          duration: 5000
        });
      }
    }
  }

  // loadTransaction(id: string): void { // Replaced by NgRx action and selector subscription
  // }

  patchFormWithTransaction(transaction: Transaction): void {
    console.log('Patching form with transaction:', transaction); // Debug log
    setTimeout(() => { // Ensure view is stable before patching
       try {
         // Handle category field - it might be an object or string
         const categoryId = typeof transaction.category === 'object' 
           ? (transaction.category as any)?._id 
           : transaction.category;
         
         console.log('Category data:', { 
           original: transaction.category, 
           extracted: categoryId 
         }); // Debug log

         // Update category options first without clearing selection
         this.loadCategoriesForType(transaction.type);

         this.transactionForm.patchValue({
           amount: transaction.amount,
           type: transaction.type,
           category: categoryId, // Use extracted category ID
           date: new Date(transaction.date),
           description: transaction.description,
           notes: transaction.notes || '',
           payee: transaction.payee || '', // Make sure payee is part of Transaction model
           paymentMethod: transaction.paymentMethod || '',
           isRecurring: transaction.recurringConfig?.isRecurring || false,
           // isSplitTransaction: transaction.isSplit || false, // Add if needed
         });

         this.tags = transaction.tags || [];
         this.transactionForm.get('tags')?.setValue(this.tags);

         if (transaction.recurringConfig?.isRecurring && transaction.recurringConfig) {
           this.transactionForm.get('recurringDetails')?.patchValue({
             frequency: transaction.recurringConfig.frequency,
             interval: transaction.recurringConfig.interval,
             endDate: transaction.recurringConfig.endDate ? new Date(transaction.recurringConfig.endDate) : null
           });
         }

         // TODO: Handle attachments and split transactions if they are part of the loaded Transaction model
         // this.attachments = transaction.attachments || [];
         // if (transaction.splitDetails) { ... populate splitTransactionsArray ... }

         console.log('Form patched successfully:', this.transactionForm.value); // Debug log
         this.cdr.markForCheck();
       } catch (error) {
         console.error('Error patching form with transaction:', error);
       }
    });
  }

  private initialFormValues(): any {
    return {
      amount: null,
      type: 'expense',
      category: '',
      date: this.today,
      description: '',
      notes: '',
      payee: '',
      paymentMethod: '',
      isRecurring: false,
      recurringDetails: { frequency: 'monthly', interval: 1, endDate: null },
      tags: [],
      isSplitTransaction: false,
      splitTransactions: []
      // location is intentionally omitted to prevent accidental empty string
    };
  }

  onSubmit(): void {
    if (this.transactionForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      let errorMessages: string[] = [];
      Object.keys(this.transactionForm.controls).forEach(key => {
        const control = this.transactionForm.get(key);
        control?.markAsTouched();
        
        if (control?.errors) {
          const errorMessage = this.getErrorMessage(key);
          if (errorMessage) {
            errorMessages.push(errorMessage);
          }
        }
      });
      
      // Announce errors to screen readers
      this.accessibilityService.announceError('Form contains errors. ' + errorMessages.join('. '));
      
      // Focus the first invalid field
      const firstInvalidControl = Object.keys(this.transactionForm.controls)
        .find(key => this.transactionForm.get(key)?.invalid);
        
      if (firstInvalidControl) {
        const element = document.querySelector(`[formControlName="${firstInvalidControl}"]`);
        (element as HTMLElement)?.focus();
      }
      return;
    }
    
    const formData = { ...this.transactionForm.value };
    // Defensive: Remove location if not a valid object
    if (
      !formData.location ||
      typeof formData.location !== 'object' ||
      Array.isArray(formData.location) ||
      Object.keys(formData.location).length === 0
    ) {
      delete formData.location;
    }

    const transactionRequestData: any = {
      amount: formData.amount,
      type: formData.type,
      category: formData.category, // This should be categoryId
      date: formData.date, // Keep as Date object or ISO string as per DTO
      description: formData.description,
      notes: formData.notes,
      paymentMethod: formData.paymentMethod,
      tags: this.tags,
      recurringConfig: formData.isRecurring ? {
        isRecurring: true,
        frequency: formData.recurringDetails.frequency,
        interval: formData.recurringDetails.interval,
        endDate: formData.recurringDetails.endDate,
      } : undefined,
      // attachments - needs handling to upload files and link IDs
      // splitDetails - needs mapping
    };
    // Only include location if it is a valid object
    if (formData.location && typeof formData.location === 'object' && !Array.isArray(formData.location) && Object.keys(formData.location).length > 0) {
      transactionRequestData.location = formData.location;
    }

    if (this.isEditMode && this.transactionId) {
      this.accessibilityService.announceOperationStatus('Transaction update', 'started');
      this.store.dispatch(TransactionActions.updateTransaction({
        transactionId: this.transactionId,
        transaction: transactionRequestData as UpdateTransactionRequest
      }));
    } else {
      this.accessibilityService.announceOperationStatus('Transaction creation', 'started');
      this.store.dispatch(TransactionActions.createTransaction({
        transaction: transactionRequestData as CreateTransactionRequest
      }));
    }

    // Listen for success/failure (could also be done with an effect that navigates/shows snackbar)
    // For simplicity here, we can navigate on successful dispatch if not handled by an effect.
    // A more robust way is to react to createTransactionSuccess/Failure actions.
    this.store.select(getTransactionLoading).pipe(
      filter((loading: boolean) => !loading && (this.transactionForm.dirty || this.transactionForm.touched)), // Typed loading, check touched
      take(1),
      switchMap(() => this.store.select(getTransactionError)),
      takeUntil(this.destroy$)
    ).subscribe(error => {
      if (!error) {
        this.snackBar.open(`Transaction ${this.isEditMode ? 'updated' : 'created'} successfully!`, 'Close', { duration: 3000 });
        this.router.navigate(['/transactions']);
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/transactions']);
  }

  // Tag methods
  addTag(event: any): void {
    const input = event.input;
    const value = event.value;

    // Add tag
    if ((value || '').trim()) {
      if (!this.tags.includes(value.trim())) {
        this.tags.push(value.trim());
        this.transactionForm.get('tags')?.setValue(this.tags);
        this.accessibilityService.announceSuccess(`Tag ${value.trim()} added`);
      }
    }

    // Reset the input value
    if (input) {
      input.value = '';
    }
  }

  removeTag(tag: string): void {
    this.tags = this.tags.filter(t => t !== tag);
    this.transactionForm.get('tags')?.setValue(this.tags);
    this.accessibilityService.announceSuccess(`Tag ${tag} removed`);
  }

  // File attachment methods
  onFileSelected(event: any): void {
    const files: FileList = event.target.files;
    this.handleFileUpload(files);
  }

  handleFileUpload(files: FileList): void {
    Array.from(files).forEach(file => {
      if (file.size > this.maxFileSize) {
        this.snackBar.open(`File ${file.name} is too large. Max size is 10MB.`, 'Close', { duration: 5000 });
        return;
      }

      if (!this.allowedFileTypes.includes(file.type)) {
        this.snackBar.open(`File ${file.name} has an unsupported format.`, 'Close', { duration: 5000 });
        return;
      }

      // Create a preview URL for the file
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const previewUrl = e.target.result;
        this.attachments.push({ file, name: file.name, size: file.size, type: file.type, preview: previewUrl });
        this.transactionForm.get('attachments')?.setValue(this.attachments);
        this.accessibilityService.announceSuccess(`File ${file.name} attached`);
      };
      reader.readAsDataURL(file);
    });
  }

  removeAttachment(index: number): void {
    const fileName = this.attachments[index].name;
    this.attachments.splice(index, 1);
    this.transactionForm.get('attachments')?.setValue(this.attachments);
    this.accessibilityService.announceSuccess(`File ${fileName} detached`);
  }

  // Split transaction methods
  addSplitTransaction(): void {
    const splitTransactionsArray = this.transactionForm.get('splitTransactions') as FormArray;
    const newSplit: SplitTransaction = { categoryId: '', amount: 0, description: '' };
    splitTransactionsArray.push(this.fb.group({
      categoryId: [newSplit.categoryId, Validators.required],
      amount: [newSplit.amount, [Validators.required, Validators.min(0.01)]],
      description: [newSplit.description]
    }));

    this.splitTransactions.push(newSplit);
    this.transactionForm.get('isSplitTransaction')?.setValue(true);
    this.accessibilityService.announceSuccess('New split transaction row added');
  }

  removeSplitTransaction(index: number): void {
    const splitTransactionsArray = this.transactionForm.get('splitTransactions') as FormArray;
    if (splitTransactionsArray.length > 1) {
      splitTransactionsArray.removeAt(index);
      this.splitTransactions.splice(index, 1);
      this.accessibilityService.announceSuccess('Split transaction row removed');
    } else {
      this.snackBar.open('At least one split transaction row is required', 'Close', { duration: 5000 });
    }
  }

  clearSplitTransactions(): void {
    const splitTransactionsArray = this.transactionForm.get('splitTransactions') as FormArray;
    while (splitTransactionsArray.length !== 0) {
      splitTransactionsArray.removeAt(0);
    }
    this.splitTransactions = [];
  }

  // Autocomplete setup
  setupDescriptionAutocomplete(): void {
    this.filteredDescriptions$ = this.transactionForm.get('description')!.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => this.filterDescriptions(value))
    );
  }

  filterDescriptions(value: string): Observable<string[]> {
    const filterValue = (value || '').toLowerCase();
    return this.store.select(getSelectedTransaction).pipe(
      take(1),
      map(transaction => {
        const allDescriptions = transaction ? [transaction.description, ...this.descriptionSuggestions] : this.descriptionSuggestions;
        // Filter out null/undefined descriptions before calling toLowerCase
        return allDescriptions.filter(desc => desc && desc.toLowerCase().includes(filterValue));
      })
    );
  }

  /**
   * Gets the icon for the currently selected payment method
   */
  getSelectedPaymentMethodIcon(): string | null {
    const selectedMethodId = this.transactionForm.get('paymentMethod')?.value;
    if (!selectedMethodId) return null;
    
    const selectedMethod = this.paymentMethods.find(method => method.id === selectedMethodId);
    return selectedMethod?.icon || null;
  }

  /**
   * Gets the name of the currently selected payment method
   */
  getSelectedPaymentMethodName(): string {
    const selectedMethodId = this.transactionForm.get('paymentMethod')?.value;
    if (!selectedMethodId) return 'None';
    
    const selectedMethod = this.paymentMethods.find(method => method.id === selectedMethodId);
    return selectedMethod?.name || 'Unknown method';
  }
  
  /**
   * Gets the icon for the currently selected category
   */
  getSelectedCategoryIcon(): string | null {
    const selectedCategoryId = this.transactionForm.get('category')?.value;
    if (!selectedCategoryId) return null;
    
    const transactionType = this.transactionForm.get('type')?.value;
    const categories = transactionType === 'expense' ? this.expenseCategories : this.incomeCategories;
    
    const selectedCategory = categories.find(cat => cat._id === selectedCategoryId);
    return selectedCategory?.icon || null;
  }

  /**
   * Gets the name of the currently selected category
   */
  getSelectedCategoryName(): string {
    const selectedCategoryId = this.transactionForm.get('category')?.value;
    if (!selectedCategoryId) return 'None';
    
    const transactionType = this.transactionForm.get('type')?.value;
    const categories = transactionType === 'expense' ? this.expenseCategories : this.incomeCategories;
    
    const selectedCategory = categories.find(cat => cat._id === selectedCategoryId);
    return selectedCategory?.name || 'Unknown category';
  }
  
  /**
   * Gets the color for the currently selected category
   */
  getSelectedCategoryColor(): string {
    const selectedCategoryId = this.transactionForm.get('category')?.value;
    if (!selectedCategoryId) return '#ccc'; // Default gray color
    
    const transactionType = this.transactionForm.get('type')?.value;
    const categories = transactionType === 'expense' ? this.expenseCategories : this.incomeCategories;
    
    const selectedCategory = categories.find(cat => cat._id === selectedCategoryId);
    return selectedCategory?.color || '#ccc';
  }
  
  /**
   * Gets the icon for a category in a split transaction
   * @param index The index of the split transaction in the form array
   */
  getSplitCategoryIcon(index: number): string | null {
    const splitTransactions = this.transactionForm.get('splitTransactions') as FormArray;
    if (!splitTransactions || index >= splitTransactions.length) return null;

    const categoryId = splitTransactions.at(index).get('categoryId')?.value;
    if (!categoryId) return null;

    const transactionType = this.transactionForm.get('type')?.value;
    const categories = transactionType === 'expense' ? this.expenseCategories : this.incomeCategories;
    
    const selectedCategory = categories.find(cat => cat._id === categoryId);
    return selectedCategory?.icon || null;
  }

  /**
   * Gets the name of a category in a split transaction
   * @param index The index of the split transaction in the form array
   */
  getSplitCategoryName(index: number): string {
    const splitTransactions = this.transactionForm.get('splitTransactions') as FormArray;
    if (!splitTransactions || index >= splitTransactions.length) return 'None';

    const categoryId = splitTransactions.at(index).get('categoryId')?.value;
    if (!categoryId) return 'None';

    const transactionType = this.transactionForm.get('type')?.value;
    const categories = transactionType === 'expense' ? this.expenseCategories : this.incomeCategories;
    
    const selectedCategory = categories.find(cat => cat._id === categoryId);
    return selectedCategory?.name || 'Unknown category';
  }
  
  /**
   * Gets the color for a category in a split transaction
   * @param index The index of the split transaction in the form array
   */
  getSplitCategoryColor(index: number): string {
    const splitTransactions = this.transactionForm.get('splitTransactions') as FormArray;
    if (!splitTransactions || index >= splitTransactions.length) return '#ccc';

    const categoryId = splitTransactions.at(index).get('categoryId')?.value;
    if (!categoryId) return '#ccc';

    const transactionType = this.transactionForm.get('type')?.value;
    const categories = transactionType === 'expense' ? this.expenseCategories : this.incomeCategories;
    
    const selectedCategory = categories.find(cat => cat._id === categoryId);
    return selectedCategory?.color || '#ccc';
  }
  
  // --- Methods/properties required by the template ---
  onAmountInput(event: any): void {
    const value = event.target.value;
    // Remove any non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    event.target.value = numericValue;
    this.transactionForm.get('amount')?.setValue(parseFloat(numericValue) || null);
  }

  checkForDuplicates(): void {
    // Implement duplicate check logic or leave as a stub
    // For now, just a stub to prevent template errors
  }

  onDescriptionSelected(event: MatAutocompleteSelectedEvent): void {
    const selectedDescription = event.option.value;
    this.transactionForm.get('description')?.setValue(selectedDescription);
    // Optionally trigger smart category suggestion
  }

  trackByCategoryId(index: number, category: Category): string {
    return category._id;
  }

  openNewCategoryDialog(): void {
    console.log('Attempting to open CreateCategoryModalComponent from TransactionFormComponent');
    const dialogRef = this.dialog.open(CreateCategoryModalComponent, {
      width: '400px',
      data: { isEdit: false }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) { // result will be the created category object
        this.loadCategories(); // Reload categories after a new one is created
        this.snackBar.open('Category created successfully', 'Close', { duration: 3000 });
      }
    });
  }

  get showRecurringOptions(): boolean {
    return this.transactionForm.get('isRecurring')?.value === true;
  }

  get splitTransactionsArray(): FormArray {
    return this.transactionForm.get('splitTransactions') as FormArray;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  }

  calculateSplitTotal(): number {
    return this.splitTransactionsArray.controls.reduce((total, control) => {
      const amount = control.get('amount')?.value || 0;
      return total + amount;
    }, 0);
  }

  // Error handling
  getErrorMessage(controlName: string): string | null {
    const control = this.transactionForm.get(controlName);
    if (control && control.errors) {
      if (control.errors['required']) {
        return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} is required`;
      } else if (control.errors['min']) {
        return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} must be greater than 0`;
      } else if (control.errors['maxlength']) {
        return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} cannot exceed ${control.errors['maxlength'].maxlength} characters`;
      }
    }
    return null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
