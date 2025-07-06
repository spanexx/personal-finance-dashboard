import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError, Subject } from 'rxjs';

import { ForgotPasswordComponent } from './forgot-password.component';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { PasswordSecurityService } from '../../../core/services/password-security.service'; // May not be directly used if PasswordStrengthMeterComponent handles it
import { NotificationService } from '../../../core/services/notification.service'; // If used instead of MatSnackBar directly
import { LiveAnnouncer } from '@angular/cdk/a11y';

// Mock Material Modules that are part of ForgotPasswordComponent's standalone imports
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
// import { PasswordStrengthMeterComponent } from '../../../shared/components/password-strength-meter/password-strength-meter.component'; // Consider mocking or shallow rendering

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let mockAuthApiService: Partial<AuthApiService>;
  let mockRouter: Partial<Router>;
  let mockActivatedRoute: any; // More complex mock for queryParams
  let mockSnackBar: Partial<MatSnackBar>;
  let mockPasswordSecurityService: Partial<PasswordSecurityService>;
  let mockLiveAnnouncer: Partial<LiveAnnouncer>;

  const queryParamsSubject = new Subject<any>();


  beforeEach(async () => {
    mockAuthApiService = {
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
    };
    mockRouter = {
      navigate: jest.fn(),
    };
    mockActivatedRoute = {
      queryParams: queryParamsSubject.asObservable(), // Use a Subject for dynamic queryParams
    };
    mockSnackBar = {
      open: jest.fn(),
    };
    mockPasswordSecurityService = {
      // Mock methods if component calls them directly
    };
    mockLiveAnnouncer = {
      announce: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        ForgotPasswordComponent, // Standalone
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule
        // PasswordStrengthMeterComponent might need to be mocked or declared if not standalone and deeply integrated
      ],
      providers: [
        FormBuilder,
        { provide: AuthApiService, useValue: mockAuthApiService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: PasswordSecurityService, useValue: mockPasswordSecurityService },
        { provide: LiveAnnouncer, useValue: mockLiveAnnouncer },
      ],
    })
    // .overrideComponent(ForgotPasswordComponent, { // If PasswordStrengthMeterComponent is complex
    //   remove: { imports: [PasswordStrengthMeterComponent] },
    //   add: { imports: [MockPasswordStrengthMeterComponent] } // if you create a mock component
    // })
    .compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    // fixture.detectChanges(); // Initial detectChanges will be in tests after setting queryParams if needed
  });

  it('should create', () => {
    fixture.detectChanges(); // Trigger ngOnInit
    expect(component).toBeTruthy();
  });

  it('should initialize forgotPasswordForm and resetPasswordForm', () => {
    fixture.detectChanges();
    expect(component.forgotPasswordForm).toBeDefined();
    expect(component.resetPasswordForm).toBeDefined();
  });

  describe('Forgot Password Mode (no token)', () => {
    beforeEach(() => {
      queryParamsSubject.next({}); // Simulate no token
      fixture.detectChanges(); // ngOnInit
    });

    it('should set isResetMode to false if no token in queryParams', () => {
      expect(component.isResetMode).toBe(false);
    });

    it('forgotPasswordForm email field validity', () => {
      const emailControl = component.forgotPasswordForm.get('email');
      expect(emailControl?.valid).toBeFalsy(); // Required
      emailControl?.setValue('test');
      expect(emailControl?.hasError('email')).toBeTruthy();
      emailControl?.setValue('test@example.com');
      expect(emailControl?.valid).toBeTruthy();
    });

    it('onSubmitForgotPassword should call authApiService.forgotPassword if form is valid', () => {
      (mockAuthApiService.forgotPassword as jest.Mock).mockReturnValue(of({ success: true, message: 'Email sent' }));
      component.forgotPasswordForm.setValue({ email: 'test@example.com' });
      component.onSubmitForgotPassword();
      expect(mockAuthApiService.forgotPassword).toHaveBeenCalledWith('test@example.com');
      expect(component.emailSent).toBe(true);
      expect(component.submittedEmail).toBe('test@example.com');
    });

    it('onSubmitForgotPassword should not call service if form is invalid', () => {
      component.forgotPasswordForm.setValue({ email: 'invalid' });
      component.onSubmitForgotPassword();
      expect(mockAuthApiService.forgotPassword).not.toHaveBeenCalled();
    });

    it('resendResetEmail should call authApiService.forgotPassword and start cooldown', fakeAsync(() => {
      component.submittedEmail = 'test@example.com';
      component.resendCooldown = 0; // Ensure cooldown allows sending
      (mockAuthApiService.forgotPassword as jest.Mock).mockReturnValue(of({ success: true }));

      component.resendResetEmail();
      expect(mockAuthApiService.forgotPassword).toHaveBeenCalledWith('test@example.com');
      expect(mockSnackBar.open).toHaveBeenCalledWith('Reset email sent again!', 'Close', expect.any(Object));
      expect(component.resendCooldown).toBe(60);

      tick(1000); // Advance time by 1 second
      expect(component.resendCooldown).toBe(59);

      tick(59000); // Advance time to end cooldown
      expect(component.resendCooldown).toBe(0);

      component.ngOnDestroy(); // Clear interval
    }));
  });

  describe('Reset Password Mode (with token)', () => {
    const testToken = 'test-reset-token';
    beforeEach(() => {
      queryParamsSubject.next({ token: testToken }); // Simulate token
      fixture.detectChanges(); // ngOnInit
    });

    it('should set isResetMode to true and store token if token in queryParams', () => {
      expect(component.isResetMode).toBe(true);
      expect(component.resetToken).toBe(testToken);
    });

    // Basic validation for resetPasswordForm (more detailed tests for validators themselves)
    it('resetPasswordForm should be invalid if passwords do not match', () => {
      component.resetPasswordForm.get('password')?.setValue('NewPass123!');
      component.resetPasswordForm.get('confirmPassword')?.setValue('DifferentPass123!');
      expect(component.resetPasswordForm.hasError('passwordMismatch')).toBeTruthy();
    });

    it('resetPasswordForm should be valid if passwords match and meet criteria', () => {
      component.resetPasswordForm.get('password')?.setValue('NewPass123!');
      component.resetPasswordForm.get('confirmPassword')?.setValue('NewPass123!');
      expect(component.resetPasswordForm.valid).toBeTruthy();
    });

    it('onSubmitResetPassword should call authApiService.resetPassword if form is valid and password strength is good', () => {
      (mockAuthApiService.resetPassword as jest.Mock).mockReturnValue(of({ success: true, message: 'Password reset' }));
      component.resetPasswordForm.setValue({ password: 'NewPassword123!', confirmPassword: 'NewPassword123!' });
      component.isPasswordValid = true; // Simulate password strength meter emitting true
      component.onSubmitResetPassword();

      expect(mockAuthApiService.resetPassword).toHaveBeenCalledWith({
        token: testToken,
        newPassword: 'NewPassword123!',
      });
      expect(component.resetComplete).toBe(true);
      expect(mockSnackBar.open).toHaveBeenCalledWith('Password reset successfully!', 'Close', expect.any(Object));
    });

    it('onSubmitResetPassword should not call service if form is invalid', () => {
      component.resetPasswordForm.get('password')?.setValue('short');
      component.onSubmitResetPassword();
      expect(mockAuthApiService.resetPassword).not.toHaveBeenCalled();
    });

    it('onSubmitResetPassword should not call service if password is not valid (strength)', () => {
      component.resetPasswordForm.setValue({ password: 'NewPassword123!', confirmPassword: 'NewPassword123!' });
      component.isPasswordValid = false; // Simulate strength meter says invalid
      component.onSubmitResetPassword();
      expect(mockAuthApiService.resetPassword).not.toHaveBeenCalled();
    });
  });

  it('goToLogin should navigate to /auth/login', () => {
    component.goToLogin();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('togglePasswordVisibility should toggle showPassword', () => {
    expect(component.showPassword).toBe(false);
    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(true);
  });

  it('toggleConfirmPasswordVisibility should toggle showConfirmPassword', () => {
    expect(component.showConfirmPassword).toBe(false);
    component.toggleConfirmPasswordVisibility();
    expect(component.showConfirmPassword).toBe(true);
  });

  it('onPasswordValidChange should update isPasswordValid', () => {
    component.onPasswordValidChange(true);
    expect(component.isPasswordValid).toBe(true);
    component.onPasswordValidChange(false);
    expect(component.isPasswordValid).toBe(false);
  });

  afterEach(() => {
    // Ensure timers are cleared
    component.ngOnDestroy();
  });
});
