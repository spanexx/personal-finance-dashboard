import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { Store } from '@ngrx/store';
import * as AuthActions from '../../../store/actions/auth.actions';
import { selectAuthLoading, selectAuthError, selectPasswordResetSent } from '../../../store/selectors/auth.selectors';

import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-password-reset',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCardModule
  ],
  templateUrl: './password-reset.component.html',
  styleUrls: ['./password-reset.component.scss']
})
export class PasswordResetComponent implements OnInit {
  // Two different form views: request reset and reset password
  requestResetForm!: FormGroup;
  resetPasswordForm!: FormGroup;
  
  isRequestMode = true; // Toggle between request and reset modes
  resetToken: string | null = null;
  
  hidePassword = true;
  hideConfirmPassword = true;
  isLoading = false;
  resetSent = false;
  resetComplete = false;
  errorMessage = '';
  constructor(
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private router: Router,
    private route: ActivatedRoute,
    private store: Store
  ) { }

  ngOnInit(): void {
    this.initForms();
    this.store.select(selectAuthLoading).subscribe(loading => {
      this.isLoading = loading;
    });
    this.store.select(selectAuthError).subscribe(error => {
      if (error) {
        this.errorMessage = error;
        this.isLoading = false;
        this.notificationService.error(error);
      }
    });
    this.store.select(selectPasswordResetSent).subscribe(sent => {
      this.resetSent = sent;
    });
    
    // Check if we have a token in the URL for direct reset
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      if (token) {
        this.resetToken = token;
        this.isRequestMode = false;
      }
    });
  }

  /**
   * Initialize the forms
   */
  private initForms(): void {
    // Request password reset form
    this.requestResetForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    // Reset password form
    this.resetPasswordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  /**
   * Password match validator
   */
  private passwordMatchValidator(group: FormGroup): { passwordMismatch: boolean } | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    
    return password === confirmPassword ? null : { passwordMismatch: true };
  }
  /**
   * Request password reset
   */
  onRequestReset(): void {
    if (this.requestResetForm.invalid) {
      this.requestResetForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    this.store.dispatch(AuthActions.forgotPassword({ email: this.requestResetForm.value.email }));
  }

  /**
   * Reset password with token
   */
  onResetPassword(): void {
    if (this.resetPasswordForm.invalid || !this.resetToken) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    this.store.dispatch(AuthActions.resetPassword({ token: this.resetToken, newPassword: this.resetPasswordForm.value.password }));
  }

  /**
   * Handle API errors with comprehensive error codes
   */
  private handleError(error: any): void {
    const errorCode = error.error?.code || error.status;
    const errorMessage = error.error?.message || 'An error occurred';
    
    switch (errorCode) {
      case 400:
        if (errorMessage.includes('token')) {
          this.notificationService.error('Invalid or expired reset token. Please request a new password reset.');
        } else if (errorMessage.includes('password')) {
          this.notificationService.error('Password does not meet security requirements.');
        } else {
          this.notificationService.error('Invalid request. Please check your input.');
        }
        break;
        
      case 401:
        if (errorMessage.includes('account is inactive')) {
          this.notificationService.error('Your account is inactive. Please contact support.');
        } else if (errorMessage.includes('account is temporarily locked')) {
          this.notificationService.error('Your account is temporarily locked. Please try again later.');
        } else if (errorMessage.includes('token')) {
          this.notificationService.error('Reset token has expired. Please request a new password reset.');
        } else {
          this.notificationService.error('Authentication failed. Please try again.');
        }
        break;
        
      case 404:
        this.notificationService.error('User not found. Please check your email address or register for a new account.');
        break;
        
      case 409:
        if (errorMessage.includes('password')) {
          this.notificationService.error('You cannot reuse one of your recent passwords. Please choose a different password.');
        } else {
          this.notificationService.error('Conflict: ' + errorMessage);
        }
        break;
        
      case 429:
        this.notificationService.error('Too many password reset requests. Please wait before trying again.');
        break;
        
      case 500:
        this.notificationService.error('Server error. Please try again later or contact support.');
        break;
        
      default:
        this.notificationService.error(errorMessage || 'An unexpected error occurred. Please try again.');
    }
  }

  /**
   * Get form control error messages
   */
  getErrorMessage(controlName: string, form: FormGroup = this.isRequestMode ? this.requestResetForm : this.resetPasswordForm): string {
    const control = form.get(controlName);
    
    if (!control || !control.errors || !control.touched) {
      return '';
    }
    
    if (control.errors['required']) {
      return 'This field is required';
    }
    
    if (controlName === 'email' && control.errors['email']) {
      return 'Please enter a valid email address';
    }
    
    if (controlName === 'password' && control.errors['minlength']) {
      return 'Password must be at least 8 characters long';
    }
    
    if (controlName === 'confirmPassword' && form.errors?.['passwordMismatch']) {
      return 'Passwords do not match';
    }
    
    return 'Invalid input';
  }

  /**
   * Navigate to the login page
   */
  onLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
