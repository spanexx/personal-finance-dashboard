import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { PasswordSecurityService, PasswordStrengthResult } from '../../../core/services/password-security.service';

@Component({
  selector: 'app-password-strength-meter',
  standalone: true,
  imports: [
    CommonModule,
    MatProgressBarModule,
    MatIconModule,
    MatTooltipModule
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordStrengthMeterComponent),
      multi: true
    }
  ],
  template: `
    <div class="password-strength-meter" [attr.aria-label]="'Password strength: ' + strengthLabel">
      <!-- Strength Progress Bar -->
      <div class="strength-progress">
        <mat-progress-bar 
          [value]="strengthPercentage" 
          [color]="strengthColor"
          [attr.aria-valuenow]="strengthPercentage"
          [attr.aria-valuemin]="0"
          [attr.aria-valuemax]="100">
        </mat-progress-bar>
        <span class="strength-label" [ngClass]="strengthClass">
          {{ strengthLabel }}
        </span>
      </div>

      <!-- Requirements Checklist -->
      <div class="requirements-list" *ngIf="showRequirements && strengthResult">
        <div class="requirement-item" 
             *ngFor="let req of requirementItems"
             [ngClass]="{ 'met': req.met, 'unmet': !req.met }">
          <mat-icon [attr.aria-label]="req.met ? 'Requirement met' : 'Requirement not met'">
            {{ req.met ? 'check_circle' : 'radio_button_unchecked' }}
          </mat-icon>
          <span>{{ req.label }}</span>
        </div>
      </div>

      <!-- Feedback and Suggestions -->
      <div class="feedback-section" *ngIf="showFeedback && strengthResult?.feedback">
        <!-- Warning -->
        <div class="warning" *ngIf="strengthResult?.feedback?.warning" 
             [attr.aria-live]="'polite'">
          <mat-icon>warning</mat-icon>
          <span>{{ strengthResult?.feedback?.warning }}</span>
        </div>

        <!-- Suggestions -->
        <div class="suggestions" *ngIf="strengthResult?.feedback?.suggestions?.length">
          <div class="suggestion-title">
            <mat-icon>lightbulb</mat-icon>
            <span>Suggestions to improve your password:</span>
          </div>
          <ul class="suggestion-list">
            <li *ngFor="let suggestion of strengthResult?.feedback?.suggestions">
              {{ suggestion }}
            </li>
          </ul>
        </div>
      </div>

      <!-- Real-time typing indicator -->
      <div class="typing-indicator" *ngIf="isTyping" [attr.aria-live]="'polite'">
        <mat-icon class="spin">sync</mat-icon>
        <span>Checking password strength...</span>
      </div>
    </div>
  `,
  styleUrls: ['./password-strength-meter.component.scss']
})
export class PasswordStrengthMeterComponent implements OnInit, OnDestroy, ControlValueAccessor {
  @Input() showRequirements = true;
  @Input() showFeedback = true;
  @Input() debounceTime = 300;
  @Input() minLength = 8;

  @Output() strengthChange = new EventEmitter<PasswordStrengthResult>();
  @Output() validChange = new EventEmitter<boolean>();

  strengthResult: PasswordStrengthResult | null = null;
  isTyping = false;
  
  private password = '';
  private destroy$ = new Subject<void>();
  private passwordInput$ = new Subject<string>();

  // ControlValueAccessor
  private onChange = (value: string) => {};
  private onTouched = () => {};

  constructor(private passwordSecurityService: PasswordSecurityService) {}

  ngOnInit(): void {
    // Set up debounced password checking
    this.passwordInput$.pipe(
      debounceTime(this.debounceTime),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(password => {
      this.checkPasswordStrength(password);
    });

    // Subscribe to password strength updates
    this.passwordSecurityService.passwordStrength$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(result => {
      this.strengthResult = result;
      this.isTyping = false;
      
      if (result) {
        this.strengthChange.emit(result);
        this.validChange.emit(result.isValid);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ControlValueAccessor implementation
  writeValue(value: string): void {
    this.password = value || '';
    this.onPasswordChange(this.password);
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // Component doesn't handle disabled state directly
  }

  private onPasswordChange(password: string): void {
    this.password = password;
    this.onChange(password);
    this.onTouched();
    
    if (password.length > 0) {
      this.isTyping = true;
      this.passwordInput$.next(password);
    } else {
      this.strengthResult = null;
      this.isTyping = false;
      this.passwordSecurityService.clearPasswordStrength();
    }
  }

  private checkPasswordStrength(password: string): void {
    this.passwordSecurityService.checkPasswordStrength(password).subscribe();
  }

  get strengthPercentage(): number {
    if (!this.strengthResult) return 0;
    return (this.strengthResult.score / 4) * 100;
  }

  get strengthLabel(): string {
    if (!this.strengthResult) return 'Enter password';
    
    const labels: Record<string, string> = {
      'weak': 'Weak',
      'fair': 'Fair',
      'good': 'Good',
      'strong': 'Strong',
      'very-strong': 'Very Strong'
    };
    
    return labels[this.strengthResult.strength] || 'Unknown';
  }

  get strengthColor(): 'primary' | 'accent' | 'warn' {
    if (!this.strengthResult) return 'primary';
    
    const colorMap: Record<string, 'primary' | 'accent' | 'warn'> = {
      'weak': 'warn',
      'fair': 'warn',
      'good': 'accent',
      'strong': 'primary',
      'very-strong': 'primary'
    };
    
    return colorMap[this.strengthResult.strength] || 'primary';
  }

  get strengthClass(): string {
    if (!this.strengthResult) return '';
    return `strength-${this.strengthResult.strength}`;
  }

  get requirementItems(): Array<{ label: string; met: boolean }> {
    if (!this.strengthResult) return [];

    return [
      {
        label: `At least ${this.minLength} characters`,
        met: this.strengthResult.requirements.minLength
      },
      {
        label: 'Uppercase letter (A-Z)',
        met: this.strengthResult.requirements.hasUppercase
      },
      {
        label: 'Lowercase letter (a-z)',
        met: this.strengthResult.requirements.hasLowercase
      },
      {
        label: 'Number (0-9)',
        met: this.strengthResult.requirements.hasNumbers
      },
      {
        label: 'Special character (!@#$%^&*)',
        met: this.strengthResult.requirements.hasSpecialChars
      }
    ];
  }
}
