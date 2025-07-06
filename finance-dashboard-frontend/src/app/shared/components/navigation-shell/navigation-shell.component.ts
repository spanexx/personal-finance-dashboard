import { Component, HostListener } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FooterComponent } from '../footer/footer.component';
import { Store } from '@ngrx/store';
import { selectIsAuthenticated } from '../../../store/selectors/auth.selectors';
import { filter } from 'rxjs/operators';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-navigation-shell',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, FooterComponent, FormsModule, CommonModule],
  templateUrl: './navigation-shell.component.html',
  styleUrl: './navigation-shell.component.scss'
})
export class NavigationShellComponent {
  /** Controls whether the sidebar is expanded or collapsed */
  isSidebarExpanded = true;

  /** Tracks the authentication status of the user */
  isAuthenticated = false;

  /** Indicates if the current route is the login route */
  isLoginRoute = false;

  constructor(private router: Router, private store: Store) {
    this.store.select(selectIsAuthenticated).subscribe((auth: boolean) => {
      this.isAuthenticated = auth;
    });
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.isLoginRoute = this.router.url.startsWith('/login');
    });
  }

  /**
   * Toggles the sidebar expanded/collapsed state
   */
  toggleSidebar(): void {
    this.isSidebarExpanded = !this.isSidebarExpanded;
  }

  /**
   * Closes the sidebar (sets it to collapsed state)
   */
  closeSidebar(): void {
    this.isSidebarExpanded = false;
  }

  /**
   * Handles window resize events to manage sidebar behavior
   */
  @HostListener('window:resize', ['$event'])
  onResize(): void {
    // On desktop, automatically expand sidebar
    // On mobile, keep it collapsed by default
    if (window.innerWidth > 768) {
      this.isSidebarExpanded = true;
    }
  }
}
