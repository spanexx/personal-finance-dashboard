import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { PasswordSecurityService } from '../../../core/services/password-security.service';
import { PasswordStrengthMeterComponent } from '../../../shared/components/password-strength-meter/password-strength-meter.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PasswordStrengthMeterComponent
  ],
  template: `
    <div class="forgot-password-container">
      <mat-card class="forgot-password-card">
        <mat-card-header>
          <mat-card-title>
            <mat-icon>lock_reset</mat-icon>
            {{ isResetMode ? 'Reset Password' : 'Forgot Password' }}
          </mat-card-title>
          <mat-card-subtitle>
            {{ isResetMode ? 'Enter your new password' : 'Enter your email to receive reset instructions' }}
          </mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <!-- Forgot Password Form -->
          <form [formGroup]="forgotPasswordForm" (ngSubmit)="onSubmitForgotPassword()" *ngIf="!isResetMode && !emailSent">
            <mat-form-field appearance="outline">
              <mat-label>Email Address</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                placeholder="Enter your email address"
                [attr.aria-describedby]="'email-errors'"
                autocomplete="email"
              />
              <mat-icon matSuffix>email</mat-icon>
              <mat-error id="email-errors" *ngIf="forgotPasswordForm.get('email')?.invalid && forgotPasswordForm.get('email')?.touched">
                <span *ngIf="forgotPasswordForm.get('email')?.errors?.['required']">Email is required</span>
                <span *ngIf="forgotPasswordForm.get('email')?.errors?.['email']">Please enter a valid email address</span>
              </mat-error>
            </mat-form-field>

            <div class="form-actions">
              <button
                mat-raised-button
                color="primary"
                type="submit"
                [disabled]="forgotPasswordForm.invalid || isLoading"
                class="submit-button"
              >
                <mat-spinner *ngIf="isLoading" diameter="20"></mat-spinner>
                <mat-icon *ngIf="!isLoading">send</mat-icon>
                {{ isLoading ? 'Sending...' : 'Send Reset Link' }}
              </button>

              <button
                mat-button
                type="button"
                (click)="goToLogin()"
                [disabled]="isLoading"
              >
                <mat-icon>arrow_back</mat-icon>
                Back to Login
              </button>
            </div>
          </form>

          <!-- Email Sent Confirmation -->
          <div class="email-sent-confirmation" *ngIf="emailSent && !isResetMode">
            <div class="success-icon">
              <mat-icon>mark_email_read</mat-icon>
            </div>
            <h3>Check Your Email</h3>
            <p>
              We've sent password reset instructions to <strong>{{ submittedEmail }}</strong>
            </p>
            <p class="instruction-text">
              Click the link in the email to reset your password. The link will expire in 1 hour.
            </p>

            <div class="email-actions">
              <button
                mat-button
                (click)="resendResetEmail()"
                [disabled]="resendCooldown > 0 || isLoading"
              >
                <mat-spinner *ngIf="isLoading" diameter="20"></mat-spinner>
                <mat-icon *ngIf="!isLoading">refresh</mat-icon>
                {{ resendCooldown > 0 ? 'Resend in ' + resendCooldown + 's' : 'Resend Email' }}
              </button>

              <button mat-button (click)="goToLogin()">
                <mat-icon>arrow_back</mat-icon>
                Back to Login
              </button>
            </div>
          </div>

          <!-- Reset Password Form -->
          <form [formGroup]="resetPasswordForm" (ngSubmit)="onSubmitResetPassword()" *ngIf="isResetMode && !resetComplete">
            <mat-form-field appearance="outline">
              <mat-label>New Password</mat-label>
              <input
                matInput
                [type]="showPassword ? 'text' : 'password'"
                formControlName="password"
                placeholder="Enter your new password"
                [attr.aria-describedby]="'password-errors password-strength'"
                autocomplete="new-password"
              />
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="togglePasswordVisibility()"
                [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
              >
                <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error id="password-errors" *ngIf="resetPasswordForm.get('password')?.invalid && resetPasswordForm.get('password')?.touched">
                <span *ngIf="resetPasswordForm.get('password')?.errors?.['required']">Password is required</span>
                <span *ngIf="resetPasswordForm.get('password')?.errors?.['minlength']">Password must be at least 8 characters</span>
                <span *ngIf="resetPasswordForm.get('password')?.errors?.['weakPassword']">Password does not meet security requirements</span>
              </mat-error>
            </mat-form-field>            <!-- Password Strength Meter -->
            <app-password-strength-meter
              id="password-strength"
              [ngModel]="resetPasswordForm.get('password')?.value || ''"
              (validChange)="onPasswordValidChange($event)"
              [showRequirements]="true"
              [showFeedback]="true">
            </app-password-strength-meter>

            <mat-form-field appearance="outline">
              <mat-label>Confirm New Password</mat-label>
              <input
                matInput
                [type]="showConfirmPassword ? 'text' : 'password'"
                formControlName="confirmPassword"
                placeholder="Confirm your new password"
                [attr.aria-describedby]="'confirm-password-errors'"
                autocomplete="new-password"
              />
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="toggleConfirmPasswordVisibility()"
                [attr.aria-label]="showConfirmPassword ? 'Hide password' : 'Show password'"
              >
                <mat-icon>{{ showConfirmPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error id="confirm-password-errors" *ngIf="resetPasswordForm.get('confirmPassword')?.invalid && resetPasswordForm.get('confirmPassword')?.touched">
                <span *ngIf="resetPasswordForm.get('confirmPassword')?.errors?.['required']">Please confirm your password</span>
                <span *ngIf="resetPasswordForm.get('confirmPassword')?.errors?.['passwordMismatch']">Passwords do not match</span>
              </mat-error>
            </mat-form-field>

            <div class="form-actions">
              <button
                mat-raised-button
                color="primary"
                type="submit"
                [disabled]="resetPasswordForm.invalid || !isPasswordValid || isLoading"
                class="submit-button"
              >
                <mat-spinner *ngIf="isLoading" diameter="20"></mat-spinner>
                <mat-icon *ngIf="!isLoading">lock</mat-icon>
                {{ isLoading ? 'Resetting...' : 'Reset Password' }}
              </button>

              <button
                mat-button
                type="button"
                (click)="goToLogin()"
                [disabled]="isLoading"
              >
                <mat-icon>cancel</mat-icon>
                Cancel
              </button>
            </div>
          </form>

          <!-- Reset Complete -->
          <div class="reset-complete-confirmation" *ngIf="resetComplete">
            <div class="success-icon">
              <mat-icon>check_circle</mat-icon>
            </div>
            <h3>Password Reset Successful</h3>
            <p>Your password has been successfully reset.</p>
            <p class="instruction-text">
              You can now log in with your new password.
            </p>

            <div class="form-actions">
              <button
                mat-raised-button
                color="primary"
                (click)="goToLogin()"
              >
                <mat-icon>login</mat-icon>
                Go to Login
              </button>
            </div>
          </div>

          <!-- Error Message -->
          <div class="error-message" *ngIf="errorMessage" role="alert">
            <mat-icon>error</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Additional Help -->
      <div class="additional-help" *ngIf="!emailSent && !resetComplete">
        <h4>Need Help?</h4>
        <ul>
          <li>Make sure you're using the email address associated with your account</li>
          <li>Check your spam folder if you don't receive the email</li>
          <li>Reset links expire after 1 hour for security</li>
          <li>Contact support if you continue to have issues</li>
        </ul>
      </div>
    </div>
  `,
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent implements OnInit, OnDestroy {
  forgotPasswordForm: FormGroup;
  resetPasswordForm: FormGroup;
  
  isResetMode = false;
  emailSent = false;
  resetComplete = false;
  isLoading = false;
  showPassword = false;
  showConfirmPassword = false;
  isPasswordValid = false;
  
  submittedEmail = '';
  errorMessage = '';
  resetToken = '';
  resendCooldown = 0;
  
  private resendTimer: any;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private authApiService: AuthApiService,
    private passwordSecurityService: PasswordSecurityService,
    private snackBar: MatSnackBar
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.resetPasswordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    // Check if we're in reset mode (token in URL)
    this.route.queryParams.subscribe(params => {
      if (params['token']) {
        this.isResetMode = true;
        this.resetToken = params['token'];
        this.validateResetToken();
      }
    });
  }

  onSubmitForgotPassword(): void {
    if (this.forgotPasswordForm.valid && !this.isLoading) {
      this.isLoading = true;
      this.errorMessage = '';
      
      const email = this.forgotPasswordForm.get('email')?.value;
      
      this.authApiService.forgotPassword(email).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success) {
            this.emailSent = true;
            this.submittedEmail = email;
            this.startResendCooldown();
          } else {
            this.errorMessage = response.message || 'Failed to send reset email';
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.handleError(error);
        }
      });
    }
  }

  onSubmitResetPassword(): void {
    if (this.resetPasswordForm.valid && this.isPasswordValid && !this.isLoading) {
      this.isLoading = true;
      this.errorMessage = '';
        const password = this.resetPasswordForm.get('password')?.value;
      
      this.authApiService.resetPassword({
        token: this.resetToken,
        newPassword: password
      }).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success) {
            this.resetComplete = true;
            this.snackBar.open('Password reset successfully!', 'Close', {
              duration: 5000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            });
          } else {
            this.errorMessage = response.message || 'Failed to reset password';
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.handleError(error);
        }
      });
    }
  }

  resendResetEmail(): void {
    if (this.resendCooldown === 0 && !this.isLoading) {
      this.isLoading = true;
      
      this.authApiService.forgotPassword(this.submittedEmail).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success) {
            this.snackBar.open('Reset email sent again!', 'Close', {
              duration: 3000,
              horizontalPosition: 'right',
              verticalPosition: 'top'
            });
            this.startResendCooldown();
          } else {
            this.errorMessage = response.message || 'Failed to resend email';
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.handleError(error);
        }
      });
    }
  }

  private validateResetToken(): void {
    if (!this.resetToken) {
      this.errorMessage = 'Invalid or missing reset token';
      return;
    }
    
    // Token validation could be done here if the backend provides an endpoint
    // For now, we'll validate when the user submits the form
  }

  private startResendCooldown(): void {
    this.resendCooldown = 60; // 60 seconds
    
    this.resendTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.resendTimer);
      }
    }, 1000);
  }

  private handleError(error: any): void {
    console.error('Password reset error:', error);
    
    if (error.status === 404) {
      this.errorMessage = 'Email address not found';
    } else if (error.status === 400) {
      this.errorMessage = error.error?.message || 'Invalid request';
    } else if (error.status === 429) {
      this.errorMessage = 'Too many reset requests. Please try again later.';
    } else {
      this.errorMessage = 'An error occurred. Please try again.';
    }
  }

  private passwordMatchValidator(control: FormGroup): { [key: string]: any } | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  onPasswordValidChange(isValid: boolean): void {
    this.isPasswordValid = isValid;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  ngOnDestroy(): void {
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
    }
  }
}
