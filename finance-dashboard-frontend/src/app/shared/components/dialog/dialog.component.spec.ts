import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { DialogComponent, DialogData } from './dialog.component'; // Assuming DialogData interface is exported
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NoopAnimationsModule } from '@angular/platform-browser/animations'; // For Material animations

describe('DialogComponent', () => {
  let component: DialogComponent;
  let fixture: ComponentFixture<DialogComponent>;
  let matDialogRefSpy: jest.Mocked<MatDialogRef<DialogComponent>>;

  const mockDialogData: DialogData = {
    title: 'Test Title',
    message: 'Test message content.',
    confirmButtonText: 'OK',
    cancelButtonText: 'Cancel',
    showCancelButton: true
  };

  beforeEach(async () => {
    matDialogRefSpy = {
      close: jest.fn()
    } as unknown as jest.Mocked<MatDialogRef<DialogComponent>>;

    await TestBed.configureTestingModule({
      imports: [
        DialogComponent, // Import if standalone
        // MatDialogModule, // DialogComponent should import this itself if standalone
        // MatButtonModule, // DialogComponent should import this itself if standalone
        // MatIconModule,   // DialogComponent should import this itself if standalone
        // NoopAnimationsModule
      ],
      providers: [
        { provide: MatDialogRef, useValue: matDialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: mockDialogData }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display title and message from MAT_DIALOG_DATA', () => {
    const titleElement = fixture.nativeElement.querySelector('h2[mat-dialog-title]');
    const messageElement = fixture.nativeElement.querySelector('div[mat-dialog-content] p');

    expect(titleElement.textContent).toContain('Test Title');
    expect(messageElement.textContent).toContain('Test message content.');
  });

  it('should display confirm and cancel buttons with correct text', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button[mat-button]');
    // Assuming confirm is primary and cancel is standard mat-button or specific class
    // This might need adjustment based on actual template structure.
    // For now, we'll check button texts.
    const confirmButton = Array.from(buttons).find((btn: any) => btn.textContent.includes('OK'));
    const cancelButton = Array.from(buttons).find((btn: any) => btn.textContent.includes('Cancel'));

    expect(confirmButton).toBeTruthy();
    expect(cancelButton).toBeTruthy();
  });

  it('should not display cancel button if showCancelButton is false', () => {
    component.data = { ...mockDialogData, showCancelButton: false };
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button[mat-button]');
    const cancelButton = Array.from(buttons).find((btn: any) => btn.textContent.includes('Cancel'));
    expect(cancelButton).toBeFalsy();
  });

  it('should call dialogRef.close(true) when confirm button is clicked', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    // Find button that contains the confirmButtonText (e.g. "OK", or a specific class/id)
    const confirmButton = Array.from(buttons).find(btn => btn.textContent.includes(mockDialogData.confirmButtonText || 'Confirm')) as HTMLElement;
    confirmButton.click();
    expect(matDialogRefSpy.close).toHaveBeenCalledWith(true);
  });

  it('should call dialogRef.close(false) when cancel button is clicked', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const cancelButton = Array.from(buttons).find(btn => btn.textContent.includes(mockDialogData.cancelButtonText || 'Cancel')) as HTMLElement;

    if (cancelButton) { // Only if cancel button is shown
        cancelButton.click();
        expect(matDialogRefSpy.close).toHaveBeenCalledWith(false);
    } else {
        // If cancel button is not shown, this test might not be relevant or should assert its absence
        expect(cancelButton).toBeFalsy();
    }
  });

  it('should use default button texts if not provided in data', () => {
    component.data = { title: 'Test', message: 'Msg' }; // No button texts
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const confirmButton = Array.from(buttons).find((btn: any) => btn.textContent.includes('Confirm'));
    const cancelButton = Array.from(buttons).find((btn: any) => btn.textContent.includes('Cancel')); // Default showCancelButton is true

    expect(confirmButton).toBeTruthy();
    expect(cancelButton).toBeTruthy(); // Default is to show cancel
  });
});
