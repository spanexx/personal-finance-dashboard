import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { Transaction } from '../../../../shared/models/transaction.model';
import { AccessibilityService } from '../../../../shared/services/accessibility.service';

interface BulkOperation {
  value: string;
  label: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-transaction-bulk-operations',
  templateUrl: './transaction-bulk-operations.component.html',
  styleUrls: ['./transaction-bulk-operations.component.scss']
})
export class TransactionBulkOperationsComponent implements OnChanges {
  @Input() selectedTransactions: Transaction[] = [];
  @Input() bulkOperations: BulkOperation[] = [
    { value: 'delete', label: 'Delete', icon: 'delete', color: 'warn' },
    { value: 'categorize', label: 'Categorize', icon: 'category', color: 'primary' },
    { value: 'export', label: 'Export', icon: 'download', color: 'accent' },
    { value: 'duplicate', label: 'Duplicate', icon: 'content_copy', color: 'primary' }
  ];

  @Output() executeOperation = new EventEmitter<{operation: string, transactions: Transaction[]}>();

  constructor(private accessibilityService: AccessibilityService) {}

  ngOnChanges(changes: SimpleChanges): void {
    // Announce selection changes for accessibility
    if (changes['selectedTransactions'] && !changes['selectedTransactions'].firstChange) {
      const count = this.selectedTransactions.length;
      if (count > 0) {
        this.accessibilityService.announce(`${count} transaction${count === 1 ? '' : 's'} selected`);
      } else if (count === 0 && changes['selectedTransactions'].previousValue?.length > 0) {
        this.accessibilityService.announce('All transactions deselected');
      }
    }
  }

  /**
   * Execute a bulk operation on selected transactions
   * @param operation The operation to perform
   */
  executeBulkOperation(operation: string): void {
    if (this.selectedTransactions.length === 0) {
      this.accessibilityService.announce('No transactions selected');
      return;
    }
    
    this.accessibilityService.announce(
      `Executing ${this.getOperationLabel(operation)} on ${this.selectedTransactions.length} transactions`
    );
    
    this.executeOperation.emit({
      operation,
      transactions: this.selectedTransactions
    });
  }

  /**
   * Get a user-friendly label for the operation
   */
  private getOperationLabel(operationValue: string): string {
    const operation = this.bulkOperations.find(op => op.value === operationValue);
    return operation ? operation.label : operationValue;
  }
}
