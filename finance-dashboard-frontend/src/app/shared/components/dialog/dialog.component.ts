import { Component, HostBinding, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule } from '@angular/material/dialog';
import { AccessibilityService } from '../../services/accessibility.service';

@Component({
  selector: 'app-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  template: `
    <div class="dialog-container" [attr.role]="role" [attr.aria-modal]="true" [attr.aria-labelledby]="labelledBy">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .dialog-container {
      display: flex;
      flex-direction: column;
      outline: none;
    }
  `]
})
export class DialogComponent implements OnInit, OnDestroy {
  @Input() role: 'dialog' | 'alertdialog' = 'dialog';
  @Input() labelledBy: string = '';

  @HostBinding('attr.tabindex') tabindex = '-1';
  @HostBinding('class.dialog') dialogClass = true;

  constructor(private accessibilityService: AccessibilityService) {}

  ngOnInit(): void {
    // Trap focus within the dialog
    if (this.role === 'dialog' || this.role === 'alertdialog') {
      this.accessibilityService.trapFocus(this.getDialogElement());
      this.announceDialog();
    }
  }

  ngOnDestroy(): void {
    // Release focus trap when dialog is closed
    if (this.role === 'dialog' || this.role === 'alertdialog') {
      this.accessibilityService.releaseFocus(this.getDialogElement());
    }
  }

  private getDialogElement(): HTMLElement {
    return document.querySelector('.dialog-container') as HTMLElement;
  }

  private announceDialog(): void {
    const title = document.getElementById(this.labelledBy)?.textContent;
    if (title) {
      this.accessibilityService.announceComponentState('Dialog', `opened: ${title}`);
    }
  }
}
