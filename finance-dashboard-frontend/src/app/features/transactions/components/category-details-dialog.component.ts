import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TransactionService } from '../../../core/services/transaction.service';

@Component({
  selector: 'app-category-details-dialog',
  templateUrl: './category-details-dialog.component.html',
  styles: [`
    .loading-container {
      display: flex;
      justify-content: center;
      padding: 20px;
    }
    
    .error-message {
      color: #f44336;
      text-align: center;
      padding: 20px;
    }
    
    .summary-section {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .summary-item {
      flex: 1;
      min-width: 120px;
      background-color: rgba(0, 0, 0, 0.04);
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    
    .label {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
      margin-bottom: 5px;
    }
    
    .value {
      font-size: 18px;
      font-weight: 500;
    }
    
    .section-title {
      margin-top: 20px;
      margin-bottom: 10px;
      font-size: 16px;
      font-weight: 500;
    }
    
    .transactions-table {
      width: 100%;
    }
    
    .expense-amount {
      color: #f44336;
    }
    
    .income-amount {
      color: #4caf50;
    }
    
    .no-data {
      text-align: center;
      padding: 20px;
      color: rgba(0, 0, 0, 0.6);
    }
    
    .chart-container {
      width: 100%;
      margin-top: 10px;
    }
    .fixed-chart-wrapper {
      width: 100%;
      height: 220px;
      min-height: 220px;
      max-height: 220px;
      overflow: hidden;
      position: relative;
    }
    #categoryMonthlyChart {
      height: 220px !important;
      width: 100% !important;
      display: block;
    }
  `]
})
export class CategoryDetailsDialogComponent {
  loading = false;
  error: string | null = null;
  transactions: any[] = [];
  displayedColumns: string[] = ['date', 'description', 'amount'];
  categoryName?: string;

  constructor(
    private dialogRef: MatDialogRef<CategoryDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      category: string;
      amount: number;
      percentage: number;
      count: number;
      startDate: string;
      endDate: string;
    },
    private transactionService: TransactionService
  ) {
    this.loadCategoryDetails();
  }

  loadCategoryDetails(): void {
    this.loading = true;
    this.error = null;

    // Get transactions for this category
    this.transactionService.getTransactions({
      startDate: this.data.startDate,
      endDate: this.data.endDate,
      category: this.data.category
    }).subscribe({
      next: (response) => {
        if (response.data && response.data.length > 0 && response.data[0].category && typeof response.data[0].category === 'object' && (response.data[0].category as any).name) {
          this.categoryName = (response.data[0].category as any).name;
        } else {
          this.categoryName = this.data.category;
        }
        this.transactions = response.data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load category details. Please try again.';
        this.loading = false;
        console.error('Error loading category details:', err);
      }
    });
  }
}

