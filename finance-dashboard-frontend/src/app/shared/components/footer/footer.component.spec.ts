import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FooterComponent } from './footer.component';
import { By } from '@angular/platform-browser';

describe('FooterComponent', () => {
  let component: FooterComponent;
  let fixture: ComponentFixture<FooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FooterComponent] // FooterComponent is standalone
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the current year in the copyright', () => {
    const currentYear = new Date().getFullYear();
    expect(component.currentYear).toBe(currentYear);

    // Assuming the template contains something like: <p>&copy; {{ currentYear }} Finance Dashboard</p>
    // We can't directly test the template's interpolated value without knowing its exact structure
    // or querying the DOM element that contains the year.
    // For now, testing the component property is sufficient for this unit test.
    // If the template structure was known, e.g., an element with id="copyright-year":
    // const yearElement = fixture.debugElement.query(By.css('#copyright-year'));
    // expect(yearElement.nativeElement.textContent).toContain(currentYear.toString());
  });

  // Example test for a link (if links were present)
  xit('should have a link to the privacy policy', () => {
    // Assuming a link like: <a href="/privacy">Privacy Policy</a>
    const privacyLink = fixture.debugElement.query(By.css('a[href="/privacy"]'));
    expect(privacyLink).toBeTruthy();
    // expect(privacyLink.nativeElement.textContent).toContain('Privacy Policy');
  });
});
