import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, takeUntil, finalize } from 'rxjs';

// Angular Material imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

// Services
import { UserProfileService } from '../../../core/services/user-profile.service';
import { AccessibilityService } from '../../../shared/services/accessibility.service';
import { AuthenticationService } from '../../../core/services/authentication.service';

// Models
import { UserProfile, UserSettings, PrivacySettings, DataExportRequest } from '../../../shared/models/user.model';

// Components
import { DataExportDialogComponent } from '../data-export-dialog/data-export-dialog.component';
import { AccountDeletionDialogComponent } from '../account-deletion-dialog/account-deletion-dialog.component';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatExpansionModule,
    MatDialogModule,
    MatTooltipModule
  ],
  templateUrl: './privacy-settings.component.html',
  styleUrls: ['./privacy-settings.component.scss']
})
export class PrivacySettingsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('privacySettingsContainer') container!: ElementRef;
  
  privacyForm!: FormGroup;
  currentUser?: UserProfile;
  isLoading = false;
  isSaving = false;
  dataExportInProgress = false;
  accountDeletionRequested = false;

  private destroy$ = new Subject<void>();

  // Privacy categories
  privacyCategories = [
    {
      id: 'profile',
      title: 'Profile Visibility',
      description: 'Control who can see your profile information',
      icon: 'person',
      options: [
        { value: 'public', label: 'Public', description: 'Anyone can see your profile' },
        { value: 'private', label: 'Private', description: 'Only you can see your profile' },
        { value: 'contacts', label: 'Contacts Only', description: 'Only your contacts can see your profile' }
      ]
    },
    {
      id: 'dataSharing',
      title: 'Data Sharing',
      description: 'Control how your data is shared',
      icon: 'share',
      toggles: [
        { key: 'analytics', label: 'Anonymous Analytics', description: 'Help improve our service with anonymous usage data' },
        { key: 'marketing', label: 'Marketing Communications', description: 'Receive marketing emails and promotional content' },
        { key: 'thirdParty', label: 'Third-party Integrations', description: 'Allow third-party services to access your data' }
      ]
    },
    {
      id: 'cookies',
      title: 'Cookie Preferences',
      description: 'Manage cookie and tracking preferences',
      icon: 'cookie',
      toggles: [
        { key: 'essential', label: 'Essential Cookies', description: 'Required for the site to function', disabled: true },
        { key: 'functional', label: 'Functional Cookies', description: 'Enable enhanced functionality and personalization' },
        { key: 'analytics', label: 'Analytics Cookies', description: 'Help us understand how visitors use our site' },
        { key: 'advertising', label: 'Advertising Cookies', description: 'Used to deliver relevant advertisements' }
      ]
    }
  ];

  // Data categories for export
  dataCategories = [
    { key: 'profile', label: 'Profile Information', description: 'Personal details and account settings' },
    { key: 'transactions', label: 'Financial Transactions', description: 'All transaction history and records' },
    { key: 'budgets', label: 'Budgets', description: 'Budget plans and spending limits' },
    { key: 'goals', label: 'Financial Goals', description: 'Savings goals and targets' },
    { key: 'categories', label: 'Categories', description: 'Custom transaction categories' },
    { key: 'reports', label: 'Reports', description: 'Generated financial reports and analytics' }
  ];

  // Export formats
  exportFormats = [
    { value: 'json', label: 'JSON', description: 'Machine-readable format for developers' },
    { value: 'csv', label: 'CSV', description: 'Spreadsheet-compatible format' },
    { value: 'pdf', label: 'PDF', description: 'Human-readable document format' }
  ];
  constructor(
    private fb: FormBuilder,
    private userProfileService: UserProfileService,
    private accessibilityService: AccessibilityService,
    private authenticationService: AuthenticationService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadUserProfile();
    this.setupFormValidation();
  }
  ngAfterViewInit(): void {
    // Focus management for accessibility
    this.accessibilityService.announce('Privacy Settings page loaded');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.privacyForm = this.fb.group({
      profileVisibility: ['private', Validators.required],
      dataSharing: this.fb.group({
        analytics: [false],
        marketing: [false],
        thirdParty: [false]
      }),
      cookies: this.fb.group({
        essential: [{ value: true, disabled: true }],
        functional: [true],
        analytics: [false],
        advertising: [false]
      }),
      dataRetention: this.fb.group({
        autoDelete: [false],
        retentionPeriod: [365] // days
      }),
      contactPreferences: this.fb.group({
        allowContact: [true],
        contactMethods: this.fb.array([])
      })
    });
  }

  private setupFormValidation(): void {
    this.privacyForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.announceFormChanges();
      });
  }
  private loadUserProfile(): void {
    this.isLoading = true;
    
    this.userProfileService.getProfile()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (user: UserProfile) => {
          this.currentUser = user;
          this.populateForm(user);
        },
        error: (error: any) => {
          console.error('Error loading user profile:', error);
          this.showError('Failed to load privacy settings');
        }
      });
  }
  private populateForm(user: UserProfile): void {
    // Use default values since the current privacy structure is minimal
    // Map existing privacy settings to our extended structure
    const existingPrivacy = user.settings?.privacy;
    
    this.privacyForm.patchValue({
      profileVisibility: 'private', // Default since not in existing structure
      dataSharing: {
        analytics: existingPrivacy?.analyticsTracking || false,
        marketing: existingPrivacy?.marketingEmails || false,
        thirdParty: false // Default since not in existing structure
      },
      cookies: {
        essential: true, // Always true
        functional: true, // Default
        analytics: existingPrivacy?.analyticsTracking || false,
        advertising: false // Default
      },
      dataRetention: {
        autoDelete: false, // Default since not in existing structure
        retentionPeriod: 365 // Default
      },
      contactPreferences: {
        allowContact: !existingPrivacy?.marketingEmails // Inverse of marketing emails
      }
    });
  }

  savePrivacySettings(): void {
    if (this.privacyForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.isSaving = true;
    const formValue = this.privacyForm.value;

    const privacySettings: PrivacySettings = {
      profileVisibility: formValue.profileVisibility,
      dataSharing: formValue.dataSharing,
      cookies: formValue.cookies,
      dataRetention: formValue.dataRetention,
      contactPreferences: formValue.contactPreferences,
      lastUpdated: new Date()
    };    // Map our extended privacy settings back to the basic structure
    const basicPrivacySettings = {
      marketingEmails: privacySettings.dataSharing.marketing,
      analyticsTracking: privacySettings.dataSharing.analytics,
      dataExportRequested: false // This is handled separately
    };

    this.userProfileService.updateSettings({ privacy: basicPrivacySettings })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isSaving = false)
      )
      .subscribe({
        next: () => {
          this.showSuccess('Privacy settings saved successfully');
          this.accessibilityService.announce('Privacy settings have been saved');
        },
        error: (error: any) => {
          console.error('Error saving privacy settings:', error);
          this.showError('Failed to save privacy settings');
        }
      });
  }

  openDataExportDialog(): void {
    const dialogRef = this.dialog.open(DataExportDialogComponent, {
      width: '600px',
      maxHeight: '80vh',
      disableClose: false,
      autoFocus: true,
      data: {
        dataCategories: this.dataCategories,
        exportFormats: this.exportFormats,
        userEmail: this.currentUser?.email
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.initiateDataExport(result);
      }
    });
  }

  private initiateDataExport(exportRequest: DataExportRequest): void {
    this.dataExportInProgress = true;

    this.userProfileService.requestDataExport(exportRequest)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.dataExportInProgress = false)
      )      .subscribe({
        next: (response) => {
          this.showSuccess('Data export initiated. You will receive an email when ready for download.');
          this.accessibilityService.announce('Data export request submitted successfully');
        },
        error: (error: any) => {
          console.error('Error initiating data export:', error);
          this.showError('Failed to initiate data export');
        }
      });
  }

  openAccountDeletionDialog(): void {
    const dialogRef = this.dialog.open(AccountDeletionDialogComponent, {
      width: '500px',
      disableClose: true,
      autoFocus: true,
      data: {
        userEmail: this.currentUser?.email,
        userName: this.currentUser?.firstName + ' ' + this.currentUser?.lastName
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.processAccountDeletion(result);
      }
    });
  }
  private processAccountDeletion(deletionRequest: any): void {
    this.accountDeletionRequested = true;

    // Commented out requestAccountDeletion usage
    /*
    this.authenticationService.requestAccountDeletion(deletionRequest)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.accountDeletionRequested = false)
      )
      .subscribe({
        next: () => {
          this.showSuccess('Account deletion request submitted. Please check your email for confirmation.');
          this.accessibilityService.announce('Account deletion request submitted');
          // Redirect to login after delay
          setTimeout(() => {
            this.router.navigate(['/auth/login']);
          }, 3000);
        },
        error: (error: any) => {
          console.error('Error processing account deletion:', error);
          this.showError('Failed to process account deletion request');
        }
      });
      */
  }

  resetToDefaults(): void {
    this.privacyForm.patchValue({
      profileVisibility: 'private',
      dataSharing: {
        analytics: false,
        marketing: false,
        thirdParty: false
      },
      cookies: {
        essential: true,
        functional: true,
        analytics: false,
        advertising: false
      },
      dataRetention: {
        autoDelete: false,
        retentionPeriod: 365
      },
      contactPreferences: {
        allowContact: true
      }
    });

    this.accessibilityService.announce('Privacy settings reset to defaults');
  }

  private markFormGroupTouched(): void {
    Object.keys(this.privacyForm.controls).forEach(key => {
      const control = this.privacyForm.get(key);
      control?.markAsTouched();
      if (control instanceof FormGroup) {
        Object.keys(control.controls).forEach(nestedKey => {
          control.get(nestedKey)?.markAsTouched();
        });
      }
    });
  }

  private announceFormChanges(): void {
    // Announce significant changes for screen readers
    const changes = this.privacyForm.dirty;
    if (changes) {
      this.accessibilityService.announce('Privacy settings have been modified');
    }
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 7000,
      panelClass: ['error-snackbar']
    });
  }

  // Getters for template
  get profileVisibility() { return this.privacyForm.get('profileVisibility'); }
  get dataSharing() { return this.privacyForm.get('dataSharing') as FormGroup; }
  get cookies() { return this.privacyForm.get('cookies') as FormGroup; }
  get dataRetention() { return this.privacyForm.get('dataRetention') as FormGroup; }
  get contactPreferences() { return this.privacyForm.get('contactPreferences') as FormGroup; }
}
