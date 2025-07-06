import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TransactionService, Category } from '../services/transaction.service';

export interface CategoryDialogData {
  category?: Category;
  mode: 'create' | 'edit';
}

export interface CategoryIconOption {
  name: string;
  icon: string;
  color: string;
}

// Define TransactionType enum to match the category types
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer'
}

@Component({
  selector: 'app-category-modal',
  templateUrl: './category-modal.component.html',
  styleUrls: ['./category-modal.component.scss']
})
export class CategoryModalComponent implements OnInit {
  categoryForm: FormGroup;
  isLoading = false;
  isEditMode: boolean;

  // Predefined category icons and colors
  categoryIcons: CategoryIconOption[] = [
    { name: 'Food & Dining', icon: 'restaurant', color: '#ff6b6b' },
    { name: 'Transportation', icon: 'directions_car', color: '#4ecdc4' },
    { name: 'Shopping', icon: 'shopping_cart', color: '#45b7d1' },
    { name: 'Entertainment', icon: 'movie', color: '#96ceb4' },
    { name: 'Bills & Utilities', icon: 'receipt', color: '#feca57' },
    { name: 'Healthcare', icon: 'local_hospital', color: '#ff9ff3' },
    { name: 'Education', icon: 'school', color: '#54a0ff' },
    { name: 'Travel', icon: 'flight', color: '#5f27cd' },
    { name: 'Gas', icon: 'local_gas_station', color: '#00d2d3' },
    { name: 'Groceries', icon: 'local_grocery_store', color: '#ff9f43' },
    { name: 'Home', icon: 'home', color: '#ee5a24' },
    { name: 'Salary', icon: 'work', color: '#10ac84' },
    { name: 'Investment', icon: 'trending_up', color: '#2ed573' },
    { name: 'Gift', icon: 'card_giftcard', color: '#a55eea' },
    { name: 'Other', icon: 'category', color: '#8395a7' }
  ];

  selectedIcon: CategoryIconOption | null = null;
  transactionTypes = Object.values(TransactionType);

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CategoryModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CategoryDialogData,
    private transactionService: TransactionService,
    private snackBar: MatSnackBar
  ) {
    this.isEditMode = data.mode === 'edit';
    this.categoryForm = this.createForm();
  }

  ngOnInit(): void {
    if (this.isEditMode && this.data.category) {
      this.populateForm(this.data.category);
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      type: [TransactionType.EXPENSE, Validators.required],
      isActive: [true]
    });
  }

  private populateForm(category: Category): void {
    this.categoryForm.patchValue({
      name: category.name,
      type: category.type,
      isActive: category.isActive !== false
    });

    // Find and select matching icon
    const matchingIcon = this.categoryIcons.find(
      icon => icon.icon === category.icon || icon.name.toLowerCase() === category.name.toLowerCase()
    );
    if (matchingIcon) {
      this.selectedIcon = matchingIcon;
    } else if (category.icon && category.color) {
      // Create custom icon option for existing category
      this.selectedIcon = {
        name: category.name,
        icon: category.icon,
        color: category.color
      };
    }
  }

  selectIcon(icon: CategoryIconOption): void {
    this.selectedIcon = icon;
  }

  onSubmit(): void {
    if (this.categoryForm.valid && this.selectedIcon) {
      this.isLoading = true;
      
      if (this.isEditMode && this.data.category) {
        // Update existing category
        const updateData: Partial<Category> = {
          name: this.categoryForm.value.name,
          type: this.categoryForm.value.type,
          color: this.selectedIcon.color,
          icon: this.selectedIcon.icon,
          isActive: this.categoryForm.value.isActive
        };

        this.transactionService.updateCategory(this.data.category.id, updateData).subscribe({
          next: (result) => {
            this.isLoading = false;
            this.snackBar.open('Category updated successfully', 'Close', { duration: 3000 });
            this.dialogRef.close(result);
          },
          error: (error) => {
            this.isLoading = false;
            console.error('Error updating category:', error);
            this.snackBar.open('Failed to save category. Please try again.', 'Close', { duration: 5000 });
          }
        });
      } else {
        // Create new category
        const createData = {
          name: this.categoryForm.value.name,
          type: this.categoryForm.value.type,
          color: this.selectedIcon.color,
          icon: this.selectedIcon.icon,
          isDefault: false,
          isActive: this.categoryForm.value.isActive
        };

        this.transactionService.createCategory(createData).subscribe({
          next: (result) => {
            this.isLoading = false;
            this.snackBar.open('Category created successfully', 'Close', { duration: 3000 });
            this.dialogRef.close(result);
          },
          error: (error) => {
            this.isLoading = false;
            console.error('Error creating category:', error);
            this.snackBar.open('Failed to save category. Please try again.', 'Close', { duration: 5000 });
          }
        });
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.categoryForm.controls).forEach(key => {
      this.categoryForm.get(key)?.markAsTouched();
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  // Form validation helpers
  isFieldInvalid(fieldName: string): boolean {
    const field = this.categoryForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.categoryForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) {
        return `${this.getFieldDisplayName(fieldName)} is required`;
      }
      if (field.errors['minlength']) {
        return `${this.getFieldDisplayName(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
      if (field.errors['maxlength']) {
        return `${this.getFieldDisplayName(fieldName)} cannot exceed ${field.errors['maxlength'].requiredLength} characters`;
      }
    }
    return '';
  }

  private getFieldDisplayName(fieldName: string): string {
    const fieldNames: { [key: string]: string } = {
      name: 'Category name',
      type: 'Transaction type'
    };
    return fieldNames[fieldName] || fieldName;
  }

  // Preview category appearance
  getPreviewStyle(): any {
    return this.selectedIcon ? {
      'background-color': this.selectedIcon.color,
      'color': 'white'
    } : {};
  }
}
