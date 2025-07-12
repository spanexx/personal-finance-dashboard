const aiService = require('../../services/ai.service');
const transactionService = require('../../services/transaction.service');
const budgetService = require('../../services/budget.service');
const goalService = require('../../services/goal.service');
const categoryService = require('../../services/category.service');
const { GoogleGenerativeAI } = require('@google/generative-ai');

jest.mock('@google/generative-ai');
jest.mock('../../services/transaction.service');
jest.mock('../../services/budget.service');
jest.mock('../../services/goal.service');
jest.mock('../../services/category.service');

describe('AI Service', () => {
  let mockGenerateContent;
  let mockGenerativeModel;

  beforeEach(() => {
    mockGenerateContent = jest.fn();
    mockGenerativeModel = {
      generateContent: mockGenerateContent,
    };
    GoogleGenerativeAI.mockImplementation(() => ({
      getGenerativeModel: () => mockGenerativeModel,
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInsights', () => {
    it('should return insights from the Gemini API', async () => {
      const mockUserId = 'user123';
      const mockTransactions = [{ description: 'Test Transaction', amount: 100, type: 'expense', category: { name: 'Test' } }];
      const mockBudgets = [{ category: { name: 'Test' }, amount: 500, spent: 100, remaining: 400 }];
      const mockGoals = [{ name: 'Test Goal', targetAmount: 1000, currentAmount: 200 }];
      const mockCategories = [{ name: 'Test' }];

      transactionService.getTransactions.mockResolvedValue(mockTransactions);
      budgetService.getBudgets.mockResolvedValue(mockBudgets);
      goalService.getGoals.mockResolvedValue(mockGoals);
      categoryService.getCategories.mockResolvedValue(mockCategories);

      const mockApiResponse = {
        response: {
          text: () => 'Test insight 1\nTest insight 2',
        },
      };
      mockGenerateContent.mockResolvedValue(mockApiResponse);

      const insights = await aiService.getInsights(mockUserId);

      expect(insights).toEqual(['Test insight 1', 'Test insight 2']);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAIResponse', () => {
    it('should return a response from the Gemini API', async () => {
      const mockUserId = 'user123';
      const mockUserInput = 'What is my biggest expense?';
      const mockTransactions = [{ description: 'Test Transaction', amount: 100, type: 'expense', category: { name: 'Test' } }];
      const mockBudgets = [{ category: { name: 'Test' }, amount: 500, spent: 100, remaining: 400 }];
      const mockGoals = [{ name: 'Test Goal', targetAmount: 1000, currentAmount: 200 }];
      const mockCategories = [{ name: 'Test' }];

      transactionService.getTransactions.mockResolvedValue(mockTransactions);
      budgetService.getBudgets.mockResolvedValue(mockBudgets);
      goalService.getGoals.mockResolvedValue(mockGoals);
      categoryService.getCategories.mockResolvedValue(mockCategories);

      const mockApiResponse = {
        response: {
          text: () => 'Your biggest expense is Test.',
        },
      };
      mockGenerateContent.mockResolvedValue(mockApiResponse);

      const response = await aiService.getAIResponse(mockUserId, mockUserInput);

      expect(response).toBe('Your biggest expense is Test.');
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });
  });
});
