import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
    fill?: boolean;
  }[];
}

export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  plugins?: {
    legend?: {
      display?: boolean;
      position?: 'top' | 'bottom' | 'left' | 'right';
    };
    title?: {
      display?: boolean;
      text?: string;
    };
  };
  scales?: any;
}

@Component({
  selector: 'app-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container">
      <canvas #chartCanvas></canvas>
    </div>
  `,
  styles: [`
    .chart-container {
      position: relative;
      width: 100%;
      height: 100%;
    }
    
    canvas {
      max-width: 100%;
      max-height: 100%;
    }
  `]
})
export class ChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  
  @Input() type: ChartType = 'pie';
  @Input() data: ChartData | null = null;
  @Input() options: ChartOptions = {};
  @Input() height?: number;
  @Input() width?: number;

  private chart: Chart | null = null;

  ngOnInit(): void {
    this.setupDefaultOptions();
  }

  ngAfterViewInit(): void {
    if (this.data) {
      this.createChart();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }

  private setupDefaultOptions(): void {
    const defaultOptions: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom'
        }
      }
    };

    this.options = { ...defaultOptions, ...this.options };
  }

  private createChart(): void {
    if (!this.data || !this.chartCanvas) {
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }

    // Destroy existing chart if it exists
    if (this.chart) {
      this.chart.destroy();
    }

    const config: ChartConfiguration = {
      type: this.type,
      data: this.data,
      options: this.options
    };

    this.chart = new Chart(ctx, config);
  }

  public updateChart(newData: ChartData): void {
    if (this.chart) {
      this.chart.data = newData;
      this.chart.update();
    } else {
      this.data = newData;
      this.createChart();
    }
  }

  public updateOptions(newOptions: ChartOptions): void {
    this.options = { ...this.options, ...newOptions };
    if (this.chart) {
      this.chart.options = this.options;
      this.chart.update();
    }
  }
}
