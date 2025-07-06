import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TransactionService } from '../../../core/services/transaction.service';

@Component({
  selector: 'app-category-details-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.category }} Breakdown</h2>
    <mat-dialog-content>
      <div *ngIf="loading" class="loading-container">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
      
      <div *ngIf="!loading && error" class="error-message">
        <p>{{ error }}</p>
        <button mat-button color="primary" (click)="loadCategoryDetails()">Retry</button>
      </div>
      
      <div *ngIf="!loading && !error">
        <div class="summary-section">
          <div class="summary-item">
            <div class="label">Total Amount</div>
            <div class="value">{{ data.amount | currency }}</div>
          </div>
          <div class="summary-item">
            <div class="label">Percentage of Budget</div>
            <div class="value">{{ data.percentage | number:'1.1-1' }}%</div>
          </div>
          <div class="summary-item">
            <div class="label">Transaction Count</div>
            <div class="value">{{ data.count }}</div>
          </div>
        </div>
        
        <h3 class="section-title">Transactions</h3>
        <table mat-table [dataSource]="transactions" class="transactions-table">
          <!-- Date Column -->
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef>Date</th>
            <td mat-cell *matCellDef="let transaction">{{ transaction.date | date }}</td>
          </ng-container>
          
          <!-- Description Column -->
          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let transaction">{{ transaction.description }}</td>
          </ng-container>
          
          <!-- Amount Column -->
          <ng-container matColumnDef="amount">
            <th mat-header-cell *matHeaderCellDef>Amount</th>
            <td mat-cell *matCellDef="let transaction" 
                [ngClass]="transaction.type === 'expense' ? 'expense-amount' : 'income-amount'">
              {{ transaction.amount | currency }}
            </td>
          </ng-container>
          
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
        
        <div *ngIf="transactions.length === 0" class="no-data">
          No transactions found for this category in the selected time period.
        </div>
          <div *ngIf="monthlyData && monthlyData.length > 0">
          <h3 class="section-title">Monthly Trends</h3>
          <canvas id="categoryMonthlyChart" 
                  [chart]="monthlyChart"
                  accessibleChart 
                  [chartTitle]="data.category + ' Monthly Trends'" 
                  [chartData]="monthlyChart?.data" 
                  [chartType]="'line'"
                  tabindex="0"
                  aria-label="Line chart showing monthly spending trends for this category">
          </canvas>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
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
    
    #categoryMonthlyChart {
      height: 200px;
      margin-top: 10px;
    }
  `]
})
export class CategoryDetailsDialogComponent {
  loading = false;
  error: string | null = null;
  transactions: any[] = [];
  monthlyData: any[] = [];
  displayedColumns: string[] = ['date', 'description', 'amount'];
  monthlyChart: any;
  
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
    }).subscribe({next: (response) => {
        this.transactions = response.data;
        this.processMonthlyData();
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load category details. Please try again.';
        this.loading = false;
        console.error('Error loading category details:', err);
      }
    });
  }
  
  processMonthlyData(): void {
    // Group transactions by month
    const monthlyMap = new Map<string, number>();
    
    this.transactions.forEach(transaction => {
      const month = new Date(transaction.date).toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const amount = transaction.type === 'expense' ? transaction.amount : 0;
      
      if (monthlyMap.has(month)) {
        monthlyMap.set(month, monthlyMap.get(month)! + amount);
      } else {
        monthlyMap.set(month, amount);
      }
    });
    
    // Convert map to array and sort by date
    this.monthlyData = Array.from(monthlyMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA.getTime() - dateB.getTime();
      });
    
    // Create chart if we have data
    if (this.monthlyData.length > 0) {
      this.createMonthlyChart();
    }
  }
  
  createMonthlyChart(): void {
    this.monthlyChart = {
      type: 'bar',
      data: {
        labels: this.monthlyData.map(item => item.month),
        datasets: [{
          label: this.data.category,
          data: this.monthlyData.map(item => item.amount),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Amount'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context: any) {
                const value = context.raw;
                return `Amount: ${value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
              }
            }
          }
        }
      }
    };
  }
}
