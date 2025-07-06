import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { Store } from '@ngrx/store';

import { NotificationService } from '../../../core/services/notification.service';
import * as AuthActions from '../../../store/actions/auth.actions';
import { selectAuthLoading, selectAuthError, selectEmailVerificationSent } from '../../../store/selectors/auth.selectors';

interface PasswordStrength {
  score: number;
  feedback: string[];
  color: string;
  label: string;
  level?: string;
  requirements?: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatCardModule,
    MatDividerModule,
    MatTooltipModule,
    MatStepperModule
  ],
  providers: [{
    provide: STEPPER_GLOBAL_OPTIONS,
    useValue: { showError: true }
  }],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit, OnDestroy {
  @ViewChild('stepper') stepper!: MatStepper;
  // Form groups for multi-step registration
  personalInfoForm!: FormGroup;
  passwordForm!: FormGroup;
  verificationForm!: FormGroup;
    // UI state
  public currentStep = 0; // Changed to 0-based indexing for stepper
  public hidePassword = true;
  public hideConfirmPassword = true;
  public isLoading = false;
  public isEmailSent = false;
  public verificationEmailSent = false;
  public canResendEmail = true;
  public resendCountdown = 0;
  public errorMessage = '';
  
  // Verification state
  public verificationCode = '';
  public verificationError = ''; // Added missing property
  public isEmailVerified = false;
  // Password strength
  public passwordStrength: PasswordStrength = {
    score: 0,
    feedback: [],
    color: '#e2e8f0',
    label: 'Enter password',
    level: 'none',
    requirements: {
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false
    }
  };
  
  private destroy$ = new Subject<void>();
  private resendTimer?: any;
  constructor(
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private store: Store,
  ) { }

  ngOnInit(): void {
    this.initForms();
    this.setupPasswordStrengthValidation();
    // Subscribe to NgRx auth state
    this.store.select(selectAuthLoading).pipe(takeUntil(this.destroy$)).subscribe(loading => {
      this.isLoading = loading;
      this.cdr.markForCheck();
    });
    this.store.select(selectAuthError).pipe(takeUntil(this.destroy$)).subscribe(error => {
      if (error) {
        this.errorMessage = error;
        this.isLoading = false;
        this.cdr.markForCheck();
      }
    });
    this.store.select(selectEmailVerificationSent).pipe(takeUntil(this.destroy$)).subscribe(sent => {
      this.verificationEmailSent = sent;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.resendTimer) {
      clearInterval(this.resendTimer);
    }
  }

  /**
   * Initialize all registration forms
   */
  private initForms(): void {
    // Step 1: Personal Information
    this.personalInfoForm = this.fb.group({
      firstName: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        this.nameValidator
      ]],
      lastName: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        this.nameValidator
      ]],
      email: ['', [
        Validators.required,
        Validators.email,
        this.emailValidator
      ]],
      username: ['', [
        Validators.minLength(3),
        Validators.maxLength(20),
        this.usernameValidator
      ]]
    });

    // Step 2: Password Setup
    this.passwordForm = this.fb.group({
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        this.passwordStrengthValidator
      ]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });    // Step 3: Email Verification (token-based)
    this.verificationForm = this.fb.group({
      // No verification code needed - token-based verification via email link
    });
  }

  /**
   * Setup real-time password strength validation
   */
  private setupPasswordStrengthValidation(): void {
    this.passwordForm.get('password')?.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(password => {
      this.calculatePasswordStrength(password);
      this.cdr.markForCheck();
    });
  }
  /**
   * Calculate password strength with detailed feedback
   */
  private calculatePasswordStrength(password: string): void {
    if (!password) {
      this.passwordStrength = {
        score: 0,
        feedback: [],
        color: '#e2e8f0',
        label: 'Enter password',
        level: 'none',
        requirements: {
          length: false,
          uppercase: false,
          lowercase: false,
          number: false,
          special: false
        }
      };
      return;
    }

    let score = 0;
    const feedback: string[] = [];

    // Check requirements
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    // Length check
    if (requirements.length) {
      score += 1;
    } else {
      feedback.push('At least 8 characters');
    }

    // Uppercase check
    if (requirements.uppercase) {
      score += 1;
    } else {
      feedback.push('One uppercase letter');
    }

    // Lowercase check
    if (requirements.lowercase) {
      score += 1;
    } else {
      feedback.push('One lowercase letter');
    }

    // Number check
    if (requirements.number) {
      score += 1;
    } else {
      feedback.push('One number');
    }

    // Special character check
    if (requirements.special) {
      score += 1;
    } else {
      feedback.push('One special character');
    }

    // Additional complexity checks
    if (password.length >= 12) score += 1;
    if (/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password)) score += 1;

    // Set strength based on score
    let color: string;
    let label: string;
    let level: string;

    if (score <= 2) {
      color = '#f56565';
      label = 'Weak';
      level = 'weak';
    } else if (score <= 4) {
      color = '#ed8936';
      label = 'Fair';
      level = 'fair';
    } else if (score <= 5) {
      color = '#ecc94b';
      label = 'Good';
      level = 'good';
    } else {
      color = '#48bb78';
      label = 'Strong';
      level = 'strong';
    }

    this.passwordStrength = {
      score: Math.min(score, 6),
      feedback: feedback.length > 0 ? ['Missing: ' + feedback.join(', ')] : ['Password strength is ' + label.toLowerCase()],
      color,
      label,
      level,
      requirements
    };
  }

  /**
   * Custom validators
   */
  private nameValidator(control: AbstractControl): ValidationErrors | null {
    const name = control.value;
    if (!name) return null;
    
    // Only letters, spaces, hyphens, and apostrophes allowed
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    return nameRegex.test(name) ? null : { invalidName: true };
  }

  private emailValidator(control: AbstractControl): ValidationErrors | null {
    const email = control.value;
    if (!email) return null;
    
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) ? null : { invalidEmail: true };
  }

  private usernameValidator(control: AbstractControl): ValidationErrors | null {
    const username = control.value;
    if (!username) return null;
    
    // Alphanumeric and underscore only
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    return usernameRegex.test(username) ? null : { invalidUsername: true };
  }

  private passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
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

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    
    if (!password || !confirmPassword) return null;
    
    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }
  /**
   * Navigation methods
   */
  public nextStep(): void {
    if (this.currentStep === 0 && this.personalInfoForm.valid) {
      this.currentStep = 1;
      this.errorMessage = '';
    } else if (this.currentStep === 1 && this.passwordForm.valid) {
      this.onSubmitPassword();
    } else if (this.currentStep === 2) {
      this.onVerifyEmail();
    } else {
      this.markCurrentFormAsTouched();
    }
  }

  public previousStep(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.errorMessage = '';
    }
  }

  public onLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  /**
   * Step 2: Submit password setup and register user
   */
  private onSubmitPassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    const registerRequest = {
      firstName: this.personalInfoForm.value.firstName,
      lastName: this.personalInfoForm.value.lastName,
      email: this.personalInfoForm.value.email,
      password: this.passwordForm.value.password,
      username: this.personalInfoForm.value.username || undefined
    };
    this.store.dispatch(AuthActions.register(registerRequest));
  }

  /**
   * Handle successful registration
   */  private handleRegistrationSuccess(response: any): void {
    this.isLoading = false;
    this.verificationEmailSent = response.emailVerificationSent || true;
    this.currentStep = 2; // Move to step 2 (verification step)
    
    this.notificationService.success('Registration successful! Please check your email for verification.');
    
    this.startResendCountdown();
    this.cdr.markForCheck();
  }

  /**
   * Handle registration errors
   */
  private handleRegistrationError(error: any): void {
    this.isLoading = false;
    
    const errorCode = error.error?.code || error.status;
    const errorMessage = error.error?.message || 'Registration failed';
    
    switch (errorCode) {
      case 409:        if (errorMessage.includes('email')) {
          this.errorMessage = 'An account with this email already exists. Please use a different email or try logging in.';
          this.personalInfoForm.get('email')?.setErrors({ emailExists: true });
          this.currentStep = 0; // Go back to step 0
        } else if (errorMessage.includes('username')) {
          this.errorMessage = 'This username is already taken. Please choose a different username.';
          this.personalInfoForm.get('username')?.setErrors({ usernameExists: true });
          this.currentStep = 0; // Go back to step 0
        } else {
          this.errorMessage = 'User already exists. Please check your information.';
        }
        break;
        
      case 400:
        this.errorMessage = 'Invalid registration data. Please check your information and try again.';
        break;
        
      case 429:
        this.errorMessage = 'Too many registration attempts. Please try again later.';
        break;
        
      default:        this.errorMessage = errorMessage || 'Registration failed. Please try again.';
    }
    
    this.notificationService.error(this.errorMessage);
    this.cdr.markForCheck();
  }
  /**
   * Step 3: Handle email verification status
   * In token-based verification, users click email links to verify
   */
  private onVerifyEmail(): void {
    // For token-based verification, this step just checks if email was sent
    // Actual verification happens via email link
    if (this.verificationEmailSent) {
      this.notificationService.info('Please check your email and click the verification link to complete registration.');
    } else {
      this.errorMessage = 'Verification email was not sent. Please try registering again.';
    }
  }  /**
   * Public method for template - Email verification status
   * For token-based verification, we don't manually verify here
   */
  public verifyEmail(): void {
    this.notificationService.info('Please check your email and click the verification link to activate your account.');
  }

  /**
   * Resend verification code (alias for resend email)
   */
  public resendVerificationCode(): void {
    this.onResendVerificationEmail();
  }
  /**
   * Complete registration - redirect to login for token-based verification
   */
  public onSubmit(): void {
    if (!this.verificationEmailSent) {
      this.errorMessage = 'Please complete the registration process first';
      return;
    }

    // For token-based verification, redirect to login page with message
    this.notificationService.info('Registration completed! Please check your email and click the verification link, then proceed to login.');
    this.router.navigate(['/auth/login'], { 
      queryParams: { message: 'Please verify your email before logging in' }
    });
  }

  /**
   * Resend verification email
   */
  onResendVerificationEmail(): void {
    if (!this.canResendEmail) return;
    const email = this.personalInfoForm.value.email;
    this.store.dispatch(AuthActions.resendEmailVerification({ email }));
    this.notificationService.success('Verification email resent! Please check your inbox.');
    this.startResendCountdown();
  }

  /**
   * Start resend countdown timer
   */
  private startResendCountdown(): void {
    this.canResendEmail = false;
    this.resendCountdown = 60;
    
    this.resendTimer = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) {
        this.canResendEmail = true;
        clearInterval(this.resendTimer);
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  /**
   * Utility methods
   */
  private markCurrentFormAsTouched(): void {
    switch (this.currentStep) {
      case 0:
        this.personalInfoForm.markAllAsTouched();
        break;
      case 1:
        this.passwordForm.markAllAsTouched();
        break;
      case 2:
        this.verificationForm.markAllAsTouched();
        break;
    }
  }  public getErrorMessage(controlName: string, formGroup: FormGroup): string {
    const control = formGroup.get(controlName);
    
    if (!control || !control.errors || !control.touched) {
      return '';
    }
    
    if (control.errors['required']) {
      return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} is required`;
    }
    
    if (control.errors['email'] || control.errors['invalidEmail']) {
      return 'Please enter a valid email address';
    }
    
    if (control.errors['minlength']) {
      return `Minimum length is ${control.errors['minlength'].requiredLength} characters`;
    }
    
    if (control.errors['maxlength']) {
      return `Maximum length is ${control.errors['maxlength'].requiredLength} characters`;
    }
    
    if (control.errors['invalidName']) {
      return 'Name can only contain letters, spaces, hyphens, and apostrophes';
    }
    
    if (control.errors['invalidUsername']) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    
    if (control.errors['emailExists']) {
      return 'This email is already registered';
    }
    
    if (control.errors['usernameExists']) {
      return 'This username is already taken';
    }
    
    if (control.errors['passwordMismatch']) {
      return 'Passwords do not match';
    }
    
    if (control.errors['pattern']) {
      return 'Please enter a valid 6-digit verification code';
    }
    
    return 'Invalid input';
  }

  public hasError(formGroup: FormGroup, controlName: string, errorType: string): boolean {
    const control = formGroup.get(controlName);
    return !!(control && control.errors && control.errors[errorType] && control.touched);
  }

  public isFieldValid(formGroup: FormGroup, controlName: string): boolean {
    const control = formGroup.get(controlName);
    return !!(control && control.valid && control.touched);
  }

  public togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }

  public toggleConfirmPasswordVisibility(): void {
    this.hideConfirmPassword = !this.hideConfirmPassword;
  }  public getProgressPercentage(): number {
    return (this.currentStep) * 50;
  }

  public getPasswordStrength(): PasswordStrength {
    return this.passwordStrength;
  }
}