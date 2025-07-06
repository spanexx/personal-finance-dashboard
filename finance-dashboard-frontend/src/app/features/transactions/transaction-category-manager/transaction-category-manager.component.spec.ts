import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog'; // MatDialog is injected in component
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { TransactionCategoryManagerComponent } from './transaction-category-manager.component';
import { TransactionService, Category } from '../services/transaction.service'; // Category is also exported here
import { AccessibilityService } from '../../../shared/services/accessibility.service';

// Import Material modules used by the component's template
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list'; // Assuming it might use mat-list for categories
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner'; // If loading spinner is used

// Mock services
class MockAccessibilityService {
  announce = jest.fn();
  announceError = jest.fn();
  announceOperationStatus = jest.fn();
  announceSuccess = jest.fn();
}

describe('TransactionCategoryManagerComponent', () => {
  let component: TransactionCategoryManagerComponent;
  let fixture: ComponentFixture<TransactionCategoryManagerComponent>;
  let mockTransactionService: Partial<TransactionService>;
  let mockAccessibilityService: MockAccessibilityService;
  let mockSnackBar: Partial<MatSnackBar>;
  let mockRouter: Partial<Router>;
  let mockMatDialog: Partial<MatDialog>;


  const mockCategories: Category[] = [
    { id: '1', _id: '1', name: 'Food', type: 'expense', icon: 'fastfood', color: '#FF0000', isDefault: false, user: 'u1' },
    { id: '2', _id: '2', name: 'Salary', type: 'income', icon: 'work', color: '#00FF00', isDefault: false, user: 'u1' },
  ];

  beforeEach(async () => {
    mockTransactionService = {
      getCategories: jest.fn().mockReturnValue(of(mockCategories)),
      createCategory: jest.fn().mockReturnValue(of(mockCategories[0])),
      updateCategory: jest.fn().mockReturnValue(of(mockCategories[0])),
      deleteCategory: jest.fn().mockReturnValue(of(undefined)),
    };
    mockAccessibilityService = new MockAccessibilityService();
    mockSnackBar = { open: jest.fn() };
    mockRouter = { navigate: jest.fn() }; // Component uses router.navigate for goBack
    mockMatDialog = { open: jest.fn() }; // Component injects MatDialog

    await TestBed.configureTestingModule({
      imports: [
        TransactionCategoryManagerComponent, // Standalone
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatListModule, MatProgressSpinnerModule
      ],
      providers: [
        FormBuilder,
        { provide: TransactionService, useValue: mockTransactionService },
        { provide: AccessibilityService, useValue: mockAccessibilityService },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: Router, useValue: mockRouter },
        { provide: MatDialog, useValue: mockMatDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionCategoryManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // ngOnInit
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load categories on init', () => {
    expect(mockTransactionService.getCategories).toHaveBeenCalled();
    expect(component.categories.length).toBe(2);
    expect(mockAccessibilityService.announceSuccess).toHaveBeenCalledWith('Loaded 2 categories successfully');
  });

  it('should initialize categoryForm', () => {
    expect(component.categoryForm).toBeDefined();
    expect(component.categoryForm.get('name')).toBeDefined();
    expect(component.categoryForm.get('type')).toBeDefined();
  });

  describe('onSubmit - Create Category', () => {
    beforeEach(() => {
      component.editingCategory = null; // Ensure create mode
      component.categoryForm.setValue({
        name: 'New Category', type: 'expense', color: '#FFFFFF', icon: 'add', isDefault: false
      });
    });

    it('should call transactionService.createCategory and reload if form is valid', () => {
      const newCategory = { ...mockCategories[0], id: '3', _id: '3', name: 'New Category' };
      (mockTransactionService.createCategory as jest.Mock).mockReturnValue(of(newCategory));
      jest.spyOn(component, 'loadCategories');
      jest.spyOn(component, 'resetForm');

      component.onSubmit();

      expect(mockTransactionService.createCategory).toHaveBeenCalled();
      expect(mockAccessibilityService.announceSuccess).toHaveBeenCalledWith('Category created successfully');
      expect(mockSnackBar.open).toHaveBeenCalledWith('Category created successfully', 'Close', { duration: 3000 });
      expect(component.loadCategories).toHaveBeenCalled();
      expect(component.resetForm).toHaveBeenCalled();
    });

    it('should handle error if createCategory fails', () => {
      (mockTransactionService.createCategory as jest.Mock).mockReturnValue(throwError(() => new Error('Create failed')));
      component.onSubmit();
      expect(mockAccessibilityService.announceError).toHaveBeenCalledWith('Error creating category');
      expect(mockSnackBar.open).toHaveBeenCalledWith('Error creating category', 'Close', { duration: 3000 });
    });

    it('should not submit if form is invalid', () => {
       component.categoryForm.get('name')?.setValue(''); // make invalid
       component.onSubmit();
       expect(mockTransactionService.createCategory).not.toHaveBeenCalled();
       expect(mockAccessibilityService.announceError).toHaveBeenCalledWith('Please correct the form errors before submitting');
    });
  });

  describe('onSubmit - Update Category', () => {
    beforeEach(() => {
      component.editingCategory = mockCategories[0];
      component.categoryForm.setValue({
        name: 'Updated Food', type: 'expense', color: '#FF0000', icon: 'fastfood', isDefault: false
      });
    });

    it('should call transactionService.updateCategory and reload if form is valid', () => {
      const updatedCategory = { ...mockCategories[0], name: 'Updated Food' };
      (mockTransactionService.updateCategory as jest.Mock).mockReturnValue(of(updatedCategory));
      jest.spyOn(component, 'loadCategories');
      jest.spyOn(component, 'cancelEdit');

      component.onSubmit();

      expect(mockTransactionService.updateCategory).toHaveBeenCalledWith(mockCategories[0].id, component.categoryForm.value);
      expect(mockAccessibilityService.announceSuccess).toHaveBeenCalledWith('Category updated successfully');
      expect(component.loadCategories).toHaveBeenCalled();
      expect(component.cancelEdit).toHaveBeenCalled();
    });
  });

  it('editCategory should populate form and set editingCategory', fakeAsync(() => {
    component.editCategory(mockCategories[0]);
    tick(100); // For setTimeout
    fixture.detectChanges();

    expect(component.editingCategory).toEqual(mockCategories[0]);
    expect(component.categoryForm.get('name')?.value).toBe(mockCategories[0].name);
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith(`Editing category ${mockCategories[0].name}. Form fields have been populated with current values.`);
    // Could also test if focus was called on firstField if it was a real element / spy
  }));

  it('deleteCategory should call service and reload on confirmation', () => {
    window.confirm = jest.fn(() => true);
    jest.spyOn(component, 'loadCategories');

    component.deleteCategory(mockCategories[0]);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockTransactionService.deleteCategory).toHaveBeenCalledWith(mockCategories[0].id);
    expect(mockAccessibilityService.announceSuccess).toHaveBeenCalledWith(`Category ${mockCategories[0].name} deleted successfully`);
    expect(component.loadCategories).toHaveBeenCalled();
  });

  it('deleteCategory should not call service if not confirmed', () => {
    window.confirm = jest.fn(() => false);
    component.deleteCategory(mockCategories[0]);
    expect(mockTransactionService.deleteCategory).not.toHaveBeenCalled();
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith(`Deletion of category ${mockCategories[0].name} cancelled`);
  });

  it('cancelEdit should reset form and editingCategory', fakeAsync(() => {
    component.editingCategory = mockCategories[0];
    component.categoryForm.get('name')?.setValue('Temporary Name');

    component.cancelEdit();
    tick(100); // For setTimeout

    expect(component.editingCategory).toBeNull();
    expect(component.categoryForm.get('name')?.value).toBe(''); // Or default if form reset has defaults
    expect(mockAccessibilityService.announce).toHaveBeenCalled();
  }));

  it('goBack should navigate to /transactions', () => {
    component.goBack();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/transactions']);
  });
});
