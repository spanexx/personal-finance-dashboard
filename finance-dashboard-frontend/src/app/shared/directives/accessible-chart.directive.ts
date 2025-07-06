import { Directive, ElementRef, HostListener, Input } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';

/**
 * Directive to enhance charts with screen reader announcements
 * Use this on chart elements to improve accessibility
 */
@Directive({
  selector: '[accessibleChart]'
})
export class AccessibleChartDirective {
  @Input() chartTitle: string = '';
  @Input() chartData: any;
  @Input() chartType: string = '';

  constructor(private el: ElementRef, private liveAnnouncer: LiveAnnouncer) {}

  @HostListener('click')
  onClick() {
    const summary = this.generateChartSummary();
    this.liveAnnouncer.announce(summary);
  }

  @HostListener('keyup.enter')
  onEnter() {
    const summary = this.generateChartSummary();
    this.liveAnnouncer.announce(summary);
  }

  private generateChartSummary(): string {
    if (!this.chartData || !this.chartTitle) {
      return 'Chart data not available';
    }

    let summary = `${this.chartTitle} - ${this.chartType} chart. `;

    // Different summary based on chart type
    if (this.chartType === 'pie') {
      summary += this.generatePieChartSummary();
    } else {
      summary += this.generateLineOrBarChartSummary();
    }

    return summary;
  }

  private generatePieChartSummary(): string {
    if (!this.chartData.labels || !this.chartData.datasets || this.chartData.datasets.length === 0) {
      return 'No data available';
    }

    const labels = this.chartData.labels;
    const data = this.chartData.datasets[0].data;
    
    let total = 0;
    for (const val of data) {
      total += val;
    }

    let summary = 'Categories: ';
    for (let i = 0; i < Math.min(labels.length, 5); i++) {
      const percentage = ((data[i] / total) * 100).toFixed(1);
      summary += `${labels[i]}: ${percentage}%, `;
    }

    if (labels.length > 5) {
      summary += `and ${labels.length - 5} more categories.`;
    }

    return summary;
  }

  private generateLineOrBarChartSummary(): string {
    if (!this.chartData.labels || !this.chartData.datasets || this.chartData.datasets.length === 0) {
      return 'No data available';
    }

    const labels = this.chartData.labels;
    let summary = `Showing data for ${labels.length} time periods. `;

    // Summarize trends
    const datasets = this.chartData.datasets;
    for (const dataset of datasets) {
      const values = dataset.data;
      const max = Math.max(...values);
      const maxIndex = values.indexOf(max);
      const min = Math.min(...values);
      const minIndex = values.indexOf(min);
      
      summary += `${dataset.label}: highest at ${labels[maxIndex]} (${max}), lowest at ${labels[minIndex]} (${min}). `;
    }

    return summary;
  }
}
