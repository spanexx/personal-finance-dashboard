import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';

import { MaterialModule, MatSnackBar } from '../../../shared/modules';

import { BudgetService } from '../budget.service';
import { CategoryService } from '../../../core/services/category.service';
import { Budget, CreateBudgetRequest, BudgetTemplate } from '../../../shared/models/budget.model';
import { Category } from '../../../shared/models/category.model';

export interface BudgetTemplateOption {
  id: string;
  name: string;
  description: string;
  type: 'predefined' | 'user' | 'custom';
  allocations: Array<{
    categoryName: string;
    percentage: number;
    color: string;
    icon: string;
  }>;
  totalAmount?: number;
  usageCount?: number;
  lastUsed?: Date;
}

export interface IncomeSource {
  id: string;
  name: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  isActive: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  recommendations: string[];
}

@Component({
  selector: 'app-budget-wizard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DragDropModule,
    MaterialModule
  ],
  templateUrl: './budget-wizard.component.html',
  styleUrls: ['./budget-wizard.component.scss']
})
export class BudgetWizardComponent implements OnInit, OnDestroy {
  @ViewChild('stepper') stepper: any;

  private destroy$ = new Subject<void>();
  
  // Forms for each step
  basicInfoForm!: FormGroup;
  templateForm!: FormGroup;
  incomeForm!: FormGroup;
  categoryForm!: FormGroup;
  settingsForm!: FormGroup;
  reviewForm!: FormGroup;

  // Data
  categories: Category[] = [];
  budgetTemplates: BudgetTemplateOption[] = [];
  selectedTemplate: BudgetTemplateOption | null = null;
  incomeSources: IncomeSource[] = [];
  
  // UI State
  loading = false;
  currentStep = 0;
  validationResults: ValidationResult = {
    isValid: false,
    warnings: [],
    errors: [],
    recommendations: []
  };

  // Predefined templates
  predefinedTemplates: BudgetTemplateOption[] = [
    {
      id: 'zero-based',
      name: 'Zero-Based Budget',
      description: 'Every dollar has a purpose. Allocate all income to specific categories.',
      type: 'predefined',
      allocations: [
        { categoryName: 'Housing', percentage: 25, color: '#2196F3', icon: 'home' },
        { categoryName: 'Transportation', percentage: 15, color: '#4CAF50', icon: 'directions_car' },
        { categoryName: 'Food', percentage: 12, color: '#FF9800', icon: 'restaurant' },
        { categoryName: 'Utilities', percentage: 8, color: '#9C27B0', icon: 'electrical_services' },
        { categoryName: 'Savings', percentage: 20, color: '#795548', icon: 'savings' },
        { categoryName: 'Entertainment', percentage: 10, color: '#E91E63', icon: 'movie' },
        { categoryName: 'Personal Care', percentage: 5, color: '#607D8B', icon: 'spa' },
        { categoryName: 'Miscellaneous', percentage: 5, color: '#757575', icon: 'category' }
      ]
    },
    {
      id: '50-30-20',
      name: '50/30/20 Rule',
      description: '50% needs, 30% wants, 20% savings and debt repayment.',
      type: 'predefined',
      allocations: [
        { categoryName: 'Needs (Housing, Food, Transport)', percentage: 50, color: '#2196F3', icon: 'home' },
        { categoryName: 'Wants (Entertainment, Dining)', percentage: 30, color: '#4CAF50', icon: 'shopping_cart' },
        { categoryName: 'Savings & Debt Payment', percentage: 20, color: '#FF9800', icon: 'savings' }
      ]
    },
    {
      id: 'envelope',
      name: 'Envelope Method',
      description: 'Traditional envelope budgeting with specific allocations for each category.',
      type: 'predefined',
      allocations: [
        { categoryName: 'Housing', percentage: 30, color: '#2196F3', icon: 'home' },
        { categoryName: 'Food & Groceries', percentage: 15, color: '#4CAF50', icon: 'local_grocery_store' },
        { categoryName: 'Transportation', percentage: 15, color: '#FF9800', icon: 'directions_car' },
        { categoryName: 'Utilities', percentage: 10, color: '#9C27B0', icon: 'electrical_services' },
        { categoryName: 'Emergency Fund', percentage: 10, color: '#F44336', icon: 'security' },
        { categoryName: 'Savings', percentage: 10, color: '#795548', icon: 'account_balance' },
        { categoryName: 'Personal & Entertainment', percentage: 10, color: '#E91E63', icon: 'person' }
      ]
    }
  ];

  constructor(
    private fb: FormBuilder,
    private budgetService: BudgetService,
    private categoryService: CategoryService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForms(): void {
    this.basicInfoForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      description: [''],
      period: ['monthly', Validators.required],
      startDate: [new Date(), Validators.required],
      endDate: ['', Validators.required]
    });

    this.templateForm = this.fb.group({
      selectedTemplateId: [''],
      useTemplate: [false]
    });

    this.incomeForm = this.fb.group({
      totalIncome: [0, [Validators.required, Validators.min(1)]],
      incomeSources: this.fb.array([]),
      includeEmergencyFund: [true],
      emergencyFundPercentage: [10, [Validators.min(0), Validators.max(50)]],
      includeSavings: [true],
      savingsPercentage: [20, [Validators.min(0), Validators.max(100)]]
    });

    this.categoryForm = this.fb.group({
      categories: this.fb.array([]),
      allocationType: ['percentage'],
      autoBalance: [true]
    });

    this.settingsForm = this.fb.group({
      alertsEnabled: [true],
      warningThreshold: [80, [Validators.min(50), Validators.max(100)]],
      criticalThreshold: [95, [Validators.min(80), Validators.max(100)]],
      emailNotifications: [true],
      pushNotifications: [true],
      rolloverEnabled: [false],
      maxRolloverPercentage: [25, [Validators.min(0), Validators.max(100)]],
      autoAdjustAllocations: [false]
    });

    this.reviewForm = this.fb.group({
      saveAsTemplate: [false],
      templateName: ['']
    });

    this.basicInfoForm.get('period')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateEndDate());

    this.basicInfoForm.get('startDate')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateEndDate());
  }

  private loadInitialData(): void {
    this.loading = true;
    
    forkJoin({
      categories: this.categoryService.getCategories(),
      userTemplates: this.budgetService.getBudgetTemplates()
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (data) => {
        this.categories = data.categories;
        this.budgetTemplates = [
          ...this.predefinedTemplates,
          ...this.mapUserTemplates(data.userTemplates)
        ];
        
        this.initializeDefaultIncomeSource();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading data:', error);
        this.snackBar.open('Error loading budget data', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  private mapUserTemplates(userTemplates: BudgetTemplate[]): BudgetTemplateOption[] {
    return userTemplates.map(template => ({
      id: template._id,
      name: template.name,
      description: template.description || 'User created template',
      type: 'user' as const,
      allocations: template.categories.map(cat => ({
        categoryName: cat.category,
        percentage: cat.percentage,
        color: this.getCategoryColor(cat.category),
        icon: this.getCategoryIcon(cat.category)
      })),
      totalAmount: template.totalAmount,
      usageCount: template.usageCount,
      lastUsed: template.lastUsed
    }));
  }

  private getCategoryColor(categoryId: string): string {
    const category = this.categories.find(c => c._id === categoryId);
    return category?.color || '#757575';
  }

  private getCategoryIcon(categoryId: string): string {
    const category = this.categories.find(c => c._id === categoryId);
    return category?.icon || 'category';
  }

  private initializeDefaultIncomeSource(): void {
    const incomeSourcesArray = this.incomeForm.get('incomeSources') as FormArray;
    incomeSourcesArray.push(this.createIncomeSourceForm({
      id: 'primary',
      name: 'Primary Income',
      amount: 0,
      frequency: 'monthly',
      isActive: true
    }));
  }

  private createIncomeSourceForm(source: IncomeSource): FormGroup {
    return this.fb.group({
      id: [source.id],
      name: [source.name, Validators.required],
      amount: [source.amount, [Validators.required, Validators.min(0)]],
      frequency: [source.frequency, Validators.required],
      isActive: [source.isActive]
    });
  }

  private updateEndDate(): void {
    const period = this.basicInfoForm.get('period')?.value;
    const startDate = this.basicInfoForm.get('startDate')?.value;
    
    if (period && startDate) {
      const endDate = new Date(startDate);
      
      switch (period) {
        case 'weekly':
          endDate.setDate(endDate.getDate() + 7);
          break;
        case 'monthly':
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case 'quarterly':
          endDate.setMonth(endDate.getMonth() + 3);
          break;
        case 'yearly':
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
      }
      
      endDate.setDate(endDate.getDate() - 1);
      this.basicInfoForm.get('endDate')?.setValue(endDate);
    }
  }

  selectTemplate(template: BudgetTemplateOption): void {
    this.selectedTemplate = template;
    this.templateForm.patchValue({
      selectedTemplateId: template.id,
      useTemplate: true
    });
    
    if (template.type !== 'custom') {
      this.applyTemplateToCategories(template);
    }
  }

  private applyTemplateToCategories(template: BudgetTemplateOption): void {
    const categoriesArray = this.categoryForm.get('categories') as FormArray;
    
    while (categoriesArray.length !== 0) {
      categoriesArray.removeAt(0);
    }
    
    template.allocations.forEach(allocation => {
      const category = this.findOrCreateCategory(allocation.categoryName);
      if (category) {
        categoriesArray.push(this.createCategoryAllocationForm(category, allocation.percentage));
      }
    });
    
    this.calculateTotalIncome();
  }

  private findOrCreateCategory(categoryName: string): Category | null {
    let category = this.categories.find(c => 
      c.name.toLowerCase() === categoryName.toLowerCase()
    );
    
    if (!category) {
      console.warn(`Category '${categoryName}' not found for template`);
      return null;
    }
    
    return category;
  }

  private createCategoryAllocationForm(category: Category, percentage: number = 0): FormGroup {
    return this.fb.group({
      categoryId: [category._id, Validators.required],
      categoryName: [category.name],
      categoryColor: [category.color],
      categoryIcon: [category.icon],
      percentage: [percentage, [Validators.min(0), Validators.max(100)]],
      fixedAmount: [0, [Validators.min(0)]],
      notes: ['']
    });
  }

  addIncomeSource(): void {
    const incomeSourcesArray = this.incomeForm.get('incomeSources') as FormArray;
    const newSource: IncomeSource = {
      id: `source_${Date.now()}`,
      name: '',
      amount: 0,
      frequency: 'monthly',
      isActive: true
    };
    
    incomeSourcesArray.push(this.createIncomeSourceForm(newSource));
  }

  removeIncomeSource(index: number): void {
    const incomeSourcesArray = this.incomeForm.get('incomeSources') as FormArray;
    if (incomeSourcesArray.length > 1) {
      incomeSourcesArray.removeAt(index);
      this.calculateTotalIncome();
    }
  }

  calculateTotalIncome(): void {
    const incomeSourcesArray = this.incomeForm.get('incomeSources') as FormArray;
    let totalMonthlyIncome = 0;
    
    incomeSourcesArray.controls.forEach(control => {
      const amount = control.get('amount')?.value || 0;
      const frequency = control.get('frequency')?.value || 'monthly';
      const isActive = control.get('isActive')?.value;
      
      if (isActive && amount > 0) {
        switch (frequency) {
          case 'weekly':
            totalMonthlyIncome += amount * 4.33;
            break;
          case 'biweekly':
            totalMonthlyIncome += amount * 2.17;
            break;
          case 'monthly':
            totalMonthlyIncome += amount;
            break;
          case 'quarterly':
            totalMonthlyIncome += amount / 3;
            break;
          case 'yearly':
            totalMonthlyIncome += amount / 12;
            break;
        }
      }
    });
    
    this.incomeForm.patchValue({ totalIncome: totalMonthlyIncome });
    this.updateCategoryAllocations();
  }

  addCategoryAllocation(): void {
    const categoriesArray = this.categoryForm.get('categories') as FormArray;
    
    const allocatedCategoryIds = categoriesArray.controls.map(
      control => control.get('categoryId')?.value
    );
    
    const availableCategory = this.categories.find(
      cat => !allocatedCategoryIds.includes(cat._id)
    );
    
    if (availableCategory) {
      categoriesArray.push(this.createCategoryAllocationForm(availableCategory));
    } else {
      this.snackBar.open('All categories have been allocated', 'Close', { duration: 3000 });
    }
  }

  removeCategoryAllocation(index: number): void {
    const categoriesArray = this.categoryForm.get('categories') as FormArray;
    categoriesArray.removeAt(index);
    this.updateCategoryAllocations();
  }

  onCategoryDrop(event: CdkDragDrop<string[]>): void {
    const categoriesArray = this.categoryForm.get('categories') as FormArray;
    const draggedControl = categoriesArray.at(event.previousIndex);
    
    categoriesArray.removeAt(event.previousIndex);
    categoriesArray.insert(event.currentIndex, draggedControl);
  }

  updateCategoryAllocations(): void {
    const totalIncome = this.incomeForm.get('totalIncome')?.value || 0;
    const allocationType = this.categoryForm.get('allocationType')?.value;
    const categoriesArray = this.categoryForm.get('categories') as FormArray;
    
    if (allocationType === 'percentage' && totalIncome > 0) {
      categoriesArray.controls.forEach(control => {
        const percentage = control.get('percentage')?.value || 0;
        const fixedAmount = (totalIncome * percentage) / 100;
        control.get('fixedAmount')?.setValue(fixedAmount, { emitEvent: false });
      });
    } else if (allocationType === 'fixed') {
      categoriesArray.controls.forEach(control => {
        const fixedAmount = control.get('fixedAmount')?.value || 0;
        const percentage = totalIncome > 0 ? (fixedAmount / totalIncome) * 100 : 0;
        control.get('percentage')?.setValue(percentage, { emitEvent: false });
      });
    }
    
    this.validateBudget();
  }

  autoBalanceCategories(): void {
    const categoriesArray = this.categoryForm.get('categories') as FormArray;
    const totalIncome = this.incomeForm.get('totalIncome')?.value || 0;
    const emergencyPercentage = this.incomeForm.get('includeEmergencyFund')?.value ? 
      (this.incomeForm.get('emergencyFundPercentage')?.value || 0) : 0;
    const savingsPercentage = this.incomeForm.get('includeSavings')?.value ? 
      (this.incomeForm.get('savingsPercentage')?.value || 0) : 0;
    
    const availablePercentage = 100 - emergencyPercentage - savingsPercentage;
    const categoryCount = categoriesArray.length;
    
    if (categoryCount > 0 && availablePercentage > 0) {
      const equalPercentage = availablePercentage / categoryCount;
      
      categoriesArray.controls.forEach(control => {
        control.get('percentage')?.setValue(equalPercentage);
      });
      
      this.updateCategoryAllocations();
    }
  }

  validateBudget(): void {
    const totalIncome = this.incomeForm.get('totalIncome')?.value || 0;
    const categoriesArray = this.categoryForm.get('categories') as FormArray;
    
    let totalAllocated = 0;
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];
    
    categoriesArray.controls.forEach(control => {
      const percentage = control.get('percentage')?.value || 0;
      totalAllocated += percentage;
    });
    
    if (this.incomeForm.get('includeEmergencyFund')?.value) {
      totalAllocated += this.incomeForm.get('emergencyFundPercentage')?.value || 0;
    }
    if (this.incomeForm.get('includeSavings')?.value) {
      totalAllocated += this.incomeForm.get('savingsPercentage')?.value || 0;
    }
    
    if (totalAllocated > 100) {
      errors.push(`Total allocation (${totalAllocated.toFixed(1)}%) exceeds 100%. Please adjust your allocations.`);
    } else if (totalAllocated < 95) {
      warnings.push(`You have ${(100 - totalAllocated).toFixed(1)}% unallocated. Consider allocating all income.`);
    }
    
    if (totalIncome === 0) {
      errors.push('Please enter your total income amount.');
    }
    
    this.validationResults = {
      isValid: errors.length === 0,
      warnings,
      errors,
      recommendations
    };
  }

  nextStep(): void {
    if (this.canProceedToNextStep()) {
      this.currentStep++;
      if (this.stepper) {
        this.stepper.next();
      }
    }
  }

  previousStep(): void {
    this.currentStep--;
    if (this.stepper) {
      this.stepper.previous();
    }
  }

  canProceedToNextStep(): boolean {
    switch (this.currentStep) {
      case 0:
        return this.basicInfoForm.valid;
      case 1:
        return true;
      case 2:
        return this.incomeForm.valid && (this.incomeForm.get('totalIncome')?.value || 0) > 0;
      case 3:
        return this.categoryForm.valid && this.validationResults.isValid;
      case 4:
        return this.settingsForm.valid;
      case 5:
        return this.reviewForm.valid;
      default:
        return false;
    }
  }

  createBudget(): void {
    if (!this.validationResults.isValid) {
      this.snackBar.open('Please fix validation errors before creating the budget', 'Close', { duration: 3000 });
      return;
    }
    
    this.loading = true;
    
    const budgetRequest = this.prepareBudgetRequest();
    
    this.budgetService.createBudget(budgetRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (budget) => {
          this.snackBar.open('Budget created successfully!', 'Close', { duration: 3000 });
          
          if (this.reviewForm.get('saveAsTemplate')?.value) {
            this.saveAsTemplate(budget);
          }
          
          this.router.navigate(['/budgets', budget._id]);
        },
        error: (error) => {
          console.error('Error creating budget:', error);
          this.snackBar.open('Error creating budget. Please try again.', 'Close', { duration: 3000 });
          this.loading = false;
        }
      });
  }

  private prepareBudgetRequest(): CreateBudgetRequest {
    const basicInfo = this.basicInfoForm.value;
    const income = this.incomeForm.value;
    const settings = this.settingsForm.value;
    
    const categoriesArray = this.categoryForm.get('categories') as FormArray;
    const categoryAllocations = categoriesArray.controls.map(control => ({
      category: control.get('categoryId')?.value,
      allocated: control.get('fixedAmount')?.value || 0
    }));
    
    if (income.includeEmergencyFund) {
      const emergencyCategory = this.categories.find(c => c.name.toLowerCase().includes('emergency'));
      if (emergencyCategory) {
        categoryAllocations.push({
          category: emergencyCategory._id,
          allocated: (income.totalIncome * income.emergencyFundPercentage) / 100
        });
      }
    }
    
    if (income.includeSavings) {
      const savingsCategory = this.categories.find(c => c.name.toLowerCase().includes('savings'));
      if (savingsCategory) {
        categoryAllocations.push({
          category: savingsCategory._id,
          allocated: (income.totalIncome * income.savingsPercentage) / 100
        });
      }
    }
    
    return {
      name: basicInfo.name,
      description: basicInfo.description,
      totalAmount: income.totalIncome,
      period: basicInfo.period,
      startDate: basicInfo.startDate,
      endDate: basicInfo.endDate,
      categories: categoryAllocations,
      alertSettings: {
        enabled: settings.alertsEnabled,
        thresholds: {
          warning: settings.warningThreshold,
          critical: settings.criticalThreshold
        },
        notifications: {
          email: settings.emailNotifications,
          push: settings.pushNotifications,
          inApp: true
        },
        frequency: 'immediate'
      },
      rolloverSettings: {
        enabled: settings.rolloverEnabled,
        maxRolloverPercentage: settings.maxRolloverPercentage,
        resetOnNewPeriod: true
      }
    };
  }

  private saveAsTemplate(budget: Budget): void {
    const templateName = this.reviewForm.get('templateName')?.value || `${budget.name} Template`;
    
    const templateData: Partial<BudgetTemplate> = {
      name: templateName,
      description: budget.description || `Template created from budget: ${budget.name}`,
      categories: budget.categories.map(cat => ({
        category: cat.category,
        percentage: (cat.allocated / budget.totalAmount) * 100,
        allocated: cat.allocated
      })),
      totalAmount: budget.totalAmount,
      period: budget.period,
      alertSettings: budget.alertSettings,
      rolloverSettings: budget.rolloverSettings,
      color: budget.color,
      icon: budget.icon,
      usageCount: 0
    };

    this.budgetService.createBudgetTemplate(templateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (template) => {
          this.snackBar.open(`Budget saved as template: ${template.name}`, 'Close', { duration: 3000 });
        },
        error: (error) => {
          console.error('Error saving template:', error);
          this.snackBar.open('Error saving budget as template', 'Close', { duration: 3000 });
        }
      });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  }

  formatPercentage(percentage: number): string {
    return `${(percentage || 0).toFixed(1)}%`;
  }

  getTotalAllocatedPercentage(): number {
    const categoriesArray = this.categoryForm.get('categories') as FormArray;
    let total = 0;
    
    categoriesArray.controls.forEach(control => {
      total += control.get('percentage')?.value || 0;
    });
    
    if (this.incomeForm.get('includeEmergencyFund')?.value) {
      total += this.incomeForm.get('emergencyFundPercentage')?.value || 0;
    }
    if (this.incomeForm.get('includeSavings')?.value) {
      total += this.incomeForm.get('savingsPercentage')?.value || 0;
    }
    
    return total;
  }

  getRemainingPercentage(): number {
    return 100 - this.getTotalAllocatedPercentage();
  }

  // Helper methods for template access
  getIncomeSourcesControls(): FormGroup[] {
    const incomeSourcesArray = this.incomeForm.get('incomeSources') as FormArray;
    return incomeSourcesArray.controls as FormGroup[];
  }

  getCategoriesControls(): FormGroup[] {
    const categoriesArray = this.categoryForm.get('categories') as FormArray;
    return categoriesArray.controls as FormGroup[];
  }

  getIncomeSourcesLength(): number {
    const incomeSourcesArray = this.incomeForm.get('incomeSources') as FormArray;
    return incomeSourcesArray.length;
  }
}
