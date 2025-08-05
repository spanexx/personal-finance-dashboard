import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatSelectChange } from '@angular/material/select';
import { of } from 'rxjs';

import { TransactionFiltersComponent } from './transaction-filters.component';
import { CategoryService } from '../../../../core/services/category.service';
import { TransactionFilters } from '../../../../shared/models/transaction.model';

describe('TransactionFiltersComponent', () => {
  let component: TransactionFiltersComponent;
  let fixture: ComponentFixture<TransactionFiltersComponent>;
  let mockCategoryService: any;

  beforeEach(async () => {
    mockCategoryService = {
      getCategories: jasmine.createSpy('getCategories').and.returnValue(of([
        { id: '1', name: 'Food' },
        { id: '2', name: 'Transport' }
      ]))
    };

    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule],
      declarations: [TransactionFiltersComponent],
      providers: [
        FormBuilder,
        { provide: CategoryService, useValue: mockCategoryService }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TransactionFiltersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize the filter form with default values', () => {
    expect(component.filterForm).toBeDefined();
    expect(component.filterForm.get('searchTerm')?.value).toBe('');
    expect(component.filterForm.get('dateRange')?.value).toBe('thisMonth');
    expect(component.filterForm.get('startDate')?.value).toBeNull();
    expect(component.filterForm.get('endDate')?.value).toBeNull();
    expect(component.filterForm.get('types')?.value).toEqual([]);
    expect(component.filterForm.get('categories')?.value).toEqual([]);
    expect(component.filterForm.get('paymentMethods')?.value).toEqual([]);
    expect(component.filterForm.get('status')?.value).toEqual([]);
    expect(component.filterForm.get('minAmount')?.value).toBeNull();
    expect(component.filterForm.get('maxAmount')?.value).toBeNull();
    expect(component.filterForm.get('tags')?.value).toBe('');
  });

  it('should load categories on ngOnInit', () => {
    expect(mockCategoryService.getCategories).toHaveBeenCalled();
    expect(component.categories).toEqual([
      { id: '1', name: 'Food' },
      { id: '2', name: 'Transport' }
    ]);
  });

  it('should emit filtersChanged event with correct filters when applyFilters is called', () => {
    spyOn(component.filtersChanged, 'emit');
    const testDate = new Date();
    component.filterForm.patchValue({
      searchTerm: 'test',
      startDate: testDate,
      endDate: testDate,
      types: ['expense'],
      categories: ['1'],
      paymentMethods: ['credit_card'],
      status: ['cleared'],
      minAmount: 10,
      maxAmount: 100,
      tags: 'tag1,tag2'
    });
    component.applyFilters();

    const expectedFilters: TransactionFilters = {
      startDate: testDate.toISOString(),
      endDate: testDate.toISOString(),
      category: '1',
      type: 'expense',
      paymentMethod: 'credit_card',
      status: 'cleared',
      minAmount: 10,
      maxAmount: 100,
      tags: ['tag1', 'tag2']
    };
    expect(component.filtersChanged.emit).toHaveBeenCalledWith(expectedFilters);
  });

  it('should emit filtersCleared event and reset form when clearFilters is called', () => {
    spyOn(component.filtersCleared, 'emit');
    spyOn(component.filterForm, 'reset').and.callThrough();
    spyOn(component, 'onDateRangePresetChange').and.callThrough();

    component.filterForm.patchValue({ searchTerm: 'some value' });
    component.clearFilters();

    expect(component.filterForm.reset).toHaveBeenCalledWith({ dateRange: 'thisMonth' });
    expect(component.onDateRangePresetChange).toHaveBeenCalled();
    expect(component.filtersCleared.emit).toHaveBeenCalled();
    expect(component.filterForm.get('searchTerm')?.value).toBeNull(); // Reset should clear this
  });

  it('should toggle showAdvancedFilters and emit advancedFiltersToggled event', () => {
    spyOn(component.advancedFiltersToggled, 'emit');
    component.showAdvancedFilters = false;
    component.toggleAdvancedFilters();
    expect(component.showAdvancedFilters).toBeTrue();
    expect(component.advancedFiltersToggled.emit).toHaveBeenCalledWith(true);

    component.toggleAdvancedFilters();
    expect(component.showAdvancedFilters).toBeFalse();
    expect(component.advancedFiltersToggled.emit).toHaveBeenCalledWith(false);
  });

  it('should set startDate and endDate based on date range preset change', () => {
    const mockEvent = { value: 'lastMonth' } as MatSelectChange;
    component.onDateRangePresetChange(mockEvent);
    // Expect startDate and endDate to be set, actual values depend on getDateRangeFromPreset
    expect(component.filterForm.get('startDate')?.value).not.toBeNull();
    expect(component.filterForm.get('endDate')?.value).not.toBeNull();

    const mockEventCustom = { value: 'custom' } as MatSelectChange;
    component.onDateRangePresetChange(mockEventCustom);
    expect(component.filterForm.get('startDate')?.value).toBeNull();
    expect(component.filterForm.get('endDate')?.value).toBeNull();
  });

  it('should apply currentFilters to the form on ngOnInit', () => {
    const initialFilters: TransactionFilters = {
      startDate: new Date('2023-01-01').toISOString(),
      endDate: new Date('2023-01-31').toISOString(),
      category: '1,2',
      type: 'income',
      paymentMethod: 'cash',
      status: 'pending',
      minAmount: 50,
      maxAmount: 500,
      tags: ['work', 'travel']
    };
    component.currentFilters = initialFilters;
    component.ngOnInit(); // Re-initialize component to apply filters

    expect(component.filterForm.get('startDate')?.value.toISOString()).toBe(initialFilters.startDate);
    expect(component.filterForm.get('endDate')?.value.toISOString()).toBe(initialFilters.endDate);
    expect(component.filterForm.get('categories')?.value).toEqual(['1', '2']);
    expect(component.filterForm.get('types')?.value).toEqual(['income']);
    expect(component.filterForm.get('paymentMethods')?.value).toEqual(['cash']);
    expect(component.filterForm.get('status')?.value).toEqual(['pending']);
    expect(component.filterForm.get('minAmount')?.value).toBe(initialFilters.minAmount);
    expect(component.filterForm.get('maxAmount')?.value).toBe(initialFilters.maxAmount);
    expect(component.filterForm.get('tags')?.value).toBe('work, travel');
  });
});
