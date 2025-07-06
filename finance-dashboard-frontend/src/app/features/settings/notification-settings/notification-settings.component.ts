import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule } from '@angular/forms';
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
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';

// Services
import { AccessibilityService } from '../../../shared/services/accessibility.service';
import { UserProfileService } from '../../../core/services/user-profile.service';

// Directives
import { FocusTrapDirective } from '../../../shared/directives/focus-trap.directive';

interface NotificationType {
  id: string;
  title: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  channels: string[];
}

@Component({
  selector: 'app-notification-settings',
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
    MatInputModule,
    MatDividerModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    FocusTrapDirective
  ],
  templateUrl: './notification-settings.component.html',
  styleUrls: ['./notification-settings.component.scss']
})
export class NotificationSettingsComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('pageTitle') pageTitle!: ElementRef;
  @ViewChild('firstControl') firstControl!: ElementRef;

  notificationForm!: FormGroup;
  isLoading = false;
  isSaving = false;
  hasUnsavedChanges = false;

  private destroy$ = new Subject<void>();

  // Notification types organized by category
  notificationTypes: NotificationType[] = [
    // Budget & Spending
    {
      id: 'budget_exceeded',
      title: 'Budget Exceeded',
      description: 'When you exceed your budget limit',
      category: 'Budget & Spending',
      defaultEnabled: true,
      channels: ['email', 'push', 'sms']
    },
    {
      id: 'budget_warning',
      title: 'Budget Warning',
      description: 'When you reach 80% of your budget',
      category: 'Budget & Spending',
      defaultEnabled: true,
      channels: ['email', 'push']
    },
    {
      id: 'large_transaction',
      title: 'Large Transaction',
      description: 'When a transaction exceeds a threshold amount',
      category: 'Budget & Spending',
      defaultEnabled: true,
      channels: ['email', 'push', 'sms']
    },
    // Goals & Savings
    {
      id: 'goal_achieved',
      title: 'Goal Achieved',
      description: 'When you reach a financial goal',
      category: 'Goals & Savings',
      defaultEnabled: true,
      channels: ['email', 'push']
    },
    {
      id: 'goal_milestone',
      title: 'Goal Milestone',
      description: 'When you reach 25%, 50%, or 75% of a goal',
      category: 'Goals & Savings',
      defaultEnabled: true,
      channels: ['email', 'push']
    },
    {
      id: 'goal_reminder',
      title: 'Goal Reminder',
      description: 'Weekly reminder about your goals progress',
      category: 'Goals & Savings',
      defaultEnabled: false,
      channels: ['email', 'push']
    },
    // Reports & Analytics
    {
      id: 'monthly_report',
      title: 'Monthly Report',
      description: 'Monthly financial summary report',
      category: 'Reports & Analytics',
      defaultEnabled: true,
      channels: ['email']
    },
    {
      id: 'weekly_summary',
      title: 'Weekly Summary',
      description: 'Weekly spending and budget summary',
      category: 'Reports & Analytics',
      defaultEnabled: false,
      channels: ['email', 'push']
    },
    // Security & Account
    {
      id: 'login_alert',
      title: 'Login Alert',
      description: 'When someone logs into your account',
      category: 'Security & Account',
      defaultEnabled: true,
      channels: ['email', 'sms']
    },
    {
      id: 'password_change',
      title: 'Password Change',
      description: 'When your password is changed',
      category: 'Security & Account',
      defaultEnabled: true,
      channels: ['email', 'sms']
    },
    {
      id: 'data_export',
      title: 'Data Export Ready',
      description: 'When your data export is ready for download',
      category: 'Security & Account',
      defaultEnabled: true,
      channels: ['email']
    }
  ];

  notificationCategories = [...new Set(this.notificationTypes.map(n => n.category))];

  frequencyOptions = [
    { value: 'immediately', label: 'Immediately' },
    { value: 'hourly', label: 'Hourly digest' },
    { value: 'daily', label: 'Daily digest' },
    { value: 'weekly', label: 'Weekly digest' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private accessibilityService: AccessibilityService,
    private userProfileService: UserProfileService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadNotificationSettings();
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
    this.accessibilityService.announce('Notification settings page loaded');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.notificationForm = this.fb.group({
      // Global settings
      globalEnabled: [true],
      emailNotifications: [true],
      pushNotifications: [true],
      smsNotifications: [false],
      
      // Delivery preferences
      emailFrequency: ['immediately'],
      quietHours: this.fb.group({
        enabled: [true],
        startTime: ['22:00'],
        endTime: ['08:00']
      }),
      
      // Contact information
      phoneNumber: [''],
      alternateEmail: [''],
      
      // Notification types
      notifications: this.fb.array(
        this.notificationTypes.map(notification => 
          this.fb.group({
            id: [notification.id],
            enabled: [notification.defaultEnabled],
            email: [notification.channels.includes('email') && notification.defaultEnabled],
            push: [notification.channels.includes('push') && notification.defaultEnabled],
            sms: [notification.channels.includes('sms') && false] // SMS disabled by default
          })
        )
      )
    });
  }

  get notificationsArray(): FormArray {
    return this.notificationForm.get('notifications') as FormArray;
  }

  private loadNotificationSettings(): void {
    this.isLoading = true;
    this.accessibilityService.announce('Loading notification settings');
    this.userProfileService.getPreferences().subscribe({
      next: (prefs) => {
        // Patch form with backend preferences (handle notification structure as needed)
        this.notificationForm.patchValue({
          globalEnabled: prefs.notifications?.email || true,
          emailNotifications: prefs.notifications?.email || true,
          pushNotifications: prefs.notifications?.push || true,
          smsNotifications: prefs.notifications?.sms || false,
          // ...map other fields as needed...
        });
        this.isLoading = false;
        this.accessibilityService.announce('Notification settings loaded successfully');
        setTimeout(() => {
          if (this.firstControl?.nativeElement) {
            this.firstControl.nativeElement.focus();
          }
        }, 100);
      },
      error: () => {
        this.isLoading = false;
        this.accessibilityService.announce('Failed to load notification settings');
      }
    });
  }

  private trackFormChanges(): void {
    this.notificationForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.hasUnsavedChanges = this.notificationForm.dirty;
      });
  }

  onSubmit(): void {
    if (this.notificationForm.valid) {
      this.saveNotificationSettings();
    }
  }

  private saveNotificationSettings(): void {
    this.isSaving = true;
    this.accessibilityService.announce('Saving notification settings');
    // Prepare preferences object from form value
    const formValue = this.notificationForm.value;
    const preferences = {
      notifications: {
        email: formValue.emailNotifications,
        push: formValue.pushNotifications,
        sms: formValue.smsNotifications,
        // ...map other notification fields as needed...
      },
      // ...map other preferences as needed...
    };
    this.userProfileService.updatePreferences(preferences).subscribe({
      next: () => {
        this.notificationForm.markAsPristine();
        this.hasUnsavedChanges = false;
        this.isSaving = false;
        this.accessibilityService.announce('Notification settings saved successfully');
      },
      error: () => {
        this.isSaving = false;
        this.accessibilityService.announce('Failed to save notification settings');
      }
    });
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
      if (this.notificationForm.valid && !this.isSaving) {
        this.onSubmit();
      }
    }
  }

  onGlobalToggleChange(enabled: boolean): void {
    const message = enabled ? 'All notifications enabled' : 'All notifications disabled';
    this.accessibilityService.announce(message);

    if (!enabled) {
      // Disable all notification types when global is disabled
      this.notificationsArray.controls.forEach(control => {
        control.patchValue({
          enabled: false,
          email: false,
          push: false,
          sms: false
        });
      });
    }
  }

  onChannelToggleChange(channel: string, enabled: boolean): void {
    const channelName = channel === 'sms' ? 'SMS' : channel.charAt(0).toUpperCase() + channel.slice(1);
    const message = enabled ? `${channelName} notifications enabled` : `${channelName} notifications disabled`;
    this.accessibilityService.announce(message);

    if (!enabled) {
      // Disable this channel for all notification types
      this.notificationsArray.controls.forEach(control => {
        control.patchValue({ [channel]: false });
      });
    }
  }

  onNotificationToggleChange(index: number, field: string, enabled: boolean): void {
    const notification = this.notificationTypes[index];
    const fieldName = field === 'enabled' ? 'notification' : `${field} notification`;
    const message = enabled 
      ? `${notification.title} ${fieldName} enabled` 
      : `${notification.title} ${fieldName} disabled`;
    
    this.accessibilityService.announce(message);

    if (field === 'enabled' && !enabled) {
      // Disable all channels when notification is disabled
      const control = this.notificationsArray.at(index);
      control.patchValue({
        email: false,
        push: false,
        sms: false
      });
    }
  }

  getNotificationsByCategory(category: string): NotificationType[] {
    return this.notificationTypes.filter(n => n.category === category);
  }

  isChannelAvailable(notification: NotificationType, channel: string): boolean {
    return notification.channels.includes(channel);
  }

  testNotification(): void {
    this.accessibilityService.announce('Sending test notification');
    
    // Simulate sending test notification
    setTimeout(() => {
      this.accessibilityService.announce('Test notification sent successfully');
    }, 1000);
  }

  trackByNotificationId(index: number, notification: NotificationType): string {
    return notification.id;
  }
}
