import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { RegisterComponent } from './register.component';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RegisterRequest } from '../../../shared/models/user.model';

// Mock Material Modules
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';


describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let mockAuthApiService: Partial<AuthApiService>;
  let mockNotificationService: Partial<NotificationService>;
  let mockRouter: Partial<Router>;
  let cdr: ChangeDetectorRef;

  beforeEach(async () => {
    mockAuthApiService = {
      register: jest.fn(),
      resendEmailVerification: jest.fn().mockReturnValue(of({})),
    };
    mockNotificationService = {
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
    mockRouter = {
      navigate: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        RegisterComponent, // Standalone
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
        MatProgressSpinnerModule, MatProgressBarModule, MatCardModule, MatStepperModule, MatTooltipModule
      ],
      providers: [
        FormBuilder,
        { provide: AuthApiService, useValue: mockAuthApiService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: Router, useValue: mockRouter },
        ChangeDetectorRef,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    cdr = fixture.debugElement.injector.get(ChangeDetectorRef);
    fixture.detectChanges(); // Trigger ngOnInit
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize personalInfoForm, passwordForm, and verificationForm', () => {
    expect(component.personalInfoForm).toBeDefined();
    expect(component.passwordForm).toBeDefined();
    expect(component.verificationForm).toBeDefined(); // Even if empty, it's initialized
  });

  describe('Form Initialization and Validators', () => {
    it('personalInfoForm should be invalid when empty', () => {
      expect(component.personalInfoForm.valid).toBeFalsy();
    });

    it('personalInfoForm email field should require valid email', () => {
      const email = component.personalInfoForm.get('email');
      email?.setValue('test');
      expect(email?.hasError('email') || email?.hasError('invalidEmail')).toBeTruthy();
      email?.setValue('test@example.com');
      expect(email?.valid).toBeTruthy();
    });

    it('passwordForm should be invalid when empty', () => {
      expect(component.passwordForm.valid).toBeFalsy();
    });

    it('passwordForm password field should have minLength and strength validation', () => {
      const password = component.passwordForm.get('password');
      password?.setValue('short');
      // Custom validator 'passwordStrengthValidator' bundles these.
      // Check a few aspects of the custom validator via its effect on form validity or errors object.
      expect(password?.hasError('minLength')).toBeTruthy(); // Based on Validators.minLength(8)

      password?.setValue('Short1@'); // Still < 8
      expect(password?.hasError('minLength')).toBeTruthy();

      password?.setValue('ValidPass1@');
      expect(password?.valid).toBeTruthy();
    });

    it('passwordForm confirmPassword should be required', () => {
      const confirmPassword = component.passwordForm.get('confirmPassword');
      expect(confirmPassword?.hasError('required')).toBeTruthy();
      confirmPassword?.setValue('ValidPass1@');
      expect(confirmPassword?.valid).toBeTruthy();
    });

    it('passwordForm should have passwordMatchValidator error if passwords do not match', () => {
      component.passwordForm.get('password')?.setValue('ValidPass1@');
      component.passwordForm.get('confirmPassword')?.setValue('Different1@');
      expect(component.passwordForm.hasError('passwordMismatch')).toBeTruthy();
    });

    it('passwordForm should be valid if passwords match and are strong', () => {
      component.passwordForm.get('password')?.setValue('ValidPass1@');
      component.passwordForm.get('confirmPassword')?.setValue('ValidPass1@');
      expect(component.passwordForm.valid).toBeTruthy();
    });
  });

  describe('Step Navigation', () => {
    it('nextStep should move from step 0 to 1 if personalInfoForm is valid', () => {
      component.currentStep = 0;
      component.personalInfoForm.setValue({
        firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', username: 'johndoe'
      });
      component.nextStep();
      expect(component.currentStep).toBe(1);
    });

    it('nextStep should not move from step 0 if personalInfoForm is invalid', () => {
      component.currentStep = 0;
      component.personalInfoForm.get('email')?.setValue('invalid'); // make form invalid
      component.nextStep();
      expect(component.currentStep).toBe(0);
    });

    // onSubmitPassword is called by nextStep when currentStep is 1
    it('nextStep should call onSubmitPassword if currentStep is 1 and passwordForm is valid', () => {
      const submitPasswordSpy = jest.spyOn(component as any, 'onSubmitPassword');
      component.currentStep = 1;
      component.passwordForm.setValue({ password: 'ValidPass1@', confirmPassword: 'ValidPass1@' });
      component.nextStep();
      expect(submitPasswordSpy).toHaveBeenCalled();
    });

    it('previousStep should decrement currentStep if not on first step', () => {
      component.currentStep = 1;
      component.previousStep();
      expect(component.currentStep).toBe(0);
      component.previousStep(); // Try again
      expect(component.currentStep).toBe(0); // Should not go below 0
    });
  });

  describe('onSubmitPassword (Registration API call)', () => {
    beforeEach(() => {
      // Pre-fill forms for submission tests
      component.personalInfoForm.setValue({
        firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', username: 'johndoe'
      });
      component.passwordForm.setValue({ password: 'ValidPass1@', confirmPassword: 'ValidPass1@' });
    });

    it('should call authApiService.register and handle success', fakeAsync(() => {
      const mockResponse = { message: 'Registration successful', emailVerificationSent: true };
      (mockAuthApiService.register as jest.Mock).mockReturnValue(of(mockResponse));

      component.currentStep = 1; // Ensure we are on the password step
      component.nextStep(); // This will trigger onSubmitPassword
      tick(); // For any async operations within subscription

      expect(mockAuthApiService.register).toHaveBeenCalled();
      expect(component.isLoading).toBe(false);
      expect(component.verificationEmailSent).toBe(true);
      expect(component.currentStep).toBe(2); // Move to verification step
      expect(mockNotificationService.success).toHaveBeenCalledWith('Registration successful! Please check your email for verification.');
      expect(component.resendCountdown).toBe(60); // Check if countdown started
    }));

    it('should call authApiService.register and handle error (e.g., email exists)', fakeAsync(() => {
      const errorResponse = { error: { code: 409, message: 'email already exists' }, status: 409 };
      (mockAuthApiService.register as jest.Mock).mockReturnValue(throwError(() => errorResponse));

      component.currentStep = 1;
      component.nextStep();
      tick();

      expect(mockAuthApiService.register).toHaveBeenCalled();
      expect(component.isLoading).toBe(false);
      expect(component.errorMessage).toContain('An account with this email already exists');
      expect(mockNotificationService.error).toHaveBeenCalled();
      expect(component.currentStep).toBe(0); // Should go back to personal info form
    }));
  });

  describe('onSubmit (Final step)', () => {
     it('should navigate to login with message if verification email was sent', () => {
        component.verificationEmailSent = true;
        component.onSubmit();
        expect(mockNotificationService.info).toHaveBeenCalledWith('Registration completed! Please check your email and click the verification link, then proceed to login.');
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/auth/login'], {
          queryParams: { message: 'Please verify your email before logging in' }
        });
     });

     it('should set error message if verification email was not sent', () => {
        component.verificationEmailSent = false;
        component.onSubmit();
        expect(component.errorMessage).toBe('Please complete the registration process first');
        expect(mockRouter.navigate).not.toHaveBeenCalled();
     });
  });

  it('onResendVerificationEmail should call service and handle notifications', fakeAsync(() => {
    component.personalInfoForm.get('email')?.setValue('test@example.com');
    component.canResendEmail = true;
    (mockAuthApiService.resendEmailVerification as jest.Mock).mockReturnValue(of({}));

    component.onResendVerificationEmail();
    tick();

    expect(mockAuthApiService.resendEmailVerification).toHaveBeenCalledWith('test@example.com');
    expect(mockNotificationService.success).toHaveBeenCalledWith('Verification email resent! Please check your inbox.');
    expect(component.canResendEmail).toBe(false);
    expect(component.resendCountdown).toBe(60);

    // Test countdown
    tick(1000); // Advance 1 second
    expect(component.resendCountdown).toBe(59);

    // Fast-forward to end countdown
    tick(59000);
    expect(component.resendCountdown).toBe(0);
    expect(component.canResendEmail).toBe(true);

    // Clear interval
    component.ngOnDestroy(); // This should clear the interval
  }));
});
