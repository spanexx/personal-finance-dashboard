import { ComponentFixture, TestBed } from '@angular/core/testing';
// ActivatedRoute might not be strictly necessary if the component doesn't directly use it.
// If child components (Header, Sidebar) need it, they should mock it themselves or be provided a mock.
// For NavigationShellComponent itself, it doesn't seem to use ActivatedRoute in its TS.
// import { ActivatedRoute } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { NavigationShellComponent } from './navigation-shell.component';
// Mock child components if their interaction is complex or not desired in this unit test
// For now, assuming they are simple enough or their modules are imported if they are standalone.

describe('NavigationShellComponent', () => {
  let component: NavigationShellComponent;
  let fixture: ComponentFixture<NavigationShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavigationShellComponent, NoopAnimationsModule], // NavigationShellComponent is standalone
      // providers: [
      //   {
      //     provide: ActivatedRoute,
      //     useValue: {
      //       snapshot: { paramMap: { get: () => null } } // Basic mock if needed by template/children
      //     }
      //   }
      // ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NavigationShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have isSidebarExpanded as true initially', () => {
    expect(component.isSidebarExpanded).toBe(true);
  });

  it('should toggle isSidebarExpanded when toggleSidebar is called', () => {
    expect(component.isSidebarExpanded).toBe(true);
    component.toggleSidebar();
    expect(component.isSidebarExpanded).toBe(false);
    component.toggleSidebar();
    expect(component.isSidebarExpanded).toBe(true);
  });

  it('should set isSidebarExpanded to false when closeSidebar is called', () => {
    component.isSidebarExpanded = true; // Ensure it's true first
    component.closeSidebar();
    expect(component.isSidebarExpanded).toBe(false);

    component.closeSidebar(); // Call again
    expect(component.isSidebarExpanded).toBe(false); // Should remain false
  });

  describe('onResize', () => {
    it('should set isSidebarExpanded to true if window width is greater than 768px', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
      component.isSidebarExpanded = false; // Start from a collapsed state
      component.onResize();
      expect(component.isSidebarExpanded).toBe(true);
    });

    it('should not change isSidebarExpanded if window width is less than or equal to 768px and it was true', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
      component.isSidebarExpanded = true; // Start from an expanded state
      component.onResize();
      // The logic is `if (window.innerWidth > 768) { this.isSidebarExpanded = true; }`
      // So if it's already true and width <= 768, it remains true.
      // If the intention was to collapse it on mobile resize, the component logic would need to change.
      // Based on current logic:
      expect(component.isSidebarExpanded).toBe(true);
    });

    it('should not change isSidebarExpanded if window width is less than or equal to 768px and it was false', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
      component.isSidebarExpanded = false; // Start from a collapsed state
      component.onResize();
      expect(component.isSidebarExpanded).toBe(false);
    });
  });
});
