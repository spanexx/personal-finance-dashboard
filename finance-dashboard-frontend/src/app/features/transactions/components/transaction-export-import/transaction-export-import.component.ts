import { Component, Input, Output, EventEmitter } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Transaction } from '../../../../shared/models/transaction.model';

interface ExportFormat {
  value: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-transaction-export-import',
  templateUrl: './transaction-export-import.component.html',
  styleUrls: ['./transaction-export-import.component.scss']
})
export class TransactionExportImportComponent {
  @Input() exportFormats: ExportFormat[] = [
    { value: 'csv', label: 'CSV', icon: 'description' },
    { value: 'excel', label: 'Excel', icon: 'table_chart' },
    { value: 'pdf', label: 'PDF', icon: 'picture_as_pdf' }
  ];

  @Output() exportRequested = new EventEmitter<string>();
  @Output() importRequested = new EventEmitter<void>();

  constructor(private liveAnnouncer: LiveAnnouncer) {}

  /**
   * Trigger export process in parent component
   * @param format Export format (csv, excel, pdf)
   */
  exportTransactions(format: string): void {
    this.liveAnnouncer.announce(`Preparing ${format.toUpperCase()} export...`, 'polite');
    this.exportRequested.emit(format);
  }

  /**
   * Open import dialog through parent component
   */
  openImportDialog(): void {
    this.liveAnnouncer.announce('Opening import dialog...', 'polite');
    this.importRequested.emit();
  }
}
