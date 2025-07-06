import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EmailVerificationComponent } from '../../../shared/components/email-verification/email-verification.component';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-email-verification-failure',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    EmailVerificationComponent
  ],
  template: `
    <div class="failure-container">
      <mat-card class="failure-card">
        <mat-card-content>
          <div class="failure-content">
            <div class="error-icon-container">
              <mat-icon class="error-icon">error</mat-icon>
              <div class="error-animation"></div>
            </div>
            
            <h1 class="failure-title">Email Verification Failed</h1>
            
            <p class="failure-message">
              {{ errorMessage || 'We couldn\'t verify your email address. The verification link may be invalid, expired, or already used.' }}
            </p>

            <div class="error-details" *ngIf="errorCode">
              <div class="error-code">
                <mat-icon>info</mat-icon>
                <span>Error Code: {{ errorCode }}</span>
              </div>
            </div>

            <!-- Troubleshooting Section -->
            <div class="troubleshooting">
              <h3>What can you do?</h3>
              
              <div class="solution-steps">
                <div class="step-item">
                  <div class="step-number">1</div>
                  <div class="step-content">
                    <h4>Request a New Verification Email</h4>
                    <p>Get a fresh verification link sent to your email address.</p>
                    <button 
                      mat-raised-button 
                      color="primary"
                      (click)="showResendForm = true"
                      [disabled]="showResendForm"
                      aria-label="Request new verification email">
                      <mat-icon>send</mat-icon>
                      Send New Email
                    </button>
                  </div>
                </div>

                <div class="step-item">
                  <div class="step-number">2</div>
                  <div class="step-content">
                    <h4>Check Your Email</h4>
                    <p>Look for our email in your inbox, spam, or junk folder.</p>
                  </div>
                </div>

                <div class="step-item">
                  <div class="step-number">3</div>
                  <div class="step-content">
                    <h4>Contact Support</h4>
                    <p>If the problem persists, our support team is here to help.</p>
                    <button 
                      mat-button 
                      (click)="contactSupport()"
                      aria-label="Contact support">
                      <mat-icon>support</mat-icon>
                      Contact Support
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Resend Verification Form -->
            <div class="resend-section" *ngIf="showResendForm">
              <h3>Request New Verification Email</h3>
              <app-email-verification
                [email]="userEmail"
                [isCompact]="false"
                [autoRefresh]="false"
                (verificationComplete)="onVerificationComplete()"
                (resendRequested)="onResendRequested($event)">
              </app-email-verification>
            </div>

            <!-- Common Issues Section -->
            <div class="common-issues">
              <h3>Common Issues</h3>
              <div class="issue-list">
                <div class="issue-item">
                  <mat-icon>schedule</mat-icon>
                  <div>
                    <strong>Link Expired:</strong>
                    <span>Verification links expire after 24 hours for security.</span>
                  </div>
                </div>
                <div class="issue-item">
                  <mat-icon>check_circle</mat-icon>
                  <div>
                    <strong>Already Verified:</strong>
                    <span>Your email might already be verified. Try logging in.</span>
                  </div>
                </div>
                <div class="issue-item">
                  <mat-icon>link_off</mat-icon>
                  <div>
                    <strong>Broken Link:</strong>
                    <span>Email clients sometimes break long links. Copy the full URL.</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="action-buttons">
              <button 
                mat-raised-button 
                color="primary"
                (click)="navigateToLogin()"
                aria-label="Go to login">
                <mat-icon>login</mat-icon>
                Try Login
              </button>
              
              <button 
                mat-button
                (click)="navigateToRegister()"
                aria-label="Go to registration">
                <mat-icon>person_add</mat-icon>
                Create New Account
              </button>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .failure-container {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 20px;
      background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
      padding-top: 40px;
    }

    .failure-card {
      max-width: 700px;
      width: 100%;
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
      overflow: hidden;
    }

    .failure-content {
      text-align: center;
      padding: 32px;
    }

    .error-icon-container {
      position: relative;
      display: inline-block;
      margin-bottom: 24px;
    }

    .error-icon {
      font-size: 80px;
      height: 80px;
      width: 80px;
      color: #f44336;
      animation: shakeError 0.6s ease-out;
    }

    .error-animation {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 100px;
      height: 100px;
      border-radius: 50%;
      border: 3px solid #f44336;
      opacity: 0;
      animation: errorPulse 1s ease-out infinite;
    }

    .failure-title {
      font-size: 2rem;
      font-weight: 600;
      color: #c62828;
      margin: 0 0 16px 0;
    }

    .failure-message {
      font-size: 1.1rem;
      color: #555;
      line-height: 1.6;
      margin-bottom: 24px;
    }

    .error-details {
      background: #ffebee;
      border: 1px solid #ffcdd2;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 32px;
    }

    .error-code {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #c62828;
      font-weight: 500;
    }

    .troubleshooting {
      text-align: left;
      margin: 32px 0;
    }

    .troubleshooting h3 {
      text-align: center;
      font-size: 1.3rem;
      color: #333;
      margin-bottom: 24px;
    }

    .solution-steps {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 12px;
      border-left: 4px solid #2196F3;
    }

    .step-number {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      background: #2196F3;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 1.1rem;
    }

    .step-content {
      flex: 1;
    }

    .step-content h4 {
      margin: 0 0 8px 0;
      color: #333;
      font-size: 1.1rem;
    }

    .step-content p {
      margin: 0 0 12px 0;
      color: #666;
      line-height: 1.5;
    }

    .resend-section {
      margin: 32px 0;
      padding: 24px;
      background: #f8f9fa;
      border-radius: 12px;
      text-align: left;
    }

    .resend-section h3 {
      text-align: center;
      margin-bottom: 20px;
      color: #333;
    }

    .common-issues {
      text-align: left;
      margin: 32px 0;
    }

    .common-issues h3 {
      text-align: center;
      font-size: 1.2rem;
      color: #333;
      margin-bottom: 20px;
    }

    .issue-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .issue-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #fff3e0;
      border-radius: 8px;
    }

    .issue-item mat-icon {
      color: #ff9800;
      font-size: 20px;
      width: 20px;
      height: 20px;
      margin-top: 2px;
    }

    .issue-item strong {
      color: #333;
      display: block;
    }

    .issue-item span {
      color: #666;
      font-size: 0.9rem;
    }

    .action-buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
      margin-top: 32px;
      flex-wrap: wrap;
    }

    .action-buttons button {
      padding: 12px 24px;
      border-radius: 8px;
    }

    /* Animations */
    @keyframes shakeError {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    @keyframes errorPulse {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
      }
      50% {
        opacity: 0.3;
        transform: translate(-50%, -50%) scale(1.1);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(1.3);
      }
    }

    /* Responsive design */
    @media (max-width: 600px) {
      .failure-container {
        padding: 16px;
        padding-top: 20px;
      }
      
      .failure-content {
        padding: 20px;
      }
      
      .failure-title {
        font-size: 1.5rem;
      }
      
      .step-item {
        flex-direction: column;
        text-align: center;
        gap: 12px;
      }
      
      .action-buttons {
        flex-direction: column;
        align-items: center;
      }
      
      .action-buttons button {
        width: 100%;
        max-width: 280px;
      }
    }
  `]
})
export class EmailVerificationFailureComponent implements OnInit {
  errorMessage = '';
  errorCode = '';
  showResendForm = false;
  userEmail = '';

  constructor(
    private notificationService: NotificationService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    // Get error details from query parameters
    this.route.queryParams.subscribe(params => {
      this.errorMessage = params['message'] || '';
      this.errorCode = params['code'] || '';
      this.userEmail = params['email'] || '';
    });
  }

  onVerificationComplete(): void {
    this.notificationService.success('Email verified successfully!');
    this.router.navigate(['/auth/email-verification-success']);
  }

  onResendRequested(email: string): void {
    this.userEmail = email;
    this.notificationService.info('Verification email sent! Please check your inbox.');
  }

  navigateToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  navigateToRegister(): void {
    this.router.navigate(['/auth/register']);
  }

  contactSupport(): void {
    // Navigate to support page or open support email
    window.open('mailto:support@personalfinancedashboard.com?subject=Email Verification Issue', '_blank');
  }
}
