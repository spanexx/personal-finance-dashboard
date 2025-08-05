import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SimpleChange, SimpleChanges } from '@angular/core';

import { TransactionBulkOperationsComponent } from './transaction-bulk-operations.component';
import { AccessibilityService } from '../../../../shared/services/accessibility.service';
import { Transaction } from '../../../../shared/models/transaction.model';

describe('TransactionBulkOperationsComponent', () => {
  let component: TransactionBulkOperationsComponent;
  let fixture: ComponentFixture<TransactionBulkOperationsComponent>;
  let mockAccessibilityService: any;
  const mockTransactions: Transaction[] = [
    { _id: '1', date: new Date(), description: 'Test 1', amount: 100, type: 'expense', category: { _id: 'c1', name: 'Cat 1', icon: 'home', color: '#fff' }, tags: [] },
    { _id: '2', date: new Date(), description: 'Test 2', amount: 200, type: 'income', category: { _id: 'c2', name: 'Cat 2', icon: 'work', color: '#000' }, tags: [] },
  ];

  beforeEach(async () => {
    mockAccessibilityService = {
      announce: jasmine.createSpy('announce')
    };

    await TestBed.configureTestingModule({
      declarations: [ TransactionBulkOperationsComponent ],
      imports: [
        NoopAnimationsModule,
        MatMenuModule,
        MatButtonModule,
        MatIconModule
      ],
      providers: [
        { provide: AccessibilityService, useValue: mockAccessibilityService }
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TransactionBulkOperationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit executeOperation when an operation is selected', () => {
    spyOn(component.executeOperation, 'emit');
    component.selectedTransactions = mockTransactions;
    const operation = 'delete';
    component.executeBulkOperation(operation);
    expect(component.executeOperation.emit).toHaveBeenCalledWith({
      operation,
      transactions: mockTransactions
    });
  });

  it('should not emit executeOperation if no transactions are selected', () => {
    spyOn(component.executeOperation, 'emit');
    component.selectedTransactions = [];
    component.executeBulkOperation('delete');
    expect(component.executeOperation.emit).not.toHaveBeenCalled();
  });

  it('should announce when no transactions are selected and operation is attempted', () => {
    component.selectedTransactions = [];
    component.executeBulkOperation('delete');
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith('No transactions selected');
  });

  it('should announce when an operation is executed', () => {
    component.selectedTransactions = mockTransactions;
    component.executeBulkOperation('delete');
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith('Executing Delete on 2 transactions');
  });

  it('should announce selection count on ngOnChanges when selectedTransactions changes', () => {
    component.selectedTransactions = [];
    fixture.detectChanges();
    mockAccessibilityService.announce.calls.reset();

    component.selectedTransactions = [mockTransactions[0]];
    const changes: SimpleChanges = {
      selectedTransactions: new SimpleChange([], [mockTransactions[0]], false)
    };
    component.ngOnChanges(changes);
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith('1 transaction selected');

    component.selectedTransactions = mockTransactions;
    const changes2: SimpleChanges = {
      selectedTransactions: new SimpleChange([mockTransactions[0]], mockTransactions, false)
    };
    component.ngOnChanges(changes2);
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith('2 transactions selected');
  });

  it('should announce deselection when selectedTransactions becomes empty', () => {
    component.selectedTransactions = mockTransactions;
    fixture.detectChanges();
    mockAccessibilityService.announce.calls.reset();

    component.selectedTransactions = [];
    const changes: SimpleChanges = {
      selectedTransactions: new SimpleChange(mockTransactions, [], false)
    };
    component.ngOnChanges(changes);
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith('All transactions deselected');
  });

  it('should not announce on first change of selectedTransactions', () => {
    mockAccessibilityService.announce.calls.reset();
    const changes: SimpleChanges = {
      selectedTransactions: new SimpleChange(undefined, mockTransactions, true)
    };
    component.ngOnChanges(changes);
    expect(mockAccessibilityService.announce).not.toHaveBeenCalled();
  });

  it('should correctly get operation label for known operation', () => {
    expect((component as any).getOperationLabel('delete')).toBe('Delete');
  });

  it('should return operation value if label is not found', () => {
    expect((component as any).getOperationLabel('unknown_op')).toBe('unknown_op');
  });
});