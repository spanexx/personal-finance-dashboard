/**
 * Prompt Library for Financial AI Assistant
 * Contains specialized prompts and context for various financial scenarios.
 */

const PROMPT_TEMPLATES = {
    FINANCIAL_OVERVIEW: (context) => `You are an AI financial assistant. Provide a concise financial overview based on the following data:

User: ${context.user?.firstName || 'User'}
Net Balance: $${context.transactions?.summary?.netBalance || 0}
Monthly Income: $${context.transactions?.summary?.totalIncome || 0}
Monthly Expenses: $${context.transactions?.summary?.totalExpenses || 0}
Savings Rate: ${context.insights?.summary?.spending?.savingsRate || 0}%

Budgets: ${context.budgets?.overallStats?.totalBudgets || 0} active budgets
Goals: ${context.goals?.overallStats?.activeGoals || 0} active goals

Recent Transactions Summary:
${context.transactions?.recentTransactions?.map(t => `- ${t.date.toISOString().split('T')[0]}: ${t.description} - $${t.amount} (${t.type})`).join('\n') || 'No recent transactions.'}

Top Spending Categories:
${context.transactions?.categoryBreakdown?.map(c => `- ${c.categoryName}: $${c.totalAmount}`).join('\n') || 'No top categories.'}

Provide a summary of the user's financial health, highlight any key trends or alerts, and offer actionable advice.`, 

    TRANSACTION_CATEGORIZATION_ASSIST: (transactionDescription, existingCategories) => `The user has a transaction with the description: "${transactionDescription}".

Existing categories: ${existingCategories.map(c => c.name).join(', ')}.

Suggest the most appropriate category from the existing categories for this transaction. If none fit perfectly, suggest a new category that would be suitable. Respond concisely with only the suggested category name.`, 

    BUDGET_OPTIMIZATION_ADVICE: (budgetData) => `Analyze the following budget data and provide advice on how to optimize spending and improve budget adherence:

Budget Name: ${budgetData.name}
Total Allocated: $${budgetData.totalAllocated}
Total Spent: $${budgetData.totalSpent}
Utilization Rate: ${budgetData.utilizationRate}%

Category Allocations:
${budgetData.categoryAllocations.map(alloc => `- ${alloc.category.name}: Allocated $${alloc.allocatedAmount}, Spent $${alloc.spentAmount}`).join('\n')}

Provide specific, actionable recommendations to help the user stay within budget or reallocate funds more effectively.`, 

    GOAL_PROGRESS_EVALUATION: (goalData) => `Evaluate the progress of the following financial goal and provide insights and recommendations:

Goal Name: ${goalData.name}
Target Amount: $${goalData.targetAmount}
Current Amount: $${goalData.currentAmount}
Progress: ${goalData.progress}%
Target Date: ${goalData.targetDate ? goalData.targetDate.toISOString().split('T')[0] : 'N/A'}
Days Remaining: ${goalData.daysToTarget || 'N/A'}
Monthly Required: $${goalData.monthlyRequired || 0}
Status: ${goalData.status}

Provide an assessment of the goal's progress, identify any risks or opportunities, and suggest steps to achieve the goal or accelerate progress.`, 

    ANOMALY_DETECTION_EXPLANATION: (anomalyDetails) => `An anomaly has been detected in your financial activity:

Type: ${anomalyDetails.type}
Description: ${anomalyDetails.description}
Date: ${anomalyDetails.date}
Amount: $${anomalyDetails.amount}

Explain why this transaction is considered an anomaly and suggest possible reasons or actions the user might take.`, 

    GENERAL_FINANCIAL_ADVICE: (topic) => `Provide general financial advice on the topic of: ${topic}. Focus on practical tips and best practices.`, 

    ACTION_CONFIRMATION: (actionType, actionData) => `Confirm the following action: ${actionType} with data: ${JSON.stringify(actionData)}. Ask the user if they want to proceed.`, 

    ERROR_RESPONSE: (errorMessage) => `An error occurred: ${errorMessage}. Please try again or rephrase your request.`, 
};

module.exports = PROMPT_TEMPLATES;
