import { Directive, ElementRef, Input, OnInit } from '@angular/core';
import { AccessibilityService, FocusTarget } from '../services/accessibility.service';

@Directive({
  selector: '[appAutoFocus]',
  standalone: true
})
export class AutoFocusDirective implements OnInit {
  @Input() appAutoFocus: boolean = true;
  @Input() focusTarget: FocusTarget = FocusTarget.FIRST_FOCUSABLE;
  @Input() focusDelay: number = 0;
  @Input() customElement?: HTMLElement;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private accessibilityService: AccessibilityService
  ) {}

  ngOnInit(): void {
    if (!this.appAutoFocus) return;

    if (this.focusDelay) {
      setTimeout(() => this.focus(), this.focusDelay);
    } else {
      // Small delay to ensure DOM is ready
      setTimeout(() => this.focus(), 0);
    }
  }

  private focus(): void {
    this.accessibilityService.setFocus(
      this.elementRef.nativeElement,
      this.focusTarget,
      this.customElement
    );
  }
}
