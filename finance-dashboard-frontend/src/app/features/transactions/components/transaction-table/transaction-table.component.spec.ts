import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SelectionModel } from '@angular/cdk/collections';
import { By } from '@angular/platform-browser';

import { TransactionTableComponent } from './transaction-table.component';
import { Transaction } from '../../../../shared/models/transaction.model';
import { AccessibilityService } from '../../../../shared/services/accessibility.service';

describe('TransactionTableComponent', () => {
  let component: TransactionTableComponent;
  let fixture: ComponentFixture<TransactionTableComponent>;
  let mockAccessibilityService: any;
  const mockTransactions: Transaction[] = [
    { _id: '1', date: new Date('2023-01-01'), description: 'Groceries', amount: 100, type: 'expense', category: { _id: 'c1', name: 'Food', icon: 'fastfood', color: '#FF5733' }, tags: ['food'] },
    { _id: '2', date: new Date('2023-01-02'), description: 'Salary', amount: 2000, type: 'income', category: { _id: 'c2', name: 'Work', icon: 'work', color: '#33FF57' }, tags: ['income'] },
    { _id: '3', date: new Date('2023-01-03'), description: 'Bus Fare', amount: 5, type: 'expense', category: { _id: 'c3', name: 'Transport', icon: 'directions_bus', color: '#3357FF' }, tags: ['travel'] },
  ];

  beforeEach(async () => {
    mockAccessibilityService = {
      announce: jasmine.createSpy('announce')
    };

    await TestBed.configureTestingModule({
      declarations: [ TransactionTableComponent ],
      imports: [
        NoopAnimationsModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatCheckboxModule
      ],
      providers: [
        { provide: AccessibilityService, useValue: mockAccessibilityService }
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TransactionTableComponent);
    component = fixture.componentInstance;
    component.transactions = mockTransactions;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize dataSource with transactions on ngOnInit', () => {
    expect(component.dataSource.data).toEqual(mockTransactions);
  });

  it('should update dataSource.data when transactions input changes', () => {
    const newTransactions: Transaction[] = [
      { _id: '4', date: new Date(), description: 'Rent', amount: 1000, type: 'expense', category: { _id: 'c4', name: 'Housing', icon: 'home', color: '#FF33A8' }, tags: [] }
    ];
    component.transactions = newTransactions;
    component.ngOnChanges({ transactions: { currentValue: newTransactions, previousValue: mockTransactions, firstChange: false, isFirstChange: () => false } });
    expect(component.dataSource.data).toEqual(newTransactions);
  });

  it('should set paginator and sort after view init', () => {
    component.ngAfterViewInit();
    expect(component.dataSource.paginator).toBe(component.paginator);
    expect(component.dataSource.sort).toBe(component.sort);
  });

  it('should return true if all transactions are selected', () => {
    component.selection.select(...mockTransactions);
    expect(component.isAllSelected()).toBeTrue();
  });

  it('should return true if some transactions are selected but not all', () => {
    component.selection.select(mockTransactions[0]);
    expect(component.isIndeterminate()).toBeTrue();
  });

  it('should return false if no transactions are selected', () => {
    component.selection.clear();
    expect(component.isAllSelected()).toBeFalse();
    expect(component.isIndeterminate()).toBeFalse();
  });

  it('should select all transactions and announce when masterToggle is called and none are selected', () => {
    component.selection.clear();
    component.masterToggle();
    expect(component.selection.selected.length).toBe(mockTransactions.length);
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith(`${mockTransactions.length} transactions selected`);
  });

  it('should clear all transactions and announce when masterToggle is called and all are selected', () => {
    component.selection.select(...mockTransactions);
    component.masterToggle();
    expect(component.selection.selected.length).toBe(0);
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith('All transactions deselected');
  });

  it('should toggle individual transaction selection and announce', () => {
    spyOn(component.transactionSelected, 'emit');
    component.toggleSelection(mockTransactions[0]);
    expect(component.selection.isSelected(mockTransactions[0])).toBeTrue();
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith(`Transaction selected: ${mockTransactions[0].description}`);
    expect(component.transactionSelected.emit).toHaveBeenCalledWith([mockTransactions[0]]);

    component.toggleSelection(mockTransactions[0]);
    expect(component.selection.isSelected(mockTransactions[0])).toBeFalse();
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith(`Transaction deselected: ${mockTransactions[0].description}`);
    expect(component.transactionSelected.emit).toHaveBeenCalledWith([]);
  });

  it('should emit transactionEdit when editTransaction is called', () => {
    spyOn(component.transactionEdit, 'emit');
    const transaction = mockTransactions[0];
    component.editTransaction(transaction);
    expect(component.transactionEdit.emit).toHaveBeenCalledWith(transaction);
  });

  it('should emit transactionDelete when deleteTransaction is called', () => {
    spyOn(component.transactionDelete, 'emit');
    const transaction = mockTransactions[0];
    component.deleteTransaction(transaction);
    expect(component.transactionDelete.emit).toHaveBeenCalledWith(transaction);
  });

  it('should emit addTransactionRequest when addTransaction is called', () => {
    spyOn(component.addTransactionRequest, 'emit');
    component.addTransaction();
    expect(component.addTransactionRequest.emit).toHaveBeenCalled();
  });

  it('should format amount correctly for expense', () => {
    const expenseTransaction = mockTransactions[0];
    expect(component.formatAmount(expenseTransaction)).toBe('-$100.00');
  });

  it('should format amount correctly for income', () => {
    const incomeTransaction = mockTransactions[1];
    expect(component.formatAmount(incomeTransaction)).toBe('+$2,000.00');
  });

  it('should return correct class for income transaction type', () => {
    expect(component.getTransactionTypeClass('income')).toBe('income-amount');
  });

  it('should return correct class for expense transaction type', () => {
    expect(component.getTransactionTypeClass('expense')).toBe('expense-amount');
  });

  it('should return category name correctly', () => {
    expect(component.getCategoryName(mockTransactions[0].category)).toBe('Food');
    expect(component.getCategoryName(null)).toBe('Uncategorized');
    expect(component.getCategoryName('stringCategory')).toBe('stringCategory');
    expect(component.getCategoryName({ name: 'TestCat' })).toBe('TestCat');
    expect(component.getCategoryName({ _id: 'testId' })).toBe('testId');
  });

  it('should return category icon correctly', () => {
    expect(component.getCategoryIcon(mockTransactions[0].category)).toBe('fastfood');
    expect(component.getCategoryIcon(null)).toBe('category');
    expect(component.getCategoryIcon('stringCategory')).toBe('category');
    expect(component.getCategoryIcon({ icon: 'test_icon' })).toBe('test_icon');
  });

  it('should return category color correctly', () => {
    expect(component.getCategoryColor(mockTransactions[0].category)).toBe('#FF5733');
    expect(component.getCategoryColor(null)).toBe('#e0e0e0');
    expect(component.getCategoryColor('stringCategory')).toBe('#e0e0e0');
    expect(component.getCategoryColor({ color: '#123456' })).toBe('#123456');
  });

  it('should handle pagination events', () => {
    spyOn(component.dataSource.paginator as MatPaginator, 'page').and.callThrough();
    const pageEvent: PageEvent = { pageIndex: 1, pageSize: 1, length: mockTransactions.length };
    component.paginator.page.emit(pageEvent);
    fixture.detectChanges();
    expect(component.dataSource.paginator?.pageIndex).toBe(1);
    expect(component.dataSource.paginator?.pageSize).toBe(1);
  });

  it('should handle sorting events', () => {
    spyOn(component.dataSource.sort as MatSort, 'sortChange').and.callThrough();
    const sortEvent: Sort = { active: 'description', direction: 'asc' };
    component.sort.sortChange.emit(sortEvent);
    fixture.detectChanges();
    expect(component.dataSource.sort?.active).toBe('description');
    expect(component.dataSource.sort?.direction).toBe('asc');
  });

  it('should display loading indicator when isLoading is true', () => {
    component.isLoading = true;
    fixture.detectChanges();
    const loadingIndicator = fixture.debugElement.query(By.css('.loading-spinner'));
    expect(loadingIndicator).toBeTruthy();
  });

  it('should display error message when error is present', () => {
    component.error = 'Failed to load transactions.';
    fixture.detectChanges();
    const errorMessage = fixture.debugElement.query(By.css('.error-message'));
    expect(errorMessage).toBeTruthy();
    expect(errorMessage.nativeElement.textContent).toContain('Failed to load transactions.');
  });
});
