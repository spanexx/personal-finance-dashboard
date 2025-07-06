import { Component, OnInit, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { MatCalendar, MatDatepickerInputEvent } from '@angular/material/datepicker';
import { Budget } from '../../../shared/models/budget.model';
import { Transaction } from '../../../shared/models/transaction.model';
import { BudgetService } from '../../../core/services/budget.service';
import { Observable, combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

interface CalendarEvent {
  date: Date;
  type: 'budget' | 'transaction' | 'alert' | 'milestone';
  title: string;
  amount?: number;
  category?: string;
  description?: string;
  color: string;
}

interface BudgetCalendarData {
  budget: Budget;
  transactions: Transaction[];
  events: CalendarEvent[];
  monthlyAllocations: { [key: string]: number };
  dailySpending: { [key: string]: number };
  alerts: { [key: string]: string[] };
}

@Component({
  selector: 'app-budget-calendar',
  templateUrl: './budget-calendar.component.html',
  styleUrls: ['./budget-calendar.component.scss']
})
export class BudgetCalendarComponent implements OnInit {
  @Input() budget: Budget | null = null;
  @Input() showTransactions = true;
  @Input() showAlerts = true;
  @Input() showMilestones = true;
  @Output() dateSelected = new EventEmitter<Date>();
  @Output() eventClicked = new EventEmitter<CalendarEvent>();
  @Output() budgetPeriodChanged = new EventEmitter<{ start: Date; end: Date }>();

  @ViewChild(MatCalendar) calendar!: MatCalendar<Date>;

  selectedDate = new Date();
  currentPeriod: { start: Date; end: Date } = this.getCurrentPeriod();
  calendarData$: Observable<BudgetCalendarData> | null = null;
  
  // View options
  viewMode: 'month' | 'week' | 'day' = 'month';
  showWeekends = true;
  showPastDates = true;
  
  // Calendar events
  events: CalendarEvent[] = [];
  selectedDateEvents: CalendarEvent[] = [];
  
  // Legend items
  legendItems = [
    { color: '#4CAF50', label: 'Budget Start/End', type: 'budget' },
    { color: '#2196F3', label: 'Transactions', type: 'transaction' },
    { color: '#FF9800', label: 'Alerts', type: 'alert' },
    { color: '#9C27B0', label: 'Milestones', type: 'milestone' }
  ];

  constructor(private budgetService: BudgetService) {}

  ngOnInit(): void {
    this.initializeCalendarData();
    this.updateCalendarEvents();
  }
  private initializeCalendarData(): void {
    if (this.budget) {
      // For now, we'll create a simplified version without the missing service methods
      this.calendarData$ = this.budgetService.getBudget(this.budget._id).pipe(
        map((budget) => ({
          budget,
          transactions: [], // We'll need to implement transaction fetching later
          events: this.generateCalendarEvents(budget, [], []),
          monthlyAllocations: this.calculateMonthlyAllocations(budget),
          dailySpending: this.calculateDailySpending([]),
          alerts: {}
        }))
      );
    }
  }

  private getCurrentPeriod(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end };
  }

  private generateCalendarEvents(budget: Budget, transactions: Transaction[], alerts: any[]): CalendarEvent[] {
    const events: CalendarEvent[] = [];    // Budget period events
    if (this.budget) {
      events.push({
        date: new Date(budget.startDate),
        type: 'budget',
        title: 'Budget Period Start',
        description: `${budget.name} budget period begins`,
        color: '#4CAF50'
      });

      events.push({
        date: new Date(budget.endDate),
        type: 'budget',
        title: 'Budget Period End',
        description: `${budget.name} budget period ends`,
        color: '#4CAF50'
      });
    }

    // Transaction events
    if (this.showTransactions) {
      transactions.forEach(transaction => {
        events.push({
          date: new Date(transaction.date),
          type: 'transaction',
          title: `${transaction.description}`,
          amount: transaction.amount,
          category: transaction.category,
          description: `${transaction.type}: $${Math.abs(transaction.amount)}`,
          color: transaction.amount > 0 ? '#4CAF50' : '#F44336'
        });
      });
    }

    // Alert events
    if (this.showAlerts) {
      alerts.forEach(alert => {
        events.push({
          date: new Date(alert.date),
          type: 'alert',
          title: alert.title,
          description: alert.message,
          color: this.getAlertColor(alert.severity)
        });
      });
    }

    // Milestone events
    if (this.showMilestones && budget) {
      this.generateMilestoneEvents(budget).forEach(event => {
        events.push(event);
      });
    }

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
  private generateMilestoneEvents(budget: Budget): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const startDate = new Date(budget.startDate);
    const endDate = new Date(budget.endDate);
    
    // Calculate milestone dates (25%, 50%, 75% through budget period)
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    [0.25, 0.5, 0.75].forEach((percentage, index) => {
      const milestoneDate = new Date(startDate);
      milestoneDate.setDate(startDate.getDate() + Math.floor(totalDays * percentage));
      
      events.push({
        date: milestoneDate,
        type: 'milestone',
        title: `Budget Checkpoint (${percentage * 100}%)`,
        description: `Review your spending progress`,
        color: '#9C27B0'
      });
    });

    return events;
  }
  private calculateMonthlyAllocations(budget: Budget): { [key: string]: number } {
    const allocations: { [key: string]: number } = {};
    
    if (budget && budget.categories) {
      budget.categories.forEach(category => {
        const monthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
        allocations[`${monthKey}-${category.category}`] = category.allocated;
      });
    }
    
    return allocations;
  }

  private calculateDailySpending(transactions: Transaction[]): { [key: string]: number } {
    const dailySpending: { [key: string]: number } = {};
    
    transactions.forEach(transaction => {
      const dateKey = transaction.date.toISOString().split('T')[0];
      dailySpending[dateKey] = (dailySpending[dateKey] || 0) + Math.abs(transaction.amount);
    });
    
    return dailySpending;
  }

  private groupAlertsByDate(alerts: any[]): { [key: string]: string[] } {
    const grouped: { [key: string]: string[] } = {};
    
    alerts.forEach(alert => {
      const dateKey = new Date(alert.date).toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(alert.message);
    });
    
    return grouped;
  }

  private getAlertColor(severity: string): string {
    switch (severity) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#FFC107';
      default: return '#FF9800';
    }
  }

  // Budget calculation methods
  getTotalSpent(): number {
    if (!this.budget || !this.budget.categories) return 0;
    return this.budget.categories.reduce((total, category) => total + category.spent, 0);
  }

  getBudgetProgress(): number {
    if (!this.budget) return 0;
    const totalSpent = this.getTotalSpent();
    const totalBudget = this.budget.totalAmount;
    return totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  }

  getTotalBudget(): number {
    return this.budget?.totalAmount || 0;
  }

  getRemainingBudget(): number {
    if (!this.budget) return 0;
    return this.budget.totalAmount - this.getTotalSpent();
  }
  // Calendar event handlers
  onDateSelected(event: MatDatepickerInputEvent<Date> | Date): void {
    let selectedDate: Date | null = null;
    
    if (event instanceof Date) {
      selectedDate = event;
    } else if (event && 'value' in event) {
      selectedDate = event.value;
    }
    
    if (selectedDate) {
      this.selectedDate = selectedDate;
      this.updateSelectedDateEvents();
      this.dateSelected.emit(selectedDate);
    }
  }

  onCalendarSelectedChange(date: Date | null): void {
    if (date) {
      this.onDateSelected(date);
    }
  }

  onDayClick(day: Date): void {
    this.onDateSelected(day);
  }

  onMonthChanged(date: Date): void {
    this.currentPeriod = {
      start: new Date(date.getFullYear(), date.getMonth(), 1),
      end: new Date(date.getFullYear(), date.getMonth() + 1, 0)
    };
    this.budgetPeriodChanged.emit(this.currentPeriod);
    this.updateCalendarEvents();
  }

  private updateSelectedDateEvents(): void {
    const selectedDateStr = this.selectedDate.toISOString().split('T')[0];
    this.selectedDateEvents = this.events.filter(event => 
      event.date.toISOString().split('T')[0] === selectedDateStr
    );
  }

  private updateCalendarEvents(): void {
    if (this.budget) {
      this.initializeCalendarData();
    }
  }

  // Calendar navigation methods
  changeViewMode(mode: 'month' | 'week' | 'day'): void {
    this.viewMode = mode;
    this.updateCalendarEvents();
  }

  goToPreviousPeriod(): void {
    const currentDate = new Date(this.selectedDate);
    if (this.viewMode === 'month') {
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (this.viewMode === 'week') {
      currentDate.setDate(currentDate.getDate() - 7);
    } else {
      currentDate.setDate(currentDate.getDate() - 1);
    }
    this.selectedDate = currentDate;
    this.onDateSelected({ value: currentDate } as MatDatepickerInputEvent<Date>);
  }

  goToNextPeriod(): void {
    const currentDate = new Date(this.selectedDate);
    if (this.viewMode === 'month') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (this.viewMode === 'week') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    this.selectedDate = currentDate;
    this.onDateSelected({ value: currentDate } as MatDatepickerInputEvent<Date>);
  }

  goToToday(): void {
    this.selectedDate = new Date();
    this.onDateSelected({ value: this.selectedDate } as MatDatepickerInputEvent<Date>);
  }

  // Calendar display methods
  getDaysInMonth(): Date[] {
    const days: Date[] = [];
    const currentDate = new Date(this.selectedDate);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Get first day of month and last day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get first day of calendar grid (might be from previous month)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // Get last day of calendar grid (might be from next month)
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));
    
    // Generate all days in the calendar grid
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    
    return days;
  }

  isCurrentMonth(date: Date): boolean {
    const currentDate = new Date(this.selectedDate);
    return date.getMonth() === currentDate.getMonth() && 
           date.getFullYear() === currentDate.getFullYear();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  isSameDate(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  getEventsForDate(date: Date): CalendarEvent[] {
    const dateStr = date.toISOString().split('T')[0];
    return this.events.filter(event => 
      event.date.toISOString().split('T')[0] === dateStr
    );
  }

  getDaySpending(date: Date): number {
    const dateStr = date.toISOString().split('T')[0];
    return this.calendarData$ ? 0 : 0; // Will be implemented when we have transaction data
  }

  getBudgetProgressForDate(date: Date): number {
    // Calculate budget progress for the given date
    const spending = this.getDaySpending(date);
    const dailyBudget = this.budget ? this.budget.totalAmount / 30 : 0; // Rough daily allocation
    return Math.min((spending / dailyBudget) * 100, 100);
  }

  onEventClick(event: CalendarEvent): void {
    this.eventClicked.emit(event);
  }

  // Utility methods
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  // Date class function for Material Calendar
  dateClass = (date: Date): string => {
    const hasEvents = this.getEventsForDate(date).length > 0;
    const hasSpending = this.getDaySpending(date) > 0;
    
    let classes = '';
    if (hasEvents) classes += ' has-events';
    if (hasSpending) classes += ' has-spending';
    if (this.isToday(date)) classes += ' today';
    
    return classes.trim();
  };
}
