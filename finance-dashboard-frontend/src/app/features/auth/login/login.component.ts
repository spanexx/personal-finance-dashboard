import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { Store } from '@ngrx/store';

import { NotificationService } from '../../../core/services/notification.service';
import { LoginRequest } from '../../../shared/models/user.model';
import { AppState } from '../../../store/state/app.state';
import * as AuthActions from '../../../store/actions/auth.actions';
import { selectAuthError, selectAuthLoading, selectIsAuthenticated } from '../../../store/selectors/auth.selectors';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { TokenService } from '../../../core/services/token.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatDividerModule,
    MatSnackBarModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  isLoading = false;
  hidePassword = true;
  returnUrl: string = '/dashboard';
  loginAttempts = 0;
  maxLoginAttempts = 5;
  accountLocked = false;
  emailNotVerified = false;
  isRateLimited = false;
  
  private destroy$ = new Subject<void>();
  private clientInfo = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language
  };

  constructor(
    private fb: FormBuilder,
    // Remove AuthApiService
    private notificationService: NotificationService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private tokenService: TokenService,
    private store: Store<AppState>,
    private authService: AuthenticationService // Add this if you want to use it for password reset, etc.
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.setupFormValidation();

    // Get return URL from route parameters or default to '/dashboard'
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    this.cdr.markForCheck();

    // Check if user had selected "remember me" previously
    this.loadRememberedUser();
    
    // Reset any previous error states
    this.resetErrorStates();

    // Subscribe to NgRx state
    this.setupStateSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize the login form with validation
   */
  private initForm(): void {
    this.loginForm = this.fb.group({
      email: ['', [
        Validators.required,
        Validators.email,
        this.emailValidator
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        this.passwordValidator
      ]],
      rememberMe: [this.tokenService.getRememberMe()]
    });
  }

  /**
   * Setup real-time form validation
   */
  private setupFormValidation(): void {
    // Real-time email validation
    this.loginForm.get('email')?.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.cdr.markForCheck();
    });

    // Real-time password validation
    this.loginForm.get('password')?.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.cdr.markForCheck();
    });
  }

  /**
   * Custom email validator
   */
  private emailValidator(control: AbstractControl): {[key: string]: any} | null {
    const email = control.value;
    if (!email) return null;
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) ? null : { 'invalidEmail': true };
  }

  /**
   * Custom password validator
   */
  private passwordValidator(control: AbstractControl): {[key: string]: any} | null {
    const password = control.value;
    if (!password) return null;
    
    const errors: any = {};
    
    if (password.length < 8) {
      errors.minLength = true;
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.requiresUppercase = true;
    }
    
    if (!/[a-z]/.test(password)) {
      errors.requiresLowercase = true;
    }
    
    if (!/[0-9]/.test(password)) {
      errors.requiresNumber = true;
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.requiresSpecialChar = true;
    }
    
    return Object.keys(errors).length > 0 ? errors : null;
  }

  /**
   * Load remembered user from localStorage
   */
  private loadRememberedUser(): void {
    const rememberMe = this.tokenService.getRememberMe();
    if (rememberMe) {
      const rememberedEmail = localStorage.getItem('pfd_remembered_email');
      if (rememberedEmail) {
        this.loginForm.patchValue({
          email: rememberedEmail,
          rememberMe: true
        });
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      }
    }
  }

  /**
   * Reset error states
   */
  private resetErrorStates(): void {
    this.accountLocked = false;
    this.emailNotVerified = false;
    this.isRateLimited = false;
    this.loginAttempts = 0;
    this.cdr.markForCheck();
  }

  /**
   * Submit the login form with comprehensive error handling
   */
  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    if (this.isLoading || this.accountLocked || this.isRateLimited) {
      return;
    }

    console.log('🔄 Starting login process...');
    this.isLoading = true;
    this.cdr.markForCheck();

    const { email, password, rememberMe } = this.loginForm.value;
    
    // Prepare login request with client info
    const loginRequest: LoginRequest = {
      email,
      password,
      clientInfo: this.clientInfo
    };

    console.log('📤 Dispatching login action:', { email, hasPassword: !!password });

    // Dispatch NgRx login action
    this.store.dispatch(AuthActions.login({ email, password }));

    // Handle remember me preference locally
    this.handleRememberMePreference(email, rememberMe);
  }

  /**
   * Handle login errors with specific error codes
   */
  private handleLoginError(error: string): void {
    console.log('❌ Login error received:', error);
    this.isLoading = false;
    this.loginAttempts++;
    
    // Parse error message to determine error type
    if (error.includes('Too many login attempts') || error.includes('rate limit')) {
      this.isRateLimited = true;
      this.notificationService.error('Too many login attempts. Please try again later.');
    } else if (error.includes('account is inactive')) {
      this.notificationService.error('Your account is inactive. Please contact support.');
    } else if (error.includes('account is temporarily locked')) {
      this.accountLocked = true;
      this.notificationService.error('Account temporarily locked due to too many failed attempts.');
    } else if (error.includes('email verification required')) {
      this.emailNotVerified = true;
      this.notificationService.error('Please verify your email address before logging in.');
    } else if (error.includes('invalid credentials')) {
      const remainingAttempts = this.maxLoginAttempts - this.loginAttempts;
      if (remainingAttempts > 0) {
        this.notificationService.error(
          `Invalid email or password. ${remainingAttempts} attempts remaining.`
        );
      } else {
        this.accountLocked = true;
        this.notificationService.error('Account locked due to too many failed attempts.');
      }
    } else if (error.includes('Account not found')) {
      this.notificationService.error('Account not found. Please check your email or register.');
    } else if (error.includes('Server error')) {
      this.notificationService.error('Server error. Please try again later.');
    } else {
      this.notificationService.error(error || 'Login failed. Please try again.');
    }
    
    // Clear password on error
    this.loginForm.patchValue({ password: '' });
    this.cdr.markForCheck();
  }

  /**
   * Get comprehensive form control error messages
   */
  getErrorMessage(controlName: string): string {
    const control = this.loginForm.get(controlName);
    
    if (!control || !control.errors || !control.touched) {
      return '';
    }
    
    if (control.errors['required']) {
      return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} is required`;
    }
    
    if (controlName === 'email') {
      if (control.errors['email'] || control.errors['invalidEmail']) {
        return 'Please enter a valid email address';
      }
    }
    
    if (controlName === 'password') {
      if (control.errors['minLength']) {
        return 'Password must be at least 8 characters long';
      }
      if (control.errors['requiresUppercase']) {
        return 'Password must contain at least one uppercase letter';
      }
      if (control.errors['requiresLowercase']) {
        return 'Password must contain at least one lowercase letter';
      }
      if (control.errors['requiresNumber']) {
        return 'Password must contain at least one number';
      }
      if (control.errors['requiresSpecialChar']) {
        return 'Password must contain at least one special character';
      }
    }
    
    return 'Invalid input';
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }

  /**
   * Navigate to the forgot password page
   */
  onForgotPassword(): void {
    this.router.navigate(['/auth/forgot-password']);
  }

  /**
   * Navigate to the registration page
   */
  onRegister(): void {
    this.router.navigate(['/auth/register']);
  }

  /**
   * Resend email verification
   */  
  onResendVerification(): void {
    const email = this.loginForm.get('email')?.value;
    if (email && this.emailNotVerified) {
      // Use NgRx action instead of direct service call
      this.store.dispatch(AuthActions.resendEmailVerification({ email }));
      this.notificationService.success('Verification email sent! Please check your inbox.');
    }
  }

  /**
   * Check if form control has specific error
   */
  hasError(controlName: string, errorType: string): boolean {
    const control = this.loginForm.get(controlName);
    return !!(control && control.errors && control.errors[errorType] && control.touched);
  }

  /**
   * Check if form control is valid
   */
  isFieldValid(controlName: string): boolean {
    const control = this.loginForm.get(controlName);
    return !!(control && control.valid && control.touched);
  }

  /**
   * Setup NgRx state subscriptions
   */
  private setupStateSubscriptions(): void {
    console.log('🔔 Setting up state subscriptions...');

    // Subscribe to loading state
    this.store.select(selectAuthLoading).pipe(
      takeUntil(this.destroy$)
    ).subscribe(isLoading => {
      console.log('🔄 Loading state changed:', isLoading);
      this.isLoading = isLoading;
      this.cdr.markForCheck();
    });

    // Subscribe to authentication errors
    this.store.select(selectAuthError).pipe(
      takeUntil(this.destroy$)
    ).subscribe(error => {
      console.log('❌ Auth error state:', error);
      if (error) {
        this.handleLoginError(error);
      }
    });

    // Subscribe to authentication state for navigation
    this.store.select(selectIsAuthenticated).pipe(
      takeUntil(this.destroy$)
    ).subscribe(isAuthenticated => {
      console.log('🔐 Authentication state changed:', isAuthenticated);
      if (isAuthenticated) {
        console.log('✅ Login successful! Navigating to:', this.returnUrl);
        this.isLoading = false;
        this.resetErrorStates();
        this.notificationService.success('Login successful! Welcome back.');
        this.router.navigateByUrl(this.returnUrl);
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Handle remember me preference locally
   */
  private handleRememberMePreference(email: string, rememberMe: boolean): void {
    // Store remember me preference and email
    if (rememberMe) {
      localStorage.setItem('pfd_remembered_email', email);
    } else {
      localStorage.removeItem('pfd_remembered_email');
    }
  }
}
