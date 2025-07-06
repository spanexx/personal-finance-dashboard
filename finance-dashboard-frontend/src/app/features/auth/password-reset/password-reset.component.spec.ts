import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, Subject } from 'rxjs';

import { PasswordResetComponent } from './password-reset.component';
import { AuthApiService } from '../../../core/services/auth-api.service';
import { NotificationService } from '../../../core/services/notification.service';

// Mock Material Modules
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

describe('PasswordResetComponent', () => {
  let component: PasswordResetComponent;
  let fixture: ComponentFixture<PasswordResetComponent>;
  let mockAuthApiService: Partial<AuthApiService>;
  let mockNotificationService: Partial<NotificationService>;
  let mockRouter: Partial<Router>;
  let queryParamsSubject: Subject<any>;

  beforeEach(async () => {
    mockAuthApiService = {
      requestPasswordReset: jest.fn().mockReturnValue(of({ success: true })),
      resetPassword: jest.fn().mockReturnValue(of({ success: true })),
    };
    mockNotificationService = {
      success: jest.fn(),
      error: jest.fn(),
    };
    mockRouter = {
      navigate: jest.fn(),
    };
    queryParamsSubject = new Subject<any>();

    await TestBed.configureTestingModule({
      imports: [
        PasswordResetComponent, // Standalone
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule
      ],
      providers: [
        FormBuilder,
        { provide: AuthApiService, useValue: mockAuthApiService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { queryParams: queryParamsSubject.asObservable() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PasswordResetComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges(); // Trigger ngOnInit
    expect(component).toBeTruthy();
  });

  it('should initialize requestResetForm and resetPasswordForm', () => {
    fixture.detectChanges();
    expect(component.requestResetForm).toBeDefined();
    expect(component.resetPasswordForm).toBeDefined();
  });

  describe('Request Mode (no token)', () => {
    beforeEach(() => {
      queryParamsSubject.next({});
      fixture.detectChanges(); // ngOnInit
    });

    it('should be in request mode if no token in queryParams', () => {
      expect(component.isRequestMode).toBe(true);
    });

    it('onRequestReset should call authApiService.requestPasswordReset if form is valid', () => {
      component.requestResetForm.setValue({ email: 'test@example.com' });
      component.onRequestReset();
      expect(mockAuthApiService.requestPasswordReset).toHaveBeenCalledWith('test@example.com');
      expect(component.resetSent).toBe(true);
      expect(mockNotificationService.success).toHaveBeenCalled();
    });
  });

  describe('Reset Mode (with token)', () => {
    const testToken = 'test-token-123';
    beforeEach(() => {
      queryParamsSubject.next({ token: testToken });
      fixture.detectChanges(); // ngOnInit
    });

    it('should be in reset mode and store token if token in queryParams', () => {
      expect(component.isRequestMode).toBe(false);
      expect(component.resetToken).toBe(testToken);
    });

    it('onResetPassword should call authApiService.resetPassword if form is valid', () => {
      component.resetPasswordForm.setValue({ password: 'NewPassword123!', confirmPassword: 'NewPassword123!' });
      component.onResetPassword();
      expect(mockAuthApiService.resetPassword).toHaveBeenCalledWith({
        token: testToken,
        newPassword: 'NewPassword123!',
      });
      expect(component.resetComplete).toBe(true);
      expect(mockNotificationService.success).toHaveBeenCalled();
    });
  });

  it('onLogin should navigate to /auth/login', () => {
    fixture.detectChanges();
    component.onLogin();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/auth/login']);
  });
});
