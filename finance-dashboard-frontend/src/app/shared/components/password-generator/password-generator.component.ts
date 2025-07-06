import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PasswordSecurityService, PasswordGeneratorOptions, GeneratedPassword } from '../../../core/services/password-security.service';
import { PasswordStrengthMeterComponent } from '../password-strength-meter/password-strength-meter.component';

@Component({
  selector: 'app-password-generator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatCheckboxModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatSnackBarModule,
    PasswordStrengthMeterComponent
  ],
  template: `
    <mat-card class="password-generator">
      <mat-card-header>
        <mat-card-title>
          <mat-icon>vpn_key</mat-icon>
          Password Generator
        </mat-card-title>
        <mat-card-subtitle>
          Generate a secure password with customizable options
        </mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <!-- Generated Password Display -->
        <div class="password-display" *ngIf="generatedPassword">
          <mat-form-field appearance="outline" class="password-field">
            <mat-label>Generated Password</mat-label>
            <input
              matInput
              [value]="generatedPassword.password"
              [type]="showPassword ? 'text' : 'password'"
              readonly
              [attr.aria-label]="'Generated password'"
            />
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="togglePasswordVisibility()"
              [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
              matTooltip="{{ showPassword ? 'Hide' : 'Show' }} password"
            >
              <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
          </mat-form-field>

          <div class="password-actions">
            <button
              mat-raised-button
              color="primary"
              (click)="copyPassword()"
              [disabled]="isCopying"
              [attr.aria-label]="'Copy password to clipboard'"
              matTooltip="Copy to clipboard"
            >
              <mat-icon>{{ isCopying ? 'check' : 'content_copy' }}</mat-icon>
              {{ isCopying ? 'Copied!' : 'Copy' }}
            </button>

            <button
              mat-button
              (click)="usePassword()"
              [attr.aria-label]="'Use this password'"
              matTooltip="Use this password"
            >
              <mat-icon>check_circle</mat-icon>
              Use Password
            </button>
          </div>          <!-- Password Strength Display -->
          <app-password-strength-meter
            [ngModel]="generatedPassword.password"
            [showRequirements]="false"
            [showFeedback]="false">
          </app-password-strength-meter>
        </div>

        <!-- Generator Options -->
        <div class="generator-options">
          <h4>Password Options</h4>

          <!-- Length Slider -->
          <div class="option-group">
            <label class="option-label">
              Length: {{ options.length }} characters
            </label>            <mat-slider
              [min]="8"
              [max]="64"
              [step]="1"
              [attr.aria-label]="'Password length'"
              class="length-slider">
              <input matSliderThumb [value]="options.length" (valueChange)="updateLength($event)" />
            </mat-slider>
          </div>

          <!-- Character Set Options -->
          <div class="option-group">
            <h5>Character Types</h5>
            
            <mat-checkbox
              [(ngModel)]="options.includeUppercase"
              (change)="onOptionsChange()"
              [attr.aria-label]="'Include uppercase letters'"
            >
              Uppercase Letters (A-Z)
            </mat-checkbox>

            <mat-checkbox
              [(ngModel)]="options.includeLowercase"
              (change)="onOptionsChange()"
              [attr.aria-label]="'Include lowercase letters'"
            >
              Lowercase Letters (a-z)
            </mat-checkbox>

            <mat-checkbox
              [(ngModel)]="options.includeNumbers"
              (change)="onOptionsChange()"
              [attr.aria-label]="'Include numbers'"
            >
              Numbers (0-9)
            </mat-checkbox>            <mat-checkbox
              [(ngModel)]="options.includeSymbols"
              (change)="onOptionsChange()"
              [attr.aria-label]="'Include symbols'"
            >
              Symbols (!&#64;#$%^&amp;*)
            </mat-checkbox>
          </div>

          <!-- Advanced Options -->
          <div class="option-group">
            <h5>Advanced Options</h5>

            <mat-checkbox
              [(ngModel)]="options.excludeSimilar"
              (change)="onOptionsChange()"
              [attr.aria-label]="'Exclude similar characters'"
              matTooltip="Excludes characters that look similar (i, l, 1, L, o, 0, O)"
            >
              Exclude Similar Characters
              <span class="example-chars">il1Lo0O</span>
            </mat-checkbox>            <mat-checkbox
              [(ngModel)]="options.excludeAmbiguous"
              (change)="onOptionsChange()"
              [attr.aria-label]="'Exclude ambiguous symbols'"
              matTooltip="Excludes symbols that might be confusing"
            >
              Exclude Ambiguous Symbols
              <span class="example-chars">{{ '{' }}{{ '}' }}[]()/"'</span>
            </mat-checkbox>
          </div>

          <!-- Character Count Info -->
          <div class="character-count-info" *ngIf="availableCharacterCount > 0">
            <mat-icon>info</mat-icon>
            <span>
              {{ availableCharacterCount }} different characters available
            </span>
          </div>

          <!-- Generate Button -->
          <div class="generate-section">
            <button
              mat-raised-button
              color="accent"
              (click)="generatePassword()"
              [disabled]="!canGenerate || isGenerating"
              class="generate-button"
              [attr.aria-label]="'Generate new password'"
            >
              <mat-icon>{{ isGenerating ? 'sync' : 'refresh' }}</mat-icon>
              {{ isGenerating ? 'Generating...' : 'Generate Password' }}
            </button>

            <div class="generation-error" *ngIf="generationError" role="alert">
              <mat-icon>error</mat-icon>
              <span>{{ generationError }}</span>
            </div>
          </div>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styleUrls: ['./password-generator.component.scss']
})
export class PasswordGeneratorComponent implements OnInit {
  @Output() passwordGenerated = new EventEmitter<string>();
  @Output() passwordSelected = new EventEmitter<string>();

  options: PasswordGeneratorOptions = {
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: false,
    excludeAmbiguous: false
  };

  generatedPassword: GeneratedPassword | null = null;
  showPassword = false;
  isCopying = false;
  isGenerating = false;
  generationError = '';

  constructor(
    private passwordSecurityService: PasswordSecurityService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.generatePassword();
  }
  updateLength(value: number): void {
    this.options.length = value;
    this.onOptionsChange();
  }

  onOptionsChange(): void {
    // Ensure at least one character type is selected
    if (!this.hasAtLeastOneCharacterType()) {
      this.generationError = 'Please select at least one character type';
      return;
    }
    
    this.generationError = '';
    
    // Auto-generate when options change
    if (this.generatedPassword) {
      this.generatePassword();
    }
  }

  generatePassword(): void {
    if (!this.canGenerate) {
      return;
    }

    this.isGenerating = true;
    this.generationError = '';

    this.passwordSecurityService.generatePassword(this.options).subscribe({
      next: (result) => {
        this.generatedPassword = result;
        this.isGenerating = false;
        this.passwordGenerated.emit(result.password);
      },
      error: (error) => {
        this.generationError = 'Failed to generate password. Please try again.';
        this.isGenerating = false;
        console.error('Password generation error:', error);
      }
    });
  }

  async copyPassword(): Promise<void> {
    if (!this.generatedPassword) return;

    this.isCopying = true;
    
    try {
      const success = await this.passwordSecurityService.copyToClipboard(this.generatedPassword.password);
      
      if (success) {
        this.snackBar.open('Password copied to clipboard!', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      } else {
        this.snackBar.open('Failed to copy password', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top'
        });
      }
    } catch (error) {
      this.snackBar.open('Failed to copy password', 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
    }
    
    setTimeout(() => {
      this.isCopying = false;
    }, 1000);
  }

  usePassword(): void {
    if (this.generatedPassword) {
      this.passwordSelected.emit(this.generatedPassword.password);
      this.snackBar.open('Password selected for use', 'Close', {
        duration: 2000,
        horizontalPosition: 'right',
        verticalPosition: 'top'
      });
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  get canGenerate(): boolean {
    return this.hasAtLeastOneCharacterType() && this.options.length >= 8;
  }

  get availableCharacterCount(): number {
    let count = 0;
    
    if (this.options.includeLowercase) {
      count += this.options.excludeSimilar ? 23 : 26; // exclude i, l, o
    }
    
    if (this.options.includeUppercase) {
      count += this.options.excludeSimilar ? 23 : 26; // exclude I, L, O
    }
    
    if (this.options.includeNumbers) {
      count += this.options.excludeSimilar ? 8 : 10; // exclude 0, 1
    }
    
    if (this.options.includeSymbols) {
      count += this.options.excludeAmbiguous ? 12 : 32; // basic vs all symbols
    }
    
    return count;
  }

  private hasAtLeastOneCharacterType(): boolean {
    return this.options.includeUppercase ||
           this.options.includeLowercase ||
           this.options.includeNumbers ||
           this.options.includeSymbols;
  }
}
