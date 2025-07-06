import { Component, EventEmitter, Input, Output, HostListener, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { NgIf } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AccessibilityService } from '../../services/accessibility.service';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgIf, RouterLink, RouterLinkActive, FocusTrapDirective],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements AfterViewInit, OnDestroy {
  /** Controls whether the sidebar is expanded or collapsed */
  @Input() isExpanded = true;
  
  /** Event emitter for toggling sidebar */
  @Output() toggleSidebar = new EventEmitter<void>();
  
  /** Event emitter for closing sidebar */
  @Output() closeSidebar = new EventEmitter<void>();
  
  @ViewChild('sidebarContent') sidebarContent!: ElementRef<HTMLElement>;
    /** Track if we're in mobile view */
  public isMobile = false;
  constructor(
    private elementRef: ElementRef,
    private router: Router,
    private accessibilityService: AccessibilityService
  ) {}
    ngAfterViewInit(): void {
    // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.checkIfMobile();
    }, 0);
  }
  
  ngOnDestroy(): void {
    // Cleanup any subscriptions or listeners if needed
  }
  
  /**
   * Check if we're in mobile view and update mobile state
   */
  private checkIfMobile(): void {
    this.isMobile = window.innerWidth <= 768;
  }
  
  /**
   * Handle window resize to track mobile state
   */
  @HostListener('window:resize', ['$event'])
  onWindowResize(): void {
    this.checkIfMobile();
  }
  /**
   * Emits an event to toggle the sidebar
   */
  onToggleSidebar(): void {
    this.toggleSidebar.emit();
    
    // Announce sidebar state change
    const newState = this.isExpanded ? 'collapsed' : 'expanded';
    this.accessibilityService.announceComponentState('Navigation sidebar', newState);
  }
  
  /**
   * Handles navigation item clicks - closes sidebar always
   */
  onNavItemClick(): void {
    // Close sidebar when nav item is clicked (all screen sizes)
    this.closeSidebar.emit();
    
    // Announce navigation action
    this.accessibilityService.announce('Navigation item selected');
  }
  /**
   * Handles clicks outside the sidebar to close it
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const isClickInsideSidebar = this.elementRef.nativeElement.contains(target);
    const isMenuToggleButton = target.closest('.menu-toggle');
    
    // Close sidebar if:
    // 1. Click is outside sidebar
    // 2. Not clicking the menu toggle button
    // 3. Sidebar is expanded
    if (!isClickInsideSidebar && !isMenuToggleButton && this.isExpanded) {
      this.closeSidebar.emit();
    }
  }  /**
   * Handles footer link clicks - closes sidebar
   */
  onFooterLinkClick(): void {
    this.closeSidebar.emit();
    
    // Announce navigation action
    this.accessibilityService.announce('Secondary navigation item selected');
  }

  /**
   * Handles keyboard navigation in the sidebar
   */
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Close sidebar with Escape key when in mobile view and expanded
    if (event.key === 'Escape' && this.isMobile && this.isExpanded) {
      event.preventDefault();
      this.closeSidebar.emit();
      this.accessibilityService.announce('Navigation menu closed');
    }
  }
}
