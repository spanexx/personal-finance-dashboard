import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatSelectChange } from '@angular/material/select';
import { of } from 'rxjs';

import { TransactionFiltersComponent } from './transaction-filters.component';
import { CategoryService } from '../../../../core/services/category.service';
// Since SharedModule doesn't exist, import the Angular Material modules directly
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('TransactionFiltersComponent', () => {
  let component: TransactionFiltersComponent;
  let fixture: ComponentFixture<TransactionFiltersComponent>;
  let categoryServiceSpy: jasmine.SpyObj<CategoryService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('CategoryService', ['getCategories']);
    spy.getCategories.and.returnValue(of([
      { _id: 'cat1', name: 'Food' },
      { _id: 'cat2', name: 'Transportation' }
    ]));

    await TestBed.configureTestingModule({
      declarations: [TransactionFiltersComponent],
      imports: [
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatDatepickerModule,
        MatNativeDateModule
      ],
      providers: [
        { provide: CategoryService, useValue: spy }
      ]
    }).compileComponents();

    categoryServiceSpy = TestBed.inject(CategoryService) as jasmine.SpyObj<CategoryService>;
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TransactionFiltersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize filter form', () => {
    expect(component.filterForm).toBeDefined();
    expect(component.filterForm.get('searchTerm')).toBeDefined();
    expect(component.filterForm.get('dateRange')).toBeDefined();
    expect(component.filterForm.get('types')).toBeDefined();
    expect(component.filterForm.get('categories')).toBeDefined();
  });

  it('should load categories on init', () => {
    expect(categoryServiceSpy.getCategories).toHaveBeenCalled();
    expect(component.categories.length).toBe(2);
  });

  it('should toggle advanced filters', () => {
    const initialValue = component.showAdvancedFilters;
    spyOn(component.advancedFiltersToggled, 'emit');
    
    component.toggleAdvancedFilters();
    
    expect(component.showAdvancedFilters).toBe(!initialValue);
    expect(component.advancedFiltersToggled.emit).toHaveBeenCalledWith(!initialValue);
  });

  it('should update date range when preset changes', () => {
    const mockEvent = new MatSelectChange({} as any, 'thisMonth');
    spyOn(component.filterForm, 'patchValue');
    
    component.onDateRangePresetChange(mockEvent);
    
    expect(component.filterForm.patchValue).toHaveBeenCalled();
  });

  it('should emit filters on apply', () => {
    spyOn(component.filtersChanged, 'emit');
    component.applyFilters();
    expect(component.filtersChanged.emit).toHaveBeenCalled();
  });

  it('should reset form and emit on clear filters', () => {
    spyOn(component.filterForm, 'reset');
    spyOn(component.filtersCleared, 'emit');
    
    component.clearFilters();
    
    expect(component.filterForm.reset).toHaveBeenCalled();
    expect(component.filtersCleared.emit).toHaveBeenCalled();
  });
});
