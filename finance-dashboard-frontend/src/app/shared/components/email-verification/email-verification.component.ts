import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil, timer } from 'rxjs';
import { EmailVerificationService, EmailVerificationStatus } from '../../../core/services/email-verification.service';

@Component({
  selector: 'app-email-verification',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="email-verification" [ngClass]="{ 'compact': isCompact }">
      <!-- Verification Status Card -->
      <mat-card class="verification-card" [ngClass]="verificationStatusClass">
        <mat-card-content>
          <div class="status-header">
            <mat-icon [ngClass]="statusIconClass">{{ statusIcon }}</mat-icon>
            <div class="status-info">
              <h3 class="status-title">{{ statusTitle }}</h3>
              <p class="status-message">{{ statusMessage }}</p>
            </div>
          </div>

          <!-- Email Address Display -->
          <div class="email-display" *ngIf="email">
            <mat-icon>email</mat-icon>
            <span>{{ email }}</span>
          </div>

          <!-- Action Buttons -->
          <div class="verification-actions" *ngIf="showActions">
            <!-- Resend Button -->
            <button
              mat-raised-button
              color="primary"
              (click)="resendVerification()"
              [disabled]="!canResend || isLoading"
              *ngIf="!verificationStatus?.isVerified"
              [attr.aria-label]="'Resend verification email'"
            >
              <mat-icon *ngIf="!isLoading">send</mat-icon>
              <mat-spinner *ngIf="isLoading" diameter="20"></mat-spinner>
              {{ resendButtonText }}
            </button>

            <!-- Refresh Status Button -->
            <button
              mat-button
              (click)="refreshStatus()"
              [disabled]="isLoading"
              *ngIf="!verificationStatus?.isVerified"
              [attr.aria-label]="'Refresh verification status'"
            >
              <mat-icon>refresh</mat-icon>
              Check Status
            </button>

            <!-- Continue Button (when verified) -->
            <button
              mat-raised-button
              color="primary"
              (click)="onContinue()"
              *ngIf="verificationStatus?.isVerified && showContinueButton"
              [attr.aria-label]="'Continue to application'"
            >
              <mat-icon>arrow_forward</mat-icon>
              Continue
            </button>
          </div>

          <!-- Cooldown Timer -->
          <div class="cooldown-timer" *ngIf="cooldownRemaining > 0" role="status" aria-live="polite">
            <mat-icon>timer</mat-icon>
            <span>
              You can resend the verification email in {{ cooldownRemaining }} seconds
            </span>
          </div>

          <!-- Loading State -->
          <div class="loading-state" *ngIf="isLoading && !cooldownRemaining" role="status" aria-live="polite">
            <mat-spinner diameter="24"></mat-spinner>
            <span>{{ loadingMessage }}</span>
          </div>

          <!-- Error State -->
          <div class="error-state" *ngIf="errorMessage" role="alert">
            <mat-icon>error</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Additional Info -->
      <div class="additional-info" *ngIf="!isCompact">
        <h4>Why verify your email?</h4>
        <ul>
          <li><mat-icon>security</mat-icon> Secure your account with email recovery</li>
          <li><mat-icon>notifications</mat-icon> Receive important account notifications</li>
          <li><mat-icon>verified</mat-icon> Access all features of the dashboard</li>
          <li><mat-icon>backup</mat-icon> Backup and restore your financial data</li>
        </ul>
        
        <div class="help-section">
          <h5>Didn't receive the email?</h5>
          <ul class="help-list">
            <li>Check your spam or junk mail folder</li>
            <li>Make sure {{ email }} is correct</li>
            <li>Add our domain to your safe senders list</li>
            <li>Try resending the verification email</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./email-verification.component.scss']
})
export class EmailVerificationComponent implements OnInit, OnDestroy {
  @Input() email = '';
  @Input() isCompact = false;
  @Input() showActions = true;
  @Input() showContinueButton = true;
  @Input() autoRefresh = true;
  @Input() refreshInterval = 30000; // 30 seconds

  @Output() verificationComplete = new EventEmitter<void>();
  @Output() resendRequested = new EventEmitter<string>();
  @Output() continueClicked = new EventEmitter<void>();

  verificationStatus: EmailVerificationStatus | null = null;
  isLoading = false;
  errorMessage = '';
  loadingMessage = 'Checking verification status...';
  cooldownRemaining = 0;

  private destroy$ = new Subject<void>();
  private refreshTimer$ = new Subject<void>();

  constructor(
    private emailVerificationService: EmailVerificationService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadVerificationStatus();
    this.setupAutoRefresh();
    this.subscribeToCooldown();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.refreshTimer$.complete();
  }

  private loadVerificationStatus(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.loadingMessage = 'Checking verification status...';

    this.emailVerificationService.getVerificationStatus(this.email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.verificationStatus = status;
          this.isLoading = false;
          
          if (status.isVerified) {
            this.verificationComplete.emit();
          }
        },
        error: (error) => {
          this.handleError('Failed to check verification status', error);
        }
      });
  }

  private setupAutoRefresh(): void {
    if (this.autoRefresh) {
      timer(this.refreshInterval, this.refreshInterval)
        .pipe(takeUntil(this.destroy$), takeUntil(this.refreshTimer$))
        .subscribe(() => {
          if (!this.verificationStatus?.isVerified && !this.isLoading) {
            this.refreshStatus();
          }
        });
    }
  }

  private subscribeToCooldown(): void {
    this.emailVerificationService.cooldown$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cooldown => {
        this.cooldownRemaining = cooldown;
      });
  }

  resendVerification(): void {
    if (!this.canResend) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.loadingMessage = 'Sending verification email...';

    this.emailVerificationService.resendVerificationEmail(this.email)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success) {
            this.snackBar.open('Verification email sent successfully!', 'Close', {
              duration: 5000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            });
            this.resendRequested.emit(this.email);
          } else {
            this.errorMessage = response.message || 'Failed to send verification email';
          }
        },
        error: (error) => {
          this.handleError('Failed to send verification email', error);
        }
      });
  }

  refreshStatus(): void {
    this.loadVerificationStatus();
  }

  onContinue(): void {
    this.continueClicked.emit();
  }

  private handleError(message: string, error: any): void {
    this.isLoading = false;
    this.errorMessage = message;
    
    console.error(message, error);
    
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  get canResend(): boolean {
    return this.verificationStatus?.canResend ?? true;
  }

  get statusIcon(): string {
    if (this.verificationStatus?.isVerified) {
      return 'check_circle';
    }
    if (this.verificationStatus?.verificationSent) {
      return 'mail_outline';
    }
    return 'email';
  }

  get statusIconClass(): string {
    if (this.verificationStatus?.isVerified) {
      return 'status-icon verified';
    }
    if (this.verificationStatus?.verificationSent) {
      return 'status-icon sent';
    }
    return 'status-icon pending';
  }

  get statusTitle(): string {
    if (this.verificationStatus?.isVerified) {
      return 'Email Verified';
    }
    if (this.verificationStatus?.verificationSent) {
      return 'Verification Email Sent';
    }
    return 'Email Verification Required';
  }

  get statusMessage(): string {
    if (this.verificationStatus?.isVerified) {
      return 'Your email address has been successfully verified.';
    }
    if (this.verificationStatus?.verificationSent) {
      return 'Please check your email and click the verification link.';
    }
    return 'Please verify your email address to complete your account setup.';
  }

  get verificationStatusClass(): string {
    if (this.verificationStatus?.isVerified) {
      return 'status-verified';
    }
    if (this.verificationStatus?.verificationSent) {
      return 'status-sent';
    }
    return 'status-pending';
  }

  get resendButtonText(): string {
    if (this.isLoading) {
      return 'Sending...';
    }
    if (this.verificationStatus?.verificationSent) {
      return 'Resend Email';
    }
    return 'Send Verification Email';
  }
}
