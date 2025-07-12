import { Component, OnInit, ViewChild, Input, Output, EventEmitter, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { SelectionModel } from '@angular/cdk/collections';
import { Transaction } from '../../../../shared/models/transaction.model';
import { AccessibilityService } from '../../../../shared/services/accessibility.service';

@Component({
  selector: 'app-transaction-table',
  templateUrl: './transaction-table.component.html',
  styleUrls: ['./transaction-table.component.scss']
})
export class TransactionTableComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() transactions: Transaction[] = [];
  @Input() isLoading = false;
  @Input() error: any = null;
  @Input() displayedColumns: string[] = ['select', 'date', 'description', 'category', 'amount', 'actions'];
  @Input() isScrollLoading = false;

  @Output() transactionEdit = new EventEmitter<Transaction>();
  @Output() transactionDelete = new EventEmitter<Transaction>();
  @Output() transactionSelected = new EventEmitter<Transaction[]>();
  @Output() addTransactionRequest = new EventEmitter<void>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  dataSource: MatTableDataSource<Transaction> = new MatTableDataSource<Transaction>([]);
  selection = new SelectionModel<Transaction>(true, []);
  
  constructor(private accessibilityService: AccessibilityService) {}

  ngOnInit(): void {
    this.dataSource = new MatTableDataSource<Transaction>(this.transactions);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['transactions'] && this.dataSource) {
      this.dataSource.data = this.transactions;
    }
  }

  ngAfterViewInit(): void {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  // Selection methods
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
    this.emitSelectedTransactions();
  }

  toggleSelection(transaction: Transaction): void {
    this.selection.toggle(transaction);
    const isSelected = this.selection.isSelected(transaction);
    this.accessibilityService.announce(
      `Transaction ${isSelected ? 'selected' : 'deselected'}: ${transaction.description}`
    );
    this.emitSelectedTransactions();
  }

  private emitSelectedTransactions(): void {
    this.transactionSelected.emit(this.selection.selected);
  }

  // Action methods
  editTransaction(transaction: Transaction): void {
    this.transactionEdit.emit(transaction);
  }

  deleteTransaction(transaction: Transaction): void {
    this.transactionDelete.emit(transaction);
  }

  addTransaction(): void {
    this.addTransactionRequest.emit();
  }

  // Formatting methods
  formatAmount(transaction: Transaction): string {
    const amount = Math.abs(transaction.amount);
    const prefix = transaction.type === 'income' ? '+' : '-';
    return `${prefix}${amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
  }

  getTransactionTypeClass(type: string): string {
    return type === 'income' ? 'income-amount' : 'expense-amount';
  }

  // Category helper methods
  getCategoryName(category: any): string {
    if (!category) return 'Uncategorized';
    if (typeof category === 'string') return category;
    if (typeof category === 'object') {
      return category.name || category._id || 'Uncategorized';
    }
    return String(category);
  }

  getCategoryIcon(category: any): string {
    if (!category || typeof category !== 'object') return 'category';
    return category.icon || 'category';
  }

  getCategoryColor(category: any): string {
    if (!category || typeof category !== 'object') return '#e0e0e0';
    return category.color || '#e0e0e0';
  }
}
