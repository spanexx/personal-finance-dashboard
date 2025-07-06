import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

// Angular Material imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';

// Services
import { AccessibilityService } from '../../../shared/services/accessibility.service';

// Directives
import { FocusTrapDirective } from '../../../shared/directives/focus-trap.directive';

interface SecuritySession {
  id: string;
  device: string;
  location: string;
  ipAddress: string;
  lastActive: Date;
  current: boolean;
}

interface SecurityEvent {
  id: string;
  type: 'login' | 'password_change' | 'email_change' | 'suspicious_activity';
  description: string;
  timestamp: Date;
  ipAddress: string;
  location: string;
}

@Component({
  selector: 'app-security-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatListModule,
    MatDividerModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    FocusTrapDirective
  ],
  templateUrl: './security-settings.component.html',
  styleUrls: ['./security-settings.component.scss']
})
export class SecuritySettingsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('pageTitle') pageTitle!: ElementRef;

  passwordForm!: FormGroup;
  twoFactorForm!: FormGroup;
  isLoading = false;
  isSaving = false;
  hasUnsavedChanges = false;
  
  // Security data
  activeSessions: SecuritySession[] = [];
  recentActivity: SecurityEvent[] = [];
  twoFactorEnabled = false;
  loginAlertsEnabled = true;
  suspiciousActivityAlertsEnabled = true;

  // Password strength
  passwordStrength = 0;
  passwordFeedback: string[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private accessibilityService: AccessibilityService
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadSecurityData();
    this.trackFormChanges();
  }

  ngAfterViewInit(): void {
    // Set focus on page title for screen readers
    setTimeout(() => {
      if (this.pageTitle?.nativeElement) {
        this.pageTitle.nativeElement.focus();
      }
    }, 100);    // Announce page load
    this.accessibilityService.announce('Security settings page loaded');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForms(): void {
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    this.twoFactorForm = this.fb.group({
      phoneNumber: ['', [Validators.pattern(/^\+?[\d\s\-\(\)]+$/)]],
      backupEmail: ['', [Validators.email]]
    });
  }

  private passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get('newPassword');
    const confirmPassword = form.get('confirmPassword');
    
    if (newPassword && confirmPassword && newPassword.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
    } else if (confirmPassword?.hasError('passwordMismatch')) {
      confirmPassword.setErrors(null);
    }
    
    return null;
  }
  private loadSecurityData(): void {
    this.isLoading = true;
    this.accessibilityService.announce('Loading security data');

    // Simulate API call
    setTimeout(() => {
      // Mock data
      this.activeSessions = [
        {
          id: '1',
          device: 'Chrome on Windows',
          location: 'New York, NY',
          ipAddress: '192.168.1.100',
          lastActive: new Date(),
          current: true
        },
        {
          id: '2',
          device: 'Safari on iPhone',
          location: 'New York, NY',
          ipAddress: '192.168.1.101',
          lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000),
          current: false
        }
      ];

      this.recentActivity = [
        {
          id: '1',
          type: 'login',
          description: 'Successful login from Chrome on Windows',
          timestamp: new Date(),
          ipAddress: '192.168.1.100',
          location: 'New York, NY'
        },
        {
          id: '2',
          type: 'password_change',
          description: 'Password changed successfully',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          ipAddress: '192.168.1.100',
          location: 'New York, NY'
        }
      ];      this.twoFactorEnabled = false;
      this.isLoading = false;
      this.accessibilityService.announce('Security data loaded successfully');
    }, 1000);
  }

  private trackFormChanges(): void {
    this.passwordForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.hasUnsavedChanges = this.passwordForm.dirty;
        this.checkPasswordStrength();
      });

    this.twoFactorForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.hasUnsavedChanges = this.hasUnsavedChanges || this.twoFactorForm.dirty;
      });
  }

  private checkPasswordStrength(): void {
    const password = this.passwordForm.get('newPassword')?.value || '';
    this.passwordStrength = 0;
    this.passwordFeedback = [];

    if (password.length >= 8) this.passwordStrength += 20;
    else this.passwordFeedback.push('Password should be at least 8 characters long');

    if (/[a-z]/.test(password)) this.passwordStrength += 20;
    else this.passwordFeedback.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) this.passwordStrength += 20;
    else this.passwordFeedback.push('Include uppercase letters');

    if (/\d/.test(password)) this.passwordStrength += 20;
    else this.passwordFeedback.push('Include numbers');

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) this.passwordStrength += 20;
    else this.passwordFeedback.push('Include special characters');
  }

  onChangePassword(): void {
    if (this.passwordForm.valid) {
      this.isSaving = true;
      this.accessibilityService.announce('Changing password');

      // Simulate API call
      setTimeout(() => {
        this.passwordForm.reset();
        this.isSaving = false;
        this.accessibilityService.announce('Password changed successfully');
      }, 2000);
    } else {
      this.accessibilityService.announce('Please correct the errors in the password form');
      this.focusFirstInvalidField(this.passwordForm);
    }
  }

  onToggleTwoFactor(): void {
    if (!this.twoFactorEnabled) {
      // Enable 2FA
      this.accessibilityService.announce('Enabling two-factor authentication');
      // Show setup process
    } else {
      // Disable 2FA
      const confirmDisable = confirm('Are you sure you want to disable two-factor authentication? This will reduce your account security.');
      if (confirmDisable) {
        this.twoFactorEnabled = false;
        this.accessibilityService.announce('Two-factor authentication disabled');
      }
    }
  }

  onRevokeSession(sessionId: string): void {
    const session = this.activeSessions.find(s => s.id === sessionId);
    if (session && !session.current) {
      const confirmRevoke = confirm(`Are you sure you want to revoke the session from ${session.device}?`);
      if (confirmRevoke) {
        this.activeSessions = this.activeSessions.filter(s => s.id !== sessionId);
        this.accessibilityService.announce(`Session from ${session.device} revoked`);
      }
    }
  }

  onRevokeAllOtherSessions(): void {
    const otherSessions = this.activeSessions.filter(s => !s.current);
    if (otherSessions.length > 0) {
      const confirmRevokeAll = confirm(`Are you sure you want to revoke all ${otherSessions.length} other sessions?`);
      if (confirmRevokeAll) {
        this.activeSessions = this.activeSessions.filter(s => s.current);
        this.accessibilityService.announce(`All other sessions revoked`);
      }
    }
  }

  onToggleLoginAlerts(): void {
    this.loginAlertsEnabled = !this.loginAlertsEnabled;
    this.accessibilityService.announce(
      `Login alerts ${this.loginAlertsEnabled ? 'enabled' : 'disabled'}`
    );
  }

  onToggleSuspiciousActivityAlerts(): void {
    this.suspiciousActivityAlertsEnabled = !this.suspiciousActivityAlertsEnabled;
    this.accessibilityService.announce(
      `Suspicious activity alerts ${this.suspiciousActivityAlertsEnabled ? 'enabled' : 'disabled'}`
    );
  }

  onBack(): void {
    if (this.hasUnsavedChanges) {
      const confirmLeave = confirm('You have unsaved changes. Are you sure you want to leave?');
      if (confirmLeave) {
        this.router.navigate(['/settings']);
      }
    } else {
      this.router.navigate(['/settings']);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    // Handle keyboard navigation
    if (event.key === 'Escape') {
      this.onBack();
    } else if (event.ctrlKey && event.key === 's') {
      event.preventDefault();
      if (this.passwordForm.valid && !this.isSaving) {
        this.onChangePassword();
      }
    }
  }

  private focusFirstInvalidField(form: FormGroup): void {
    const firstInvalidControl = Object.keys(form.controls)
      .find(key => form.get(key)?.invalid);

    if (firstInvalidControl) {
      const element = document.querySelector(`[formControlName="${firstInvalidControl}"]`) as HTMLElement;
      if (element) {
        element.focus();
      }
    }
  }

  getFieldError(fieldName: string, form: FormGroup = this.passwordForm): string {
    const field = form.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['minlength']) return `Password must be at least ${field.errors['minlength'].requiredLength} characters`;
      if (field.errors['passwordMismatch']) return 'Passwords do not match';
      if (field.errors['pattern']) return `Please enter a valid ${fieldName}`;
      if (field.errors['email']) return 'Please enter a valid email address';
    }
    return '';
  }

  isFieldInvalid(fieldName: string, form: FormGroup = this.passwordForm): boolean {
    const field = form.get(fieldName);
    return !!(field?.invalid && field.touched);
  }

  getPasswordStrengthText(): string {
    if (this.passwordStrength === 0) return 'Very Weak';
    if (this.passwordStrength <= 40) return 'Weak';
    if (this.passwordStrength <= 60) return 'Fair';
    if (this.passwordStrength <= 80) return 'Good';
    return 'Strong';
  }

  getPasswordStrengthColor(): string {
    if (this.passwordStrength === 0) return '#f44336';
    if (this.passwordStrength <= 40) return '#ff5722';
    if (this.passwordStrength <= 60) return '#ff9800';
    if (this.passwordStrength <= 80) return '#2196f3';
    return '#4caf50';
  }

  getSecurityEventIcon(type: string): string {
    switch (type) {
      case 'login': return 'login';
      case 'password_change': return 'lock';
      case 'email_change': return 'email';
      case 'suspicious_activity': return 'warning';
      default: return 'info';
    }
  }

  trackBySessionId(index: number, session: SecuritySession): string {
    return session.id;
  }
  trackByEventId(index: number, event: SecurityEvent): string {
    return event.id;
  }

  get hasOtherActiveSessions(): boolean {
    return this.activeSessions.filter(s => !s.current).length > 0;
  }

  get otherActiveSessionsCount(): number {
    return this.activeSessions.filter(s => !s.current).length;
  }
}
