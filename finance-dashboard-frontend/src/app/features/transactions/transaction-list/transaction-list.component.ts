import { Component, OnInit, ViewChild, ChangeDetectionStrategy, NgZone, OnDestroy, ChangeDetectorRef, HostListener, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Store } from '@ngrx/store';
import { FormBuilder } from '@angular/forms';

// import { Transaction, TransactionService } from '../services/transaction.service'; // Service will be used by effects
import { TransactionService, TransactionFilters as ServiceTransactionFilters } from '../services/transaction.service'; // Keep for local type usage if different from store
import { Transaction, TransactionFilters } from '../../../shared/models/transaction.model'; // Use model from shared, added TransactionFilters
import { AccessibilityService } from '../../../shared/services/accessibility.service';
import { AppState } from '../../../store/state/app.state';
import { selectAuthUser, selectIsAuthenticated, selectAuthError } from '../../../store/selectors/auth.selectors';  // Import TransactionFacadeService to abstract store interactions
import { TransactionFacadeService } from '../../../core/services/transaction-facade.service';
import { takeUntil, filter, withLatestFrom, take } from 'rxjs/operators';
import { Subject, combineLatest, Observable } from 'rxjs';
import { CategoryService } from '../../../core/services/category.service';
import * as fromTransactionUtils from './utils';
import { ExportImportService } from '../../../core/services/export-import.service';
import { ImportDialogComponent } from '../components/import-dialog/import-dialog.component';
import { ExportImportHistoryComponent } from '../components/export-import-history/export-import-history.component';

@Component({
  selector: 'app-transaction-list',
  templateUrl: './transaction-list.component.html',
  styleUrl: './transaction-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionListComponent implements OnInit, OnDestroy, AfterViewInit {
  displayedColumns: string[] = ['select', 'date', 'description', 'category', 'amount', 'actions'];
  
  private destroyed$ = new Subject<void>();
  private readonly DEBUG_LOADING = false; // Set to true for debugging pagination issues

  // Use facade service to access store state
  transactions$: Observable<Transaction[]>;
  isLoading$: Observable<boolean>;
  error$: Observable<any | null>;
  pagination$: Observable<any>;
  currentStoreFilters$: Observable<TransactionFilters | null>;
  
  // Authentication state
  user$ = this.store.select(selectAuthUser);
  isAuthenticated$ = this.store.select(selectIsAuthenticated);
  authError$ = this.store.select(selectAuthError);
  
  // For virtual scrolling optimization
  pageSize = 100; // Conservative initial page size, will be optimized based on dataset size
  currentPage = 1; // NgRx pagination is usually 1-based
  isScrollLoading = false;
  totalTransactions = 0;
  useInfiniteScroll = false; // Will be set based on dataset size
  private isInitialLoad = true; // Track if this is the first load to handle stale pagination
  private readonly MAX_BACKEND_PAGE_SIZE = 500; // Backend's maximum page size limit

  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('filterPanel') filterPanel!: ElementRef<HTMLDivElement>;
  
  // UI state
  showAdvancedFilters = false;
  
  // For child components
  categories: any[] = [];
  selectedTransactions: Transaction[] = [];
  searchSuggestions: string[] = [];
  exportFormats = fromTransactionUtils.exportFormats;

  // Current filter state
  currentFilters: TransactionFilters = {};

  constructor(
    private transactionService: TransactionService,
    private categoryService: CategoryService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private accessibilityService: AccessibilityService,
    private store: Store<AppState>,
    private liveAnnouncer: LiveAnnouncer,
    private exportImportService: ExportImportService,
    private transactionFacade: TransactionFacadeService
  ) {
    // Use facade service to get observables
    this.isLoading$ = this.transactionFacade.isLoading();
    this.error$ = this.transactionFacade.getError();
    this.transactions$ = this.transactionFacade.getTransactions();
    this.pagination$ = this.transactionFacade.getPagination();
    this.currentStoreFilters$ = this.transactionFacade.getFilters();
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
    // Process transactions and update search suggestions
    this.transactions$.pipe(
      withLatestFrom(this.isLoading$),
      takeUntil(this.destroyed$)
    ).subscribe(([transactions, isLoading]) => {
      // Handle different response formats
      let txArray: any[] = Array.isArray(transactions)
        ? transactions
        : (transactions && typeof transactions === 'object' && Array.isArray((transactions as any).data)
            ? (transactions as any).data
            : []);
            
      this.updateSearchSuggestions(txArray);
      
      if (!isLoading) {
        this.liveAnnouncer.announce(`Transaction list updated. Showing ${txArray.length} transactions.`, 'polite');
      }
      this.cdr.markForCheck();
    });

    // Handle loading state changes
    this.isLoading$.pipe(takeUntil(this.destroyed$)).subscribe(loading => {
      if (loading) {
        this.liveAnnouncer.announce('Loading transactions...', 'polite');
      }
      this.cdr.markForCheck();
    });

    // Handle errors
    this.error$.pipe(takeUntil(this.destroyed$)).subscribe(error => {
      if (error) {
        const errorMessage = error.message || 'Failed to perform transaction operation.';
        this.snackBar.open(errorMessage, 'Close', { duration: 5000, panelClass: ['error-snackbar'] });
        this.liveAnnouncer.announce(`Error: ${errorMessage}`, 'assertive');
      }
      this.cdr.markForCheck();
    });

    // Check authentication before loading data
    combineLatest([
      this.isAuthenticated$,
      this.authError$
    ]).pipe(
      takeUntil(this.destroyed$),
      filter(([isAuthenticated, authError]) => !authError), // Wait until no auth error
      take(1) // Only take the first valid state
    ).subscribe(([isAuthenticated, authError]) => {
      if (authError) {
        this.handleAuthError(authError);
        return;
      }
      
      if (isAuthenticated) {
        // Add a slightly longer delay to ensure store is properly initialized
        setTimeout(() => {
          this.dispatchLoadTransactions();
          this.loadCategoriesForFilter();
          this.loadSearchSuggestions();
        }, 200);
      } else {
        this.router.navigate(['/auth/login']);
      }
    });

    // Welcome message for authenticated users
    this.user$.pipe(
      takeUntil(this.destroyed$),
      filter(user => !!user)
    ).subscribe(user => {
      this.accessibilityService.announce(`Welcome ${user!.firstName}. Loading your transactions.`);
    });
  }

  ngAfterViewInit(): void {
    // Update local pagination state
    this.pagination$.pipe(takeUntil(this.destroyed$)).subscribe(pagination => {
      // Apply safe defaults if pagination data is incomplete
      this.currentPage = (pagination?.page > 0) ? pagination.page : 1;
      
      // Get total count for tracking
      const totalCount = (pagination?.total >= 0) ? pagination.total : 0;
      
      // Only update if there's a meaningful change to avoid unnecessary updates
      if (this.totalTransactions !== totalCount) {
        this.totalTransactions = totalCount;
        
        // Update infinite scroll setting based on total count
        this.useInfiniteScroll = fromTransactionUtils.shouldUseInfiniteScroll(totalCount);
      }
      
      if (!pagination || typeof pagination.page !== 'number') {
        if (this.DEBUG_LOADING) {
          console.warn('[TransactionList] Malformed or missing pagination object:', pagination);
        }
      }
      this.cdr.markForCheck();
    });
    
    // Set up search input focus
    if (this.searchInput?.nativeElement) {
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
    
    // Configure infinite scroll
    if (this.viewport) {
      this.viewport.elementScrolled()
        .pipe(takeUntil(this.destroyed$))
        .subscribe(() => {
          this.ngZone.run(() => {
            this.onScroll();
          });
        });
    }
  }
  
  ngOnDestroy(): void {
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
    // Only use infinite scroll for large datasets
    if (!this.useInfiniteScroll) {
      return;
    }
    
    // Check if we're at the end of currently loaded transactions
    this.transactions$.pipe(take(1)).subscribe(transactions => {
      if (this.viewport) {
        const end = this.viewport.getRenderedRange().end;
        const totalItems = this.viewport.getDataLength(); 
  
        // Check if we are near the end of the currently loaded data AND if there are more items to load from server
        if (end > 0 && totalItems > 0 && end >= totalItems - 10 && !this.isScrollLoading && transactions.length < this.totalTransactions) {
          this.loadMoreTransactions();
        }
      }
    });
  }

  loadMoreTransactions() {
    // Prevent multiple loads if already loading or if all transactions are loaded
    if (this.isScrollLoading || (this.totalTransactions > 0 && this.currentPage * this.pageSize >= this.totalTransactions)) {
      return;
    }

    this.isScrollLoading = true; // Handled by isLoading$ from store for general loading
    
    const nextPage = this.currentPage + 1;
    this.transactionFacade.loadTransactions(
      this.currentFilters, // Ensure currentFilters is up-to-date from form or store
      nextPage,
      this.pageSize
    );
    
    // Announce to user for accessibility
    this.liveAnnouncer.announce(
      `Loading more transactions. Page ${nextPage} of ${Math.ceil(this.totalTransactions / this.pageSize)}`,
      'polite'
    );
    
    // isScrollLoading will be set to false once loadTransactionsSuccess/Failure is dispatched and isLoading$ updates
  }

  private announceDataLoad(count: number): void {
    this.accessibilityService.announce(`Loaded ${count} transactions. Total: ${this.totalTransactions}. Use arrow keys to navigate or search to filter results.`);
  }

  /**
   * Dynamically calculate the optimal initial page size
   * This can be enhanced to check backend capabilities or user preferences
   */
  private getOptimalInitialPageSize(): number {
    // For now, use the backend's maximum limit to ensure we get accurate totals
    // This could be enhanced to:
    // 1. Check backend capabilities via an API call
    // 2. Use user preferences (stored in localStorage)
    // 3. Adapt based on device performance/memory
    // 4. Consider network speed
    
    return this.MAX_BACKEND_PAGE_SIZE;
  }

  // Centralized method to dispatch load transactions action
  dispatchLoadTransactions(page: number = 1, filters: TransactionFilters | null = this.currentFilters): void {
    if (this.DEBUG_LOADING) {
      console.log(`[dispatchLoadTransactions] Called with page=${page}, current pageSize=${this.pageSize}, isInitialLoad=${this.isInitialLoad}`);
    }
    
    // For initial loads, use smart loading strategy
    if (page === 1) {
      if (this.DEBUG_LOADING) {
        console.log('[dispatchLoadTransactions] Initial load - using smart loading strategy');
      }
      
      // For first time loads, use dynamic page size calculation
      // This adapts to backend capabilities and could be enhanced for user preferences
      const initialPageSize = this.isInitialLoad ? this.getOptimalInitialPageSize() : fromTransactionUtils.calculateInitialPageSize(null);
      this.pageSize = initialPageSize;
      
      this.transactionFacade.loadTransactions(filters, 1, initialPageSize)
        .subscribe(success => {
          if (!success) {
            this.snackBar.open('Failed to load transactions. Please try again.', 'Close', { 
              duration: 5000, 
              panelClass: ['error-snackbar'] 
            });
            return;
          }
          
          if (this.DEBUG_LOADING) {
            console.log('[dispatchLoadTransactions] Initial load completed, analyzing dataset...');
          }
          
          // After loading, analyze dataset size and optimize strategy
          // Use a timeout to ensure pagination state is properly updated
          setTimeout(() => {
            this.pagination$.pipe(
              filter(pagination => pagination != null),
              take(1)
            ).subscribe(pagination => {
              const totalCount = pagination.total || 0;
              
              if (this.DEBUG_LOADING) {
                console.log('[dispatchLoadTransactions] Dataset analysis:', pagination);
                console.log(`[dispatchLoadTransactions] Dataset: ${totalCount} transactions`);
              }
              
              // Mark that we've completed the initial load
              this.isInitialLoad = false;
              
              const optimalPageSize = fromTransactionUtils.calculateOptimalPageSize(totalCount);
              this.useInfiniteScroll = fromTransactionUtils.shouldUseInfiniteScroll(totalCount);
              
              if (this.DEBUG_LOADING) {
                console.log(`[dispatchLoadTransactions] Strategy: ${this.useInfiniteScroll ? 'Infinite scroll' : 'Single page'}`);
                console.log(`[dispatchLoadTransactions] Optimal page size: ${optimalPageSize}`);
              }
              
              // Optimize loading strategy based on dataset size
              if (totalCount <= 500 && totalCount > 0) {
                // Small to medium datasets: Load all at once for best UX
                if (optimalPageSize > this.pageSize || totalCount > this.pageSize) {
                  // Need to reload to get all transactions
                  if (this.DEBUG_LOADING) {
                    console.log(`[dispatchLoadTransactions] Reloading with optimal size: ${optimalPageSize} (total: ${totalCount})`);
                  }
                  this.pageSize = optimalPageSize;
                  this.transactionFacade.loadTransactions(filters, 1, optimalPageSize);
                } else {
                  if (this.DEBUG_LOADING) {
                    console.log(`[dispatchLoadTransactions] Initial load sufficient for ${totalCount} transactions`);
                  }
                  this.pageSize = optimalPageSize;
                }
              } else if (totalCount > 500) {
                // Large datasets: Use pagination + infinite scroll
                if (this.DEBUG_LOADING) {
                  console.log(`[dispatchLoadTransactions] Large dataset (${totalCount}), using pagination strategy`);
                }
                this.pageSize = optimalPageSize;
                
                // Announce strategy to user
                this.liveAnnouncer.announce(
                  `Large dataset detected (${totalCount} transactions). Using pagination for optimal performance.`,
                  'polite'
                );
                
                // If current page size is too small, reload with optimal size
                if (optimalPageSize > this.pageSize) {
                  this.transactionFacade.loadTransactions(filters, 1, optimalPageSize);
                }
              } else {
                // Empty dataset or very small dataset
                if (this.DEBUG_LOADING) {
                  console.log(`[dispatchLoadTransactions] Dataset has ${totalCount} transactions - using default page size`);
                }
                this.pageSize = Math.max(optimalPageSize, 10); // Minimum reasonable page size
              }
            });
          }, 150); // Reasonable timeout to ensure pagination state is ready
        });
    } else {
      // For subsequent pages, use current page size
      if (this.DEBUG_LOADING) {
        console.log(`[dispatchLoadTransactions] Loading page ${page} with page size ${this.pageSize}`);
      }
      this.transactionFacade.loadTransactions(filters, page, this.pageSize)
        .subscribe(success => {
          if (!success) {
            this.snackBar.open('Failed to load transactions. Please try again.', 'Close', { 
              duration: 5000, 
              panelClass: ['error-snackbar'] 
            });
          }
        });
    }
  }

  // Filter handling now moved to TransactionTableComponent

  getTransactionTypeClass(type: string): string {
    return type === 'income' ? 'income-amount' : 'expense-amount';
  }

  formatAmount(transaction: Transaction): string {
    const prefix = transaction.type === 'income' ? '+' : '-';
    return `${prefix}$${Math.abs(transaction.amount).toFixed(2)}`;
  }

  editTransaction(transaction: Transaction): void {
    this.transactionFacade.selectTransaction(transaction._id);
    this.router.navigate(['/transactions/edit', transaction._id]); // Use _id
  }

  deleteTransaction(transaction: Transaction): void {
    if (confirm(`Are you sure you want to delete this transaction: ${transaction.description}?`)) {
      this.liveAnnouncer.announce(`Attempting to delete transaction: ${transaction.description}.`, 'polite');
      
      this.transactionFacade.deleteTransaction(transaction._id)
        .subscribe(success => {
          if (success) {
            this.snackBar.open(`Transaction "${transaction.description}" deleted successfully`, 'Close', { duration: 3000 });
            this.liveAnnouncer.announce(`Transaction ${transaction.description} deleted successfully.`, 'polite');
          } else {
            this.snackBar.open(`Failed to delete transaction "${transaction.description}"`, 'Close', { 
              duration: 5000, 
              panelClass: ['error-snackbar'] 
            });
            this.liveAnnouncer.announce(`Error deleting transaction ${transaction.description}.`, 'assertive');
          }
        });
    }
  }

  addTransaction(): void {
    this.transactionFacade.clearSelectedTransaction(); // Ensure no stale selection
    this.router.navigate(['/transactions/new']);
  }

  manageCategories(): void {
    this.router.navigate(['/transactions/categories']);
  }
  // Keyboard navigation now handled by TransactionTableComponent

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

  // Filter form initialization moved to TransactionFiltersComponent

  private loadSearchSuggestions(): void {
    // Load search suggestions from recent transactions
    this.transactionService.getTransactions({ limit: 200, page: 1 }).subscribe({
      next: (response) => {
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

  // Filter methods moved to the TransactionFiltersComponent

  // loadTransactionsWithFilters is effectively replaced by dispatchLoadTransactions
  // public loadTransactionsWithFilters(): void { ... } // REMOVE

  // Table handling is now done in TransactionTableComponent

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

  // Transaction statistics calculation moved to TransactionStatisticsComponent

  // Bulk operations methods now handled in TransactionTableComponent

  onTransactionsSelected(transactions: Transaction[]): void {
    this.selectedTransactions = transactions;
    this.cdr.markForCheck();
  }

  executeBulkOperation(payload: {operation: string, transactions: Transaction[]}): void {
    const { operation, transactions } = payload;
    
    if (transactions.length === 0) {
      this.snackBar.open('Please select transactions first', 'Close', { duration: 3000 });
      return;
    }

    this.accessibilityService.announceOperationStatus(`Bulk ${operation}`, 'started');

    switch (operation) {
      case 'delete':
        this.bulkDeleteTransactions(transactions);
        break;
      case 'categorize':
        this.openBulkCategorizeDialog(transactions);
        break;
      case 'export':
        this.bulkExportTransactions(transactions);
        break;
      case 'duplicate':
        this.bulkDuplicateTransactions(transactions);
        break;
    }
  }

  private bulkDeleteTransactions(transactions: Transaction[]): void {
    const confirmMessage = `Are you sure you want to delete ${transactions.length} selected transaction(s)?`;
    
    if (confirm(confirmMessage)) {
      const ids = transactions.map(t => t._id);
      
      ids.forEach(id => {
        this.transactionFacade.deleteTransaction(id);
      });
      this.liveAnnouncer.announce(`Attempting to delete ${ids.length} selected transactions.`, 'polite');
      this.selectedTransactions = [];
    }
  }

  private openBulkCategorizeDialog(transactions: Transaction[]): void {
    this.snackBar.open('Bulk categorize feature coming soon', 'Close', { duration: 3000 });
  }

  private bulkExportTransactions(transactions: Transaction[]): void {
    this.exportTransactions('csv', transactions); // Pass selected transactions
  }

  private bulkDuplicateTransactions(transactions: Transaction[]): void {
    this.snackBar.open('Bulk duplicate feature coming soon', 'Close', { duration: 3000 });
  }

  // Export/Import methods
  exportTransactions(format: string, transactionsToExport?: Transaction[]): void {
    // Validate format is one of the supported types
    const validFormat = ['csv', 'excel', 'pdf'].includes(format) ? format as 'csv' | 'excel' | 'pdf' : 'csv';
    
    this.liveAnnouncer.announce(`Preparing ${validFormat.toUpperCase()} export...`, 'polite');

    if (transactionsToExport && transactionsToExport.length > 0) {
      // Exporting specific transactions (e.g., selected ones)
      this.downloadTransactionData(transactionsToExport, validFormat);
    } else {
      // Exporting based on current filters
      this.transactions$.pipe(take(1)).subscribe((currentTransactionsInStore: Transaction[]) => {
        this.downloadTransactionData(currentTransactionsInStore, validFormat);
      });
    }
  }
  private downloadTransactionData(transactions: Transaction[], format: string): void {
    const currentDate = new Date().toISOString().split('T')[0];
    
    // For CSV export, use direct client-side generation
    if (format === 'csv') {
      const csvData = fromTransactionUtils.convertToCSV(transactions);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions_${currentDate}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      this.liveAnnouncer.announce('CSV export completed. Download started.', 'polite');
    } 
    // For other formats, use the API
    else {
      // Show loading indicator
      const loadingRef = this.snackBar.open(`Preparing ${format.toUpperCase()} export...`, 'Processing', { 
        duration: undefined 
      });

      // Use current filters for date range
      const dateRange = this.currentFilters?.startDate && this.currentFilters?.endDate ? {
        startDate: this.currentFilters.startDate.toString(),
        endDate: this.currentFilters.endDate.toString()
      } : undefined;
      
      // Call export API
      this.exportImportService.exportData({
        format: format as any,
        type: 'transactions',
        dateRange: dateRange,
        includeAttachments: false
      }).subscribe({
        next: (result) => {
          loadingRef.dismiss();
          // Create a link to download the file
          const link = document.createElement('a');
          link.href = result.downloadUrl;
          link.download = result.fileName;
          link.click();
          
          this.snackBar.open(`Export completed successfully. ${result.recordCount} records exported.`, 'Close', {
            duration: 5000
          });
          this.liveAnnouncer.announce(`Export completed. ${result.recordCount} transactions exported.`, 'polite');
        },
        error: (error) => {
          loadingRef.dismiss();
          this.snackBar.open(`Export failed: ${error.message}`, 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          this.liveAnnouncer.announce(`Export failed: ${error.message}`, 'assertive');
        }
      });
    }
  }

  // Date range is now handled by the TransactionFiltersComponent

  openImportDialog(): void {
    const dialogRef = this.dialog.open(ImportDialogComponent, {
      width: '700px',
      data: {
        type: 'transactions'
      },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Refresh transactions after successful import
        this.snackBar.open(`Successfully imported ${result.recordsImported} transactions`, 'Close', {
          duration: 5000
        });
        // Reset to first page and refresh to show all transactions including newly imported ones
        this.currentPage = 1;
        this.dispatchLoadTransactions(1, this.currentFilters);
        this.liveAnnouncer.announce(`Import completed. ${result.recordsImported} new transactions added.`, 'polite');
      }
    });
  }

  openHistoryDialog(): void {
    this.dialog.open(ExportImportHistoryComponent, {
      width: '800px',
      maxHeight: '90vh'
    });
  }

  // Methods to interact with the extracted filter component
  onFiltersChanged(filters: TransactionFilters): void {
    this.currentFilters = filters;
    this.currentPage = 1; // Reset to first page when filters change
    this.isInitialLoad = true; // Treat filter changes as fresh loads
    this.transactionFacade.updateFilters(filters);
    this.dispatchLoadTransactions(1, filters);
    this.liveAnnouncer.announce('Applying transaction filters', 'polite');
  }

  onFiltersCleared(): void {
    this.currentFilters = {};
    this.currentPage = 1; // Reset to first page when clearing filters
    this.isInitialLoad = true; // Treat filter clearing as fresh load
    this.transactionFacade.updateFilters(null);
    this.dispatchLoadTransactions(1, null);
    this.liveAnnouncer.announce('Filters cleared. Loading all transactions.', 'polite');
  }

  onAdvancedFiltersToggled(showAdvancedFilters: boolean): void {
    this.showAdvancedFilters = showAdvancedFilters;
  }

  /**
   * Demonstrates using the selector factories from the facade
   * This could be used in the statistics component or for quick summaries
   */
  getTransactionTotals(): void {
    combineLatest([
      this.transactionFacade.getTransactionsByType('income'),
      this.transactionFacade.getTransactionsByType('expense')
    ]).pipe(
      take(1)
    ).subscribe(([incomeTransactions, expenseTransactions]) => {
      const totalIncome = incomeTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      const totalExpenses = expenseTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      
      this.snackBar.open(
        `Summary - Income: $${totalIncome.toFixed(2)}, Expenses: $${totalExpenses.toFixed(2)}`, 
        'Close', 
        { duration: 5000 }
      );
      
      this.liveAnnouncer.announce(
        `Transaction summary loaded. Total income: $${totalIncome.toFixed(2)}, Total expenses: $${totalExpenses.toFixed(2)}`, 
        'polite'
      );
    });
  }

  refreshTransactions(): void {
    this.currentPage = 1; // Reset to first page
    this.isInitialLoad = true; // Reset initial load flag for fresh data
    this.dispatchLoadTransactions(1, this.currentFilters);
    this.liveAnnouncer.announce('Refreshing transaction list', 'polite');
    this.snackBar.open('Refreshing transactions...', 'Close', {
      duration: 2000
    });
  }

  createMissingTransactions(): void {
    const startDate = prompt('Enter start date (YYYY-MM-DD):');
    const endDate = prompt('Enter end date (YYYY-MM-DD):');

    if (startDate && endDate) {
      this.transactionFacade.createMissingTransactions(startDate, endDate);
    }
  }
}