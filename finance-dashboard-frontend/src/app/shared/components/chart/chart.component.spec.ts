import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef, SimpleChange } from '@angular/core';
import { ChartComponent } from './chart.component';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js'; // Import Chart and registerables
import { BehaviorSubject } from 'rxjs';

// Mock Chart.js
// jest.mock('chart.js'); // This would auto-mock Chart.js module

// More controlled manual mock:
let mockChartInstance: Partial<Chart>;

const MockChart = jest.fn().mockImplementation((context, config) => {
  mockChartInstance = {
    data: config.data,
    options: config.options,
    update: jest.fn(),
    destroy: jest.fn(),
    config: config // Store config for inspection
  };
  return mockChartInstance as Chart;
});


describe('ChartComponent', () => {
  let component: ChartComponent;
  let fixture: ComponentFixture<ChartComponent>;

  beforeAll(() => {
    // Chart.register(...registerables); // This might be needed if not auto-mocking and Chart.js needs it globally
  });

  beforeEach(async () => {
    // Reset the manual mock before each test
    MockChart.mockClear();
    if (mockChartInstance && mockChartInstance.update) {
        (mockChartInstance.update as jest.Mock).mockClear();
    }
    if (mockChartInstance && mockChartInstance.destroy) {
        (mockChartInstance.destroy as jest.Mock).mockClear();
    }

    await TestBed.configureTestingModule({
      imports: [ChartComponent], // Assuming it's standalone
      // No providers needed if Chart.js is globally available or mocked as above
    }).compileComponents();

    fixture = TestBed.createComponent(ChartComponent);
    component = fixture.componentInstance;

    // Replace the actual Chart constructor with the mock for the duration of the test
    component['Chart'] = MockChart as any;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize chart on ngAfterViewInit if chartCanvas is present and data exists', () => {
    // Mock canvas element
    const mockCanvas = document.createElement('canvas');
    component.chartCanvas = new ElementRef(mockCanvas);
    component.chartData = { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] };
    component.chartType = 'bar';

    fixture.detectChanges(); // Trigger ngAfterViewInit through lifecycle
    component.ngAfterViewInit(); // Explicit call might be needed if change detection doesn't trigger it as expected in test

    expect(MockChart).toHaveBeenCalledTimes(1);
    expect(mockChartInstance).toBeDefined();
    if (mockChartInstance?.config) {
        expect((mockChartInstance.config as ChartConfiguration).type).toBe('bar');
        expect((mockChartInstance.config as ChartConfiguration).data.labels).toEqual(['A', 'B']);
    }
  });

  it('should not initialize chart if canvas is not present', () => {
    component.chartCanvas = undefined; // Ensure canvas is not defined
    component.chartData = { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] };
    fixture.detectChanges();
    component.ngAfterViewInit();
    expect(MockChart).not.toHaveBeenCalled();
  });

  it('should not initialize chart if chartData is not present', () => {
    const mockCanvas = document.createElement('canvas');
    component.chartCanvas = new ElementRef(mockCanvas);
    component.chartData = undefined;
    fixture.detectChanges();
    component.ngAfterViewInit();
    expect(MockChart).not.toHaveBeenCalled();
  });


  it('should destroy chart on ngOnDestroy', () => {
    // Initialize a chart first
    const mockCanvas = document.createElement('canvas');
    component.chartCanvas = new ElementRef(mockCanvas);
    component.chartData = { labels: ['A', 'B'], datasets: [{ data: [1, 2] }] };
    component.ngAfterViewInit();
    expect(MockChart).toHaveBeenCalledTimes(1);

    component.ngOnDestroy();
    expect(mockChartInstance?.destroy).toHaveBeenCalledTimes(1);
  });

  describe('ngOnChanges', () => {
    beforeEach(() => {
      // Initial setup to create the chart instance
      const mockCanvas = document.createElement('canvas');
      component.chartCanvas = new ElementRef(mockCanvas);
      component.chartData = { labels: ['X'], datasets: [{ data: [10] }] };
      component.chartType = 'line';
      component.ngAfterViewInit(); // Create the chart
      MockChart.mockClear(); // Clear calls from initial setup
    });

    it('should update chart data when chartData input changes', () => {
      const newData = { labels: ['C', 'D'], datasets: [{ data: [3, 4], label: 'New' }] };
      component.chartData = newData;
      component.ngOnChanges({
        chartData: new SimpleChange(null, newData, false)
      });
      expect(mockChartInstance?.data).toEqual(newData);
      expect(mockChartInstance?.update).toHaveBeenCalled();
    });

    it('should update chart options when chartOptions input changes', () => {
      const newOptions = { responsive: false, plugins: { legend: { display: false } } };
      component.chartOptions = newOptions;
      component.ngOnChanges({
        chartOptions: new SimpleChange(null, newOptions, false)
      });
      expect(mockChartInstance?.options).toEqual(expect.objectContaining(newOptions));
      expect(mockChartInstance?.update).toHaveBeenCalled();
    });

    it('should recreate chart if chartType input changes', () => {
      const newType: ChartType = 'pie';
      component.chartType = newType;
      component.ngOnChanges({
        chartType: new SimpleChange('line', newType, false)
      });
      expect(mockChartInstance?.destroy).toHaveBeenCalled(); // Old chart destroyed
      expect(MockChart).toHaveBeenCalledTimes(1); // New chart created
      if (mockChartInstance?.config) {
        expect((mockChartInstance.config as ChartConfiguration).type).toBe('pie');
      }
    });

    it('should not update if chart instance does not exist', () => {
       (component as any).chart = undefined; // Force chart to be undefined
       const newData = { labels: ['C', 'D'], datasets: [{ data: [3, 4] }] };
       component.chartData = newData;
       component.ngOnChanges({
         chartData: new SimpleChange(null, newData, false)
       });
       // mockChartInstance is from the last created chart via MockChart
       // if component.chart is undefined, then update should not be called
       expect(mockChartInstance?.update).not.toHaveBeenCalled();
    });
  });

  it('should use provided chartId for canvas element', () => {
    const testId = 'myTestChart';
    component.chartId = testId;
    fixture.detectChanges(); // This will trigger ngAfterViewInit if canvas is there
    // We can't easily test the template here for the ID, but we can check if the component stores it
    expect(component.chartId).toBe(testId);
  });

});
