import { Component, OnInit } from '@angular/core';
import { AiService } from '../../../../core/services/ai.service';

@Component({
  selector: 'app-ai-insights',
  templateUrl: './ai-insights.component.html',
  styleUrls: ['./ai-insights.component.scss'],
})
export class AiInsightsComponent implements OnInit {
  insights: string[] = [];

  constructor(private aiService: AiService) {}

  ngOnInit(): void {
    this.aiService.getInsights().subscribe((response) => {
      this.insights = response.insights;
    });
  }
}
