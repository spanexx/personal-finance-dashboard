import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-cash-flow-visualization',
  template: `
    <div class="cash-flow-container">
      <h3 class="cash-flow-title">Monthly Cash Flow</h3>
      
      <div class="cash-flow-chart">
        <div *ngFor="let month of cashFlowData" class="month-column">
          <div class="month-label">{{ month.month }}</div>
          
          <div class="flow-bars">
            <!-- Income Bar -->
            <div class="income-bar" [style.height.px]="calculateBarHeight(month.income, maxValue)">
              <div class="amount-label" *ngIf="month.income > 0">
                {{ month.income | currency }}
              </div>
            </div>
            
            <!-- Expense Bar -->
            <div class="expense-bar" [style.height.px]="calculateBarHeight(month.expenses, maxValue)">
              <div class="amount-label" *ngIf="month.expenses > 0">
                {{ month.expenses | currency }}
              </div>
            </div>
            
            <!-- Net Bar -->
            <div class="net-bar" 
                 [class.positive]="month.net >= 0"
                 [class.negative]="month.net < 0"
                 [style.height.px]="calculateBarHeight(Math.abs(month.net), maxValue)">
              <div class="amount-label">
                {{ month.net | currency }}
              </div>
            </div>
          </div>
          
          <div class="net-indicator" [class.positive]="month.net >= 0" [class.negative]="month.net < 0">
            <mat-icon>{{ month.net >= 0 ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
          </div>
        </div>
      </div>
      
      <div class="legend">
        <div class="legend-item">
          <div class="legend-color income"></div>
          <div class="legend-label">Income</div>
        </div>
        <div class="legend-item">
          <div class="legend-color expense"></div>
          <div class="legend-label">Expenses</div>
        </div>
        <div class="legend-item">
          <div class="legend-color net-positive"></div>
          <div class="legend-label">Net (Positive)</div>
        </div>
        <div class="legend-item">
          <div class="legend-color net-negative"></div>
          <div class="legend-label">Net (Negative)</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cash-flow-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 15px;
    }
    
    .cash-flow-title {
      margin-top: 0;
      margin-bottom: 20px;
      font-size: 18px;
      font-weight: 500;
      text-align: center;
    }
    
    .cash-flow-chart {
      display: flex;
      justify-content: space-around;
      align-items: flex-end;
      height: 250px;
      margin-bottom: 20px;
      overflow-x: auto;
    }
    
    .month-column {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 100px;
      margin: 0 5px;
    }
    
    .month-label {
      font-size: 12px;
      margin-bottom: 5px;
      white-space: nowrap;
    }
    
    .flow-bars {
      display: flex;
      align-items: flex-end;
      height: 200px;
      margin-bottom: 10px;
    }
    
    .income-bar,
    .expense-bar,
    .net-bar {
      width: 20px;
      margin: 0 5px;
      border-radius: 3px 3px 0 0;
      position: relative;
      display: flex;
      justify-content: center;
      
      .amount-label {
        position: absolute;
        top: -20px;
        font-size: 10px;
        white-space: nowrap;
        transform: rotate(-45deg);
        transform-origin: bottom left;
      }
    }
    
    .income-bar {
      background-color: rgba(75, 192, 192, 0.6);
    }
    
    .expense-bar {
      background-color: rgba(255, 99, 132, 0.6);
    }
    
    .net-bar {
      &.positive {
        background-color: rgba(54, 162, 235, 0.6);
      }
      
      &.negative {
        background-color: rgba(255, 159, 64, 0.6);
      }
    }
    
    .net-indicator {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      
      &.positive {
        color: #4caf50;
      }
      
      &.negative {
        color: #f44336;
      }
      
      mat-icon {
        font-size: 18px;
        height: 18px;
        width: 18px;
      }
    }
    
    .legend {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      margin: 0 10px;
    }
    
    .legend-color {
      width: 15px;
      height: 15px;
      margin-right: 5px;
      border-radius: 3px;
      
      &.income {
        background-color: rgba(75, 192, 192, 0.6);
      }
      
      &.expense {
        background-color: rgba(255, 99, 132, 0.6);
      }
      
      &.net-positive {
        background-color: rgba(54, 162, 235, 0.6);
      }
      
      &.net-negative {
        background-color: rgba(255, 159, 64, 0.6);
      }
    }
    
    .legend-label {
      font-size: 12px;
    }
    
    @media (max-width: 768px) {
      .cash-flow-chart {
        justify-content: flex-start;
      }
      
      .month-column {
        min-width: 80px;
      }
    }
  `]
})
export class CashFlowVisualizationComponent implements OnChanges {
  @Input() cashFlowData: {
    month: string;
    income: number;
    expenses: number;
    net: number;
  }[] = [];
  
  maxValue = 0;
  Math = Math; // Make Math available in the template
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cashFlowData'] && this.cashFlowData) {
      this.calculateMaxValue();
    }
  }
  
  calculateMaxValue(): void {
    this.maxValue = 0;
    
    for (const month of this.cashFlowData) {
      this.maxValue = Math.max(this.maxValue, month.income, month.expenses, Math.abs(month.net));
    }
    
    // Add a little padding to the top
    this.maxValue = this.maxValue * 1.1;
  }
  
  calculateBarHeight(value: number, maxValue: number): number {
    if (maxValue === 0) return 0;
    return (value / maxValue) * 200; // 200px is the height of the flow-bars container
  }
}
