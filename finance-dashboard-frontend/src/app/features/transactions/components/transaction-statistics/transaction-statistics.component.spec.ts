import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SimpleChange, SimpleChanges } from '@angular/core';

import { TransactionStatisticsComponent } from './transaction-statistics.component';
import { Transaction } from '../../../../shared/models/transaction.model';

describe('TransactionStatisticsComponent', () => {
  let component: TransactionStatisticsComponent;
  let fixture: ComponentFixture<TransactionStatisticsComponent>;

  const mockTransactions: Transaction[] = [
    { _id: '1', date: new Date(), description: 'Income 1', amount: 1000, type: 'income', category: { _id: 'c1', name: 'Salary', icon: 'work', color: '#000' }, tags: [] },
    { _id: '2', date: new Date(), description: 'Expense 1', amount: 100, type: 'expense', category: { _id: 'c2', name: 'Groceries', icon: 'shopping_cart', color: '#fff' }, tags: [] },
    { _id: '3', date: new Date(), description: 'Expense 2', amount: 50, type: 'expense', category: { _id: 'c2', name: 'Groceries', icon: 'shopping_cart', color: '#fff' }, tags: [] },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TransactionStatisticsComponent ],
      imports: [
        MatCardModule,
        MatProgressSpinnerModule
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TransactionStatisticsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate statistics correctly when transactions are provided', () => {
    component.transactions = mockTransactions;
    component.ngOnChanges({
      transactions: {
        currentValue: mockTransactions,
        previousValue: [],
        firstChange: true,
        isFirstChange: () => true
      }
    });
    fixture.detectChanges();

    expect(component.stats.total).toBe(3);
    expect(component.stats.income).toBe(1000);
    expect(component.stats.expenses).toBe(150);
    expect(component.stats.netAmount).toBe(850);
    expect(component.stats.avgTransaction).toBeCloseTo(383.33, 2);
  });

  it('should handle empty transaction array', () => {
    component.transactions = [];
    component.ngOnChanges({
      transactions: {
        currentValue: [],
        previousValue: [],
        firstChange: true,
        isFirstChange: () => true
      }
    });
    fixture.detectChanges();

    expect(component.stats.total).toBe(0);
    expect(component.stats.income).toBe(0);
    expect(component.stats.expenses).toBe(0);
    expect(component.stats.netAmount).toBe(0);
    expect(component.stats.avgTransaction).toBe(0);
  });

  it('should show loading spinner when isLoading is true', () => {
    component.isLoading = true;
    fixture.detectChanges();
    const spinner = fixture.nativeElement.querySelector('mat-progress-spinner');
    expect(spinner).toBeTruthy();
  });

  it('should not show loading spinner when isLoading is false', () => {
    component.isLoading = false;
    fixture.detectChanges();
    const spinner = fixture.nativeElement.querySelector('mat-progress-spinner');
    expect(spinner).toBeFalsy();
  });

  it('should call calculateStatistics on transactions input change', () => {
    spyOn(component as any, 'calculateStatistics');
    component.transactions = mockTransactions;
    const changes: SimpleChanges = {
      transactions: new SimpleChange(undefined, mockTransactions, true)
    };
    component.ngOnChanges(changes);
    expect((component as any).calculateStatistics).toHaveBeenCalled();
  });
});