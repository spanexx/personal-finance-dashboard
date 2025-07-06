export interface Contribution {
  amount: number;
  date: Date;
  note?: string;
  transactionId?: string;
}

export interface Milestone {
  name: string;
  targetAmount: number;
  targetDate: Date;
  achieved: boolean;
  achievedDate?: Date;
  description?: string;
}

export interface Goal {
  _id: string;
  user: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'emergency_fund' | 'vacation' | 'home' | 'car' | 'education' | 'retirement' | 'debt_payoff' | 'investment' | 'other';
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  contributions: Contribution[];
  milestones: Milestone[];
  color?: string;
  icon?: string;
  isPublic: boolean;
  reminderEnabled: boolean;
  reminderFrequency: 'daily' | 'weekly' | 'monthly';
  lastReminderSent?: Date;
  progressPercentage: number;
  projectedCompletionDate?: Date;
  remainingAmount: number;
  averageMonthlyContribution: number;
  monthsToTarget: number;
  isOnTrack: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGoalRequest {
  name: string;
  description?: string;
  targetAmount: number;
  targetDate: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'emergency_fund' | 'vacation' | 'home' | 'car' | 'education' | 'retirement' | 'debt_payoff' | 'investment' | 'other';
  color?: string;
  icon?: string;
  isPublic?: boolean;
  reminderEnabled?: boolean;
  reminderFrequency?: 'daily' | 'weekly' | 'monthly';
  milestones?: Array<{
    name: string;
    targetAmount: number;
    targetDate: Date;
    description?: string;
  }>;
}

export interface UpdateGoalRequest {
  name?: string;
  description?: string;
  targetAmount?: number;
  targetDate?: Date;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'emergency_fund' | 'vacation' | 'home' | 'car' | 'education' | 'retirement' | 'debt_payoff' | 'investment' | 'other';
  status?: 'active' | 'paused' | 'completed' | 'cancelled';
  color?: string;
  icon?: string;
  isPublic?: boolean;
  reminderEnabled?: boolean;
  reminderFrequency?: 'daily' | 'weekly' | 'monthly';
  milestones?: Array<{
    name: string;
    targetAmount: number;
    targetDate: Date;
    description?: string;
    achieved?: boolean;
    achievedDate?: Date;
  }>;
}

export interface AddContributionRequest {
  goalId: string;
  amount: number;
  date: Date;
  note?: string;
  transactionId?: string;
}

export interface UpdateContributionRequest {
  contributionId: string;
  amount?: number;
  date?: Date;
  note?: string;
}

export interface GoalProgress {
  goalId: string;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  progressPercentage: number;
  targetDate: Date;
  projectedCompletionDate?: Date;
  daysRemaining: number;
  isOnTrack: boolean;
  monthlyContributionNeeded: number;
  averageMonthlyContribution: number;
  milestones: Array<{
    name: string;
    targetAmount: number;
    targetDate: Date;
    achieved: boolean;
    achievedDate?: Date;
    progressPercentage: number;
  }>;
}

export interface GoalSummary {
  totalGoals: number;
  activeGoals: number;
  completedGoals: number;
  totalTargetAmount: number;
  totalCurrentAmount: number;
  totalRemainingAmount: number;
  averageProgress: number;
  goalsOnTrack: number;
  goalsBehindSchedule: number;
  upcomingMilestones: Array<{
    goalId: string;
    goalName: string;
    milestoneName: string;
    targetDate: Date;
    daysUntilTarget: number;
  }>;
}

export interface GoalAnalytics {
  monthlyContributions: Array<{
    month: string;
    amount: number;
    goalBreakdown: Array<{
      goalId: string;
      goalName: string;
      amount: number;
    }>;
  }>;
  categoryBreakdown: Array<{
    category: string;
    totalTarget: number;
    totalCurrent: number;
    goalCount: number;
    averageProgress: number;
  }>;
  priorityDistribution: Array<{
    priority: string;
    count: number;
    totalAmount: number;
  }>;
  completionTrends: Array<{
    month: string;
    completed: number;
    created: number;
  }>;
}