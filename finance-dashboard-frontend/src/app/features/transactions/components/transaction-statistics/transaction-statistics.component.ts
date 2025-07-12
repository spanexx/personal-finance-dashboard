import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Transaction } from '../../../../shared/models/transaction.model';

export interface TransactionStats {
  total: number;
  income: number;
  expenses: number;
  netAmount: number;
  avgTransaction: number;
}

@Component({
  selector: 'app-transaction-statistics',
  templateUrl: './transaction-statistics.component.html',
  styleUrls: ['./transaction-statistics.component.scss']
})
export class TransactionStatisticsComponent implements OnChanges {
  @Input() transactions: Transaction[] = [];
  @Input() isLoading = false;

  stats: TransactionStats = {
    total: 0,
    income: 0,
    expenses: 0,
    netAmount: 0,
    avgTransaction: 0
  };

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['transactions'] && this.transactions) {
      this.calculateStatistics();
    }
  }

  /**
   * Calculate transaction statistics based on current transactions
   */
  private calculateStatistics(): void {
    this.stats = {
      total: this.transactions.length,
      income: this.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
      expenses: this.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + Math.abs(t.amount), 0),
      netAmount: 0,
      avgTransaction: 0
    };
    
    this.stats.netAmount = this.stats.income - this.stats.expenses;
    this.stats.avgTransaction = this.transactions.length > 0 
      ? this.transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / this.transactions.length 
      : 0;
  }
}
