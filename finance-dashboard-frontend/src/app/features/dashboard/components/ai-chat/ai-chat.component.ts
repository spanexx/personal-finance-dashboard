import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule, TitleCasePipe, JsonPipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AiService, ChatMessage, AIAction } from '../../../../core/services/ai.service';

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TitleCasePipe, JsonPipe],
  templateUrl: './ai-chat.component.html',
  styleUrls: ['./ai-chat.component.scss']
})
export class AiChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  
  chatForm: FormGroup;
  messages: ChatMessage[] = [];
  isTyping = false;
  isLoading = false;
  sessionId: string;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private aiService: AiService,
    private cdr: ChangeDetectorRef
  ) {
    this.chatForm = this.fb.group({
      message: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(1000)]]
    });
    
    this.sessionId = this.aiService.generateSessionId();
  }

  ngOnInit(): void {
    this.subscribeToAIService();
    // Don't automatically load chat history - start fresh
    // this.loadChatHistory();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private subscribeToAIService(): void {
    // Subscribe to chat messages
    this.subscriptions.push(
      this.aiService.chatMessages$.subscribe(messages => {
        console.log('🔄 Chat messages updated:', messages);
        this.messages = messages;
        this.cdr.detectChanges(); // Force change detection
      })
    );

    // Subscribe to typing indicator
    this.subscriptions.push(
      this.aiService.isTyping$.subscribe(isTyping => {
        this.isTyping = isTyping;
        // Enable/disable form control based on typing state
        if (isTyping) {
          this.chatForm.get('message')?.disable();
        } else {
          this.chatForm.get('message')?.enable();
        }
      })
    );

    // Subscribe to loading state
    this.subscriptions.push(
      this.aiService.isLoading$.subscribe(isLoading => {
        this.isLoading = isLoading;
      })
    );

    // Subscribe to errors
    this.subscriptions.push(
      this.aiService.errors$.subscribe(error => {
        console.error('AI Service Error:', error);
        // Handle error display
      })
    );

    // Subscribe to action suggestions
    this.subscriptions.push(
      this.aiService.actionSuggestions$.subscribe(action => {
        // Handle action suggestions
        console.log('Action suggested:', action);
      })
    );
  }

  sendMessage(): void {
    if (this.chatForm.valid && !this.isTyping) {
      const message = this.chatForm.get('message')?.value.trim();
      
      if (message) {
        // Add user message via AI service to keep everything in sync
        this.aiService.addUserMessage(message, this.sessionId);
        
        // Send via WebSocket for real-time response
        this.aiService.sendRealtimeChatMessage(message, this.sessionId);
        
        // Clear form
        this.chatForm.get('message')?.setValue('');
      }
    }
  }

  loadChatHistory(): void {
    console.log('🔄 Loading chat history...');
    this.aiService.loadChatHistory(1, 50);
  }

  executeAction(action: AIAction, messageIndex: number): void {
    this.aiService.executeRealtimeAction(action);
    
    // Mark message as action executed
    if (this.messages[messageIndex]) {
      this.messages[messageIndex].actionExecuted = true;
    }
  }

  clearChat(): void {
    this.aiService.clearChatHistory();
    this.sessionId = this.aiService.generateSessionId();
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  // Helper methods for template
  isActionMessage(message: ChatMessage): boolean {
    return message.responseType === 'action' && typeof message.aiResponse === 'object';
  }

  getActionFromMessage(message: ChatMessage): AIAction | null {
    if (this.isActionMessage(message)) {
      return message.aiResponse as AIAction;
    }
    return null;
  }

  formatTimestamp(timestamp: string): string {
    return new Date(timestamp).toLocaleTimeString();
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}
