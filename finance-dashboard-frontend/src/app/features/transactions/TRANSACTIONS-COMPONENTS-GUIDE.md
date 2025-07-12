# Transactions Components Usage Guide

This guide provides documentation and usage examples for the refactored Transaction components.

## Overview

The Transaction module has been refactored into smaller, more maintainable components:

1. **TransactionListComponent** - Container component coordinating all transaction functionality
2. **TransactionFiltersComponent** - Handles filtering of transactions
3. **TransactionTableComponent** - Displays and handles interactions with transaction data
4. **TransactionBulkOperationsComponent** - Manages bulk operations on selected transactions
5. **TransactionExportImportComponent** - Handles export and import functionality
6. **TransactionStatisticsComponent** - Displays transaction statistics

## TransactionFacadeService

The `TransactionFacadeService` abstracts interactions with the NgRx store, providing a simplified API for transaction operations.

### Key Features

- **Error Handling**: Type-safe error handling with detailed error information
- **Caching**: Performance optimization for frequently accessed data
- **Selector Factories**: Convenient methods for common data transformations

### Usage Examples

#### Basic Usage

```typescript
// Inject in constructor
constructor(private transactionFacade: TransactionFacadeService) { }

// Load transactions
ngOnInit() {
  this.transactionFacade.loadTransactions(null, 1, 20)
    .subscribe(success => {
      if (success) {
        console.log('Transactions loaded successfully');
      }
    });
}

// Get transactions as an observable
this.transactions$ = this.transactionFacade.getTransactions();
```

#### Using Selector Factories

```typescript
// Get transactions by type
this.incomeTransactions$ = this.transactionFacade.getTransactionsByType('income');

// Get transactions by category
this.foodTransactions$ = this.transactionFacade.getTransactionsByCategory('food-category-id');

// Get transactions by date range
const startDate = new Date('2025-01-01');
const endDate = new Date('2025-06-30');
this.q1q2Transactions$ = this.transactionFacade.getTransactionsByDateRange(startDate, endDate);

// Get transactions by tag
this.vacationTransactions$ = this.transactionFacade.getTransactionsByTag('vacation');
```

## TransactionFiltersComponent

Handles the filtering UI and logic for transactions.

### Inputs

- `currentFilters: TransactionFilters` - The currently applied filters
- `showAdvancedFilters: boolean` - Whether to display advanced filters

### Outputs

- `filtersChanged: EventEmitter<TransactionFilters>` - Emitted when filters are updated
- `filtersCleared: EventEmitter<void>` - Emitted when filters are cleared
- `advancedFiltersToggled: EventEmitter<boolean>` - Emitted when advanced filters are toggled

### Usage Example

```html
<app-transaction-filters
  [currentFilters]="currentFilters"
  [showAdvancedFilters]="showAdvancedFilters"
  (filtersChanged)="onFiltersChanged($event)"
  (filtersCleared)="onFiltersCleared()"
  (advancedFiltersToggled)="onAdvancedFiltersToggled($event)">
</app-transaction-filters>
```

## TransactionTableComponent

Displays transactions in a table format with various interaction capabilities.

### Inputs

- `transactions: Transaction[]` - Array of transactions to display
- `isLoading: boolean` - Whether transactions are currently loading
- `error: any | null` - Any error that occurred during loading
- `displayedColumns: string[]` - Columns to display in the table

### Outputs

- `transactionEdit: EventEmitter<Transaction>` - Emitted when a transaction is edited
- `transactionDelete: EventEmitter<Transaction>` - Emitted when a transaction is deleted
- `transactionSelected: EventEmitter<Transaction[]>` - Emitted when transactions are selected
- `addTransactionRequest: EventEmitter<void>` - Emitted when a new transaction is requested

### Usage Example

```html
<app-transaction-table
  [transactions]="(transactions$ | async) || []"
  [isLoading]="(isLoading$ | async) || false"
  [error]="error$ | async"
  [displayedColumns]="displayedColumns"
  (transactionEdit)="editTransaction($event)"
  (transactionDelete)="deleteTransaction($event)"
  (transactionSelected)="onTransactionsSelected($event)"
  (addTransactionRequest)="addTransaction()">
</app-transaction-table>
```

## TransactionBulkOperationsComponent

Provides UI for performing operations on multiple selected transactions.

### Inputs

- `selectedTransactions: Transaction[]` - Currently selected transactions

### Outputs

- `executeOperation: EventEmitter<{operation: string, transactions: Transaction[]}>` - Emitted when a bulk operation is executed

### Usage Example

```html
<app-transaction-bulk-operations
  [selectedTransactions]="selectedTransactions"
  (executeOperation)="executeBulkOperation($event)">
</app-transaction-bulk-operations>
```

## TransactionExportImportComponent

Handles exporting and importing of transaction data.

### Inputs

- `exportFormats: string[]` - Available export formats

### Outputs

- `exportRequested: EventEmitter<string>` - Emitted when an export is requested with the format
- `importRequested: EventEmitter<void>` - Emitted when an import is requested

### Usage Example

```html
<app-transaction-export-import
  [exportFormats]="exportFormats"
  (exportRequested)="exportTransactions($event)"
  (importRequested)="openImportDialog()">
</app-transaction-export-import>
```

## TransactionStatisticsComponent

Displays statistical information about the transactions.

### Inputs

- `transactions: Transaction[]` - Transactions to calculate statistics from
- `isLoading: boolean` - Whether transactions are currently loading

### Usage Example

```html
<app-transaction-statistics
  [transactions]="(transactions$ | async) || []"
  [isLoading]="(isLoading$ | async) || false">
</app-transaction-statistics>
```

## Performance Optimizations

The following performance optimizations have been implemented:

1. **Caching in Facade**: Frequently accessed data is cached to prevent unnecessary store selections
2. **TrackBy Functions**: All lists use trackBy functions to optimize change detection
3. **OnPush Change Detection**: All components use ChangeDetectionStrategy.OnPush
4. **Async Pipe**: Using async pipe to automatically handle subscriptions
5. **Virtual Scrolling**: Table component uses virtual scrolling for large data sets
6. **ShareReplay Operator**: Used for shared observables to prevent multiple subscriptions
7. **NgZone Optimization**: Heavy operations run outside NgZone to prevent change detection cycles

## Best Practices

1. **Component Communication**: Use Input/Output for parent-child communication, and the facade service for unrelated components
2. **Error Handling**: Always handle errors from the facade and provide user feedback
3. **Accessibility**: Use LiveAnnouncer or AccessibilityService for screen reader announcements
4. **Reactive Approach**: Prefer observables and async pipe over direct property access
5. **Immutability**: Always treat state as immutable, using the facade for state modifications
