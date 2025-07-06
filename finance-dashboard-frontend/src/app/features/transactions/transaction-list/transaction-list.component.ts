import { Component, OnInit, ViewChild, ChangeDetectionStrategy, NgZone, OnDestroy, ChangeDetectorRef, HostListener, ElementRef, AfterViewInit } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { LiveAnnouncer } from '@angular/cdk/a11y'; // Import LiveAnnouncer
import { Store } from '@ngrx/store';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatDatepicker } from '@angular/material/datepicker';
import { MatSelectChange } from '@angular/material/select';
import { SelectionModel } from '@angular/cdk/collections';

// import { Transaction, TransactionService } from '../services/transaction.service'; // Service will be used by effects
import { TransactionService, TransactionFilters as ServiceTransactionFilters } from '../services/transaction.service'; // Keep for local type usage if different from store
import { Transaction, TransactionFilters } from '../../../shared/models/transaction.model'; // Use model from shared, added TransactionFilters
import { AccessibilityService } from '../../../shared/services/accessibility.service';
import { AppState } from '../../../store/state/app.state';
import { selectAuthUser, selectIsAuthenticated, selectAuthError } from '../../../store/selectors/auth.selectors';
import * as TransactionActions from '../../../store/actions/transaction.actions';
import {
  getAllTransactions,
  getTransactionLoading,
  getTransactionError,
  getTransactionPagination,
  getTransactionFilters,
  getSelectedTransaction
} from '../../../store/selectors/transaction.selectors';
import { takeUntil, filter, debounceTime, distinctUntilChanged, startWith, map, tap, withLatestFrom, take } from 'rxjs/operators'; // Added withLatestFrom and take
import { Subject, combineLatest, Observable, Subscription } from 'rxjs';
import { CategoryService } from '../../../core/services/category.service';

@Component({
  selector: 'app-transaction-list',
  templateUrl: './transaction-list.component.html',
  styleUrl: './transaction-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionListComponent implements OnInit, OnDestroy, AfterViewInit {
  displayedColumns: string[] = ['select', 'date', 'description', 'category', 'amount', 'actions'];
  dataSource!: MatTableDataSource<Transaction>;
  
  errorMessage: string | null = null;
  private destroyed$ = new Subject<void>();

  transactions$: Observable<Transaction[]>;
  isLoading$: Observable<boolean>;
  error$: Observable<any | null>;
  pagination$ = this.store.select(getTransactionPagination);
  currentStoreFilters$ = this.store.select(getTransactionFilters);


  // private allTransactions: Transaction[] = []; // Will be replaced by transactions$ from store
  
  // Authentication state
  user$ = this.store.select(selectAuthUser);
  isAuthenticated$ = this.store.select(selectIsAuthenticated);
  authError$ = this.store.select(selectAuthError);
  
  // For virtual scrolling optimization
  pageSize = 20; // Default page size
  currentPage = 1; // NgRx pagination is usually 1-based
  isScrollLoading = false;
  totalTransactions = 0;

  @ViewChild(MatPaginator) paginator!: MatPaginator; // Keep if used for UI, though virtual scroll is primary
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('filterPanel') filterPanel!: ElementRef<HTMLElement>;
    // Advanced filtering properties
  filterForm!: FormGroup;
  showAdvancedFilters = false;
  
  // Filter options
  categories: any[] = [];
  paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'debit_card', label: 'Debit Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'check', label: 'Check' },
    { value: 'digital_wallet', label: 'Digital Wallet' },
    { value: 'other', label: 'Other' }
  ];
  
  transactionTypes = [
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expense' },
    { value: 'transfer', label: 'Transfer' }
  ];
  
  statusOptions = [
    { value: 'completed', label: 'Completed' },
    { value: 'pending', label: 'Pending' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  // Date range presets
  dateRangePresets = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'lastWeek', label: 'Last Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'last3Months', label: 'Last 3 Months' },
    { value: 'last6Months', label: 'Last 6 Months' },
    { value: 'thisYear', label: 'This Year' },
    { value: 'lastYear', label: 'Last Year' },
    { value: 'custom', label: 'Custom Range' }
  ];

  // Bulk operations
  selection = new SelectionModel<Transaction>(true, []);
  bulkOperations = [
    { value: 'delete', label: 'Delete Selected', icon: 'delete', color: 'warn' },
    { value: 'categorize', label: 'Change Category', icon: 'category', color: 'primary' },
    { value: 'export', label: 'Export Selected', icon: 'download', color: 'accent' },
    { value: 'duplicate', label: 'Duplicate Selected', icon: 'content_copy', color: 'primary' }
  ];
  // Search and autocomplete
  searchTerm = '';
  searchSuggestions: string[] = [];
  filteredSuggestions!: Observable<string[]>;
  // Export/Import
  exportFormats: { value: 'csv' | 'excel' | 'pdf', label: string, icon: string }[] = [
    { value: 'csv', label: 'CSV', icon: 'table_chart' },
    { value: 'excel', label: 'Excel', icon: 'grid_on' },
    { value: 'pdf', label: 'PDF', icon: 'picture_as_pdf' }
  ];

  // Statistics
  transactionStats = {
    total: 0,
    income: 0,
    expenses: 0,
    netAmount: 0,
    avgTransaction: 0
  };

  // Additional properties for enhanced functionality
  currentFilters: TransactionFilters = {};
  isFiltering = false;

  constructor(
    private transactionService: TransactionService, // May still be needed for non-CRUD ops or until full refactor
    private categoryService: CategoryService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private accessibilityService: AccessibilityService,
    private store: Store<AppState>,
    private fb: FormBuilder,
    private liveAnnouncer: LiveAnnouncer // Inject LiveAnnouncer
  ) {
    this.initializeFilterForm();
    this.isLoading$ = this.store.select(getTransactionLoading);
    this.error$ = this.store.select(getTransactionError);
    this.transactions$ = this.store.select(getAllTransactions);
  }

  loadCategoriesForFilter(): void {
    this.categoryService.getCategories()
      .pipe(takeUntil(this.destroyed$))
      .subscribe(
        (categories: any[]) => {
          this.categories = categories;
          this.cdr.markForCheck();
        },
        (error) => {
          this.snackBar.open('Failed to load categories.', 'Close', { duration: 3000 });
        }
      );
  }

  loadTransactionsWithFilters(): void {
    this.dispatchLoadTransactions();
  }

  ngOnInit(): void {
    this.transactions$.pipe(
      withLatestFrom(this.isLoading$),
      takeUntil(this.destroyed$)
    ).subscribe(([transactions, isLoading]) => {
      // Defensive: If transactions is not an array, try to extract array
      let txArray: any[] = Array.isArray(transactions)
        ? transactions
        : (transactions && typeof transactions === 'object' && Array.isArray((transactions as any).data)
            ? (transactions as any).data
            : []);
      this.updateDataSource(txArray);
      this.calculateStatistics(txArray);
      this.updateSearchSuggestions(txArray);
      if (!isLoading) {
        this.liveAnnouncer.announce(`Transaction list updated. Showing ${txArray.length} transactions.`, 'polite');
      }
      this.cdr.markForCheck();
    });

    this.isLoading$.pipe(takeUntil(this.destroyed$)).subscribe(loading => {
      if (loading) {
        // this.accessibilityService.announce('Loading transactions...'); // Replaced by liveAnnouncer
        this.liveAnnouncer.announce('Loading transactions...', 'polite');
      }
      this.cdr.markForCheck();
    });

    this.error$.pipe(takeUntil(this.destroyed$)).subscribe(error => {
      if (error) {
        const errorMessage = error.message || 'Failed to perform transaction operation.';
        this.snackBar.open(errorMessage, 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
        // accessibilityService.announceError might use LiveAnnouncer internally or have its own mechanism.
        // For critical errors, an assertive announcement is good.
        this.liveAnnouncer.announce(`Error: ${errorMessage}`, 'assertive');
      }
      this.cdr.markForCheck();
    });

    // Check authentication status before loading transactions
    combineLatest([
      this.isAuthenticated$,
      this.authError$
    ]).pipe(
      takeUntil(this.destroyed$)
    ).subscribe(([isAuthenticated, authError]) => {
      if (authError) {
        this.handleAuthError(authError);
        return;
      }
      
      if (isAuthenticated) {
        // Initial load dispatched here
        this.dispatchLoadTransactions();
        this.loadCategoriesForFilter(); // <-- Ensure categories are loaded
        this.loadSearchSuggestions(); // Load search suggestions from service (could be an effect too)

      } else {
        this.router.navigate(['/auth/login']);
      }
    });

    // Subscribe to user changes for personalized data
    this.user$.pipe(
      takeUntil(this.destroyed$),
      filter(user => !!user)
    ).subscribe(user => {
      this.accessibilityService.announce(`Welcome ${user!.firstName}. Loading your transactions.`);
    });

    // Subscribe to filter form changes to potentially update store filters or trigger reloads
    this.filterForm.valueChanges.pipe(
      debounceTime(500), // Debounce to avoid rapid dispatches
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)), // Only if value actually changed
      takeUntil(this.destroyed$)
    ).subscribe(formValues => {
      // This could dispatch updateTransactionFilters if live filtering is desired before hitting "Apply"
      // For now, "Apply" button explicitly dispatches.
    });

  }

  ngAfterViewInit(): void {
    // Assign paginator to dataSource if available
    if (this.paginator && this.dataSource) {
      this.dataSource.paginator = this.paginator;
    }
    // Subscribe to pagination$ here to ensure paginator is defined
    this.pagination$.pipe(takeUntil(this.destroyed$)).subscribe(pagination => {
      // Defensive: fallback to defaults if any property is missing or invalid
      const safePage = (pagination && typeof pagination.page === 'number' && pagination.page > 0) ? pagination.page : 1;
      const safeLimit = (pagination && typeof pagination.limit === 'number' && pagination.limit > 0) ? pagination.limit : 20;
      const safeTotal = (pagination && typeof pagination.total === 'number' && pagination.total >= 0) ? pagination.total : 0;

      if (this.paginator) {
        this.currentPage = safePage;
        this.pageSize = safeLimit;
        this.totalTransactions = safeTotal;
        this.paginator.pageIndex = safePage - 1;
        this.paginator.pageSize = safeLimit;
        this.paginator.length = safeTotal;
      }
      // Optionally log a warning if pagination is malformed
      if (!pagination || typeof pagination.page !== 'number') {
        console.warn('[TransactionList] Malformed or missing pagination object:', pagination);
      }
      this.cdr.markForCheck();
    });
    // Auto focus on search input when component loads - defer to avoid performance issues
    if (this.searchInput?.nativeElement) {
      // Use zone.runOutsideAngular to avoid performance violations
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          this.ngZone.run(() => {
            if (this.searchInput?.nativeElement) {
              this.searchInput.nativeElement.focus();
              this.accessibilityService.announce('Transaction list loaded. Search input focused.');
            }
          });
        }, 0);
      });
    }
    // Set up scroll listener for virtual scrolling
    if (this.viewport) {
      this.viewport.elementScrolled()
        .pipe(takeUntil(this.destroyed$))
        .subscribe(() => {
          this.ngZone.run(() => {
            this.onScroll();
          });
        });
    }
  }  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
    
    // Release any active focus traps with null safety
    if (this.filterPanel?.nativeElement) {
      this.accessibilityService.releaseFocus(this.filterPanel.nativeElement);
    }
  }

  /**
   * Enable focus trap on filter panel when user starts filtering
   */
  onFilterFocus(): void {
    if (this.filterPanel?.nativeElement) {
      this.accessibilityService.trapFocus(this.filterPanel.nativeElement);
    }
  }

  /**
   * Release focus trap when user leaves filter panel
   */
  onFilterBlur(): void {
    // Use zone.runOutsideAngular to avoid performance violations
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.ngZone.run(() => {
          if (this.filterPanel?.nativeElement && document.activeElement && 
              !this.filterPanel.nativeElement.contains(document.activeElement)) {
            this.accessibilityService.releaseFocus(this.filterPanel.nativeElement);
          }
        });
      }, 0);
    });
  }

  onScroll() {
    if (this.viewport) {
      const end = this.viewport.getRenderedRange().end;
      const totalItems = this.viewport.getDataLength(); // This is total items in the viewport's current buffer

      // Check if we are near the end of the currently loaded data AND if there are more items to load from server
      if (end > 0 && totalItems > 0 && end >= totalItems - 5 && !this.isScrollLoading && totalItems < this.totalTransactions) {
        this.loadMoreTransactions();
      }
    }
  }

  loadMoreTransactions() {
    // Prevent multiple loads if already loading or if all transactions are loaded
    if (this.isScrollLoading || (this.dataSource.data.length >= this.totalTransactions && this.totalTransactions > 0) ) {
      return;
    }

    this.isScrollLoading = true; // Handled by isLoading$ from store for general loading
    // this.store.dispatch(TransactionActions.setTransactionLoading({ loading: true })); // Alternative for specific scroll loading
    
    const nextPage = this.currentPage + 1;
    this.store.dispatch(TransactionActions.loadTransactions({
        filters: this.currentFilters, // Ensure currentFilters is up-to-date from form or store
        page: nextPage,
        limit: this.pageSize
    }));
    // isScrollLoading will be set to false once loadTransactionsSuccess/Failure is dispatched and isLoading$ updates
  }

  private announceDataLoad(count: number): void {
    this.accessibilityService.announce(`Loaded ${count} transactions. Total: ${this.totalTransactions}. Use arrow keys to navigate or search to filter results.`);
  }

  // Centralized method to dispatch load transactions action
  dispatchLoadTransactions(page: number = 1, filters: TransactionFilters | null = this.currentFilters): void {
    this.store.dispatch(TransactionActions.loadTransactions({
      filters: filters,
      page: page,
      limit: this.pageSize
    }));
  }

  // Example of how applyFilter might be simplified if dataSource is directly from store transactions
  // This component uses a separate filter input for MatTableDataSource internal filtering,
  // which is different from the advanced filters that hit the backend.
  // For this example, applyFilter likely refers to the MatTableDataSource's own filter.
  // Advanced filters are handled by applyAdvancedFilters().
   applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }

    // Announce filter results to screen readers
    const filteredCount = this.dataSource.filteredData.length;
    const totalCount = this.dataSource.data.length;
    
    if (filterValue.trim()) {
      if (filteredCount === 0) {
        this.accessibilityService.announce(`No transactions found matching "${filterValue}"`);
      } else {
        this.accessibilityService.announce(`${filteredCount} out of ${totalCount} transactions found matching "${filterValue}"`);
      }
    } else {
      this.accessibilityService.announce(`Filter cleared. Showing all ${totalCount} transactions`);
    }
  }

  getTransactionTypeClass(type: string): string {
    return type === 'income' ? 'income-amount' : 'expense-amount';
  }

  formatAmount(transaction: Transaction): string {
    const prefix = transaction.type === 'income' ? '+' : '-';
    return `${prefix}$${Math.abs(transaction.amount).toFixed(2)}`;
  }

  editTransaction(transaction: Transaction): void {
    this.store.dispatch(TransactionActions.selectTransaction({ transactionId: transaction._id }));
    this.router.navigate(['/transactions/edit', transaction._id]); // Use _id
  }

  deleteTransaction(transaction: Transaction): void {
    if (confirm(`Are you sure you want to delete this transaction: ${transaction.description}?`)) {
      this.liveAnnouncer.announce(`Attempting to delete transaction: ${transaction.description}.`, 'polite');
      this.store.dispatch(TransactionActions.deleteTransaction({ transactionId: transaction._id }));
      // Success/failure announcement should ideally be triggered by an effect or subscription
      // to a success/failure action. For now, error$ subscription handles general errors.
      // A specific success announcement could be:
      // this.store.pipe(ofType(TransactionActions.deleteTransactionSuccess), take(1)).subscribe(() => {
      //   this.liveAnnouncer.announce('Transaction deleted successfully.', 'polite');
      // });
    }
  }

  addTransaction(): void {
    this.store.dispatch(TransactionActions.clearSelectedTransaction()); // Ensure no stale selection
    this.router.navigate(['/transactions/new']);
  }

  manageCategories(): void {
    this.router.navigate(['/transactions/categories']);
  }
  // Add keyboard event handling for table navigation
  @HostListener('keydown', ['$event'])  onKeyDown(event: KeyboardEvent) {
    // Only handle if we have data and are focused on a row
    if (!this.dataSource || !this.dataSource.data.length) return;
    
    const target = event.target as HTMLElement;
    const isTableRow = target.closest('tr[mat-row]');
    
    if (isTableRow) {
      const rows = Array.from(document.querySelectorAll('tr[mat-row]') || []);
      const currentIndex = rows.indexOf(isTableRow);
      
      if (currentIndex >= 0) {
        switch(event.key) {
          case 'ArrowDown':
            event.preventDefault();
            if (currentIndex < rows.length - 1) {
              const nextRow = rows[currentIndex + 1] as HTMLElement;
              nextRow?.focus();
            }
            break;
          case 'ArrowUp':
            event.preventDefault();
            if (currentIndex > 0) {
              const prevRow = rows[currentIndex - 1] as HTMLElement;
              prevRow?.focus();
            }
            break;
          case 'Enter':
            event.preventDefault();
            const transactionId = isTableRow.getAttribute('data-transaction-id');
            if (transactionId) {
              // Use _id for finding transaction
              const transaction = this.dataSource.data.find(t => t._id === transactionId);
              if (transaction) {
                this.editTransaction(transaction);
              }
            }
            break;
        }
      }
    }
  }

  // Performance optimization with trackBy function
  trackByTransactionId(index: number, transaction: Transaction): string { // Typed parameter
    return transaction._id; // Use _id
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: any): void {
    let errorMessage = 'Authentication error occurred';
    
    if (error) {
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.error && error.error.message) {
        errorMessage = error.error.message;
      }
    }

    // Show error message to user
    this.snackBar.open(errorMessage, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar']
    });

    // Announce error to screen readers
    this.accessibilityService.announceError(errorMessage);

    // Redirect to login page
    this.router.navigate(['/auth/login']);
  }

  private initializeFilterForm(): void {
    this.filterForm = this.fb.group({
      searchTerm: [''],
      dateRange: ['thisMonth'],
      startDate: [null],
      endDate: [null],
      categories: [[]],
      types: [[]],
      paymentMethods: [[]],
      status: [[]],
      minAmount: [null],
      maxAmount: [null],
      tags: [''],
      hasAttachments: [null],
      isRecurring: [null]
    });
    
    // Setup filtered suggestions for search autocomplete
    this.filteredSuggestions = this.filterForm.get('searchTerm')!.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      map(value => this.filterSearchSuggestions(value || ''))
    );
  }

  private filterSearchSuggestions(value: string): string[] {
    if (!value || value.length < 2) return [];
    
    const filterValue = value.toLowerCase();
    return this.searchSuggestions.filter(suggestion => 
      suggestion.toLowerCase().includes(filterValue)
    ).slice(0, 10); // Limit to 10 suggestions
  }

  private loadSearchSuggestions(): void {
    // Load search suggestions from recent transactions
    this.transactionService.getTransactions({ limit: 100, page: 1 }).subscribe({
      next: (response) => {
        console.log('Loaded search suggestions:', response);
        // Defensive: ensure response.data is an array
        const txs = Array.isArray(response.data) ? response.data : [];
        const suggestions = new Set<string>();
        txs.forEach(transaction => {
          if (transaction.description) suggestions.add(transaction.description);
          if (transaction.payee) suggestions.add(transaction.payee);
          if (transaction.notes) suggestions.add(transaction.notes);
          if (transaction.tags) transaction.tags.forEach(tag => suggestions.add(tag));
        });
        this.searchSuggestions = Array.from(suggestions).sort();
      },
      error: (error) => console.error('Error loading search suggestions:', error)
    });
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
    this.accessibilityService.announce(
      this.showAdvancedFilters ? 'Advanced filters expanded' : 'Advanced filters collapsed'
    );
  }

  onDateRangePresetChange(event: MatSelectChange): void {
    const preset = event.value;
    const today = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    switch (preset) {
      case 'today':
        startDate = endDate = new Date(today);
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = endDate = yesterday;
        break;
      case 'thisWeek':
        startDate = new Date(today.setDate(today.getDate() - today.getDay()));
        endDate = new Date();
        break;
      case 'lastWeek':
        const lastWeekEnd = new Date(today.setDate(today.getDate() - today.getDay() - 1));
        startDate = new Date(lastWeekEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
        endDate = lastWeekEnd;
        break;
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date();
        break;
      case 'lastMonth':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        startDate = lastMonth;
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'last3Months':
        startDate = new Date(today.setMonth(today.getMonth() - 3));
        endDate = new Date();
        break;
      case 'last6Months':
        startDate = new Date(today.setMonth(today.getMonth() - 6));
        endDate = new Date();
        break;
      case 'thisYear':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date();
        break;
      case 'lastYear':
        startDate = new Date(today.getFullYear() - 1, 0, 1);
        endDate = new Date(today.getFullYear() - 1, 11, 31);
        break;
    }

    if (startDate && endDate) {
      this.filterForm.patchValue({
        startDate,
        endDate
      });
    }
  }

  applyAdvancedFilters(): void {
    this.isFiltering = true; // Consider if this local flag is still needed or if isLoading$ suffices
    const formValues = this.filterForm.value;
    
    this.currentFilters = {
      search: formValues.searchTerm || undefined,
      startDate: formValues.startDate ? formValues.startDate.toISOString() : undefined,
      endDate: formValues.endDate ? formValues.endDate.toISOString() : undefined,
      category: formValues.categories?.length ? formValues.categories.join(',') : undefined,
      type: formValues.types?.length ? formValues.types[0] : undefined,
      paymentMethod: formValues.paymentMethods?.length ? formValues.paymentMethods.join(',') : undefined,
      status: formValues.status?.length ? formValues.status[0] : undefined,
      minAmount: formValues.minAmount || undefined,
      maxAmount: formValues.maxAmount || undefined,
      tags: formValues.tags ? formValues.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t) : undefined,
    } as unknown as TransactionFilters;

    this.store.dispatch(TransactionActions.updateTransactionFilters({ filters: this.currentFilters as any }));
    this.dispatchLoadTransactions(1, this.currentFilters);
    // Announcement will be made when transactions$ emits new data due to filtering
    // this.accessibilityService.announceOperationStatus('Filtering transactions', 'completed'); // Replaced by transactions$ subscription announcement
  }

  clearFilters(): void {
    this.filterForm.reset({
      dateRange: 'thisMonth'
    });
    this.currentFilters = {};
    this.store.dispatch(TransactionActions.updateTransactionFilters({ filters: null }));
    const mockMatSelect = { value: 'thisMonth' } as any;
    this.onDateRangePresetChange(new MatSelectChange(mockMatSelect, 'thisMonth'));
    this.dispatchLoadTransactions(1, null);
    this.liveAnnouncer.announce('Filters cleared. Loading all transactions.', 'polite');
    // this.accessibilityService.announce('Filters cleared'); // Replaced
  }

  // loadTransactionsWithFilters is effectively replaced by dispatchLoadTransactions
  // public loadTransactionsWithFilters(): void { ... } // REMOVE

  private updateDataSource(transactions: Transaction[]): void {
    if (!this.dataSource) {
      this.dataSource = new MatTableDataSource(transactions);
    } else {
      // Only update data if it's different to avoid unnecessary re-renders if transactions object is mutated by mistake
      if (this.dataSource.data !== transactions) {
         this.dataSource.data = transactions;
      }
    }
    // Always assign paginator after dataSource is set/updated
    if (this.paginator && this.dataSource) {
      this.dataSource.paginator = this.paginator;
    }
    // Configure sorting and pagination - MatTableDataSource handles this if bound correctly in template
    if (this.sort && this.dataSource.sort !== this.sort) { // Check if sort is already set
        this.dataSource.sort = this.sort;
         // Custom sort for date field
        this.dataSource.sortingDataAccessor = (item, property) => {
          switch (property) {
            case 'date': return new Date(item.date).getTime();
            case 'amount': return item.amount;
            // case 'category': return item.categoryDetails?.name || ''; // categoryDetails might not exist on shared Transaction model
            case 'category': return item.category || ''; // Use category ID or fetch category name if needed
            default: return (item as any)[property];
          }
        };
    }
    // MatPaginator is driven by pagination$ subscription now for total length, page size, page index
    // if (this.paginator && this.dataSource.paginator !== this.paginator) {
    //   this.dataSource.paginator = this.paginator;
    // }
  }

  // Error handling is now centralized via error$ subscription
  // private handleLoadError(error: any): void { ... } // REMOVE

  private updateSearchSuggestions(transactions: Transaction[]): void {
    const suggestions = new Set<string>();
    transactions.forEach(transaction => {
      if (transaction.description) suggestions.add(transaction.description);
      if (transaction.payee) suggestions.add(transaction.payee);
      if (transaction.tags) transaction.tags.forEach(tag => suggestions.add(tag));
    });
    this.searchSuggestions = Array.from(suggestions).sort();
  }

  private calculateStatistics(transactions: Transaction[]): void {
    this.transactionStats = {
      total: transactions.length,
      income: transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
      expenses: transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0),
      netAmount: 0,
      avgTransaction: 0
    };
    
    this.transactionStats.netAmount = this.transactionStats.income - this.transactionStats.expenses;
    this.transactionStats.avgTransaction = transactions.length > 0 
      ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length 
      : 0;
  }

  // Bulk operations methods
  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows && numRows > 0;
  }

  isIndeterminate(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected > 0 && numSelected < numRows;
  }

  masterToggle(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
      this.accessibilityService.announce('All transactions deselected');
    } else {
      this.dataSource.data.forEach(row => this.selection.select(row));
      this.accessibilityService.announce(`${this.dataSource.data.length} transactions selected`);
    }
  }

  toggleSelection(transaction: Transaction): void {
    this.selection.toggle(transaction);
    const isSelected = this.selection.isSelected(transaction);
    this.accessibilityService.announce(
      `Transaction ${isSelected ? 'selected' : 'deselected'}: ${transaction.description}`
    );
  }

  executeBulkOperation(operation: string): void {
    const selectedTransactions = this.selection.selected;
    
    if (selectedTransactions.length === 0) {
      this.snackBar.open('Please select transactions first', 'Close', { duration: 3000 });
      return;
    }

    this.accessibilityService.announceOperationStatus(`Bulk ${operation}`, 'started');

    switch (operation) {
      case 'delete':
        this.bulkDeleteTransactions(selectedTransactions);
        break;
      case 'categorize':
        this.openBulkCategorizeDialog(selectedTransactions);
        break;
      case 'export':
        this.bulkExportTransactions(selectedTransactions);
        break;
      case 'duplicate':
        this.bulkDuplicateTransactions(selectedTransactions);
        break;
    }
  }

  private bulkDeleteTransactions(transactions: Transaction[]): void {
    const confirmMessage = `Are you sure you want to delete ${transactions.length} selected transaction(s)?`;
    
    if (confirm(confirmMessage)) {
      const ids = transactions.map(t => t._id); // Use _id
      
      ids.forEach(id => {
        this.store.dispatch(TransactionActions.deleteTransaction({ transactionId: id }));
      });
      this.liveAnnouncer.announce(`Attempting to delete ${ids.length} selected transactions.`, 'polite');
      this.selection.clear();
    }
  }



  private openBulkCategorizeDialog(transactions: Transaction[]): void {
    // This would open a dialog to select a new category
    // For now, we'll implement a simple prompt
    // TODO: Implement proper dialog component
    console.log('Bulk categorize:', transactions);
    this.snackBar.open('Bulk categorize feature coming soon', 'Close', { duration: 3000 });
  }

  private bulkExportTransactions(transactions: Transaction[]): void {
    // This would export only selected transactions
    // For now, we'll use the regular export by getting current filters from store and applying them
    // Or, ideally, a new selector would give only the selected transactions if they are already loaded in the store.
    this.exportTransactions('csv', transactions); // Pass selected transactions
  }

  private bulkDuplicateTransactions(transactions: Transaction[]): void {
    // This would duplicate selected transactions
    console.log('Bulk duplicate:', transactions);
    this.snackBar.open('Bulk duplicate feature coming soon', 'Close', { duration: 3000 });
  }

  // Export/Import methods
  exportTransactions(format: 'csv' | 'excel' | 'pdf', transactionsToExport?: Transaction[]): void {
    this.accessibilityService.announceOperationStatus(`Exporting to ${format.toUpperCase()}`, 'started');

    if (transactionsToExport && transactionsToExport.length > 0) {
      // Exporting specific transactions (e.g., selected ones)
      this.downloadTransactionData(transactionsToExport, format);
      this.accessibilityService.announceOperationStatus('Export', 'completed');
    } else {
      // Exporting based on current filters - needs to fetch all filtered data
      // This might require a specific action/effect if pagination means not all data is in client state
      // For now, assume we export what's currently in the store if not specific transactions are passed
      this.transactions$.pipe(take(1)).subscribe((currentTransactionsInStore: Transaction[]) => { // Typed parameter
        this.downloadTransactionData(currentTransactionsInStore, format);
        this.accessibilityService.announceOperationStatus('Export', 'completed');
      });
      // A better approach for "export all filtered" would be:
      // this.store.dispatch(TransactionActions.exportFilteredTransactions({ format, filters: this.currentFilters }));
      // And an effect handles fetching all pages and then triggering download.
    }
  }
  private downloadTransactionData(transactions: Transaction[], format: string): void {
    // Simple CSV export implementation
    if (format === 'csv') {
      const csvData = this.convertToCSV(transactions);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } else {
      // For Excel and PDF, we'd need additional libraries
      this.snackBar.open(`${format.toUpperCase()} export coming soon`, 'Close', { duration: 3000 });
    }
  }

  openImportDialog(): void {
    // TODO: Implement import dialog component
    this.snackBar.open('Import feature coming soon', 'Close', { duration: 3000 });
  }

  private convertToCSV(transactions: Transaction[]): string {
    if (!transactions || transactions.length === 0) {
      return '';
    }

    // Define CSV headers
    const headers = [
      'Date',
      'Description',
      'Category',
      'Type',
      'Amount',
      'Payment Method',
      'Status',
      'Payee',
      'Notes',
      'Tags'
    ];

    // Convert transactions to CSV rows
    const csvRows = transactions.map(transaction => {
      return [
        transaction.date ? new Date(transaction.date).toLocaleDateString() : '',
        this.escapeCsvValue(transaction.description || ''),
        this.escapeCsvValue(transaction.category || ''), // categoryDetails might not be on shared model.
        transaction.type || '',
        transaction.amount?.toString() || '0', // Ensure amount is defined
        transaction.paymentMethod || '',
        transaction.status || '',
        this.escapeCsvValue(transaction.payee || ''),
        this.escapeCsvValue(transaction.notes || ''),
        transaction.tags ? this.escapeCsvValue(transaction.tags.join('; ')) : ''
      ].join(',');
    });

    // Combine headers and rows
    return [headers.join(','), ...csvRows].join('\n');
  }

  private escapeCsvValue(value: string): string {
    // Escape CSV values that contain commas, quotes, or newlines
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

