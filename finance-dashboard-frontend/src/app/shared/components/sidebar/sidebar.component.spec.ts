import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router, ActivatedRoute } from '@angular/router'; // Router is used in component
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { SidebarComponent } from './sidebar.component';
import { AccessibilityService } from '../../services/accessibility.service';
import { By } from '@angular/platform-browser';

class MockAccessibilityService {
  announceComponentState = jest.fn();
  announce = jest.fn();
}

class MockRouter {
  navigate = jest.fn();
  // Mock other router properties/methods if needed by the component template or logic
}


describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let accessibilityServiceMock: MockAccessibilityService;
  let routerMock: MockRouter;

  // Removed mockActivatedRoute as it's not directly used by the component's TS logic shown

  beforeEach(async () => {
    accessibilityServiceMock = new MockAccessibilityService();
    routerMock = new MockRouter();

    await TestBed.configureTestingModule({
      imports: [SidebarComponent, NoopAnimationsModule], // SidebarComponent is standalone
      providers: [
        { provide: AccessibilityService, useValue: accessibilityServiceMock },
        { provide: Router, useValue: routerMock },
        // Provide a basic ActivatedRoute mock if any RouterLinkActive or similar needs it.
        { provide: ActivatedRoute, useValue: { snapshot: {} } }
      ]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set isMobile based on window width on init and resize', fakeAsync(() => {
    // Test initial check in ngAfterViewInit (via setTimeout)
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });
    component.ngAfterViewInit(); // Manually trigger if needed for test setup
    tick(); // Process setTimeout
    expect(component.isMobile).toBe(true);

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    component.onWindowResize(); // Trigger resize handler
    expect(component.isMobile).toBe(false);
  }));

  it('should emit toggleSidebar and announce when onToggleSidebar is called', () => {
    jest.spyOn(component.toggleSidebar, 'emit');
    component.isExpanded = true; // Assuming initial state

    component.onToggleSidebar();

    expect(component.toggleSidebar.emit).toHaveBeenCalled();
    expect(accessibilityServiceMock.announceComponentState).toHaveBeenCalledWith('Navigation sidebar', 'collapsed');

    // Toggle again
    component.onToggleSidebar(); // Now isExpanded should be false internally if component toggles it
                                 // The component itself doesn't toggle isExpanded, parent does.
                                 // So we manually set it to test announcement for "expanded"
    component.isExpanded = false; // Simulate parent changing the input
    fixture.detectChanges();
    component.onToggleSidebar();
    expect(accessibilityServiceMock.announceComponentState).toHaveBeenCalledWith('Navigation sidebar', 'expanded');
  });

  it('should emit closeSidebar and announce when onNavItemClick is called', () => {
    jest.spyOn(component.closeSidebar, 'emit');
    component.onNavItemClick();
    expect(component.closeSidebar.emit).toHaveBeenCalled();
    expect(accessibilityServiceMock.announce).toHaveBeenCalledWith('Navigation item selected');
  });

  it('should emit closeSidebar and announce when onFooterLinkClick is called', () => {
    jest.spyOn(component.closeSidebar, 'emit');
    component.onFooterLinkClick();
    expect(component.closeSidebar.emit).toHaveBeenCalled();
    expect(accessibilityServiceMock.announce).toHaveBeenCalledWith('Secondary navigation item selected');
  });

  it('should close sidebar with Escape key in mobile view when expanded', () => {
    jest.spyOn(component.closeSidebar, 'emit');
    component.isMobile = true;
    component.isExpanded = true;
    fixture.detectChanges();

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    // Dispatch on the component's root element or document if listener is global
    fixture.debugElement.nativeElement.dispatchEvent(escapeEvent);
    // component.onKeyDown(escapeEvent); // Or call directly if HostListener doesn't trigger in test

    expect(component.closeSidebar.emit).toHaveBeenCalled();
    expect(accessibilityServiceMock.announce).toHaveBeenCalledWith('Navigation menu closed');
  });

  it('should NOT close sidebar with Escape key if not mobile or not expanded', () => {
    jest.spyOn(component.closeSidebar, 'emit');
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });

    // Case 1: Not mobile, but expanded
    component.isMobile = false;
    component.isExpanded = true;
    fixture.detectChanges();
    fixture.debugElement.nativeElement.dispatchEvent(escapeEvent);
    expect(component.closeSidebar.emit).not.toHaveBeenCalled();

    // Case 2: Mobile, but not expanded
    component.isMobile = true;
    component.isExpanded = false;
    fixture.detectChanges();
    fixture.debugElement.nativeElement.dispatchEvent(escapeEvent);
    expect(component.closeSidebar.emit).not.toHaveBeenCalled();
  });

  it('should close sidebar on document click if click is outside and sidebar is expanded', () => {
    jest.spyOn(component.closeSidebar, 'emit');
    component.isExpanded = true;
    fixture.detectChanges();

    // Simulate a click outside
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component.closeSidebar.emit).toHaveBeenCalled();
  });

  it('should NOT close sidebar on document click if click is inside', () => {
    jest.spyOn(component.closeSidebar, 'emit');
    component.isExpanded = true;
    fixture.detectChanges();

    fixture.debugElement.nativeElement.click(); // Click on the component itself
    fixture.detectChanges();

    expect(component.closeSidebar.emit).not.toHaveBeenCalled();
  });

  it('should NOT close sidebar on document click if sidebar is not expanded', () => {
    jest.spyOn(component.closeSidebar, 'emit');
    component.isExpanded = false;
    fixture.detectChanges();

    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component.closeSidebar.emit).not.toHaveBeenCalled();
  });
});
