import { Component, Inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ExportImportService, ImportOptions, ImportResult } from '../../../../core/services/export-import.service';

@Component({
  selector: 'app-import-dialog',
  templateUrl: './import-dialog.component.html',
  styleUrls: ['./import-dialog.component.scss']
})
export class ImportDialogComponent implements OnInit {
  importForm: FormGroup;
  selectedFile: File | null = null;
  isValidating = false;
  isImporting = false;
  @ViewChild('fileInput') fileInput!: ElementRef;
  validationResult: {
    format?: string;
    recordsCount?: number;
    validRecords?: number;
    errors?: Array<{message: string; row?: number}>;
    warnings?: Array<{message: string; row?: number}>;
  } | null = null;
  importResult: ImportResult | null = null;
  importOptions: Array<{id: string; name: string; formats: string[]}> = [];
  errorMessage: string | null = null;
  importTypes = [
    { value: 'transactions', label: 'Transactions' },
    { value: 'categories', label: 'Categories' },
    { value: 'budgets', label: 'Budgets' },
    { value: 'goals', label: 'Goals' }
  ];
  currentStep = 1; // 1: Select File, 2: Validate
  
  openFileDialog(): void {
    this.fileInput.nativeElement.click();
  }

  constructor(
    private dialogRef: MatDialogRef<ImportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder,
    private exportImportService: ExportImportService
  ) {
    this.importForm = this.fb.group({
      type: ['transactions', Validators.required],
      file: [null, Validators.required],
      updateExisting: [false],
      skipErrors: [false],
      dateFormat: ['YYYY-MM-DD']
    });
    
    // If data contains type, preset it
    if (data && data.type) {
      this.importForm.get('type')?.setValue(data.type);
    }
  }

  ngOnInit(): void {
    this.loadImportOptions();
  }

  loadImportOptions(): void {
    this.exportImportService.getImportOptions().subscribe({
      next: (options: any) => {
        this.importOptions = options;
      },
      error: (error: Error) => {
        this.errorMessage = 'Failed to load import options: ' + error.message;
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.selectedFile = input.files[0];
      this.importForm.patchValue({ file: this.selectedFile });
    }
  }

  validateFile(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Please select a file to import.';
      return;
    }

    this.isValidating = true;
    this.errorMessage = null;
    
    this.exportImportService.validateImportFile(
      this.selectedFile,
      this.importForm.get('type')?.value
    ).subscribe({
      next: (result: any) => {
        this.validationResult = result;
        this.isValidating = false;
        this.currentStep = 3; // Move to options step
      },
      error: (error: Error) => {
        this.errorMessage = 'Validation failed: ' + error.message;
        this.isValidating = false;
      }
    });
  }

  importFile(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Please select a file to import.';
      return;
    }

    this.isImporting = true;
    this.errorMessage = null;
    
    const options: ImportOptions = {
      type: this.importForm.get('type')?.value as 'transactions' | 'budgets' | 'goals' | 'categories',
      options: {
        updateExisting: this.importForm.get('updateExisting')?.value,
        skipErrors: this.importForm.get('skipErrors')?.value,
        dateFormat: this.importForm.get('dateFormat')?.value
      }
    };

    this.exportImportService.importData(this.selectedFile, options).subscribe({
      next: (result: ImportResult) => {
        this.importResult = result;
        this.isImporting = false;
        this.currentStep = 4; // Move to results step
      },
      error: (error: Error) => {
        this.errorMessage = 'Import failed: ' + error.message;
        this.isImporting = false;
      }
    });
  }

  nextStep(): void {
    if (this.currentStep === 1) {
      this.validateFile();
    } else if (this.currentStep === 3) {
      this.importFile();
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  close(): void {
    this.dialogRef.close(this.importResult);
  }

  get fileInputLabel(): string {
    return this.selectedFile ? this.selectedFile.name : 'Choose file';
  }

  getObjectKeys(obj: Record<string, unknown>): string[] {
    return obj ? Object.keys(obj) : [];
  }
}
