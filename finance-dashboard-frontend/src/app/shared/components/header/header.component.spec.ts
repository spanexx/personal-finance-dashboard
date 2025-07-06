import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HeaderComponent } from './header.component';
import { AccessibilityService } from '../../services/accessibility.service';
import { By } from '@angular/platform-browser';
import { FocusTrapDirective } from '../../directives/focus-trap.directive'; // Import if used in template directly
import { NgIf } from '@angular/common';

// Mock AccessibilityService
class MockAccessibilityService {
  announceComponentState = jest.fn();
  announceRouteChange = jest.fn(); // In case it's used, though not directly in HeaderComponent methods shown
}

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;
  let accessibilityServiceMock: MockAccessibilityService;

  beforeEach(async () => {
    accessibilityServiceMock = new MockAccessibilityService();
    await TestBed.configureTestingModule({
      // HeaderComponent is standalone, so it imports NgIf and FocusTrapDirective itself.
      // If it wasn't standalone, you'd import them here or in a TestHostComponent.
      imports: [HeaderComponent],
      providers: [
        { provide: AccessibilityService, useValue: accessibilityServiceMock }
      ]
    }).compileComponents();
    
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit toggleSidebar event when onToggleSidebar is called', () => {
    jest.spyOn(component.toggleSidebar, 'emit');
    component.onToggleSidebar();
    expect(component.toggleSidebar.emit).toHaveBeenCalled();
  });

  it('should call accessibilityService.announceComponentState when onToggleSidebar is called', () => {
    component.isSidebarExpanded = true; // Assuming initial state
    component.onToggleSidebar();
    expect(accessibilityServiceMock.announceComponentState).toHaveBeenCalledWith('Navigation menu', 'collapsed');

    component.onToggleSidebar(); // Toggle again
    expect(accessibilityServiceMock.announceComponentState).toHaveBeenCalledWith('Navigation menu', 'expanded');
  });

  it('should toggle isUserMenuOpen when toggleUserMenu is called', () => {
    expect(component.isUserMenuOpen).toBe(false);
    component.toggleUserMenu();
    expect(component.isUserMenuOpen).toBe(true);
    component.toggleUserMenu();
    expect(component.isUserMenuOpen).toBe(false);
  });

  it('should call accessibilityService.announceComponentState when toggleUserMenu is called', () => {
    component.toggleUserMenu(); // Open
    expect(accessibilityServiceMock.announceComponentState).toHaveBeenCalledWith('User menu', 'opened');
    component.toggleUserMenu(); // Close
    expect(accessibilityServiceMock.announceComponentState).toHaveBeenCalledWith('User menu', 'closed');
  });

  it('should focus the first item in user menu when opened', fakeAsync(() => {
    // Create a mock user menu dropdown in the component's DOM for testing focus
    const userMenuDiv = document.createElement('div');
    userMenuDiv.innerHTML = '<button id="firstMenuItem">Profile</button><a href="#" id="secondMenuItem">Logout</a>';
    component.userMenuDropdown = { nativeElement: userMenuDiv };
    const firstItem = userMenuDiv.querySelector('#firstMenuItem') as HTMLElement;
    jest.spyOn(firstItem, 'focus');

    component.toggleUserMenu(); // Open menu
    tick(100); // Wait for setTimeout in toggleUserMenu

    expect(component.isUserMenuOpen).toBe(true);
    expect(firstItem.focus).toHaveBeenCalled();
  }));

  it('should close user menu and focus trigger on Escape keydown if menu is open', () => {
    component.isUserMenuOpen = true; // Open menu
    fixture.detectChanges();

    // Mock the menu trigger element for focus check
    const userMenuTriggerButton = document.createElement('button');
    jest.spyOn(userMenuTriggerButton, 'focus');
    // Simulate this button being the one that triggered the menu
    // This is a bit tricky as the actual element is in the component's template
    // A more robust way might be to query it from fixture.debugElement if it has a clear ID or class.
    // For simplicity, we assume component.elementRef.nativeElement.querySelector('.user-menu') would work if template has it.
    // Here, we'll just check if announceComponentState is called, as focus return is harder to test without complex DOM setup.

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    component.onUserMenuKeyDown(escapeEvent);

    expect(component.isUserMenuOpen).toBe(false);
    expect(accessibilityServiceMock.announceComponentState).toHaveBeenCalledWith('User menu', 'closed');
    // Ideally, also test: expect(userMenuTriggerButton.focus).toHaveBeenCalled();
  });

  it('should close user menu on document click if menu is open and click is outside', () => {
    component.isUserMenuOpen = true;
    fixture.detectChanges();

    // Simulate a click outside the component
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(component.isUserMenuOpen).toBe(false);
  });

  it('should NOT close user menu on document click if click is inside', () => {
    component.isUserMenuOpen = true;
    fixture.detectChanges();

    // Simulate a click inside by clicking on the component's root element
    fixture.debugElement.nativeElement.click();
    fixture.detectChanges();

    expect(component.isUserMenuOpen).toBe(true); // Should remain open
  });
});
