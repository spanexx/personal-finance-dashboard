import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing'; // For routerLink
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ElementRef } from '@angular/core';
import { of, throwError } from 'rxjs';

import { DashboardComponent } from './dashboard.component';
import { MockApiService } from '../../core/services/mock-api.service'; // Using actual mock for now
import { AccessibilityService } from '../../shared/services/accessibility.service';

// Import Material Modules used in the template
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NgChartsModule } from 'ng2-charts';


// Mock AccessibilityService
class MockAccessibilityService {
  announce = jest.fn();
  announceRouteChange = jest.fn(); // For ngAfterViewInit
}

// Mock ElementRef
class MockElementRef implements ElementRef {
  nativeElement = { focus: jest.fn() };
}

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let mockApiService: Partial<MockApiService>;
  let mockAccessibilityService: MockAccessibilityService;

  const mockDashboardData = {
    financialSummary: { totalIncome: 1000, totalExpenses: 500, netSavings: 500 },
    recentTransactions: [{ id: 't1', description: 'Coffee', amount: 5, date: new Date().toISOString(), type: 'expense', categoryDetails: { name: 'Food', icon: 'fastfood', color: '#fff'} }],
    budgetProgress: {
        categories: [{ category: 'Groceries', categoryDetails: {name: 'Groceries', color: '#ccc', icon: 'cart'}, amount: 300, spent: 150 }]
    },
    goals: [{ id: 'g1', name: 'Vacation', targetAmount: 1000, currentAmount: 200, targetDate: new Date().toISOString() }],
    spendingByCategory: [{ category: {id: 'c1', name: 'Food', color: '#FF0000'}, amount: 200, percentage: 40 }],
    incomeVsExpenses: [{ period: 'Jan', income: 500, expenses: 200, net: 300 }]
  };

  beforeEach(async () => {
    mockApiService = {
      getDashboardData: jest.fn().mockReturnValue(of(mockDashboardData)),
      // Mock other methods if they were to be called by specific test cases
      getBudgets: jest.fn().mockReturnValue(of({ data: [] })),
      getGoals: jest.fn().mockReturnValue(of({ data: [] })),
      getTransactions: jest.fn().mockReturnValue(of({ data: [] })),
    };
    mockAccessibilityService = new MockAccessibilityService();

    await TestBed.configureTestingModule({
      imports: [
        DashboardComponent, // Standalone
        CommonModule,
        RouterTestingModule,
        FormsModule,
        NoopAnimationsModule,
        MatCardModule, MatIconModule, MatButtonModule, MatListModule,
        MatProgressBarModule, MatSelectModule, MatFormFieldModule, NgChartsModule
      ],
      providers: [
        { provide: MockApiService, useValue: mockApiService }, // Providing actual MockApiService for now
        { provide: AccessibilityService, useValue: mockAccessibilityService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;

    // Mock ViewChild elements
    component.dashboardTitle = new MockElementRef() as ElementRef<HTMLElement>;
    component.periodSelect = new MockElementRef() as ElementRef<any>; // Use any if MatSelect instance is complex

    fixture.detectChanges(); // Calls ngOnInit
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call loadDashboardData and updateCurrentDateDisplay on ngOnInit', () => {
    const loadSpy = jest.spyOn(component, 'loadDashboardData');
    const dateSpy = jest.spyOn(component, 'updateCurrentDateDisplay');
    component.ngOnInit();
    expect(loadSpy).toHaveBeenCalled();
    expect(dateSpy).toHaveBeenCalled();
  });

  it('should focus dashboard title and announce after view init', fakeAsync(() => {
    component.ngAfterViewInit();
    tick(100); // For the setTimeout
    expect(component.dashboardTitle.nativeElement.focus).toHaveBeenCalled();
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith('Dashboard loaded. Use Tab to navigate between widgets.');
  }));


  describe('loadDashboardData', () => {
    it('should call apiService.getDashboardData and update component properties', () => {
      component.loadDashboardData();
      expect(mockApiService.getDashboardData).toHaveBeenCalled();
      expect(component.totalIncome).toBe(mockDashboardData.financialSummary.totalIncome);
      expect(component.totalExpenses).toBe(mockDashboardData.financialSummary.totalExpenses);
      expect(component.netBalance).toBe(mockDashboardData.financialSummary.netSavings);
      expect(component.recentTransactions.length).toBe(1);
      expect(component.budgetItems.length).toBe(1);
      expect(component.savingsGoals.length).toBe(1);
      // Check if chart data prep methods were called (indirectly via data update)
      expect(component.expenseChartData.labels?.length).toBeGreaterThan(0);
      expect(component.incomeExpenseChartData.labels?.length).toBeGreaterThan(0);
      expect(mockAccessibilityService.announce).toHaveBeenCalledWith(expect.stringContaining('Dashboard updated'));
    });

    it('should handle error when loading dashboard data', () => {
      (mockApiService.getDashboardData as jest.Mock).mockReturnValue(throwError(() => new Error('API Error')));
      component.loadDashboardData();
      expect(mockApiService.getDashboardData).toHaveBeenCalled();
      expect(mockAccessibilityService.announce).toHaveBeenCalledWith('Error loading dashboard data');
      // Check if isLoading is set to false, error property might be set if component has one
    });
  });

  describe('onTimePeriodChange', () => {
    it('should announce time period change and reload data', () => {
      const loadSpy = jest.spyOn(component, 'loadDashboardData');
      component.selectedTimePeriod = 'week'; // Change the period
      component.onTimePeriodChange();

      const periodLabel = component['timePeriods'].find(p => p.value === 'week')?.label;
      expect(mockAccessibilityService.announce).toHaveBeenCalledWith(`Time period changed to ${periodLabel}. Loading data...`);
      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe('prepareExpenseChartData', () => {
    it('should correctly transform spending data for pie chart', () => {
      const spendingData = [
        { category: { name: 'Food', color: '#FF0000' }, amount: 100, percentage: 50 } as any,
        { category: { name: 'Travel', color: '#00FF00' }, amount: 100, percentage: 50 } as any,
      ];
      component.prepareExpenseChartData(spendingData);
      expect(component.expenseChartData.labels).toEqual(['Food', 'Travel']);
      expect(component.expenseChartData.datasets[0].data).toEqual([100, 100]);
      expect(component.expenseChartData.datasets[0].backgroundColor).toEqual(['#FF0000', '#00FF00']);
    });
  });

  describe('refreshDashboard', () => {
    it('should announce refresh and call loadDashboardData', () => {
       const loadSpy = jest.spyOn(component, 'loadDashboardData');
       component.refreshDashboard();
       expect(mockAccessibilityService.announce).toHaveBeenCalledWith('Refreshing dashboard...');
       expect(loadSpy).toHaveBeenCalled();
    });
  });

  it('focusTimeFilter should focus the period select element and announce', () => {
    component.focusTimeFilter();
    expect(component.periodSelect.nativeElement.focus).toHaveBeenCalled();
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith('Time period filter focused');
  });

  it('focusDashboardTitle should focus the dashboard title element and announce', () => {
    component.focusDashboardTitle();
    expect(component.dashboardTitle.nativeElement.focus).toHaveBeenCalled();
    expect(mockAccessibilityService.announce).toHaveBeenCalledWith('Dashboard title focused');
  });

});
