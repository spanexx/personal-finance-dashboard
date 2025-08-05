import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { LiveAnnouncer } from '@angular/cdk/a11y';

import { TransactionExportImportComponent } from './transaction-export-import.component';

describe('TransactionExportImportComponent', () => {
  let component: TransactionExportImportComponent;
  let fixture: ComponentFixture<TransactionExportImportComponent>;
  let mockLiveAnnouncer: any;

  beforeEach(async () => {
    mockLiveAnnouncer = {
      announce: jasmine.createSpy('announce')
    };

    await TestBed.configureTestingModule({
      declarations: [ TransactionExportImportComponent ],
      imports: [
        NoopAnimationsModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule
      ],
      providers: [
        { provide: LiveAnnouncer, useValue: mockLiveAnnouncer }
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TransactionExportImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit exportRequested when exportTransactions is called', () => {
    spyOn(component.exportRequested, 'emit');
    const format = 'csv';
    component.exportTransactions(format);
    expect(component.exportRequested.emit).toHaveBeenCalledWith(format);
    expect(mockLiveAnnouncer.announce).toHaveBeenCalledWith(`Preparing ${format.toUpperCase()} export...`, 'polite');
  });

  it('should emit importRequested when openImportDialog is called', () => {
    spyOn(component.importRequested, 'emit');
    component.openImportDialog();
    expect(component.importRequested.emit).toHaveBeenCalled();
    expect(mockLiveAnnouncer.announce).toHaveBeenCalledWith('Opening import dialog...', 'polite');
  });
});