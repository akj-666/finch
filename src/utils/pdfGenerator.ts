import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Expense } from '../types';
import { formatDate, formatTimeline } from './formatters';
import { FINCH_LOGO_LIGHT_BASE64 } from '../assets/logoBase64';

// Format amounts for PDF with Indian number system (using 'Rs.' to guarantee 100% PDF font compatibility)
function formatPDFCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `Rs. ${formatted}`;
}

export function generateExpensePDF(
  expenses: Expense[],
  startDate: string,
  endDate: string,
  categoryFilter?: string,
  natureFilter?: string,
  onError?: (message: string) => void
): boolean {
  if (expenses.length === 0) {
    if (onError) {
      onError('No expenses match the currently selected filters. Adjust your date range or filters to include records before generating a report.');
    }
    return false;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Colors based on brand guidelines
  const brandForest: [number, number, number] = [15, 59, 46]; // #0F3B2E
  const brandGold: [number, number, number] = [200, 155, 60]; // #C89B3C
  const brandIvoryBg: [number, number, number] = [255, 248, 238]; // #FFF8EE
  const textDark: [number, number, number] = [30, 41, 34];
  const textMuted: [number, number, number] = [100, 116, 107];
  const lineBorder: [number, number, number] = [226, 219, 206];

  // Header Banner
  doc.setFillColor(...brandForest);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Gold accent bar
  doc.setFillColor(...brandGold);
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Brand Name & Title
  doc.setTextColor(255, 248, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Finch — Business Expense Report', margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(200, 155, 60);
  doc.text('KOTTAYAM, KERALA, INDIA', margin, 20);

  // Finch Logo in Header Banner (directly on dark green header banner, without white container)
  try {
    const logoW = 36;
    const logoH = 13.3;
    const logoX = pageWidth - margin - logoW;
    const logoY = 7;
    doc.addImage(FINCH_LOGO_LIGHT_BASE64, 'PNG', logoX, logoY, logoW, logoH);
  } catch (err) {
    // Fallback gracefully if image rendering encounters any issue
    console.warn('PDF logo rendering fallback:', err);
  }

  // Metadata block
  let currentY = 38;
  const timelineLabel = formatTimeline(startDate, endDate);
  const now = new Date();
  const generatedOn = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' at ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  doc.setTextColor(...textDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Report Timeline:', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(timelineLabel, margin + 32, currentY);

  doc.setFont('helvetica', 'bold');
  doc.text('Generated On:', pageWidth - 80, currentY);
  doc.setFont('helvetica', 'normal');
  doc.text(generatedOn, pageWidth - 52, currentY);

  currentY += 6;
  const activeFilters = [
    categoryFilter && categoryFilter !== 'ALL' ? `Category: ${categoryFilter}` : null,
    natureFilter && natureFilter !== 'ALL' ? `Nature: ${natureFilter}` : null,
  ].filter(Boolean);

  if (activeFilters.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...textMuted);
    doc.text(`Active Filters: ${activeFilters.join('  |  ')}`, margin, currentY);
    currentY += 6;
  }

  currentY += 2;

  // Calculate totals
  const totalSpend = expenses.reduce((sum, e) => sum + e.amount, 0);
  const capexSpend = expenses.filter((e) => e.nature === 'CapEx').reduce((sum, e) => sum + e.amount, 0);
  const opexSpend = expenses.filter((e) => e.nature === 'OpEx').reduce((sum, e) => sum + e.amount, 0);

  // Summary Metrics Box
  const boxWidth = (pageWidth - margin * 2 - 9) / 4;
  const boxHeight = 18;

  const summaryCards = [
    { title: 'TOTAL SPEND', value: formatPDFCurrency(totalSpend), color: brandForest },
    { title: 'CAPEX (CAPITAL)', value: formatPDFCurrency(capexSpend), color: [29, 78, 137] as [number, number, number] },
    { title: 'OPEX (OPERATING)', value: formatPDFCurrency(opexSpend), color: [161, 98, 7] as [number, number, number] },
    { title: 'EXPENSE COUNT', value: `${expenses.length} Records`, color: brandForest },
  ];

  summaryCards.forEach((card, idx) => {
    const x = margin + idx * (boxWidth + 3);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...lineBorder);
    doc.roundedRect(x, currentY, boxWidth, boxHeight, 2, 2, 'FD');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text(card.title, x + 3.5, currentY + 6);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...card.color);
    doc.text(card.value, x + 3.5, currentY + 13.5);
  });

  currentY += boxHeight + 8;

  // Category Subtotals Summary Table
  const categoryMap = new Map<string, { total: number; capex: number; opex: number; count: number }>();
  expenses.forEach((e) => {
    const existing = categoryMap.get(e.category) || { total: 0, capex: 0, opex: 0, count: 0 };
    existing.total += e.amount;
    if (e.nature === 'CapEx') existing.capex += e.amount;
    else existing.opex += e.amount;
    existing.count += 1;
    categoryMap.set(e.category, existing);
  });

  const categoryRows = Array.from(categoryMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([cat, data]) => {
      const pct = ((data.total / totalSpend) * 100).toFixed(1) + '%';
      return [
        cat,
        `${data.count}`,
        formatPDFCurrency(data.capex),
        formatPDFCurrency(data.opex),
        formatPDFCurrency(data.total),
        pct,
      ];
    });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...brandForest);
  doc.text('Category-wise Subtotals', margin, currentY);
  currentY += 3;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [['Category', 'Count', 'CapEx', 'OpEx', 'Subtotal (INR)', '% Share']],
    body: categoryRows,
    theme: 'plain',
    headStyles: {
      fillColor: brandForest,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: textDark,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 65 },
      1: { halign: 'center', cellWidth: 15 },
      2: { halign: 'right', cellWidth: 26 },
      3: { halign: 'right', cellWidth: 26 },
      4: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
      5: { halign: 'right', cellWidth: 18 },
    },
    alternateRowStyles: {
      fillColor: brandIvoryBg,
    },
  });

  // Next: Itemized Expenses Table
  const finalCategoryTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  currentY = finalCategoryTableY + 8;

  // Check if we need a page break before starting itemized ledger
  if (currentY > pageHeight - 50) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...brandForest);
  doc.text('Itemized Expense Ledger', margin, currentY);
  currentY += 3;

  const itemizedRows = expenses.map((exp) => {
    let descText = exp.description;
    const extras: string[] = [];
    if (exp.kioskTag) extras.push(`Tag: ${exp.kioskTag}`);
    if (exp.notes) extras.push(`Note: ${exp.notes}`);
    if (exp.hasReceipt) extras.push(`Receipt: Verified Proof`);
    if (extras.length > 0) {
      descText += `\n(${extras.join(' | ')})`;
    }

    return [
      formatDate(exp.date),
      descText,
      exp.category,
      exp.nature,
      exp.paymentMode,
      formatPDFCurrency(exp.amount),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin, bottom: 18 },
    head: [['Date', 'Description & Reference', 'Category', 'Nature', 'Mode', 'Amount']],
    body: itemizedRows,
    foot: [
      ['', 'GRAND TOTAL (Selected Period)', '', '', `${expenses.length} items`, formatPDFCurrency(totalSpend)],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: brandForest,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: textDark,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 22, halign: 'left' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 38 },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    footStyles: {
      fillColor: [240, 235, 225],
      textColor: brandForest,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'right',
    },
    didParseCell: (data) => {
      // Style CapEx vs OpEx
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw === 'CapEx') {
          data.cell.styles.textColor = [29, 78, 137];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [161, 98, 7];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.setDrawColor(...lineBorder);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.text('Finch Expense Ledger — Confidential Internal Report', margin, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 15, pageHeight - 7);
  }

  // Generate safe filename
  const cleanTimeline = timelineLabel.replace(/[\s–/]+/g, '-').toLowerCase();
  doc.save(`finch-expenses-${cleanTimeline}.pdf`);
  return true;
}
