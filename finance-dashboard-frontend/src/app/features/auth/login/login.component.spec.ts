import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { Subject, of, throwError } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TokenService } from '../../../core/services/token.service';
import { AppState } from '../../../store/state/app.state';
import * as AuthActions from '../../../store/actions/auth.actions';
import { selectAuthError, selectIsLoading, selectIsAuthenticated } from '../../../store/selectors/auth.selectors';

// Mock Material Modules typically imported by Standalone Component
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBarModule } from '@angular/material/snack-bar'; // For NotificationService if it uses MatSnackBar

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthApiService: Partial<AuthApiService>;
  let mockNotificationService: Partial<NotificationService>;
  let mockRouter: Partial<Router>;
  let mockTokenService: Partial<TokenService>;
  let store: MockStore<AppState>;

  const initialState: Partial<AppState> = {
    auth: {
      user: null,
      token: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,
    },
  };

  beforeEach(async () => {
    mockAuthApiService = {
      resendEmailVerification: jest.fn().mockReturnValue(of({})),
    };
    mockNotificationService = {
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warning: jest.fn(),
    };
    mockRouter = {
      navigate: jest.fn(),
      navigateByUrl: jest.fn(),
    };
    mockTokenService = {
      getRememberMe: jest.fn().mockReturnValue(false),
      // No need to mock set/remove for localStorage, setup-jest handles it
    };

    await TestBed.configureTestingModule({
      imports: [
        LoginComponent, // It's standalone
        ReactiveFormsModule,
        NoopAnimationsModule,
        // Import necessary Material modules that LoginComponent uses in its template
        MatFormFieldModule, MatInputModule, MatButtonModule, MatCheckboxModule,
        MatIconModule, MatProgressSpinnerModule, MatCardModule, MatSnackBarModule
      ],
      providers: [
        FormBuilder,
        { provide: AuthApiService, useValue: mockAuthApiService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParams: {} } } },
        { provide: TokenService, useValue: mockTokenService },
        provideMockStore({ initialState }),
        ChangeDetectorRef,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(MockStore);
    fixture.detectChanges(); // Trigger ngOnInit
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize login form', () => {
    expect(component.loginForm).toBeDefined();
    expect(component.loginForm.get('email')).toBeDefined();
    expect(component.loginForm.get('password')).toBeDefined();
    expect(component.loginForm.get('rememberMe')).toBeDefined();
  });

  it('email field validity', () => {
    let errors: any = {};
    const email = component.loginForm.get('email');
    expect(email?.valid).toBeFalsy(); // Initially required

    email?.setValue('test');
    errors = email?.errors || {};
    expect(errors['email'] || errors['invalidEmail']).toBeTruthy();

    email?.setValue('test@example.com');
    errors = email?.errors || {};
    expect(errors['email'] || errors['invalidEmail']).toBeFalsy();
    expect(email?.valid).toBeTruthy();
  });

  it('password field validity - custom validator logic', () => {
    const password = component.loginForm.get('password');
    expect(password?.valid).toBeFalsy(); // Required

    password?.setValue('short'); // Too short
    expect(password?.errors?.['minLength']).toBeTruthy();

    password?.setValue('longenough'); // Missing uppercase, number, special
    expect(password?.errors?.['requiresUppercase']).toBeTruthy();
    expect(password?.errors?.['requiresNumber']).toBeTruthy();
    expect(password?.errors?.['requiresSpecialChar']).toBeTruthy();

    password?.setValue('LongEnough1'); // Missing special
    expect(password?.errors?.['requiresSpecialChar']).toBeTruthy();

    password?.setValue('LongEnough1@'); // Valid
    expect(password?.valid).toBeTruthy();
  });


  it('should load remembered email if rememberMe is true and email exists in localStorage', () => {
    (mockTokenService.getRememberMe as jest.Mock).mockReturnValue(true);
    jest.spyOn(localStorage, 'getItem').mockReturnValue('test@example.com');

    // Re-initialize to simulate ngOnInit with these conditions
    component.ngOnInit();
    fixture.detectChanges();

    expect(localStorage.getItem).toHaveBeenCalledWith('pfd_remembered_email');
    expect(component.loginForm.get('email')?.value).toBe('test@example.com');
    expect(component.loginForm.get('rememberMe')?.value).toBe(true);
  });

  describe('onSubmit', () => {
    it('should not dispatch login action if form is invalid', () => {
      jest.spyOn(store, 'dispatch');
      component.loginForm.get('email')?.setValue(''); // Invalid form
      component.onSubmit();
      expect(store.dispatch).not.toHaveBeenCalled();
    });

    it('should dispatch login action if form is valid', () => {
      jest.spyOn(store, 'dispatch');
      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'Password123!',
        rememberMe: false,
      });
      component.onSubmit();

      const expectedCredentials: LoginRequest = {
        email: 'test@example.com',
        password: 'Password123!',
        clientInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language
        }
      };
      expect(store.dispatch).toHaveBeenCalledWith(AuthActions.login({ credentials: expectedCredentials }));
    });

    it('should handle rememberMe preference - true', () => {
      jest.spyOn(localStorage, 'setItem');
      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'Password123!',
        rememberMe: true,
      });
      component.onSubmit(); // This calls handleRememberMePreference internally
      expect(localStorage.setItem).toHaveBeenCalledWith('pfd_remembered_email', 'test@example.com');
    });

    it('should handle rememberMe preference - false', () => {
      jest.spyOn(localStorage, 'removeItem');
      component.loginForm.setValue({
        email: 'test@example.com',
        password: 'Password123!',
        rememberMe: false,
      });
      component.onSubmit();
      expect(localStorage.removeItem).toHaveBeenCalledWith('pfd_remembered_email');
    });
  });

  describe('State Subscriptions', () => {
    it('should set isLoading from store', () => {
      store.overrideSelector(selectIsLoading, true);
      store.refreshState(); // Push the new state
      fixture.detectChanges();
      expect(component.isLoading).toBe(true);
    });

    it('should call handleLoginError when authError emits', () => {
      const errorSpy = jest.spyOn(component as any, 'handleLoginError');
      store.overrideSelector(selectAuthError, 'Invalid credentials test');
      store.refreshState();
      fixture.detectChanges();
      expect(errorSpy).toHaveBeenCalledWith('Invalid credentials test');
    });

    it('should navigate and show success on isAuthenticated true', () => {
      component.returnUrl = '/test-dashboard';
      store.overrideSelector(selectIsAuthenticated, true);
      store.refreshState();
      fixture.detectChanges();

      expect(mockNotificationService.success).toHaveBeenCalledWith('Login successful! Welcome back.');
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/test-dashboard');
    });
  });

  it('togglePasswordVisibility should toggle hidePassword', () => {
    expect(component.hidePassword).toBe(true);
    component.togglePasswordVisibility();
    expect(component.hidePassword).toBe(false);
    component.togglePasswordVisibility();
    expect(component.hidePassword).toBe(true);
  });

  it('onForgotPassword should navigate to forgot-password', () => {
    component.onForgotPassword();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/auth/forgot-password']);
  });

  it('onRegister should navigate to register', () => {
    component.onRegister();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/auth/register']);
  });

  it('onResendVerification should call authApiService and show notification', fakeAsync(() => {
    component.loginForm.get('email')?.setValue('test@example.com');
    component.emailNotVerified = true; // Simulate this state
    (mockAuthApiService.resendEmailVerification as jest.Mock).mockReturnValue(of({}));

    component.onResendVerification();
    tick(); // For async operations if any within service call (though mock is sync of)

    expect(mockAuthApiService.resendEmailVerification).toHaveBeenCalledWith('test@example.com');
    expect(mockNotificationService.success).toHaveBeenCalledWith('Verification email sent! Please check your inbox.');
  }));

  it('onResendVerification should show error if service fails', fakeAsync(() => {
    component.loginForm.get('email')?.setValue('test@example.com');
    component.emailNotVerified = true;
    (mockAuthApiService.resendEmailVerification as jest.Mock).mockReturnValue(throwError(() => new Error('Failed')));

    component.onResendVerification();
    tick();

    expect(mockNotificationService.error).toHaveBeenCalledWith('Failed to send verification email. Please try again.');
  }));
});
