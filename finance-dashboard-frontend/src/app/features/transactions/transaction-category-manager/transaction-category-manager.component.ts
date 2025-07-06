import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Category, CreateCategoryRequest, UpdateCategoryRequest } from '../../../shared/models/category.model';
import { CategoryService } from '../../../core/services/category.service';
import { AccessibilityService } from '../../../shared/services/accessibility.service';
import { FocusTrapDirective } from '../../../shared/directives/focus-trap.directive';
import { CreateCategoryModalComponent } from '../create-category-modal/create-category-modal.component';

@Component({
  selector: 'app-transaction-category-manager',
  templateUrl: './transaction-category-manager.component.html',
  styleUrl: './transaction-category-manager.component.scss',
  host: { role: 'main' }
})
export class TransactionCategoryManagerComponent implements OnInit, AfterViewInit {
  categoryForm!: FormGroup;
  categories: Category[] = [];
  expenseCategories: Category[] = [];
  incomeCategories: Category[] = [];
  isLoading = true;
  isSubmitting = false;
  editingCategory: Category | null = null;
  iconList: string[] = [
    'shopping_cart', 'restaurant', 'directions_car', 'home', 'movie',
    'local_hospital', 'power', 'shopping_bag', 'payments', 'school',
    'flight', 'fitness_center', 'pets', 'child_care', 'wifi',
    'local_bar', 'sports_esports', 'card_giftcard', 'commute', 'savings'
  ];
  colorOptions: string[] = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
    '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50',
    '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800',
    '#ff5722', '#795548', '#9e9e9e', '#607d8b'
  ];
  selectedColor: string = this.colorOptions[0];
  selectedIcon: string = this.iconList[0];
  @ViewChild('firstField') firstField!: ElementRef;

  constructor(
    private fb: FormBuilder,
    private categoryService: CategoryService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private accessibilityService: AccessibilityService
  ) {
    this.createForm();
  }

  ngOnInit(): void {
    this.loadCategories();
  }
  ngAfterViewInit(): void {
    setTimeout(() => {
      if (this.firstField) {
        this.firstField.nativeElement.focus();
      }
    }, 100);
  }

  createForm(): void {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      type: ['expense', Validators.required],
      color: [this.selectedColor, [Validators.required, Validators.pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)]],
      icon: [this.selectedIcon, [Validators.required, Validators.maxLength(50), Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
      description: ['', Validators.maxLength(500)],
      parent: [null],
      sortOrder: [0],
      budgetAllocation: [0],
      isActive: [true]
    });
  }

  loadCategories(): void {
    this.isLoading = true;
    this.accessibilityService.announceOperationStatus('Category loading', 'started');
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.expenseCategories = categories.filter(c => c.type === 'expense');
        this.incomeCategories = categories.filter(c => c.type === 'income');
        this.isLoading = false;
        const totalCount = categories.length;
        this.accessibilityService.announceSuccess(`Loaded ${totalCount} categories successfully`);
      },
      error: (error) => {
        this.accessibilityService.announceError('Failed to load categories');
        this.snackBar.open('Failed to load categories', 'Close', { duration: 3000 });
        this.isLoading = false;
        console.error('Error fetching categories:', error);
      }
    });
  }

  selectColor(color: string): void {
    this.selectedColor = color;
    this.categoryForm.get('color')?.setValue(color);
    const colorIndex = this.colorOptions.indexOf(color) + 1;
    this.accessibilityService.announce(`Selected color ${colorIndex} of ${this.colorOptions.length}, ${color}`);
  }

  selectIcon(icon: string): void {
    this.selectedIcon = icon;
    this.categoryForm.get('icon')?.setValue(icon);
    const iconIndex = this.iconList.indexOf(icon) + 1;
    this.accessibilityService.announce(`Selected icon ${iconIndex} of ${this.iconList.length}, ${icon}`);
  }

  editCategory(category: Category): void {
    this.editingCategory = category;
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
    this.selectedColor = category.color;
    this.selectedIcon = category.icon;
    this.accessibilityService.announce(`Editing category ${category.name}. Form fields have been populated with current values.`);
    setTimeout(() => {
      if (this.firstField) {
        this.firstField.nativeElement.focus();
      }
    }, 100);
  }

  cancelEdit(): void {
    const categoryName = this.editingCategory?.name;
    this.editingCategory = null;
    this.resetForm();
    this.accessibilityService.announce(`Cancelled editing ${categoryName || 'category'}. Form has been reset for creating a new category.`);
    setTimeout(() => {
      if (this.firstField) {
        this.firstField.nativeElement.focus();
      }
    }, 100);
  }

  resetForm(): void {
    this.categoryForm.reset({
      name: '',
      type: 'expense',
      color: this.colorOptions[0],
      icon: this.iconList[0],
      description: '',
      parent: null,
      sortOrder: 0,
      budgetAllocation: 0,
      isActive: true
    });
    this.selectedColor = this.colorOptions[0];
    this.selectedIcon = this.iconList[0];
  }

  deleteCategory(category: Category): void {
    const categoryName = category.name;
    const confirmationMessage = `Are you sure you want to delete category "${categoryName}"? This will affect all transactions using this category.`;
    this.accessibilityService.announce(`Confirming deletion of category ${categoryName}`);
    if (confirm(confirmationMessage)) {
      this.accessibilityService.announceOperationStatus(`Deleting category ${categoryName}`, 'started');
      this.categoryService.deleteCategory(category._id).subscribe({
        next: () => {
          this.accessibilityService.announceSuccess(`Category ${categoryName} deleted successfully`);
          this.snackBar.open('Category deleted successfully', 'Close', { duration: 3000 });
          this.loadCategories();
        },
        error: (error) => {
          this.accessibilityService.announceError(`An error occurred while deleting category ${categoryName}`);
          this.snackBar.open('An error occurred while deleting the category', 'Close', { duration: 3000 });
          console.error('Error deleting category:', error);
        }
      });
    } else {
      this.accessibilityService.announce(`Deletion of category ${categoryName} cancelled`);
    }
  }

  onSubmit(): void {
    if (this.categoryForm.invalid) {
      Object.keys(this.categoryForm.controls).forEach(key => {
        const control = this.categoryForm.get(key);
        control?.markAsTouched();
      });
      this.accessibilityService.announceError('Please correct the form errors before submitting');
      const firstInvalidControl = Object.keys(this.categoryForm.controls)
        .find(key => this.categoryForm.get(key)?.invalid);
      if (firstInvalidControl) {
        const element = document.querySelector(`[formControlName="${firstInvalidControl}"]`);
        (element as HTMLElement)?.focus();
      }
      return;
    }
    this.isSubmitting = true;
    const formData = this.categoryForm.value;
    if (this.editingCategory) {
      this.accessibilityService.announceOperationStatus('Category update', 'started');
      const updateData: UpdateCategoryRequest = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        color: formData.color,
        icon: formData.icon,
        parent: formData.parent,
        sortOrder: formData.sortOrder,
        budgetAllocation: formData.budgetAllocation,
        isActive: formData.isActive
      };
      this.categoryService.updateCategory(this.editingCategory._id, updateData).subscribe({
        next: () => {
          this.accessibilityService.announceSuccess('Category updated successfully');
          this.snackBar.open('Category updated successfully', 'Close', { duration: 3000 });
          this.isSubmitting = false;
          this.loadCategories();
          this.cancelEdit();
        },
        error: (error) => {
          this.accessibilityService.announceError('Error updating category');
          this.snackBar.open('Error updating category', 'Close', { duration: 3000 });
          this.isSubmitting = false;
          console.error('Error updating category:', error);
        }
      });
    } else {
      this.accessibilityService.announceOperationStatus('Category creation', 'started');
      const createData: CreateCategoryRequest = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        color: formData.color ? formData.color.toUpperCase() : undefined,
        icon: formData.icon,
        sortOrder: formData.sortOrder,
        budgetAllocation: formData.budgetAllocation
      };
      // Only include parent if it is a non-empty, valid ObjectId string
      if (formData.parent && typeof formData.parent === 'string' && /^[a-fA-F0-9]{24}$/.test(formData.parent)) {
        createData.parent = formData.parent;
      }
      this.categoryService.createCategory(createData).subscribe({
        next: () => {
          this.accessibilityService.announceSuccess('Category created successfully');
          this.snackBar.open('Category created successfully', 'Close', { duration: 3000 });
          this.isSubmitting = false;
          this.loadCategories();
          this.resetForm();
          setTimeout(() => {
            if (this.firstField) {
              this.firstField.nativeElement.focus();
            }
          }, 100);
        },
        error: (error) => {
          this.accessibilityService.announceError('Error creating category');
          this.snackBar.open('Error creating category', 'Close', { duration: 3000 });
          this.isSubmitting = false;
          console.error('Error creating category:', error);
        }
      });
    }
  }

  // Accessibility: Keyboard navigation for color options
  onColorKeydown(event: KeyboardEvent, color: string, index: number): void {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.selectColor(color);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        this.focusNextColor(index);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        this.focusPreviousColor(index);
        break;
      case 'Home':
        event.preventDefault();
        this.focusColor(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusColor(this.colorOptions.length - 1);
        break;
    }
  }

  // Accessibility: Keyboard navigation for icon options
  onIconKeydown(event: KeyboardEvent, icon: string, index: number): void {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.selectIcon(icon);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        this.focusNextIcon(index);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        this.focusPreviousIcon(index);
        break;
      case 'Home':
        event.preventDefault();
        this.focusIcon(0);
        break;
      case 'End':
        event.preventDefault();
        this.focusIcon(this.iconList.length - 1);
        break;
    }
  }

  private focusColor(index: number): void {
    const colorElements = document.querySelectorAll('.color-option');
    if (colorElements[index]) {
      (colorElements[index] as HTMLElement).focus();
    }
  }

  private focusNextColor(currentIndex: number): void {
    const nextIndex = currentIndex < this.colorOptions.length - 1 ? currentIndex + 1 : 0;
    this.focusColor(nextIndex);
  }

  private focusPreviousColor(currentIndex: number): void {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : this.colorOptions.length - 1;
    this.focusColor(prevIndex);
  }

  private focusIcon(index: number): void {
    const iconElements = document.querySelectorAll('.icon-option');
    if (iconElements[index]) {
      (iconElements[index] as HTMLElement).focus();
    }
  }

  private focusNextIcon(currentIndex: number): void {
    const nextIndex = currentIndex < this.iconList.length - 1 ? currentIndex + 1 : 0;
    this.focusIcon(nextIndex);
  }

  private focusPreviousIcon(currentIndex: number): void {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : this.iconList.length - 1;
    this.focusIcon(prevIndex);
  }
  goBack(): void {
    this.router.navigate(['/transactions']);
  }

  openCreateCategoryModal(): void {
    console.log('Attempting to open CreateCategoryModalComponent');
    const dialogRef = this.dialog.open(CreateCategoryModalComponent, {
      width: '400px',
      data: { isEdit: false }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) { // result will be the created category object
        this.loadCategories();
        this.snackBar.open('Category created successfully', 'Close', { duration: 3000 });
      }
    });
  }
}
