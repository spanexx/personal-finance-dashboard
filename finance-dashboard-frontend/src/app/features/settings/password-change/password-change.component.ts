import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

// Angular Material imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';

// Services
import { UserProfileService } from '../../../core/services/user-profile.service';
import { PasswordChangeRequest, PasswordStrengthResult } from '../../../shared/models/user.model';

@Component({
  selector: 'app-password-change',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatListModule
  ],
  templateUrl: './password-change.component.html',
  styleUrls: ['./password-change.component.scss']
})
export class PasswordChangeComponent implements OnInit, OnDestroy {
  @Output() cancel = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();
  
  private destroy$ = new Subject<void>();
  
  passwordForm: FormGroup;
  loading = false;
  error: string | null = null;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  passwordStrength: PasswordStrengthResult | null = null;

  constructor(
    private fb: FormBuilder,
    private userProfileService: UserProfileService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.passwordForm = this.createPasswordForm();
  }

  ngOnInit(): void {
    this.setupPasswordStrengthValidation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createPasswordForm(): FormGroup {
    return this.fb.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [
        Validators.required,
        Validators.minLength(8),
        this.passwordComplexityValidator
      ]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  private setupPasswordStrengthValidation(): void {    this.passwordForm.get('newPassword')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(password => {
        if (password) {
          this.userProfileService.checkPasswordStrength(password)
            .pipe(takeUntil(this.destroy$))
            .subscribe(result => {
              this.passwordStrength = result;
            });
        } else {
          this.passwordStrength = null;
        }
      });
  }

  private passwordComplexityValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.value;
    if (!password) return null;

    const errors: ValidationErrors = {};
    
    if (!/(?=.*[a-z])/.test(password)) {
      errors['lowercase'] = true;
    }
    
    if (!/(?=.*[A-Z])/.test(password)) {
      errors['uppercase'] = true;
    }
    
    if (!/(?=.*\d)/.test(password)) {
      errors['number'] = true;
    }
    
    if (!/(?=.*[@$!%*?&])/.test(password)) {
      errors['special'] = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = this.passwordForm?.get('newPassword')?.value;
    const confirmPassword = control.value;
    
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      return { passwordMismatch: true };
    }
    
    return null;
  }

  togglePasswordVisibility(field: 'current' | 'new' | 'confirm'): void {
    switch (field) {
      case 'current':
        this.showCurrentPassword = !this.showCurrentPassword;
        break;
      case 'new':
        this.showNewPassword = !this.showNewPassword;
        break;
      case 'confirm':
        this.showConfirmPassword = !this.showConfirmPassword;
        break;
    }
  }

  getPasswordVisibilityIcon(field: 'current' | 'new' | 'confirm'): string {
    switch (field) {
      case 'current':
        return this.showCurrentPassword ? 'visibility_off' : 'visibility';
      case 'new':
        return this.showNewPassword ? 'visibility_off' : 'visibility';
      case 'confirm':
        return this.showConfirmPassword ? 'visibility_off' : 'visibility';
      default:
        return 'visibility';
    }
  }

  getPasswordInputType(field: 'current' | 'new' | 'confirm'): string {
    switch (field) {
      case 'current':
        return this.showCurrentPassword ? 'text' : 'password';
      case 'new':
        return this.showNewPassword ? 'text' : 'password';
      case 'confirm':
        return this.showConfirmPassword ? 'text' : 'password';
      default:
        return 'password';
    }
  }
  getPasswordStrengthColor(): string {
    if (!this.passwordStrength) return 'warn';
    
    // Map score to color based on strength levels
    if (this.passwordStrength.score >= 4) return 'primary'; // Strong
    if (this.passwordStrength.score >= 3) return 'primary'; // Good  
    if (this.passwordStrength.score >= 2) return 'accent';  // Fair
    return 'warn'; // Weak
  }

  getPasswordStrengthValue(): number {
    if (!this.passwordStrength) return 0;
    return (this.passwordStrength.score / 4) * 100; // Convert to percentage
  }
  getPasswordStrengthText(): string {
    if (!this.passwordStrength) return '';
    
    let level = 'Weak';
    if (this.passwordStrength.score >= 4) level = 'Strong';
    else if (this.passwordStrength.score >= 3) level = 'Good';
    else if (this.passwordStrength.score >= 2) level = 'Fair';
    
    return `Password strength: ${level}`;
  }

  getPasswordStrengthLevel(): string {
    if (!this.passwordStrength) return '';
    
    if (this.passwordStrength.score >= 4) return 'strong';
    if (this.passwordStrength.score >= 3) return 'good';
    if (this.passwordStrength.score >= 2) return 'fair';
    return 'weak';
  }

  getFieldError(fieldName: string): string | null {
    const field = this.passwordForm.get(fieldName);
    if (!field?.errors || !field.touched) return null;

    if (field.errors['required']) {
      return `${this.getFieldLabel(fieldName)} is required`;
    }
    if (field.errors['minlength']) {
      return `${this.getFieldLabel(fieldName)} must be at least ${field.errors['minlength'].requiredLength} characters`;
    }
    if (field.errors['passwordMismatch']) {
      return 'Passwords do not match';
    }
    if (field.errors['samePassword']) {
      return 'New password must be different from current password';
    }

    return 'Invalid input';
  }

  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      currentPassword: 'Current password',
      newPassword: 'New password',
      confirmPassword: 'Confirm password'
    };
    return labels[fieldName] || fieldName;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.passwordForm.get(fieldName);
    return !!(field?.invalid && field?.touched);
  }

  hasError(fieldName: string, errorType: string): boolean {
    const field = this.passwordForm.get(fieldName);
    return !!(field?.hasError(errorType) && field?.touched);
  }

  focusField(fieldName: string): void {
    const element = document.getElementById(fieldName);
    if (element) {
      element.focus();
    }
  }

  onSubmit(): void {
    if (this.passwordForm.invalid) {
      this.markFormGroupTouched();
      this.focusFirstInvalidField();
      return;
    }

    const formData = this.passwordForm.value;
    const request: PasswordChangeRequest = {
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword
    };

    this.loading = true;
    this.error = null;
    this.successMessage = null;

    this.userProfileService.changePassword(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loading = false;
          this.successMessage = 'Password changed successfully';
          this.passwordForm.reset();
          this.passwordStrength = null;
          
          this.snackBar.open('Password changed successfully', 'Close', {
            duration: 5000,
            panelClass: ['success-snackbar']
          });

          // Redirect after a short delay
          setTimeout(() => {
            this.router.navigate(['/settings/security']);
          }, 2000);
        },
        error: (error) => {
          this.loading = false;
          this.error = error.message || 'Failed to change password. Please try again.';
          
          this.snackBar.open(this.error || 'Unknown error occurred', 'Close', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      });
  }

  onCancel(): void {
    this.passwordForm.reset();
    this.passwordStrength = null;
    this.showCurrentPassword = false;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
    this.cancel.emit();
  }

  onBack(): void {
    this.back.emit();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.passwordForm.controls).forEach(key => {
      const control = this.passwordForm.get(key);
      control?.markAsTouched();
    });
  }

  private focusFirstInvalidField(): void {
    const firstInvalidControl = Object.keys(this.passwordForm.controls)
      .find(key => this.passwordForm.get(key)?.invalid);
    
    if (firstInvalidControl) {
      const element = document.querySelector(`[formControlName="${firstInvalidControl}"]`) as HTMLElement;
      element?.focus();
    }
  }

  // Accessibility methods
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.onCancel();
    }
  }

  getAriaDescribedBy(fieldName: string): string {
    const parts: string[] = [];
    
    if (fieldName === 'newPassword' && this.passwordStrength) {
      parts.push('password-strength');
    }
    
    if (this.getFieldError(fieldName)) {
      parts.push(`${fieldName}-error`);
    }
    
    return parts.join(' ');
  }

  private checkPasswordSameAsOld(control: AbstractControl): ValidationErrors | null {
    const currentPassword = this.passwordForm?.get('currentPassword')?.value;
    const newPassword = control.value;
    
    if (currentPassword && newPassword && currentPassword === newPassword) {
      return { samePassword: true };
    }
    
    return null;
  }

  private handleError(error: any): void {
    console.error('Password change error:', error);
    
    if (error.status === 400) {
      this.errorMessage = 'Invalid current password or password requirements not met';
    } else if (error.status === 401) {
      this.errorMessage = 'Current password is incorrect';
    } else if (error.status === 422) {
      this.errorMessage = 'Password does not meet security requirements';
    } else if (error.status === 429) {
      this.errorMessage = 'Too many password change attempts. Please try again later';
    } else {
      this.errorMessage = 'Failed to change password. Please try again later';
    }
  }
}
