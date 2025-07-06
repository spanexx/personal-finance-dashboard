import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// Angular Material imports
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatNativeDateModule } from '@angular/material/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';

// Services
import { UserProfileService } from '../../../core/services/user-profile.service';

// Models
export interface DataExportRequest {
  format: 'json' | 'csv' | 'pdf';
  categories: string[];
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  includeAttachments: boolean;
  email?: string;
  reason?: string;
}

export interface ExportCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  estimatedSize?: string;
  enabled: boolean;
}

interface DataExportDialogData {
  userEmail?: string;
}

@Component({
  selector: 'app-data-export-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatStepperModule,
    MatCardModule,
    MatListModule,
    MatDividerModule,
    MatChipsModule,
    MatNativeDateModule,
    MatExpansionModule,
    MatTooltipModule
  ],
  templateUrl: './data-export-dialog.component.html',
  styleUrls: ['./data-export-dialog.component.scss']
})
export class DataExportDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  exportForm: FormGroup;
  loading = false;
  error: string | null = null;
  currentStep = 0;
  maxDate = new Date();
  minDate = new Date(2020, 0, 1); // Minimum date for data export

  // Properties referenced in template
  get dataCategories() {
    return this.exportCategories;
  }
  get dataTypesArray(): FormArray {
    return this.exportForm.get('categories') as FormArray;
  }

  getCategoryControl(index: number): FormControl {
    return this.dataTypesArray.at(index) as FormControl;
  }

  get selectedDataTypes(): ExportCategory[] {
    return this.exportCategories.filter((_, index) => 
      this.categoriesFormArray.at(index).value
    );
  }

  exportCategories: ExportCategory[] = [
    {
      id: 'profile',
      name: 'Profile Data',
      description: 'Personal information, preferences, and account settings',
      icon: 'person',
      estimatedSize: '< 1 MB',
      enabled: true
    },
    {
      id: 'transactions',
      name: 'Transaction History',
      description: 'All your financial transactions and related data',
      icon: 'receipt',
      estimatedSize: '5-50 MB',
      enabled: true
    },
    {
      id: 'budgets',
      name: 'Budget Data',
      description: 'Budget plans, allocations, and tracking history',
      icon: 'account_balance_wallet',
      estimatedSize: '< 5 MB',
      enabled: true
    },
    {
      id: 'goals',
      name: 'Financial Goals',
      description: 'Savings goals, progress tracking, and achievements',
      icon: 'flag',
      estimatedSize: '< 1 MB',
      enabled: true
    },
    {
      id: 'categories',
      name: 'Categories & Tags',
      description: 'Custom categories, tags, and classification rules',
      icon: 'label',
      estimatedSize: '< 1 MB',
      enabled: true
    },
    {
      id: 'reports',
      name: 'Reports & Analytics',
      description: 'Generated reports, insights, and analytical data',
      icon: 'analytics',
      estimatedSize: '1-10 MB',
      enabled: true
    },
    {
      id: 'attachments',
      name: 'File Attachments',
      description: 'Receipt images, documents, and other uploaded files',
      icon: 'attach_file',
      estimatedSize: '10-500 MB',
      enabled: false
    }
  ];

  exportFormats = [
    { value: 'json', label: 'JSON', description: 'Machine-readable format, best for data migration' },
    { value: 'csv', label: 'CSV', description: 'Spreadsheet format, good for analysis' },
    { value: 'pdf', label: 'PDF', description: 'Human-readable format, good for archival' }
  ];  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<DataExportDialogComponent>,
    private userProfileService: UserProfileService,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: DataExportDialogData
  ) {
    this.exportForm = this.createExportForm();
  }

  ngOnInit(): void {
    this.setupFormValidation();
    this.loadUserPreferences();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  private createExportForm(): FormGroup {
    return this.fb.group({
      format: ['json', [Validators.required]],
      categories: this.fb.array(
        this.exportCategories.map(cat => this.fb.control(cat.enabled))
      ),
      dateRange: this.fb.group({
        enabled: [false],
        startDate: [null],
        endDate: [null]
      }),
      includeAttachments: [false],
      email: ['', [Validators.email]],
      reason: ['']
    });
  }
  private setupFormValidation(): void {
    // Date range validation
    this.exportForm.get('dateRange.enabled')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(enabled => {
        const startDateControl = this.exportForm.get('dateRange.startDate');
        const endDateControl = this.exportForm.get('dateRange.endDate');
        
        if (enabled) {
          startDateControl?.setValidators([Validators.required]);
          endDateControl?.setValidators([Validators.required]);
        } else {
          startDateControl?.clearValidators();
          endDateControl?.clearValidators();
        }
        
        startDateControl?.updateValueAndValidity();
        endDateControl?.updateValueAndValidity();
      });

    // Categories validation - at least one must be selected
    this.categoriesFormArray.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(values => {
        const hasSelection = values.some((selected: boolean) => selected);
        if (!hasSelection) {
          this.categoriesFormArray.setErrors({ noSelection: true });
        } else {
          this.categoriesFormArray.setErrors(null);
        }
      });
  }

  private loadUserPreferences(): void {
    this.userProfileService.getProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (profile) => {
          if (profile.email) {
            this.exportForm.patchValue({ email: profile.email });
          }
        },
        error: (error) => {
          console.warn('Could not load user preferences:', error);
        }
      });
  }
  get categoriesFormArray(): FormArray {
    return this.exportForm.get('categories') as FormArray;
  }

  getSelectedCategories(): ExportCategory[] {
    return this.exportCategories.filter((_, index) => 
      this.categoriesFormArray.at(index).value
    );
  }

  getEstimatedSize(): string {
    const selectedCategories = this.getSelectedCategories();
    if (selectedCategories.length === 0) return '0 MB';
    
    // Simple estimation logic - in practice, this would come from the backend
    let totalSizeMB = 0;
    selectedCategories.forEach(cat => {
      const sizeStr = cat.estimatedSize || '< 1 MB';
      if (sizeStr.includes('500')) totalSizeMB += 250; // Average for 10-500 MB
      else if (sizeStr.includes('50')) totalSizeMB += 25; // Average for 5-50 MB
      else if (sizeStr.includes('10')) totalSizeMB += 5; // Average for 1-10 MB
      else totalSizeMB += 0.5; // For < 1 MB categories
    });
    
    if (totalSizeMB < 1) return '< 1 MB';
    if (totalSizeMB > 1000) return `${(totalSizeMB / 1000).toFixed(1)} GB`;
    return `${totalSizeMB.toFixed(0)} MB`;
  }

  onCategoryToggle(index: number): void {
    const control = this.categoriesFormArray.at(index);
    control.setValue(!control.value);
  }

  isCategorySelected(index: number): boolean {
    return this.categoriesFormArray.at(index).value;
  }

  canProceedToNext(): boolean {
    switch (this.currentStep) {
      case 0: // Format selection
        return this.exportForm.get('format')?.valid || false;
      case 1: // Category selection
        return this.getSelectedCategories().length > 0;
      case 2: // Options
        return this.exportForm.valid;
      default:
        return false;
    }
  }

  nextStep(): void {
    if (this.canProceedToNext() && this.currentStep < 3) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }  onSubmit(): void {
    if (!this.exportForm.valid) {
      this.markFormGroupTouched();
      return;
    }

    const formValue = this.exportForm.value;
    const selectedCategoryIds = this.exportCategories
      .filter((_, index) => this.categoriesFormArray.at(index).value)
      .map(cat => cat.id);

    const exportRequest: DataExportRequest = {
      format: formValue.format,
      categories: selectedCategoryIds,
      includeAttachments: formValue.includeAttachments,
      email: formValue.email,
      reason: formValue.reason || 'User data export request'
    };

    if (formValue.dateRange?.enabled) {
      exportRequest.dateRange = {
        startDate: formValue.dateRange.startDate,
        endDate: formValue.dateRange.endDate
      };
    }

    this.loading = true;
    this.error = null;

    this.userProfileService.requestDataExport(exportRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.loading = false;
          this.snackBar.open(
            'Data export request submitted successfully. You will receive an email when ready.',
            'Close',
            { 
              duration: 5000,
              panelClass: ['success-snackbar']
            }
          );
          this.dialogRef.close(response);
        },
        error: (error: any) => {
          this.loading = false;
          this.error = error.message || 'Failed to submit export request';
          this.snackBar.open(
            this.error || 'Failed to submit export request',
            'Close',
            { 
              duration: 5000,
              panelClass: ['error-snackbar']
            }
          );
        }
      });
  }
  onCancel(): void {
    this.dialogRef.close();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.exportForm.controls).forEach(key => {
      const control = this.exportForm.get(key);
      control?.markAsTouched();
    });
  }

  getStepTitle(): string {
    switch (this.currentStep) {
      case 0: return 'Choose Export Format';
      case 1: return 'Select Data Categories';
      case 2: return 'Configure Options';
      case 3: return 'Review & Submit';
      default: return 'Data Export';
    }
  }

  getStepDescription(): string {
    switch (this.currentStep) {
      case 0: return 'Select the format for your exported data';
      case 1: return 'Choose which types of data to include';
      case 2: return 'Set date ranges and additional options';
      case 3: return 'Review your selections and submit the request';
      default: return '';
    }
  }

  // Accessibility methods
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.onCancel();
    }
  }

  focusFirstInvalidField(): void {
    const firstInvalidControl = Object.keys(this.exportForm.controls)
      .find(key => this.exportForm.get(key)?.invalid);
    
    if (firstInvalidControl) {
      const element = document.querySelector(`[formControlName="${firstInvalidControl}"]`) as HTMLElement;
      element?.focus();
    }
  }

  getFieldError(fieldName: string): string | null {
    const field = this.exportForm.get(fieldName);
    if (!field?.errors || !field.touched) return null;

    if (field.errors['required']) return `${this.getFieldLabel(fieldName)} is required`;
    if (field.errors['email']) return 'Please enter a valid email address';
    if (field.errors['noSelection']) return 'Please select at least one data category';

    return 'Invalid input';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      format: 'Export format',
      startDate: 'Start date',
      endDate: 'End date',
      email: 'Email address',
      categories: 'Data categories'
    };
    return labels[fieldName] || fieldName;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.exportForm.get(fieldName);
    return !!(field?.invalid && field?.touched);
  }

  // Helper method for progress indicator
  getStepProgress(): number {
    return ((this.currentStep + 1) / 4) * 100;
  }

  // Format helper for display
  formatSelectedCategories(): string {
    const selected = this.getSelectedCategories();
    if (selected.length === 0) return 'None selected';
    if (selected.length === 1) return selected[0].name;
    if (selected.length === this.exportCategories.length) return 'All categories';
    return `${selected.length} categories selected`;
  }

  formatDateRange(): string {
    const useDateRange = this.exportForm.get('useDateRange')?.value;
    if (!useDateRange) return 'All available data';
    
    const startDate = this.exportForm.get('startDate')?.value;
    const endDate = this.exportForm.get('endDate')?.value;
    
    if (!startDate || !endDate) return 'Date range not set';
    
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  }

  getSelectedFormatDescription(): string {
    const selectedFormat = this.exportFormats.find(f => f.value === this.exportForm.get('format')?.value);
    return selectedFormat?.description || '';
  }

  getEstimatedFileSize(): string {
    return this.getEstimatedSize();
  }

  selectAllDataTypes(): void {
    this.categoriesFormArray.controls.forEach(control => control.setValue(true));
  }

  selectNoneDataTypes(): void {
    this.categoriesFormArray.controls.forEach(control => control.setValue(false));
  }
}
