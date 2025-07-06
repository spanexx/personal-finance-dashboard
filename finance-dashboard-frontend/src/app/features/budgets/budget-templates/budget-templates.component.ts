import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

import { BudgetTemplate } from '../../../shared/models/budget.model';
import { BudgetService } from '../budget.service';
import { 
  MaterialModule,
  MatDialog,
  MatSnackBar
} from '../../../shared/modules';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

export interface BudgetCategory {
  id?: string;
  category?: string;
  name?: string;
  percentage?: number;
  allocated: number;
  spent?: number;
  color?: string;
}

export interface BudgetTemplateData {
  id: string;
  name: string;
  description: string;
  type: 'predefined' | 'custom';
  categories: BudgetCategory[];
  totalPercentage: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
}

@Component({
  selector: 'app-budget-templates',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    ReactiveFormsModule,
    CommonModule,
    MaterialModule
  
  ],
  templateUrl: './budget-templates.component.html',
  styleUrls: ['./budget-templates.component.scss']
})
export class BudgetTemplatesComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('templateDialog') templateDialog!: TemplateRef<any>;

  // Data source for template table
  dataSource = new MatTableDataSource<BudgetTemplateData>();
  displayedColumns: string[] = ['name', 'type', 'categories', 'percentage', 'usage', 'status', 'actions'];
  
  // Form for creating/editing templates
  templateForm: FormGroup;
  isEditMode = false;
  selectedTemplate: BudgetTemplateData | null = null;
  
  // Predefined templates
  predefinedTemplates: BudgetTemplateData[] = [
    {
      id: '1',
      name: '50/30/20 Rule',
      description: 'Allocate 50% to needs, 30% to wants, and 20% to savings',
      type: 'predefined',      categories: [
        { id: '1', name: 'Needs', percentage: 50, allocated: 50, spent: 0, color: '#4CAF50' },
        { id: '2', name: 'Wants', percentage: 30, allocated: 30, spent: 0, color: '#2196F3' },
        { id: '3', name: 'Savings', percentage: 20, allocated: 20, spent: 0, color: '#FF9800' }
      ],
      totalPercentage: 100,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    },
    {
      id: '2',
      name: 'Zero-Based Budget',
      description: 'Every dollar has a purpose - income minus expenses equals zero',
      type: 'predefined',      categories: [
        { id: '1', name: 'Housing', percentage: 35, allocated: 35, spent: 0, color: '#E91E63' },
        { id: '2', name: 'Transportation', percentage: 15, allocated: 15, spent: 0, color: '#9C27B0' },
        { id: '3', name: 'Food', percentage: 12, allocated: 12, spent: 0, color: '#3F51B5' },
        { id: '4', name: 'Utilities', percentage: 8, allocated: 8, spent: 0, color: '#00BCD4' },
        { id: '5', name: 'Insurance', percentage: 10, allocated: 10, spent: 0, color: '#4CAF50' },
        { id: '6', name: 'Savings', percentage: 15, allocated: 15, spent: 0, color: '#FF9800' },
        { id: '7', name: 'Miscellaneous', percentage: 5, allocated: 5, spent: 0, color: '#795548' }
      ],
      totalPercentage: 100,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    },
    {
      id: '3',
      name: 'Envelope Method',
      description: 'Allocate specific amounts to different spending categories',
      type: 'predefined',      categories: [
        { id: '1', name: 'Groceries', percentage: 15, allocated: 15, spent: 0, color: '#4CAF50' },
        { id: '2', name: 'Entertainment', percentage: 10, allocated: 10, spent: 0, color: '#2196F3' },
        { id: '3', name: 'Dining Out', percentage: 8, allocated: 8, spent: 0, color: '#FF9800' },
        { id: '4', name: 'Shopping', percentage: 12, allocated: 12, spent: 0, color: '#E91E63' },
        { id: '5', name: 'Emergency Fund', percentage: 20, allocated: 20, spent: 0, color: '#F44336' },
        { id: '6', name: 'Bills', percentage: 30, allocated: 30, spent: 0, color: '#9C27B0' },
        { id: '7', name: 'Miscellaneous', percentage: 5, allocated: 5, spent: 0, color: '#607D8B' }
      ],
      totalPercentage: 100,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageCount: 0
    }
  ];

  // Available categories for custom templates
  availableCategories = [
    { name: 'Housing', color: '#E91E63' },
    { name: 'Transportation', color: '#9C27B0' },
    { name: 'Food', color: '#3F51B5' },
    { name: 'Groceries', color: '#4CAF50' },
    { name: 'Utilities', color: '#00BCD4' },
    { name: 'Insurance', color: '#FF5722' },
    { name: 'Healthcare', color: '#795548' },
    { name: 'Entertainment', color: '#2196F3' },
    { name: 'Dining Out', color: '#FF9800' },
    { name: 'Shopping', color: '#E91E63' },
    { name: 'Education', color: '#673AB7' },
    { name: 'Savings', color: '#4CAF50' },
    { name: 'Emergency Fund', color: '#F44336' },
    { name: 'Investments', color: '#009688' },
    { name: 'Debt Payment', color: '#FF5722' },
    { name: 'Subscriptions', color: '#607D8B' },
    { name: 'Travel', color: '#FF9800' },
    { name: 'Personal Care', color: '#E91E63' },
    { name: 'Gifts', color: '#9C27B0' },
    { name: 'Miscellaneous', color: '#795548' }
  ];

  constructor(
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private budgetService: BudgetService
  ) {
    this.templateForm = this.createTemplateForm();
  }

  ngOnInit(): void {
    this.loadTemplates();
    this.setupTable();
  }

  private createTemplateForm(): FormGroup {
    return this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      categories: this.fb.array([]),
      isActive: [true]
    });
  }
  private loadTemplates(): void {
    // Load custom templates from service
    this.budgetService.getBudgetTemplates().subscribe(
      (customTemplates: BudgetTemplate[]) => {        const convertedTemplates: BudgetTemplateData[] = customTemplates.map(template => ({
          id: template._id,
          name: template.name,
          description: template.description || '',
          type: 'custom' as const,
          categories: template.categories.map(cat => ({
            category: cat.category,
            percentage: cat.percentage ?? 0,
            allocated: cat.allocated,
            name: cat.category // Assuming category is the name
          })),
          totalPercentage: template.categories.reduce((sum, cat) => sum + (cat.percentage ?? 0), 0),
          isActive: true, // Default to active
          createdAt: template.createdAt,
          updatedAt: template.updatedAt,
          usageCount: template.usageCount || 0
        }));
        
        const allTemplates = [...this.predefinedTemplates, ...convertedTemplates];
        this.dataSource.data = allTemplates;
      },
      error => {
        console.error('Error loading templates:', error);
        this.dataSource.data = this.predefinedTemplates;
      }
    );
  }

  private setupTable(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    
    // Custom filter predicate
    this.dataSource.filterPredicate = (data: BudgetTemplateData, filter: string) => {
      const searchText = filter.toLowerCase();
      return data.name.toLowerCase().includes(searchText) ||
             data.description.toLowerCase().includes(searchText) ||
             data.type.toLowerCase().includes(searchText);
    };
  }

  // Template CRUD operations
  createTemplate(): void {
    this.isEditMode = false;
    this.selectedTemplate = null;
    this.templateForm.reset();
    this.clearCategories();
    this.addCategory(); // Start with one category
    this.dialog.open(this.templateDialog, {
      width: '800px',
      maxHeight: '90vh'
    });
  }

  editTemplate(template: BudgetTemplateData): void {
    if (template.type === 'predefined') {
      this.snackBar.open('Predefined templates cannot be edited', 'Close', { duration: 3000 });
      return;
    }

    this.isEditMode = true;
    this.selectedTemplate = template;
    this.populateForm(template);
    this.dialog.open(this.templateDialog, {
      width: '800px',
      maxHeight: '90vh'
    });
  }

  private populateForm(template: BudgetTemplateData): void {
    this.templateForm.patchValue({
      name: template.name,
      description: template.description,
      isActive: template.isActive
    });

    this.clearCategories();
    template.categories.forEach(category => {
      this.addCategory(category);
    });
  }

  duplicateTemplate(template: BudgetTemplateData): void {
    this.isEditMode = false;
    this.selectedTemplate = null;
    this.templateForm.patchValue({
      name: `${template.name} (Copy)`,
      description: template.description,
      isActive: true
    });

    this.clearCategories();
    template.categories.forEach(category => {
      this.addCategory({ ...category, id: undefined });
    });

    this.dialog.open(this.templateDialog, {
      width: '800px',
      maxHeight: '90vh'
    });
  }

  deleteTemplate(template: BudgetTemplateData): void {
    if (template.type === 'predefined') {
      this.snackBar.open('Predefined templates cannot be deleted', 'Close', { duration: 3000 });
      return;
    }

    if (confirm(`Are you sure you want to delete "${template.name}"?`)) {
      this.budgetService.deleteBudgetTemplate(template.id).subscribe(
        () => {
          this.snackBar.open('Template deleted successfully', 'Close', { duration: 3000 });
          this.loadTemplates();
        },
        error => {
          console.error('Error deleting template:', error);
          this.snackBar.open('Error deleting template', 'Close', { duration: 3000 });
        }
      );
    }
  }
  toggleTemplateStatus(template: BudgetTemplateData): void {
    if (template.type === 'predefined') return;

    const updatedTemplate = { ...template, isActive: !template.isActive };
    
    // Convert to BudgetTemplate format for service
    const serviceTemplate: Partial<BudgetTemplate> = {
      name: updatedTemplate.name,
      description: updatedTemplate.description,
      categories: updatedTemplate.categories.map(cat => ({
        category: cat.category || cat.name || '',
        percentage: cat.percentage ?? 0,
        allocated: cat.allocated || 0
      })),
      usageCount: updatedTemplate.usageCount
    };

    this.budgetService.updateBudgetTemplate(updatedTemplate.id, serviceTemplate).subscribe(
      () => {
        this.snackBar.open(
          `Template ${updatedTemplate.isActive ? 'activated' : 'deactivated'}`,
          'Close',
          { duration: 3000 }
        );
        this.loadTemplates();
      },
      error => {
        console.error('Error updating template status:', error);
        this.snackBar.open('Error updating template status', 'Close', { duration: 3000 });
      }
    );
  }

  // Category management
  get categories(): FormArray {
    return this.templateForm.get('categories') as FormArray;
  }

  addCategory(category?: BudgetCategory): void {
    const categoryForm = this.fb.group({
      name: [category?.name || '', Validators.required],
      allocated: [category?.allocated || 0, [Validators.required, Validators.min(0), Validators.max(100)]],
      color: [category?.color || this.getRandomColor(), Validators.required]
    });

    this.categories.push(categoryForm);
  }

  removeCategory(index: number): void {
    if (this.categories.length > 1) {
      this.categories.removeAt(index);
    } else {
      this.snackBar.open('At least one category is required', 'Close', { duration: 3000 });
    }
  }

  private clearCategories(): void {
    while (this.categories.length > 0) {
      this.categories.removeAt(0);
    }
  }

  private getRandomColor(): string {
    const colors = ['#E91E63', '#9C27B0', '#3F51B5', '#2196F3', '#00BCD4', 
                   '#4CAF50', '#FF9800', '#FF5722', '#795548', '#607D8B'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Form validation and submission
  get totalPercentage(): number {
    return this.categories.controls.reduce((total, control) => {
      return total + (control.get('allocated')?.value || 0);
    }, 0);
  }

  get isPercentageValid(): boolean {
    return this.totalPercentage === 100;
  }

  onSubmit(): void {
    if (this.templateForm.valid && this.isPercentageValid) {
      const formValue = this.templateForm.value;
      const templateData: Partial<BudgetTemplateData> = {
        name: formValue.name,
        description: formValue.description,
        type: 'custom',
        categories: formValue.categories.map((cat: any, index: number) => ({
          id: `cat_${index}`,
          name: cat.name,
          allocated: cat.allocated,
          spent: 0,
          color: cat.color
        })),
        totalPercentage: this.totalPercentage,
        isActive: formValue.isActive,
        usageCount: 0
      };

      if (this.isEditMode && this.selectedTemplate) {
        this.updateTemplate(this.selectedTemplate.id, templateData);
      } else {
        this.createNewTemplate(templateData);
      }
    } else {
      this.markFormGroupTouched();
      if (!this.isPercentageValid) {
        this.snackBar.open('Total allocation must equal 100%', 'Close', { duration: 3000 });
      }
    }
  }
  private createNewTemplate(templateData: Partial<BudgetTemplateData>): void {
    // Convert to BudgetTemplate format for service
    const serviceTemplate: Partial<BudgetTemplate> = {
      name: templateData.name,
      description: templateData.description,
      categories: templateData.categories?.map(cat => ({
        category: cat.category || cat.name || '',
        percentage: cat.percentage ?? 0,
        allocated: cat.allocated || 0
      })) || [],
      usageCount: templateData.usageCount || 0
    };

    this.budgetService.createBudgetTemplate(serviceTemplate).subscribe(
      () => {
        this.snackBar.open('Template created successfully', 'Close', { duration: 3000 });
        this.dialog.closeAll();
        this.loadTemplates();
      },
      error => {
        console.error('Error creating template:', error);
        this.snackBar.open('Error creating template', 'Close', { duration: 3000 });
      }
    );
  }
  private updateTemplate(id: string, templateData: Partial<BudgetTemplateData>): void {
    // Convert to BudgetTemplate format for service
    const serviceTemplate: Partial<BudgetTemplate> = {
      name: templateData.name,
      description: templateData.description,
      categories: templateData.categories?.map(cat => ({
        category: cat.category || cat.name || '',
        percentage: cat.percentage ?? 0,
        allocated: cat.allocated || 0
      })) || [],
      usageCount: templateData.usageCount || 0
    };

    this.budgetService.updateBudgetTemplate(id, serviceTemplate).subscribe(
      () => {
        this.snackBar.open('Template updated successfully', 'Close', { duration: 3000 });
        this.dialog.closeAll();
        this.loadTemplates();
      },
      error => {
        console.error('Error updating template:', error);
        this.snackBar.open('Error updating template', 'Close', { duration: 3000 });
      }
    );
  }

  private markFormGroupTouched(): void {
    Object.keys(this.templateForm.controls).forEach(key => {
      const control = this.templateForm.get(key);
      control?.markAsTouched();
      
      if (control instanceof FormArray) {
        control.controls.forEach(nestedControl => {
          if (nestedControl instanceof FormGroup) {
            Object.keys(nestedControl.controls).forEach(nestedKey => {
              nestedControl.get(nestedKey)?.markAsTouched();
            });
          }
        });
      }
    });
  }
  // Helper methods for type conversion
  private convertBudgetCategoryToTemplate(category: BudgetCategory): { category: string; percentage: number; allocated: number; } {
    return {
      category: category.category || category.name || '',
      percentage: category.percentage ?? 0,
      allocated: category.allocated || 0
    };
  }

  private convertBudgetTemplateDataToTemplate(data: BudgetTemplateData): Partial<BudgetTemplate> {
    return {
      name: data.name,
      description: data.description,
      categories: data.categories.map(cat => this.convertBudgetCategoryToTemplate(cat)),
      usageCount: data.usageCount
    };
  }

  // Utility methods
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }
  getCategoryNames(categories: BudgetCategory[]): string {
    return categories.map(cat => cat.name || cat.category || 'Unnamed').join(', ');
  }

  exportTemplate(template: BudgetTemplateData): void {
    const exportData = {
      ...template,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `budget-template-${template.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  importTemplate(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const templateData = JSON.parse(e.target?.result as string);
          // Validate and create template
          this.createNewTemplate({
            ...templateData,
            name: `${templateData.name} (Imported)`,
            type: 'custom',
            usageCount: 0
          });
        } catch (error) {
          console.error('Error importing template:', error);
          this.snackBar.open('Error importing template file', 'Close', { duration: 3000 });
        }
      };
      
      reader.readAsText(file);
    }
  }  useTemplate(template: BudgetTemplateData): void {
    // Convert BudgetTemplateData to BudgetTemplate for the service
    const budgetTemplate: Partial<BudgetTemplate> = {
      _id: template.id,
      name: template.name,
      description: template.description,
      categories: template.categories.map(cat => ({
        category: cat.category || cat.name || '',
        percentage: cat.percentage ?? 0,
        allocated: cat.allocated || 0
      })),
      usageCount: template.usageCount,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt
    };
    
    // Navigate to budget wizard with pre-selected template
    this.budgetService.setSelectedTemplate(budgetTemplate as BudgetTemplate);
    // Navigation logic would be handled by router
    this.snackBar.open(`Template "${template.name}" selected for budget creation`, 'Close', { duration: 3000 });
  }

  cancelDialog(): void {
    this.dialog.closeAll();
  }
}
