import { Injectable, ElementRef } from '@angular/core';
import { Subject } from 'rxjs';

export enum FocusTarget {
  FIRST_FOCUSABLE = 'first-focusable',
  LAST_FOCUSABLE = 'last-focusable',
  CUSTOM = 'custom'
}

export enum AnnouncementType {
  POLITE = 'polite',
  ASSERTIVE = 'assertive'
}

@Injectable({
  providedIn: 'root'
})
export class AccessibilityService {
  private announcer = new Subject<string>();
  private _liveAnnouncer: HTMLElement | null = null;
  private _assertiveAnnouncer: HTMLElement | null = null;
  private _previousFocus: HTMLElement | null = null;
  private _focusTraps: Set<HTMLElement> = new Set();

  announcer$ = this.announcer.asObservable();

  constructor() {
    this.initAnnouncers();
  }

  /**
   * Initialize the live announcer elements for screen readers
   */
  private initAnnouncers(): void {
    if (typeof document !== 'undefined') {
      // Polite announcer for non-urgent updates
      this._liveAnnouncer = document.createElement('div');
      this._liveAnnouncer.setAttribute('aria-live', 'polite');
      this._liveAnnouncer.setAttribute('aria-atomic', 'true');
      this._liveAnnouncer.classList.add('sr-only');
      document.body.appendChild(this._liveAnnouncer);

      // Assertive announcer for urgent updates
      this._assertiveAnnouncer = document.createElement('div');
      this._assertiveAnnouncer.setAttribute('aria-live', 'assertive');
      this._assertiveAnnouncer.setAttribute('aria-atomic', 'true');
      this._assertiveAnnouncer.classList.add('sr-only');
      document.body.appendChild(this._assertiveAnnouncer);
    }
  }

  /**
   * Make an announcement for screen readers
   */
  private makeAnnouncement(message: string, type: AnnouncementType, duration: number = 1000): void {
    const announcer = type === AnnouncementType.ASSERTIVE ? this._assertiveAnnouncer : this._liveAnnouncer;
    if (announcer) {
      announcer.textContent = message;
      setTimeout(() => {
        if (announcer) {
          announcer.textContent = '';
        }
      }, duration);
    }
  }
  /**
   * Get all focusable elements within a container
   */
  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    if (!container) return [];
    
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    return Array.from(focusableElements);
  }

  /**
   * Announce a message to screen readers
   */
  announce(message: string): void {
    this.makeAnnouncement(message, AnnouncementType.POLITE);
  }

  /**
   * Announce a success message
   */
  announceSuccess(message: string): void {
    this.makeAnnouncement(`Success: ${message}`, AnnouncementType.POLITE);
  }

  /**
   * Announce an error message
   */
  announceError(message: string): void {
    this.makeAnnouncement(`Error: ${message}`, AnnouncementType.ASSERTIVE);
  }

  /**
   * Announce operation status
   */
  announceOperationStatus(operation: string, status: 'started' | 'completed' | 'failed'): void {
    const message = `${operation} ${status}`;
    const type = status === 'failed' ? AnnouncementType.ASSERTIVE : AnnouncementType.POLITE;
    this.makeAnnouncement(message, type);
  }

  /**
   * Announce component state changes
   */
  announceComponentState(component: string, state: string): void {
    this.makeAnnouncement(`${component} ${state}`, AnnouncementType.POLITE);
  }

  /**
   * Announce route changes for navigation feedback
   */
  announceRouteChange(routeName: string): void {
    this.makeAnnouncement(`Navigated to ${routeName} page`, AnnouncementType.POLITE);
  }
  /**
   * Set focus on an element based on target type
   */
  setFocus(container: HTMLElement, target: FocusTarget, customElement?: HTMLElement): void {
    if (!container) return;
    
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return;

    switch (target) {
      case FocusTarget.FIRST_FOCUSABLE:
        focusableElements[0]?.focus();
        break;
      case FocusTarget.LAST_FOCUSABLE:
        focusableElements[focusableElements.length - 1]?.focus();
        break;
      case FocusTarget.CUSTOM:
        if (customElement) {
          customElement.focus();
        }
        break;
    }
  }
  /**
   * Trap focus within a dialog or modal
   */
  trapFocus(container: HTMLElement): void {
    if (!container) return;
    
    const focusableElements = this.getFocusableElements(container);
    if (focusableElements.length === 0) return;

    // Store current focused element to restore focus later
    this._previousFocus = document.activeElement as HTMLElement;
    this._focusTraps.add(container);

    // Focus first element
    focusableElements[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      // If shift+tab and first element is focused, move to last
      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
      // If tab and last element is focused, move to first
      else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    
    // Store the event listener for cleanup
    (container as any)._focusTrapHandler = handleKeyDown;
  }
  /**
   * Release focus trap and restore previous focus
   */
  releaseFocus(container: HTMLElement): void {
    if (!container || !this._focusTraps.has(container)) return;
    
    // Remove event listener
    const handler = (container as any)._focusTrapHandler;
    if (handler) {
      container.removeEventListener('keydown', handler);
      delete (container as any)._focusTrapHandler;
    }

    this._focusTraps.delete(container);

    // Restore previous focus if this was the last focus trap
    if (this._focusTraps.size === 0 && this._previousFocus) {
      this._previousFocus.focus();
      this._previousFocus = null;
    }
  }
}
