import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-email-verification-success',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="success-container">
      <mat-card class="success-card">
        <mat-card-content>
          <div class="success-content">
            <div class="success-icon-container">
              <mat-icon class="success-icon">verified</mat-icon>
              <div class="checkmark-animation">
                <div class="checkmark"></div>
              </div>
            </div>
            
            <h1 class="success-title">Email Verified Successfully!</h1>
            
            <p class="success-message">
              Congratulations! Your email address has been verified successfully. 
              You now have full access to all features of your Personal Finance Dashboard.
            </p>

            <div class="benefits-list">
              <h3>What you can now do:</h3>
              <div class="benefit-item">
                <mat-icon>security</mat-icon>
                <span>Enhanced account security</span>
              </div>
              <div class="benefit-item">
                <mat-icon>notifications</mat-icon>
                <span>Receive important notifications</span>
              </div>
              <div class="benefit-item">
                <mat-icon>backup</mat-icon>
                <span>Backup and restore your data</span>
              </div>
              <div class="benefit-item">
                <mat-icon>sync</mat-icon>
                <span>Sync across multiple devices</span>
              </div>
            </div>

            <div class="action-buttons">
              <button 
                mat-raised-button 
                color="primary" 
                class="primary-btn"
                (click)="navigateToDashboard()"
                aria-label="Go to Dashboard">
                <mat-icon>dashboard</mat-icon>
                Go to Dashboard
              </button>
              
              <button 
                mat-button 
                class="secondary-btn"
                (click)="navigateToLogin()"
                aria-label="Go to Login">
                <mat-icon>login</mat-icon>
                Login to Account
              </button>
            </div>

            <div class="additional-info">
              <p class="info-text">
                <mat-icon>info</mat-icon>
                If you have any questions or need help getting started, 
                visit our <a href="#" (click)="openHelp($event)" class="help-link">Help Center</a>.
              </p>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .success-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
    }

    .success-card {
      max-width: 600px;
      width: 100%;
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
      overflow: hidden;
    }

    .success-content {
      text-align: center;
      padding: 20px;
    }

    .success-icon-container {
      position: relative;
      display: inline-block;
      margin-bottom: 24px;
    }

    .success-icon {
      font-size: 80px;
      height: 80px;
      width: 80px;
      color: #4CAF50;
      animation: fadeInScale 0.6s ease-out;
    }

    .checkmark-animation {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 100px;
      height: 100px;
      border-radius: 50%;
      border: 3px solid #4CAF50;
      opacity: 0;
      animation: ringScale 0.8s ease-out 0.3s forwards;
    }

    .checkmark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(45deg);
      width: 20px;
      height: 40px;
      border: solid #4CAF50;
      border-width: 0 4px 4px 0;
      opacity: 0;
      animation: checkmarkDraw 0.4s ease-out 0.6s forwards;
    }

    .success-title {
      font-size: 2rem;
      font-weight: 600;
      color: #2E7D32;
      margin: 0 0 16px 0;
      animation: slideUp 0.6s ease-out 0.2s both;
    }

    .success-message {
      font-size: 1.1rem;
      color: #555;
      line-height: 1.6;
      margin-bottom: 32px;
      animation: slideUp 0.6s ease-out 0.4s both;
    }

    .benefits-list {
      margin: 32px 0;
      animation: slideUp 0.6s ease-out 0.6s both;
    }

    .benefits-list h3 {
      font-size: 1.2rem;
      color: #333;
      margin-bottom: 16px;
    }

    .benefit-item {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 12px;
      margin: 12px 0;
      padding: 8px 16px;
      background: #f8f9fa;
      border-radius: 8px;
      text-align: left;
    }

    .benefit-item mat-icon {
      color: #4CAF50;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .action-buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
      margin: 32px 0;
      flex-wrap: wrap;
      animation: slideUp 0.6s ease-out 0.8s both;
    }

    .primary-btn {
      padding: 12px 24px;
      font-size: 1.1rem;
      font-weight: 500;
      border-radius: 8px;
    }

    .secondary-btn {
      padding: 12px 24px;
      font-size: 1rem;
      border-radius: 8px;
    }

    .additional-info {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #e0e0e0;
      animation: fadeIn 0.6s ease-out 1s both;
    }

    .info-text {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 0.9rem;
      color: #666;
      margin: 0;
    }

    .info-text mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2196F3;
    }

    .help-link {
      color: #2196F3;
      text-decoration: none;
      font-weight: 500;
    }

    .help-link:hover {
      text-decoration: underline;
    }

    /* Animations */
    @keyframes fadeInScale {
      from {
        opacity: 0;
        transform: scale(0.5);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes ringScale {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.8);
      }
      to {
        opacity: 0.3;
        transform: translate(-50%, -50%) scale(1.1);
      }
    }

    @keyframes checkmarkDraw {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    /* Responsive design */
    @media (max-width: 600px) {
      .success-container {
        padding: 16px;
      }
      
      .success-content {
        padding: 16px;
      }
      
      .success-title {
        font-size: 1.5rem;
      }
      
      .action-buttons {
        flex-direction: column;
        align-items: center;
      }
      
      .primary-btn,
      .secondary-btn {
        width: 100%;
        max-width: 280px;
      }
    }
  `]
})
export class EmailVerificationSuccessComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Any initialization logic if needed
  }

  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  navigateToLogin(): void {
    this.router.navigate(['/auth/login'], {
      queryParams: { message: 'Email verified! You can now log in.' }
    });
  }

  openHelp(event: Event): void {
    event.preventDefault();
    // Open help center or navigate to help page
    window.open('/help', '_blank');
  }
}
