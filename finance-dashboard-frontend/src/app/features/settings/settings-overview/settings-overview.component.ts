import { Component, OnInit, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

// Angular Material imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';

// Services
import { AccessibilityService } from '../../../shared/services/accessibility.service';

// Directives
import { FocusTrapDirective } from '../../../shared/directives/focus-trap.directive';

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  ariaLabel: string;
}

@Component({
  selector: 'app-settings-overview',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
    FocusTrapDirective
  ],
  templateUrl: './settings-overview.component.html',
  styleUrls: ['./settings-overview.component.scss']
})
export class SettingsOverviewComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('pageTitle') pageTitle!: ElementRef;

  private destroy$ = new Subject<void>();

  settingsSections: SettingsSection[] = [
    {
      id: 'profile',
      title: 'Profile Settings',
      description: 'Manage your personal information and account details',
      icon: 'person',
      route: '/settings/profile',
      ariaLabel: 'Navigate to profile settings to manage personal information'
    },
    {
      id: 'preferences',
      title: 'User Preferences',
      description: 'Customize currency, theme, language, and display options',
      icon: 'tune',
      route: '/settings/preferences',
      ariaLabel: 'Navigate to user preferences to customize app settings'
    },
    {
      id: 'notifications',
      title: 'Notification Settings',
      description: 'Configure email, push, and alert preferences',
      icon: 'notifications',
      route: '/settings/notifications',
      ariaLabel: 'Navigate to notification settings to manage alerts and communications'
    },    {
      id: 'security',
      title: 'Security Settings',
      description: 'Update password and manage security preferences',
      icon: 'security',
      route: '/settings/security',
      ariaLabel: 'Navigate to security settings to manage password and privacy'
    },
    {
      id: 'privacy',
      title: 'Privacy & GDPR',
      description: 'Manage privacy settings, data sharing, and GDPR compliance',
      icon: 'privacy_tip',
      route: '/settings/privacy',
      ariaLabel: 'Navigate to privacy settings to manage data sharing and GDPR compliance'
    }
  ];

  constructor(
    private router: Router,
    private accessibilityService: AccessibilityService
  ) { }
  ngOnInit(): void {
    // Announce page navigation
    this.accessibilityService.announceRouteChange('Settings overview');
  }

  ngAfterViewInit(): void {
    // Auto focus on page title after view initialization
    setTimeout(() => {
      if (this.pageTitle?.nativeElement) {
        this.pageTitle.nativeElement.focus();
      }
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Navigate to specific settings section
   */  navigateToSection(section: SettingsSection): void {
    this.accessibilityService.announceOperationStatus(
      `Navigating to ${section.title}`,
      'started'
    );
    
    this.router.navigate([section.route]);
  }
  /**
   * Handle keyboard navigation for settings cards
   */
  onKeyDown(event: KeyboardEvent, section: SettingsSection): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.navigateToSection(section);
    }
  }

  /**
   * Track by function for settings sections to optimize *ngFor performance
   */
  trackBySection(index: number, section: SettingsSection): string {
    return section.id;
  }
}
