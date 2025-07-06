import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Chart, ChartConfiguration } from 'chart.js';

@Directive({
  selector: '[chart]'
})
export class ChartDirective implements OnChanges {
  @Input() chart: ChartConfiguration | any;
  private chartInstance: Chart | undefined;

  constructor(private elementRef: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chart'] && this.chart) {
      this.initOrUpdateChart();
    }
  }

  private initOrUpdateChart(): void {
    const canvas = this.elementRef.nativeElement;
    
    // Destroy previous chart if it exists
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    // Create new chart
    this.chartInstance = new Chart(canvas, this.chart);
  }
}
