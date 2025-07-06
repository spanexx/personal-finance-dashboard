import { Component, OnInit, ElementRef, Renderer2, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, delay, tap } from 'rxjs/operators';
import { NavigationShellComponent } from './shared/components/navigation-shell/navigation-shell.component';
import { AccessibilityService } from './shared/services/accessibility.service';
import { Store } from '@ngrx/store';
import * as AuthActions from './store/actions/auth.actions';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NavigationShellComponent], // Added RouterOutlet
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'finance-dashboard-frontend';

  constructor(
    private router: Router,
    private accessibilityService: AccessibilityService,
    private elementRef: ElementRef<HTMLElement>, // For potential focus target within app component itself
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object,
    private store: Store // <-- Inject NgRx store
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Restore auth session on app init
      this.store.dispatch(AuthActions.authRestoreSession());
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        tap((event: NavigationEnd) => { // Announce first
          const urlParts = event.urlAfterRedirects.split('/');
          let routeName = urlParts[1] || 'home';
          routeName = routeName.charAt(0).toUpperCase() + routeName.slice(1).split('?')[0].split('#')[0]; // Clean up query params/fragments
          this.accessibilityService.announceRouteChange(routeName);
        }),
        delay(100) // Delay to allow DOM update
      ).subscribe(() => {
        this.focusMainContent();
      });
    }
  }

  private focusMainContent(): void {
    let mainContentElement = this.document.getElementById('main-content'); // Standard ID

    if (!mainContentElement) {
      mainContentElement = this.document.querySelector('main'); // Try <main> tag
    }

    if (!mainContentElement) {
      mainContentElement = this.document.querySelector('[role="main"]'); // Try role="main"
    }

    if (!mainContentElement) {
      // Fallback: try to find the main router outlet's container or first h1
      const routerOutletElement = this.document.querySelector('router-outlet');
      // Attempt to find the first H1 in the activated component, checking parent if router-outlet is empty
      let parent = routerOutletElement?.parentElement;
      while(parent && !mainContentElement){
        mainContentElement = parent.querySelector('h1');
        if(mainContentElement) break;
        // if current parent is app-root, stop search to avoid focusing app title
        if(parent.tagName.toLowerCase() === 'app-root') break;
        parent = parent.parentElement;
      }
    }

    if (mainContentElement) {
      // Ensure it can receive focus
      if (!mainContentElement.hasAttribute('tabindex')) {
        this.renderer.setAttribute(mainContentElement, 'tabindex', '-1');
      }
      mainContentElement.focus({ preventScroll: true }); // preventScroll is a good practice
    } else {
      // As a last resort, focus the body if no specific main content is found
      this.document.body.focus({ preventScroll: true });
    }
  }
}
