import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { TokenService } from './token.service';

export interface AIInsight {
  text: string;
  timestamp: string;
}

export interface ChatMessage {
  id?: string;
  userMessage: string;
  aiResponse: any;
  responseType: 'text' | 'action' | 'mixed';
  timestamp: string;
  sessionId?: string;
  actionExecuted?: boolean;
}

export interface AIAction {
  action: 'create' | 'update' | 'delete';
  type: 'transaction' | 'budget' | 'goal' | 'category';
  data: any;
  message?: string;
}

export interface AIPreferences {
  responseStyle: 'concise' | 'detailed' | 'conversational' | 'professional';
  insightFrequency: 'daily' | 'weekly' | 'monthly' | 'manual';
  enabledFeatures: {
    autoInsights: boolean;
    spendingAlerts: boolean;
    budgetSuggestions: boolean;
    goalTracking: boolean;
    categoryAnalysis: boolean;
  };
  notificationSettings: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    inAppNotifications: boolean;
  };
  contextSettings: {
    includeHistoricalData: boolean;
    dataRangeMonths: number;
    includeGoals: boolean;
    includeBudgets: boolean;
  };
}

@Injectable({
  providedIn: 'root',
})
export class AiService {
  private apiUrl = `${environment.apiUrl}/ai`;
  private socket: Socket | null = null;
  
  // Subjects for real-time updates
  private chatMessagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  private insightsSubject = new BehaviorSubject<string[]>([]);
  private typingSubject = new BehaviorSubject<boolean>(false);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new Subject<string>();
  private actionSuggestionSubject = new Subject<AIAction>();
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  
  // Public observables
  public chatMessages$ = this.chatMessagesSubject.asObservable();
  public insights$ = this.insightsSubject.asObservable();
  public isTyping$ = this.typingSubject.asObservable();
  public isLoading$ = this.loadingSubject.asObservable();
  public errors$ = this.errorSubject.asObservable();
  public actionSuggestions$ = this.actionSuggestionSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  constructor(
    private http: HttpClient,
    private tokenService: TokenService
  ) {
    this.initializeWebSocket();
  }

  private initializeWebSocket(): void {
    const token = this.tokenService.getAccessToken();
    if (!token) {
      console.warn('No auth token available for WebSocket connection. User needs to log in first.');
      return;
    }

    // Check if token looks valid (basic format check)
    if (!token.includes('.') || token.length < 100) {
      console.warn('Token appears invalid, attempting to get a fresh one...');
      this.refreshTokenAndReconnect();
      return;
    }

    console.log('Initializing AI WebSocket connection to:', `${environment.baseUrl}/ai`);
    console.log('Token info:', {
      hasToken: !!token,
      tokenLength: token.length,
      tokenStart: token.length > 20 ? token.substring(0, 20) + '...' : 'token too short'
    });
    
    this.socket = io(`${environment.baseUrl}/ai`, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      forceNew: true
    });

    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('AI WebSocket connected successfully');
      this.connectionStatusSubject.next(true);
    });

    this.socket.on('connect_error', (error) => {
      console.error('AI WebSocket connection error:', error);
      
      // If it's an authentication error, try to reconnect once with a fresh token
      if (error.message?.includes('Authentication error')) {
        console.log('Authentication error detected, attempting to reconnect with fresh token...');
        setTimeout(() => {
          this.reconnect();
        }, 2000);
      }
      
      this.connectionStatusSubject.next(false);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('AI WebSocket disconnected:', reason);
      this.connectionStatusSubject.next(false);
    });

    this.socket.on('ai:response', (data: any) => {
      console.log('🔥 AI Response received:', data);
      const currentMessages = this.chatMessagesSubject.value;
      
      // Find the last message with matching user message and no AI response
      const lastMessageIndex = currentMessages.length - 1;
      const lastMessage = currentMessages[lastMessageIndex];
      
      if (lastMessage && 
          lastMessage.userMessage === data.message && 
          (!lastMessage.aiResponse || lastMessage.aiResponse === '')) {
        // Update existing message
        const updatedMessages = [...currentMessages];
        updatedMessages[lastMessageIndex] = {
          ...updatedMessages[lastMessageIndex],
          aiResponse: data.response,
          responseType: typeof data.response === 'object' ? 'action' : 'text',
          timestamp: data.timestamp
        };
        this.chatMessagesSubject.next(updatedMessages);
        console.log('✅ Updated existing message with AI response');
      } else {
        // Create new complete message (fallback)
        const newMessage: ChatMessage = {
          userMessage: data.message,
          aiResponse: data.response,
          responseType: typeof data.response === 'object' ? 'action' : 'text',
          timestamp: data.timestamp,
          sessionId: data.sessionId
        };
        this.chatMessagesSubject.next([...currentMessages, newMessage]);
        console.log('⚠️ Created new complete message - lastMessage:', lastMessage);
      }
    });

    this.socket.on('ai:typing', (data: { isTyping: boolean }) => {
      this.typingSubject.next(data.isTyping);
    });

    this.socket.on('ai:insights', (data: { insights: string[], timestamp: string }) => {
      this.insightsSubject.next(data.insights);
    });

    this.socket.on('ai:insights_loading', (data: { loading: boolean }) => {
      this.loadingSubject.next(data.loading);
    });

    this.socket.on('ai:action_suggestion', (data: { action: AIAction, timestamp: string }) => {
      this.actionSuggestionSubject.next(data.action);
    });

    this.socket.on('ai:error', (data: { message: string, error?: string }) => {
      this.errorSubject.next(data.message);
    });

    this.socket.on('ai:history', (data: { history: ChatMessage[], pagination: any }) => {
      console.log('📜 Chat history received:', data.history);
      
      // Only load history if we don't have any messages yet to avoid overwriting real-time messages
      const currentMessages = this.chatMessagesSubject.value;
      if (currentMessages.length === 0) {
        console.log('📜 Loading initial chat history');
        this.chatMessagesSubject.next(data.history.reverse());
      } else {
        console.log('📜 Skipping history load - real-time messages present');
      }
    });

    this.socket.on('disconnect', () => {
      console.log('AI WebSocket disconnected');
    });
  }

  // REST API Methods
  getInsights(): Observable<{ success: boolean; insights: string[] }> {
    return this.http.get<{ success: boolean; insights: string[] }>(`${this.apiUrl}/insights`);
  }

  sendChatMessage(message: string, sessionId?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/chat`, { 
      userInput: message, 
      sessionId 
    });
  }

  getChatHistory(page: number = 1, limit: number = 20): Observable<any> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    
    return this.http.get(`${this.apiUrl}/history`, { params });
  }

  executeAction(action: AIAction): Observable<any> {
    return this.http.post(`${this.apiUrl}/execute-action`, { action });
  }

  getPreferences(): Observable<{ success: boolean; preferences: AIPreferences }> {
    return this.http.get<{ success: boolean; preferences: AIPreferences }>(`${this.apiUrl}/preferences`);
  }

  updatePreferences(preferences: Partial<AIPreferences>): Observable<any> {
    return this.http.put(`${this.apiUrl}/preferences`, preferences);
  }

  // WebSocket Methods
  sendRealtimeChatMessage(message: string, sessionId?: string): void {
    console.log('Attempting to send chat message:', { message, sessionId, connected: this.socket?.connected });
    if (this.socket?.connected) {
      this.socket.emit('ai:chat', { message, sessionId });
      console.log('Message sent via WebSocket');
    } else {
      console.warn('WebSocket not connected, cannot send message');
      this.errorSubject.next('Not connected to AI service');
    }
  }

  requestRealtimeInsights(): void {
    if (this.socket?.connected) {
      this.socket.emit('ai:get_insights');
    }
  }

  loadChatHistory(page: number = 1, limit: number = 20): void {
    if (this.socket?.connected) {
      this.socket.emit('ai:get_history', { page, limit });
    }
  }

  executeRealtimeAction(action: AIAction, chatId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('ai:execute_action', { action, chatId });
    }
  }

  // Utility Methods
  clearChatHistory(): void {
    this.chatMessagesSubject.next([]);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  reconnect(): void {
    this.disconnect();
    this.initializeWebSocket();
  }

  // Generate session ID
  generateSessionId(): string {
    return 'session_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  // Utility method to set token manually for testing
  setTokenAndReconnect(token: string): void {
    console.log('Setting new token and reconnecting...');
    this.tokenService.setAccessToken(token);
    this.reconnect();
  }

  // Method to get current token info
  getTokenInfo(): any {
    const token = this.tokenService.getAccessToken();
    return {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      tokenStart: token?.substring(0, 30) + '...' || 'No token'
    };
  }

  // Method to refresh token and reconnect
  private refreshTokenAndReconnect(): void {
    console.log('Attempting to refresh token via API call...');
    
    // Make any API call to trigger token refresh through the HTTP interceptor
    this.http.get(`${environment.apiUrl}/user/profile`).subscribe({
      next: () => {
        console.log('Token refreshed, reconnecting WebSocket...');
        setTimeout(() => this.reconnect(), 1000);
      },
      error: (error) => {
        console.error('Failed to refresh token:', error);
        this.errorSubject.next('Authentication failed. Please log in again.');
      }
    });
  }

  // Method to add user message to chat
  addUserMessage(message: string, sessionId?: string): void {
    const currentMessages = this.chatMessagesSubject.value;
    const userMessage: ChatMessage = {
      userMessage: message,
      aiResponse: '',
      responseType: 'text',
      timestamp: new Date().toISOString(),
      sessionId: sessionId || this.generateSessionId()
    };
    
    this.chatMessagesSubject.next([...currentMessages, userMessage]);
    console.log('➕ Added user message:', userMessage);
  }
}
