import { Directive, ElementRef, OnDestroy, OnInit, Input } from '@angular/core';
import { AccessibilityService } from '../services/accessibility.service';

@Directive({
  selector: '[appFocusTrap]',
  standalone: true
})
export class FocusTrapDirective implements OnInit, OnDestroy {
  @Input() appFocusTrap: boolean = true;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private accessibilityService: AccessibilityService
  ) {}

  ngOnInit(): void {
    if (this.appFocusTrap) {
      this.accessibilityService.trapFocus(this.elementRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    if (this.appFocusTrap) {
      this.accessibilityService.releaseFocus(this.elementRef.nativeElement);
    }
  }
}
