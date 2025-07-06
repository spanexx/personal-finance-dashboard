import { Component, EventEmitter, Input, Output, HostListener, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { NgIf } from '@angular/common';
import { AccessibilityService } from '../../services/accessibility.service';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';

import { Subscription } from 'rxjs';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { UserProfile } from '../../models';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NgIf, FocusTrapDirective],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements AfterViewInit, OnDestroy {
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

  constructor(
    private elementRef: ElementRef,
    private accessibilityService: AccessibilityService,
    private userProfileService: UserProfileService
  ) {
    // Subscribe to user profile
    this.profileSub = this.userProfileService.profile$.subscribe(profile => {
      this.userProfile = profile;
      // If notifications are part of profile/settings, update count here
      // For now, set to 0 or mock until real notification API is available
      this.notificationCount = 0; // TODO: Replace with real count if available
    });
    // Optionally, trigger profile load if not already loaded
    if (!this.userProfileService.getCurrentProfile()) {
      this.userProfileService.getProfile().subscribe();
    }
  }
  
  ngAfterViewInit(): void {
    // Auto focus on menu button when it becomes visible (mobile)
    this.setupMenuButtonAutoFocus();
  }
  
  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
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
