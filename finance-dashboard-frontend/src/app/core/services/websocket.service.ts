import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject, fromEvent, merge } from 'rxjs';
import { filter, map, tap, shareReplay, takeUntil, retry, delay } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';
import { NotificationService } from './notification.service';
import { environment } from '../../../environments/environment';
import { AuthenticationService } from './authentication.service';

export interface SocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface BudgetAlert {
  budgetId: string;
  userId: string;
  type: 'threshold_exceeded' | 'overspending' | 'underspending' | 'category_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  title: string;
  threshold?: number;
  current?: number;
  category?: string;
  timestamp: string;
}

export interface RealtimeUpdate {
  type: 'budget' | 'transaction' | 'goal' | 'balance';
  action: 'created' | 'updated' | 'deleted' | 'alert';
  data: any;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private isConnected$ = new BehaviorSubject<boolean>(false);
  private connectionRetries = 0;
  private maxRetries = 5;
  private destroy$ = new Subject<void>();

  // Event subjects
  private budgetEvents$ = new Subject<SocketEvent>();
  private transactionEvents$ = new Subject<SocketEvent>();
  private goalEvents$ = new Subject<SocketEvent>();
  private balanceEvents$ = new Subject<SocketEvent>();
  private systemEvents$ = new Subject<SocketEvent>();

  // Public observables
  public isConnected = this.isConnected$.asObservable();
  public budgetUpdates = this.budgetEvents$.asObservable();
  public transactionUpdates = this.transactionEvents$.asObservable();
  public goalUpdates = this.goalEvents$.asObservable();
  public balanceUpdates = this.balanceEvents$.asObservable();
  public systemNotifications = this.systemEvents$.asObservable();

  // Specific event observables
  public budgetAlerts!: Observable<BudgetAlert>;
  public budgetThresholdExceeded!: Observable<any>;
  public budgetPerformanceUpdates!: Observable<any>;
  public transactionCreated!: Observable<any>;
  public goalMilestoneReached!: Observable<any>;
  public balanceUpdated!: Observable<any>;

  constructor(
    private authService: AuthenticationService,
    private notificationService: NotificationService
  ) {
    this.setupEventObservables();
    this.initializeConnection();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
  }

  private setupEventObservables(): void {
    // Budget-specific events
    this.budgetAlerts = this.budgetUpdates.pipe(
      filter(event => event.type === 'budget:alert'),
      map(event => event.data as BudgetAlert),
      tap(alert => this.handleBudgetAlert(alert)),
      shareReplay(1)
    );

    this.budgetThresholdExceeded = this.budgetUpdates.pipe(
      filter(event => event.type === 'budget:threshold_exceeded'),
      map(event => event.data),
      tap(data => this.handleThresholdAlert(data)),
      shareReplay(1)
    );

    this.budgetPerformanceUpdates = this.budgetUpdates.pipe(
      filter(event => event.type === 'budget:updated'),
      map(event => event.data),
      shareReplay(1)
    );

    // Transaction events
    this.transactionCreated = this.transactionUpdates.pipe(
      filter(event => event.type === 'transaction:created'),
      map(event => event.data),
      tap(transaction => this.handleTransactionCreated(transaction)),
      shareReplay(1)
    );

    // Goal events
    this.goalMilestoneReached = this.goalUpdates.pipe(
      filter(event => event.type === 'goal:milestone_reached'),
      map(event => event.data),
      tap(goal => this.handleGoalMilestone(goal)),
      shareReplay(1)
    );

    // Balance events
    this.balanceUpdated = this.balanceUpdates.pipe(
      filter(event => event.type === 'balance:updated'),
      map(event => event.data),
      shareReplay(1)
    );
  }

  private initializeConnection(): void {
    // Listen for auth state changes
    this.authService.isAuthenticated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isAuthenticated: boolean) => {
        if (isAuthenticated) {
          this.connect();
        } else {
          this.disconnect();
        }
      });
  }

  private connect(): void {
    if (this.socket?.connected) {
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      console.warn('No authentication token available for WebSocket connection');
      return;
    }

    try {
      this.socket = io(environment.baseUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxRetries,
        reconnectionDelay: 1000,
        autoConnect: true
      });

      this.setupSocketEventHandlers();
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
      this.handleConnectionError();
    }
  }

  private setupSocketEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.isConnected$.next(true);
      this.connectionRetries = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected$.next(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.handleConnectionError();
    });

    this.socket.on('authentication_success', (data) => {
      console.log('WebSocket authentication successful', data);
    });

    this.socket.on('authentication_error', (error) => {
      console.error('WebSocket authentication failed:', error);
      this.notificationService.error('Failed to authenticate WebSocket connection');
      this.disconnect();
    });

    // Budget events
    this.socket.on('budget:alert', (data) => {
      this.budgetEvents$.next({ type: 'budget:alert', data, timestamp: new Date().toISOString() });
    });

    this.socket.on('budget:threshold_exceeded', (data) => {
      this.budgetEvents$.next({ type: 'budget:threshold_exceeded', data, timestamp: new Date().toISOString() });
    });

    this.socket.on('budget:updated', (data) => {
      this.budgetEvents$.next({ type: 'budget:updated', data, timestamp: new Date().toISOString() });
    });

    this.socket.on('budget:period_transition', (data) => {
      this.budgetEvents$.next({ type: 'budget:period_transition', data, timestamp: new Date().toISOString() });
    });

    // Transaction events
    this.socket.on('transaction:created', (data) => {
      this.transactionEvents$.next({ type: 'transaction:created', data, timestamp: new Date().toISOString() });
    });

    this.socket.on('transaction:updated', (data) => {
      this.transactionEvents$.next({ type: 'transaction:updated', data, timestamp: new Date().toISOString() });
    });

    this.socket.on('transaction:deleted', (data) => {
      this.transactionEvents$.next({ type: 'transaction:deleted', data, timestamp: new Date().toISOString() });
    });

    // Goal events
    this.socket.on('goal:progress_updated', (data) => {
      this.goalEvents$.next({ type: 'goal:progress_updated', data, timestamp: new Date().toISOString() });
    });

    this.socket.on('goal:milestone_reached', (data) => {
      this.goalEvents$.next({ type: 'goal:milestone_reached', data, timestamp: new Date().toISOString() });
    });

    this.socket.on('goal:completed', (data) => {
      this.goalEvents$.next({ type: 'goal:completed', data, timestamp: new Date().toISOString() });
    });

    // Balance events
    this.socket.on('balance:updated', (data) => {
      this.balanceEvents$.next({ type: 'balance:updated', data, timestamp: new Date().toISOString() });
    });

    this.socket.on('balance:reconciled', (data) => {
      this.balanceEvents$.next({ type: 'balance:reconciled', data, timestamp: new Date().toISOString() });
    });

    // System events
    this.socket.on('system:notification', (data) => {
      this.systemEvents$.next({ type: 'system:notification', data, timestamp: new Date().toISOString() });
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private handleConnectionError(): void {
    this.connectionRetries++;
    
    if (this.connectionRetries >= this.maxRetries) {
      this.notificationService.error(
        'Unable to establish real-time connection. Some features may not be available.',
        'Connection Failed'
      );
    }
  }

  private handleBudgetAlert(alert: BudgetAlert): void {
    const severity = alert.severity;
    const title = alert.title || 'Budget Alert';
    const message = alert.message;

    switch (severity) {
      case 'critical':
        this.notificationService.error(message, title, 0); // No auto-dismiss
        break;
      case 'high':
        this.notificationService.warning(message, title, 10000);
        break;
      case 'medium':
        this.notificationService.warning(message, title, 7000);
        break;
      case 'low':
        this.notificationService.info(message, title, 5000);
        break;
    }
  }

  private handleThresholdAlert(data: any): void {
    const message = `Budget "${data.budgetName}" has exceeded ${data.threshold}% of the allocated amount.`;
    this.notificationService.warning(message, 'Budget Threshold Exceeded', 8000);
  }

  private handleTransactionCreated(transaction: any): void {
    const message = `New ${transaction.type} transaction: ${this.formatCurrency(transaction.amount)}`;
    this.notificationService.success(message, 'Transaction Added', 3000);
  }

  private handleGoalMilestone(goal: any): void {
    const message = `Congratulations! You've reached ${goal.milestone}% of your goal "${goal.name}"`;
    this.notificationService.success(message, 'Goal Milestone Reached', 8000);
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected$.next(false);
    }
  }

  public reconnect(): void {
    this.disconnect();
    setTimeout(() => this.connect(), 1000);
  }

  // Utility methods for components
  public joinRoom(room: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join_room', { room });
    }
  }

  public leaveRoom(room: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave_room', { room });
    }
  }

  public getConnectionStatus(): Observable<boolean> {
    return this.isConnected;
  }

  // Method to get specific budget events for a budget ID
  public getBudgetEvents(budgetId: string): Observable<SocketEvent> {
    return this.budgetUpdates.pipe(
      filter(event => event.data.budgetId === budgetId)
    );
  }

  // Method to listen for specific transaction events
  public getTransactionEvents(userId?: string): Observable<SocketEvent> {
    return this.transactionUpdates.pipe(
      filter(event => !userId || event.data.userId === userId)
    );
  }

  // Add a stub for getUnreadNotificationCount if missing
  public getUnreadNotificationCount(): Observable<number> {
    // In a real implementation, this would track unread notifications from the server
    return new BehaviorSubject<number>(0).asObservable();
  }
}
