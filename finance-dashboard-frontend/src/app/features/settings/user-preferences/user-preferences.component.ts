import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

// Angular Material imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// Services
import { AccessibilityService } from '../../../shared/services/accessibility.service';

// Directives
import { FocusTrapDirective } from '../../../shared/directives/focus-trap.directive';

interface PreferenceOption {
  value: string;
  label: string;
  description?: string;
}

@Component({
  selector: 'app-user-preferences',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatRadioModule,
    MatDividerModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    FocusTrapDirective
  ],
  templateUrl: './user-preferences.component.html',
  styleUrls: ['./user-preferences.component.scss']
})
export class UserPreferencesComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('pageTitle') pageTitle!: ElementRef;
  @ViewChild('firstControl') firstControl!: ElementRef;

  preferencesForm!: FormGroup;
  isLoading = false;
  isSaving = false;
  hasUnsavedChanges = false;

  private destroy$ = new Subject<void>();

  // Preference options
  currencyOptions: PreferenceOption[] = [
    { value: 'USD', label: 'US Dollar ($)' },
    { value: 'EUR', label: 'Euro (€)' },
    { value: 'GBP', label: 'British Pound (£)' },
    { value: 'JPY', label: 'Japanese Yen (¥)' },
    { value: 'CAD', label: 'Canadian Dollar (C$)' },
    { value: 'AUD', label: 'Australian Dollar (A$)' }
  ];

  languageOptions: PreferenceOption[] = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'it', label: 'Italiano' },
    { value: 'pt', label: 'Português' }
  ];

  timezoneOptions: PreferenceOption[] = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
    { value: 'Europe/Paris', label: 'Central European Time (CET)' },
    { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' }
  ];

  dateFormatOptions: PreferenceOption[] = [
    { value: 'MM/dd/yyyy', label: 'MM/DD/YYYY (US Format)' },
    { value: 'dd/MM/yyyy', label: 'DD/MM/YYYY (European Format)' },
    { value: 'yyyy-MM-dd', label: 'YYYY-MM-DD (ISO Format)' },
    { value: 'dd MMM yyyy', label: 'DD MMM YYYY (e.g., 31 May 2025)' }
  ];

  themeOptions: PreferenceOption[] = [
    { value: 'light', label: 'Light Theme' },
    { value: 'dark', label: 'Dark Theme' },
    { value: 'auto', label: 'Auto (System Preference)' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private accessibilityService: AccessibilityService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadPreferences();
    this.trackFormChanges();
  }

  ngAfterViewInit(): void {
    // Set focus on page title for screen readers
    setTimeout(() => {
      if (this.pageTitle?.nativeElement) {
        this.pageTitle.nativeElement.focus();
      }
    }, 100);

    // Announce page load
    this.accessibilityService.announce('User preferences page loaded');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.preferencesForm = this.fb.group({
      // General Preferences
      currency: ['USD'],
      language: ['en'],
      timezone: ['America/New_York'],
      dateFormat: ['MM/dd/yyyy'],
      
      // Display Preferences
      theme: ['auto'],
      compactView: [false],
      showCents: [true],
      animationsEnabled: [true],
      
      // Dashboard Preferences
      defaultDashboardView: ['overview'],
      showWelcomeMessage: [true],
      autoRefreshDashboard: [true],
      refreshInterval: [30],
      
      // Chart and Report Preferences
      defaultChartType: ['line'],
      showDataLabels: [true],
      colorBlindFriendly: [false],
      highContrastMode: [false],
      
      // Budget Preferences
      budgetNotifications: [true],
      budgetWarningThreshold: [80],
      weekStartsOn: ['monday'],
      
      // Privacy and Data
      dataRetention: ['1year'],
      analyticsOptIn: [true],
      exportFormat: ['csv']
    });
  }

  private loadPreferences(): void {
    this.isLoading = true;
    this.accessibilityService.announce('Loading user preferences');

    // Simulate API call
    setTimeout(() => {
      // Mock data - replace with actual service call
      const mockPreferences = {
        currency: 'USD',
        language: 'en',
        timezone: 'America/New_York',
        dateFormat: 'MM/dd/yyyy',
        theme: 'auto',
        compactView: false,
        showCents: true,
        animationsEnabled: true,
        defaultDashboardView: 'overview',
        showWelcomeMessage: true,
        autoRefreshDashboard: true,
        refreshInterval: 30,
        defaultChartType: 'line',
        showDataLabels: true,
        colorBlindFriendly: false,
        highContrastMode: false,
        budgetNotifications: true,
        budgetWarningThreshold: 80,
        weekStartsOn: 'monday',
        dataRetention: '1year',
        analyticsOptIn: true,
        exportFormat: 'csv'
      };

      this.preferencesForm.patchValue(mockPreferences);
      this.isLoading = false;
      this.accessibilityService.announce('User preferences loaded successfully');

      // Focus first control after data loads
      setTimeout(() => {
        if (this.firstControl?.nativeElement) {
          this.firstControl.nativeElement.focus();
        }
      }, 100);
    }, 1000);
  }

  private trackFormChanges(): void {
    this.preferencesForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.hasUnsavedChanges = this.preferencesForm.dirty;
      });
  }

  onSubmit(): void {
    if (this.preferencesForm.valid) {
      this.savePreferences();
    }
  }

  private savePreferences(): void {
    this.isSaving = true;
    this.accessibilityService.announce('Saving user preferences');

    // Simulate API call
    setTimeout(() => {
      this.preferencesForm.markAsPristine();
      this.hasUnsavedChanges = false;
      this.isSaving = false;
      this.accessibilityService.announce('User preferences saved successfully');
    }, 1500);
  }

  onReset(): void {
    const confirmReset = confirm('Are you sure you want to reset all preferences to default values?');
    if (confirmReset) {
      this.preferencesForm.reset();
      this.initializeForm();
      this.accessibilityService.announce('Preferences reset to default values');
    }
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
      if (this.preferencesForm.valid && !this.isSaving) {
        this.onSubmit();
      }
    }
  }

  onPreferenceChange(setting: string, value: any): void {
    // Announce preference changes to screen readers
    const settingLabels: { [key: string]: string } = {
      currency: 'Currency',
      language: 'Language',
      theme: 'Theme',
      compactView: 'Compact view',
      showCents: 'Show cents',
      animationsEnabled: 'Animations',
      budgetNotifications: 'Budget notifications',
      colorBlindFriendly: 'Color blind friendly mode',
      highContrastMode: 'High contrast mode'
    };

    const label = settingLabels[setting] || setting;
    const announcement = typeof value === 'boolean' 
      ? `${label} ${value ? 'enabled' : 'disabled'}`
      : `${label} changed to ${value}`;
    
    this.accessibilityService.announce(announcement);
  }
}
