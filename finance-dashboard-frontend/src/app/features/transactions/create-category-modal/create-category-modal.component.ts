import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CategoryService } from '../../../core/services/category.service';
import { Category, CreateCategoryRequest, UpdateCategoryRequest } from '../../../shared/models/category.model';

export interface CategoryDialogData {
  category?: Category;
  isEdit?: boolean;
}

@Component({
  selector: 'app-create-category-modal',
  templateUrl: './create-category-modal.component.html',
  styleUrls: ['./create-category-modal.component.scss']
})
export class CreateCategoryModalComponent implements OnInit {
  categoryForm!: FormGroup;
  isLoading = false;
  isEdit = false;
  
  // Predefined category icons (Material icon names, not emoji)
  categoryIcons = [
    { icon: 'home', name: 'Home' },
    { icon: 'fastfood', name: 'Food' },
    { icon: 'directions_car', name: 'Transport' },
    { icon: 'work', name: 'Work' },
    { icon: 'local_hospital', name: 'Health' },
    { icon: 'school', name: 'Education' },
    { icon: 'movie', name: 'Entertainment' },
    { icon: 'shopping_bag', name: 'Shopping' },
    { icon: 'flight', name: 'Travel' },
    { icon: 'bolt', name: 'Utilities' },
    { icon: 'attach_money', name: 'Income' },
    { icon: 'card_giftcard', name: 'Gifts' },
    { icon: 'sports_soccer', name: 'Sports' },
    { icon: 'smartphone', name: 'Technology' },
    { icon: 'pets', name: 'Pets' },
    { icon: 'medication', name: 'Medical' },
    { icon: 'local_taxi', name: 'Taxi' },
    { icon: 'local_grocery_store', name: 'Groceries' },
    { icon: 'local_cafe', name: 'Coffee' },
    { icon: 'menu_book', name: 'Books' },
    { icon: 'music_note', name: 'Music' },
    { icon: 'category', name: 'Other' }
  ];
  
  // Predefined category colors
  categoryColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE',
    '#AED6F1', '#A3E4D7', '#D5DBDB', '#FADBD8', '#D6EAF8'
  ];
  
  categoryTypes = [
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expense' },
    { value: 'transfer', label: 'Transfer' }
  ];
  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateCategoryModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CategoryDialogData,
    private categoryService: CategoryService,
    private snackBar: MatSnackBar
  ) {
    this.isEdit = data?.isEdit || false;
  }

  ngOnInit(): void {
    this.initializeForm();
    
    if (this.isEdit && this.data.category) {
      this.populateForm(this.data.category);
    }
  }

  private initializeForm(): void {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      type: ['expense', Validators.required],
      color: ['#FF6B6B', [Validators.required, Validators.pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)]],
      icon: [this.categoryIcons[0].icon, [Validators.required, Validators.maxLength(50), Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
      description: ['', Validators.maxLength(500)],
      parent: [null],
      sortOrder: [0],
      budgetAllocation: [0],
      isActive: [true]
    });
  }

  private populateForm(category: Category): void {
    this.categoryForm.patchValue({
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon,
      description: category.description || '',
      parent: category.parent || null,
      sortOrder: category.sortOrder || 0,
      budgetAllocation: category.budgetAllocation || 0,
      isActive: category.isActive !== false
    });
  }

  onIconSelect(icon: string): void {
    this.categoryForm.patchValue({ icon });
  }

  onColorSelect(color: string): void {
    this.categoryForm.patchValue({ color });
  }

  onSubmit(): void {
    if (this.categoryForm.valid && !this.isLoading) {
      this.isLoading = true;
      const formValue = this.categoryForm.value;
      if (this.isEdit && this.data.category) {
        // Update existing category
        const updateData: UpdateCategoryRequest = {
          name: formValue.name,
          description: formValue.description,
          type: formValue.type,
          color: formValue.color,
          icon: formValue.icon,
          parent: formValue.parent,
          sortOrder: formValue.sortOrder,
          budgetAllocation: formValue.budgetAllocation,
          isActive: formValue.isActive
        };
        this.categoryService.updateCategory(this.data.category._id, updateData).subscribe({
          next: (category) => {
            this.isLoading = false;
            this.snackBar.open('Category updated successfully', 'Close', {
              duration: 3000,
              horizontalPosition: 'end',
              verticalPosition: 'top'
            });
            this.dialogRef.close(category);
          },
          error: (error) => {
            this.isLoading = false;
            console.error('Error updating category:', error);
            this.snackBar.open('Failed to update category', 'Close', {
              duration: 3000,
              horizontalPosition: 'end',
              verticalPosition: 'top'
            });
          }
        });
      } else {
        // Create new category
        const createData: CreateCategoryRequest = {
          name: formValue.name,
          description: formValue.description,
          type: formValue.type,
          color: formValue.color ? formValue.color.toUpperCase() : undefined,
          icon: formValue.icon,
          sortOrder: formValue.sortOrder,
          budgetAllocation: formValue.budgetAllocation
        };
        // Only include parent if it is a non-empty, valid ObjectId string
        if (formValue.parent && typeof formValue.parent === 'string' && /^[a-fA-F0-9]{24}$/.test(formValue.parent)) {
          createData.parent = formValue.parent;
        }
        this.categoryService.createCategory(createData).subscribe({
          next: (category) => {
            this.isLoading = false;
            this.snackBar.open('Category created successfully', 'Close', {
              duration: 3000,
              horizontalPosition: 'end',
              verticalPosition: 'top'
            });
            this.dialogRef.close(category);
          },
          error: (error) => {
            this.isLoading = false;
            console.error('Error creating category:', error);
            this.snackBar.open('Failed to create category', 'Close', {
              duration: 3000,
              horizontalPosition: 'end',
              verticalPosition: 'top'
            });
          }
        });
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.categoryForm.controls).forEach(key => {
      const control = this.categoryForm.get(key);
      control?.markAsTouched();
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getFieldError(fieldName: string): string {
    const control = this.categoryForm.get(fieldName);
    
    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return `${this.getFieldLabel(fieldName)} is required`;
      }
      if (control.errors['minlength']) {
        return `${this.getFieldLabel(fieldName)} must be at least ${control.errors['minlength'].requiredLength} characters`;
      }
      if (control.errors['maxlength']) {
        return `${this.getFieldLabel(fieldName)} cannot exceed ${control.errors['maxlength'].requiredLength} characters`;
      }
    }
    
    return '';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      name: 'Category name',
      type: 'Category type',
      color: 'Color',
      icon: 'Icon',
      description: 'Description'
    };
    
    return labels[fieldName] || fieldName;
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.categoryForm.get(fieldName);
    return !!(control?.invalid && control.touched);
  }

  getSelectedIcon(): string {
    return this.categoryForm.get('icon')?.value || '💡';
  }

  getSelectedColor(): string {
    return this.categoryForm.get('color')?.value || '#FF6B6B';
  }

  getPreviewStyle(): any {
    return {
      'background-color': this.getSelectedColor(),
      'color': 'white'
    };
  }
}
