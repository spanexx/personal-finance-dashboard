import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { TransactionTableComponent } from './transaction-table.component';
import { AccessibilityService } from '../../../../shared/services/accessibility.service';

describe('TransactionTableComponent', () => {
  let component: TransactionTableComponent;
  let fixture: ComponentFixture<TransactionTableComponent>;
  let accessibilityServiceSpy: jasmine.SpyObj<AccessibilityService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('AccessibilityService', ['announce']);

    await TestBed.configureTestingModule({
      declarations: [TransactionTableComponent],
      imports: [
        NoopAnimationsModule,
        MatPaginatorModule,
        MatSortModule,
        MatTableModule,
        MatCheckboxModule,
        MatIconModule,
        MatChipsModule,
        MatButtonModule,
        MatTooltipModule,
        MatProgressBarModule
      ],
      providers: [
        { provide: AccessibilityService, useValue: spy }
      ]
    }).compileComponents();

    accessibilityServiceSpy = TestBed.inject(AccessibilityService) as jasmine.SpyObj<AccessibilityService>;
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TransactionTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update data source when transactions input changes', () => {
    const mockTransactions = [
      { _id: '1', description: 'Test 1', amount: 100, type: 'income', date: new Date() },
      { _id: '2', description: 'Test 2', amount: 200, type: 'expense', date: new Date() }
    ] as any;
    
    component.transactions = mockTransactions;
    component.ngOnChanges({
      transactions: {
        currentValue: mockTransactions,
        previousValue: [],
        firstChange: false,
        isFirstChange: () => false
      }
    });
    
    expect(component.dataSource.data.length).toBe(2);
    expect(component.dataSource.data).toEqual(mockTransactions);
  });

  it('should toggle selection and announce when toggling item', () => {
    const mockTransaction = { _id: '1', description: 'Test', amount: 100 } as any;
    
    component.toggleSelection(mockTransaction);
    
    expect(component.selection.isSelected(mockTransaction)).toBeTrue();
    expect(accessibilityServiceSpy.announce).toHaveBeenCalled();
  });

  it('should format amount correctly for income and expense', () => {
    const incomeTransaction = { amount: 100, type: 'income' } as any;
    const expenseTransaction = { amount: 100, type: 'expense' } as any;
    
    expect(component.formatAmount(incomeTransaction)).toContain('+');
    expect(component.formatAmount(expenseTransaction)).toContain('-');
  });

  it('should get correct transaction type class', () => {
    expect(component.getTransactionTypeClass('income')).toBe('income-amount');
    expect(component.getTransactionTypeClass('expense')).toBe('expense-amount');
  });

  it('should emit edit event when editing transaction', () => {
    spyOn(component.transactionEdit, 'emit');
    const mockTransaction = { _id: '1' } as any;
    
    component.editTransaction(mockTransaction);
    
    expect(component.transactionEdit.emit).toHaveBeenCalledWith(mockTransaction);
  });

  it('should emit delete event when deleting transaction', () => {
    spyOn(component.transactionDelete, 'emit');
    const mockTransaction = { _id: '1' } as any;
    
    component.deleteTransaction(mockTransaction);
    
    expect(component.transactionDelete.emit).toHaveBeenCalledWith(mockTransaction);
  });
});
