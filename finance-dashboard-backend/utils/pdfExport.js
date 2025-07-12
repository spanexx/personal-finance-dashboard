// Utility to generate a simple PDF from report data using PDFKit
const PDFDocument = require('pdfkit');

function generateReportPDF(report) {
  const doc = new PDFDocument({ margin: 40 });
  let buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {});

  // Title
  doc.fontSize(20).text(report.name || 'Financial Report', { align: 'center' });
  doc.moveDown();

  // Metadata
  doc.fontSize(12).text(`Type: ${report.type}`);
  doc.text(`Period: ${report.period}`);
  doc.text(`Status: ${report.status}`);
  doc.text(`Created: ${report.createdAt}`);
  doc.text(`Format: PDF`);
  doc.moveDown();

  // Summary
  if (report.data && report.data.summary) {
    doc.fontSize(14).text('Summary:', { underline: true });
    const summary = report.data.summary;
    // Define the order and user-friendly labels
    const summaryFields = [
      { key: 'totalIncome', label: 'Total Income' },
      { key: 'totalExpenses', label: 'Total Expenses' },
      { key: 'averageDailySpending', label: 'Average Daily Spending' },
      { key: 'transactionCount', label: 'Transaction Count' },
      { key: 'categoriesCount', label: 'Categories Count' }
    ];
    summaryFields.forEach(({ key, label }) => {
      if (summary[key] !== undefined) {
        let value = summary[key];
        if (key === 'averageDailySpending' && typeof value === 'number') {
          value = value.toFixed(2);
        }
        doc.fontSize(12).text(`${label}: ${value}`);
      }
    });
    doc.moveDown();
  }

  // Category/Source Analysis
  if (report.data && (report.data.categoryAnalysis || report.data.sourceAnalysis)) {
    const analysis = report.data.categoryAnalysis || report.data.sourceAnalysis;
    doc.fontSize(14).text('Details:', { underline: true });
    analysis.forEach((item, idx) => {
      // Compose detail line in requested format
      let detailLine = '';
      if (item.categoryName) {
        detailLine += `${item.categoryName}`;
      } else if (item.source) {
        detailLine += `${item.source}`;
      }
      if (item.totalAmount !== undefined) detailLine += ` - Total Amount: ${item.totalAmount}`;
      if (item.transactionCount !== undefined) detailLine += ` - Transaction Count: ${item.transactionCount}`;
      if (item.averageAmount !== undefined) {
        let avg = item.averageAmount;
        if (typeof avg === 'number') avg = avg.toFixed(2);
        detailLine += ` - Average Amount: ${avg}`;
      }
      if (item.minAmount !== undefined) detailLine += ` - min: ${item.minAmount}`;
      if (item.maxAmount !== undefined) detailLine += ` - max: ${item.maxAmount}`;
      doc.fontSize(12).text(`${idx + 1}. ${detailLine}`);
    });
    doc.moveDown();
  }

  // End
  doc.end();
  return new Promise((resolve) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
  });
}

module.exports = { generateReportPDF };
