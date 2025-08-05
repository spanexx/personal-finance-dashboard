import { Component, EventEmitter, Input, Output, HostListener, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { NgIf } from '@angular/common';
import { NgForOf, CommonModule, DatePipe } from '@angular/common';
import { AccessibilityService } from '../../services/accessibility.service';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { AuthenticationService } from '../../../core/services/authentication.service';
import { WebSocketService } from '../../../core/services/websocket.service';
import { NotificationService } from '../../../core/services/notification.service';
import { UserProfile } from '../../models';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NgIf, NgForOf, CommonModule, DatePipe, FocusTrapDirective],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements AfterViewInit, OnDestroy {
  // Notification dropdown state
  isNotificationDropdownOpen = false;
  // Notification list
  notifications: Array<{ message: string; timestamp: Date }> = [];
  /** Input to control sidebar state from parent */
  @Input() isSidebarExpanded = true;
  
  /** Event emitter for toggling sidebar */
  @Output() toggleSidebar = new EventEmitter<void>();
  
  /** Controls the visibility of the user dropdown menu */
  isUserMenuOpen = false;
  
  @ViewChild('menuToggleButton') menuToggleButton!: ElementRef<HTMLButtonElement>;
  @ViewChild('userMenuDropdown') userMenuDropdown!: ElementRef<HTMLElement>;
  
  userProfile: UserProfile | null = null;
  notificationCount: number = 0;
  private profileSub?: Subscription;
  private notificationSub?: Subscription;
  private goalUpdateSub?: Subscription;
  private budgetUpdateSub?: Subscription;
  private transactionUpdateSub?: Subscription;
  private balanceUpdateSub?: Subscription;

  constructor(
    private elementRef: ElementRef,
    private accessibilityService: AccessibilityService,
    private userProfileService: UserProfileService,
    private authService: AuthenticationService,
    private wsService: WebSocketService,
    private notificationService: NotificationService,
    private router: Router
  ) {
    // Subscribe to user profile
    this.profileSub = this.userProfileService.profile$.subscribe(profile => {
      this.userProfile = profile;
    });
    // Optionally, trigger profile load if not already loaded
    if (!this.userProfileService.getCurrentProfile()) {
      this.userProfileService.getProfile().subscribe();
    }
    // Subscribe to notification count
    this.notificationSub = this.wsService.getUnreadNotificationCount().subscribe(count => {
      this.notificationCount = count;
    });
    // // Listen for real-time notification events
    // this.wsService.systemNotifications.subscribe(event => {
    //   // Optionally increment notificationCount or handle notification logic
    //   this.notificationCount++;
    // });

    // Subscribe to goal updates
    this.goalUpdateSub = this.wsService.goalUpdates.subscribe(event => {
      this.notificationCount++;
      const goalName = event?.data?.goalName || event?.data?.name;
      const goalMsg = goalName ? `Goal updated: ${goalName}` : 'A goal was updated.';
      this.notifications.unshift({ message: goalMsg, timestamp: new Date() });
    });
    // Subscribe to budget updates
    this.budgetUpdateSub = this.wsService.budgetUpdates.subscribe(event => {
      this.notificationCount++;
      const budgetName = event?.data?.budgetName || event?.data?.name;
      const budgetMsg = budgetName ? `Budget updated: ${budgetName}` : 'A budget was updated.';
      this.notifications.unshift({ message: budgetMsg, timestamp: new Date() });
    });

    // Subscribe to transaction updates
    this.transactionUpdateSub = this.wsService.transactionUpdates.subscribe(event => {
      this.notificationCount++;
      const amount = event?.data?.amount;
      const category = event?.data?.category;
      let txMsg = 'A transaction was updated.';
      if (amount && category) {
        txMsg = `Transaction: ${amount} (${category})`;
      } else if (amount) {
        txMsg = `Transaction: ${amount}`;
      }
      this.notifications.unshift({ message: txMsg, timestamp: new Date() });
    });

    // Subscribe to balance updates
    this.balanceUpdateSub = this.wsService.balanceUpdates.subscribe(event => {
      this.notificationCount++;
      const newBalance = event?.data?.newBalance;
      const balMsg = newBalance !== undefined ? `Balance updated: ${newBalance}` : 'Your balance was updated.';
      this.notifications.unshift({ message: balMsg, timestamp: new Date() });
    });
  }

  onNotificationButtonClick(): void {
    this.isNotificationDropdownOpen = !this.isNotificationDropdownOpen;
  }

    
  
  ngAfterViewInit(): void {
    // Auto focus on menu button when it becomes visible (mobile)
    this.setupMenuButtonAutoFocus();
  }
  
  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
    this.notificationSub?.unsubscribe();
    this.goalUpdateSub?.unsubscribe();
    this.budgetUpdateSub?.unsubscribe();
    this.transactionUpdateSub?.unsubscribe();
    this.balanceUpdateSub?.unsubscribe();
  }

  // Handle profile/settings/logout actions
  onProfile(): void {
    this.router.navigate(['/settings/profile']);
    this.isUserMenuOpen = false;
  }
  onSettings(): void {
    this.router.navigate(['/settings']);
    this.isUserMenuOpen = false;
  }
  onLogout(): void {
    const refreshToken = this.authService['tokenService']?.getRefreshToken?.();
    if (!refreshToken) {
      this.accessibilityService.announceError('Logout failed: No refresh token found. Please log in again.');
      return;
    }
    this.authService.logout(refreshToken).subscribe({
      next: () => {
        // Clear tokens after successful logout
        this.authService['tokenService']?.clearTokens?.();
        // Announce logout to user
        this.accessibilityService.announce('You have been logged out.');
        const loggedOutUserProfile = this.userProfile;

        // Optionally reset user profile and notification count
        this.userProfile = null;
        this.notificationCount = 0;

        // Send a notification to the current user
        if (loggedOutUserProfile?.id) {
          this.notificationService.sendUserNotification(
            loggedOutUserProfile.id,
            'You have been logged out.',
            'USER_LOGOUT',
            {}
          ).subscribe();
        }

        // Refresh the window to ensure all state is reset and route to login
        setTimeout(() => {
          window.location.href = '/auth/login';
        }, 200);
      },
      error: () => {
        this.accessibilityService.announceError('Logout failed. Please try again.');
      }
    });
    this.isUserMenuOpen = false;
  }
  
  /**
   * Setup auto focus for menu button in mobile view
   */
  private setupMenuButtonAutoFocus(): void {
    // Auto focus on menu button when transitioning to mobile view
    if (window.innerWidth <= 768 && this.menuToggleButton?.nativeElement) {
      setTimeout(() => {
        this.menuToggleButton.nativeElement.focus();
      }, 100);
    }
  }
  
  /**
   * Emits an event to toggle the sidebar
import { UserProfile } from '../../../core/models/user-profile.model';
   */
  onToggleSidebar(): void {
    this.toggleSidebar.emit();
    
    // Announce sidebar state change
    const newState = this.isSidebarExpanded ? 'collapsed' : 'expanded';
    this.accessibilityService.announceComponentState('Navigation menu', newState);
  }
  
  /**
   * Toggles the user dropdown menu
   */
  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
    
    // Announce menu state change
    const state = this.isUserMenuOpen ? 'opened' : 'closed';
    this.accessibilityService.announceComponentState('User menu', state);
    
    // Handle focus management for user menu
    if (this.isUserMenuOpen && this.userMenuDropdown?.nativeElement) {
      // Focus first focusable element in dropdown
      setTimeout(() => {
        const firstFocusable = this.userMenuDropdown.nativeElement.querySelector('[tabindex]:not([tabindex="-1"]), button:not([disabled]), a[href]') as HTMLElement;
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }, 100);
    }
  }
  
  /**
   * Handle keyboard navigation for user menu
   */
  onUserMenuKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isUserMenuOpen) {
      this.isUserMenuOpen = false;
      this.accessibilityService.announceComponentState('User menu', 'closed');
      
      // Return focus to menu trigger
      const userMenuTrigger = this.elementRef.nativeElement.querySelector('.user-menu') as HTMLElement;
      if (userMenuTrigger) {
        userMenuTrigger.focus();
      }
    }
  }

  /**
   * Handles clicks outside the user menu to close it
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const userMenuElement = this.elementRef.nativeElement.querySelector('.user-menu');
    const isClickInsideUserMenu = userMenuElement?.contains(target);
    
    // Close user menu if clicking outside
    if (!isClickInsideUserMenu && this.isUserMenuOpen) {
      this.isUserMenuOpen = false;
    }
  }
}
