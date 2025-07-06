import { BudgetActions } from './budget.actions'; // Assuming createActionGroup syntax
import { Budget, CreateBudgetRequest, UpdateBudgetRequest } from '../../shared/models/budget.model';
import { BudgetPagination } from '../state/budget.state';

describe('Budget Actions', () => {
  // Mock Data
  const mockBudget: Budget = {
    _id: 'b1',
    user: 'user1',
    name: 'Test Budget',
    totalAmount: 1000,
    period: 'monthly',
    startDate: new Date(),
    endDate: new Date(),
    categories: [],
    alertSettings: { enabled: false, thresholds: { warning: 80, critical: 95 }, notifications: { email: false, push: false, inApp: true }, frequency: 'daily' },
    rolloverSettings: { enabled: false, maxRolloverPercentage: 0, resetOnNewPeriod: true },
    isActive: true,
    isTemplate: false,
    totalSpent: 0,
    totalRemaining: 1000,
    utilizationPercentage: 0,
    status: 'on_track',
    lastCalculated: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPagination: BudgetPagination = {
    page: 1,
    limit: 10,
    totalItems: 1,
    totalPages: 1,
  };

  const mockError = { message: 'Test Error' };
  const mockFilters = { period: 'monthly' };
  const mockCreateDto: CreateBudgetRequest = {
    name: 'New Budget',
    totalAmount: 500,
    period: 'monthly',
    startDate: new Date(),
    endDate: new Date(),
    categories: []
  };
  const mockUpdateDto: UpdateBudgetRequest = { _id: 'b1', name: 'Updated Budget' };

  // Load Budgets
  it('should create a Load Budgets action', () => {
    const action = BudgetActions.loadBudgets({ filters: mockFilters, page: 1, limit: 10 });
    expect(action.type).toBe('[Budget] Load Budgets');
    expect(action.filters).toEqual(mockFilters);
    expect(action.page).toBe(1);
    expect(action.limit).toBe(10);
  });

  it('should create a Load Budgets Success action', () => {
    const action = BudgetActions.loadBudgetsSuccess({ budgets: [mockBudget], pagination: mockPagination });
    expect(action.type).toBe('[Budget] Load Budgets Success');
    expect(action.budgets).toEqual([mockBudget]);
    expect(action.pagination).toEqual(mockPagination);
  });

  it('should create a Load Budgets Failure action', () => {
    const action = BudgetActions.loadBudgetsFailure({ error: 'Error string' });
    expect(action.type).toBe('[Budget] Load Budgets Failure');
    expect(action.error).toBe('Error string');
  });

  // Load Budget
  it('should create a Load Budget action', () => {
    const action = BudgetActions.loadBudget({ budgetId: 'b1' });
    expect(action.type).toBe('[Budget] Load Budget');
    expect(action.budgetId).toBe('b1');
  });

  it('should create a Load Budget Success action', () => {
    const action = BudgetActions.loadBudgetSuccess({ budget: mockBudget });
    expect(action.type).toBe('[Budget] Load Budget Success');
    expect(action.budget).toEqual(mockBudget);
  });

  it('should create a Load Budget Failure action', () => {
    const action = BudgetActions.loadBudgetFailure({ error: 'Error string' });
    expect(action.type).toBe('[Budget] Load Budget Failure');
    expect(action.error).toBe('Error string');
  });

  // Create Budget
  it('should create a Create Budget action', () => {
    const action = BudgetActions.createBudget({ budgetData: mockCreateDto });
    expect(action.type).toBe('[Budget] Create Budget');
    expect(action.budgetData).toEqual(mockCreateDto);
  });

  it('should create a Create Budget Success action', () => {
    const action = BudgetActions.createBudgetSuccess({ budget: mockBudget });
    expect(action.type).toBe('[Budget] Create Budget Success');
    expect(action.budget).toEqual(mockBudget);
  });

  it('should create a Create Budget Failure action', () => {
    const action = BudgetActions.createBudgetFailure({ error: 'Error string' });
    expect(action.type).toBe('[Budget] Create Budget Failure');
    expect(action.error).toBe('Error string');
  });

  // Update Budget
  it('should create an Update Budget action', () => {
    const action = BudgetActions.updateBudget({ budgetId: 'b1', budgetData: mockUpdateDto });
    expect(action.type).toBe('[Budget] Update Budget');
    expect(action.budgetId).toBe('b1');
    expect(action.budgetData).toEqual(mockUpdateDto);
  });

  it('should create an Update Budget Success action', () => {
    const action = BudgetActions.updateBudgetSuccess({ budget: mockBudget });
    expect(action.type).toBe('[Budget] Update Budget Success');
    expect(action.budget).toEqual(mockBudget);
  });

  it('should create an Update Budget Failure action', () => {
    const action = BudgetActions.updateBudgetFailure({ error: 'Error string' });
    expect(action.type).toBe('[Budget] Update Budget Failure');
    expect(action.error).toBe('Error string');
  });

  // Delete Budget
  it('should create a Delete Budget action', () => {
    const action = BudgetActions.deleteBudget({ budgetId: 'b1' });
    expect(action.type).toBe('[Budget] Delete Budget');
    expect(action.budgetId).toBe('b1');
  });

  it('should create a Delete Budget Success action', () => {
    const action = BudgetActions.deleteBudgetSuccess({ budgetId: 'b1' });
    expect(action.type).toBe('[Budget] Delete Budget Success');
    expect(action.budgetId).toBe('b1');
  });

  it('should create a Delete Budget Failure action', () => {
    const action = BudgetActions.deleteBudgetFailure({ error: 'Error string' });
    expect(action.type).toBe('[Budget] Delete Budget Failure');
    expect(action.error).toBe('Error string');
  });

  // Select Budget
  it('should create a Select Budget action with a budget', () => {
    const action = BudgetActions.selectBudget({ budget: mockBudget });
    expect(action.type).toBe('[Budget] Select Budget');
    expect(action.budget).toEqual(mockBudget);
  });

  it('should create a Select Budget action with null', () => {
    const action = BudgetActions.selectBudget({ budget: null });
    expect(action.type).toBe('[Budget] Select Budget');
    expect(action.budget).toBeNull();
  });

  // Clear Selected Budget
  it('should create a Clear Selected Budget action', () => {
    const action = BudgetActions.clearSelectedBudget();
    expect(action.type).toBe('[Budget] Clear Selected Budget');
  });

  // Update Filters
  it('should create an Update Budget Filters action', () => {
    const action = BudgetActions.updateBudgetFilters({ filters: mockFilters });
    expect(action.type).toBe('[Budget] Update Budget Filters');
    expect(action.filters).toEqual(mockFilters);
  });

  // Clear Budget Error
  it('should create a Clear Budget Error action', () => {
    const action = BudgetActions.clearBudgetError();
    expect(action.type).toBe('[Budget] Clear Budget Error');
  });

  // Load Current Budget
  it('should create a Load Current Budget action', () => {
    const action = BudgetActions.loadCurrentBudget();
    expect(action.type).toBe('[Budget] Load Current Budget');
  });

  it('should create a Load Current Budget Success action', () => {
    const action = BudgetActions.loadCurrentBudgetSuccess({ budget: mockBudget });
    expect(action.type).toBe('[Budget] Load Current Budget Success');
    expect(action.budget).toEqual(mockBudget);
  });

  it('should create a Load Current Budget Failure action', () => {
    const action = BudgetActions.loadCurrentBudgetFailure({ error: 'Error string' });
    expect(action.type).toBe('[Budget] Load Current Budget Failure');
    expect(action.error).toBe('Error string');
  });
});
