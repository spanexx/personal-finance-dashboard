import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';

import { NotificationService } from '../../../core/services/notification.service';
import { EmailVerificationComponent } from '../../../shared/components/email-verification/email-verification.component';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    EmailVerificationComponent
  ],
  template: `
    <div class="verify-email-container">
      <mat-card class="verify-card">
        <!-- Loading State -->
        <div *ngIf="isLoading" class="loading-section">
          <mat-spinner diameter="50"></mat-spinner>
          <h2>Verifying Your Email...</h2>
          <p>Please wait while we verify your email address.</p>
        </div>

        <!-- Success State -->
        <div *ngIf="!isLoading && isVerified" class="success-section">
          <mat-icon class="success-icon">verified</mat-icon>
          <h2>Email Verified Successfully!</h2>
          <p>Your email has been verified. You can now log in to your account.</p>
          <div class="actions">
            <button mat-raised-button color="primary" (click)="navigateToLogin()">
              Go to Login
            </button>
          </div>
        </div>

        <!-- Error State -->
        <div *ngIf="!isLoading && !isVerified && hasError" class="error-section">
          <mat-icon class="error-icon">error</mat-icon>
          <h2>Verification Failed</h2>
          <p class="error-message">{{ errorMessage }}</p>
          <div class="actions">
            <button mat-raised-button color="primary" (click)="navigateToLogin()">
              Go to Login
            </button>
            <button 
              mat-button 
              (click)="resendVerification()" 
              [disabled]="!canResend || resendCooldown > 0">
              <span *ngIf="resendCooldown > 0">
                Resend in {{ resendCooldown }}s
              </span>
              <span *ngIf="resendCooldown === 0">
                Request New Verification Email
              </span>
            </button>
          </div>
        </div>        <!-- Email Verification Component for Resend -->
        <div *ngIf="showResendComponent" class="resend-section">
          <app-email-verification
            [email]="userEmail"
            [isCompact]="true"
            [autoRefresh]="false"
            (resendRequested)="onVerificationRequested($event)"
            (verificationComplete)="onVerificationComplete()">
          </app-email-verification>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .verify-email-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .verify-card {
      max-width: 500px;
      width: 100%;
      padding: 40px;
      text-align: center;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    .loading-section,
    .success-section,
    .error-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    .success-icon {
      font-size: 64px;
      height: 64px;
      width: 64px;
      color: #4caf50;
    }

    .error-icon {
      font-size: 64px;
      height: 64px;
      width: 64px;
      color: #f44336;
    }

    h2 {
      margin: 0;
      color: #333;
      font-weight: 500;
    }

    p {
      margin: 0;
      color: #666;
      line-height: 1.5;
    }

    .error-message {
      color: #f44336;
      font-weight: 500;
    }

    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 10px;
    }

    @media (max-width: 600px) {
      .verify-card {
        padding: 24px;
      }
      
      .actions {
        flex-direction: column;
      }
    }
  `]
})
export class VerifyEmailComponent implements OnInit, OnDestroy {
  isLoading = true;
  isVerified = false;
  hasError = false;
  errorMessage = '';
  canResend = true;
  resendCooldown = 0;
  showResendComponent = false;
  userEmail = '';
  
  private destroy$ = new Subject<void>();
  private cooldownTimer?: any;

  constructor(
    private notificationService: NotificationService,
    private router: Router,
    private route: ActivatedRoute
  ) {}
  ngOnInit(): void {
    // Get token from URL parameters
    const token = this.route.snapshot.queryParams['token'];
    
    if (!token) {
      this.handleVerificationError('Invalid verification link. No token provided.');
      return;
    }

    this.verifyEmailToken(token);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }
  }  private verifyEmailToken(token: string): void {
    // TODO: Implement email verification via AuthenticationService or NgRx action
    // Example: this.store.dispatch(AuthActions.verifyEmail({ token }));
    setTimeout(() => {
      this.isLoading = false;
      this.isVerified = true;
      this.hasError = false;
      // this.emailVerificationService.markEmailAsVerified(''); // Remove or replace as needed
      this.notificationService.success('Email verified successfully!');
      setTimeout(() => {
        this.router.navigate(['/auth/email-verification-success']);
      }, 1500);
    }, 1000);
  }

  private handleVerificationError(message: string): void {
    this.isLoading = false;
    this.isVerified = false;
    this.hasError = true;
    this.errorMessage = message;
    this.notificationService.error(message);
  }

  navigateToLogin(): void {
    if (this.isVerified) {
      this.router.navigate(['/auth/login'], {
        queryParams: { message: 'Email verified! You can now log in.' }
      });
    } else {
      this.router.navigate(['/auth/login']);
    }
  }

  resendVerification(): void {
    if (!this.canResend || this.resendCooldown > 0) return;

    this.showResendComponent = true;
  }
  onVerificationRequested(email: string): void {
    this.userEmail = email;
    this.startResendCooldown();
    this.notificationService.info('Verification email sent! Please check your inbox.');
  }

  onVerificationComplete(): void {
    this.isVerified = true;
    this.hasError = false;
    this.showResendComponent = false;
    this.notificationService.success('Email verified successfully!');
  }

  private startResendCooldown(): void {
    this.canResend = false;
    this.resendCooldown = 60;
    
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        this.canResend = true;
        clearInterval(this.cooldownTimer);
      }
    }, 1000);
  }
}
