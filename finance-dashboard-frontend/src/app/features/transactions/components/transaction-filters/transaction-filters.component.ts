import { Component, OnInit, Input, Output, EventEmitter, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatSelectChange } from '@angular/material/select';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { TransactionFilters } from '../../../../shared/models/transaction.model';
import { CategoryService } from '../../../../core/services/category.service';
import * as fromTransactionUtils from '../../transaction-list/utils';

@Component({
  selector: 'app-transaction-filters',
  templateUrl: './transaction-filters.component.html',
  styleUrls: ['./transaction-filters.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionFiltersComponent implements OnInit, OnDestroy {
  @Input() currentFilters: TransactionFilters | null = null;
  @Input() showAdvancedFilters = false;
  
  @Output() filtersChanged = new EventEmitter<TransactionFilters>();
  @Output() filtersCleared = new EventEmitter<void>();
  @Output() advancedFiltersToggled = new EventEmitter<boolean>();
  
  filterForm!: FormGroup;
  
  // Filter options
  categories: any[] = [];
  paymentMethods = fromTransactionUtils.paymentMethods;
  transactionTypes = fromTransactionUtils.transactionTypes;
  statusOptions = fromTransactionUtils.statusOptions;
  dateRangePresets = fromTransactionUtils.dateRangePresets;
  
  private destroyed$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private categoryService: CategoryService
  ) { }

  ngOnInit(): void {
    this.initializeFilterForm();
    this.loadCategoriesForFilter();
    
    // Apply initial filters if provided
    if (this.currentFilters) {
      this.applyFiltersToForm(this.currentFilters);
    }

    // Subscribe to form value changes for real-time filtering if needed
    /*
    this.filterForm.valueChanges.pipe(
      debounceTime(500),
      takeUntil(this.destroyed$)
    ).subscribe(values => {
      // Implement if you want real-time filtering as user types
    });
    */
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  initializeFilterForm(): void {
    this.filterForm = this.fb.group({
      searchTerm: [''],
      dateRange: ['thisMonth'], // Default to current month
      startDate: [null],
      endDate: [null],
      types: [[]],
      categories: [[]],
      paymentMethods: [[]],
      status: [[]],
      minAmount: [null],
      maxAmount: [null],
      tags: ['']
    });
  }

  loadCategoriesForFilter(): void {
    this.categoryService.getCategories()
      .pipe(takeUntil(this.destroyed$))
      .subscribe(
        (categories: any[]) => {
          this.categories = categories;
        },
        (error) => {
          console.error('Failed to load categories', error);
        }
      );
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
    this.advancedFiltersToggled.emit(this.showAdvancedFilters);
  }

  onDateRangePresetChange(event: MatSelectChange): void {
    const selectedPreset = event.value;
    const dateRange = fromTransactionUtils.getDateRangeFromPreset(selectedPreset);
    
    if (dateRange) {
      this.filterForm.patchValue({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
    } else {
      this.filterForm.patchValue({
        startDate: null,
        endDate: null
      });
    }
  }

  applyFilters(): void {
    const formValues = this.filterForm.value;
    
    const filters: TransactionFilters = {
      startDate: formValues.startDate ? formValues.startDate.toISOString() : undefined,
      endDate: formValues.endDate ? formValues.endDate.toISOString() : undefined,
      category: formValues.categories?.length ? formValues.categories.join(',') : undefined,
      type: formValues.types?.length ? formValues.types[0] : undefined,
      paymentMethod: formValues.paymentMethods?.length ? formValues.paymentMethods.join(',') : undefined,
      status: formValues.status?.length ? formValues.status[0] : undefined,
      minAmount: formValues.minAmount || undefined,
      maxAmount: formValues.maxAmount || undefined,
      tags: formValues.tags ? formValues.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t) : undefined,
    } as TransactionFilters;
    
    this.filtersChanged.emit(filters);
  }

  clearFilters(): void {
    this.filterForm.reset({
      dateRange: 'thisMonth'
    });
    
    const mockMatSelect = { value: 'thisMonth' } as any;
    this.onDateRangePresetChange(new MatSelectChange(mockMatSelect, 'thisMonth'));
    
    this.filtersCleared.emit();
  }

  private applyFiltersToForm(filters: TransactionFilters): void {
    // Convert API filter model to form model
    const formValues: any = {
      searchTerm: '',
      dateRange: 'custom', // Default to custom if dates are specified
      startDate: filters.startDate ? new Date(filters.startDate) : null,
      endDate: filters.endDate ? new Date(filters.endDate) : null,
      types: filters.type ? [filters.type] : [],
      categories: filters.category ? filters.category.split(',') : [],
      paymentMethods: filters.paymentMethod ? filters.paymentMethod.split(',') : [],
      status: filters.status ? [filters.status] : [],
      minAmount: filters.minAmount || null,
      maxAmount: filters.maxAmount || null,
      tags: filters.tags ? filters.tags.join(', ') : ''
    };
    
    this.filterForm.patchValue(formValues);
  }
}
