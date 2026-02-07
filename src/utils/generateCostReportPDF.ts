import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { DashboardFilters, DashboardData } from '../pages/Admin/dashboard/types/dashboard.types';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable: { finalY: number };
  }
}

const COLORS = {
  primary: [37, 99, 235], // blue-600
  secondary: [249, 115, 22], // orange-500
  success: [22, 163, 74], // green-600
  warning: [245, 158, 11], // amber-500
  danger: [220, 38, 38], // red-600
  gray: [107, 114, 128], // gray-500
  light: [249, 250, 251], // gray-50
  dark: [17, 24, 39], // gray-900
};

export const generateCostReportPDF = (
  data: DashboardData,
  filters: DashboardFilters,
  userName?: string
): void => {
  try {
    console.log('[PDF] Iniciando geração do PDF...');
    console.log('[PDF] Dados recebidos:', { data, filters, userName });
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let currentY = 20;

  // Helper functions
  const addHeader = () => {
    // Header background
    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('Relatório de Custo Mensal', pageWidth / 2, 25, { align: 'center' });
    
    // Subtitle
    doc.setFontSize(12);
    doc.text('Análise detalhada de custos da frota', pageWidth / 2, 32, { align: 'center' });
  };

  const addFiltersInfo = () => {
    currentY = 50;
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFontSize(14);
    doc.text('Período do Relatório', 20, currentY);
    
    currentY += 8;
    doc.setFontSize(11);
    doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
    
    const formatDate = (dateStr: string | undefined) => {
      if (!dateStr) return null;
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };
    
    const startDate = formatDate(filters.startDate);
    const endDate = formatDate(filters.endDate);
    const branch = filters.branch === 'all' || !filters.branch ? 'Todas as filiais' : filters.branch;
    
    // Formatar período
    let periodText = 'Período: ';
    if (startDate && endDate) {
      periodText += `${startDate} a ${endDate}`;
    } else if (startDate) {
      periodText += `A partir de ${startDate}`;
    } else if (endDate) {
      periodText += `Até ${endDate}`;
    } else {
      periodText += 'Todo o histórico disponível';
    }
    
    doc.text(periodText, 20, currentY);
    currentY += 6;
    doc.text(`Filial: ${branch}`, 20, currentY);
    currentY += 6;
    if (userName) {
      doc.text(`Gerado por: ${userName}`, 20, currentY);
      currentY += 6;
    }
    doc.text(`Data de geração: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 20, currentY);
    
    currentY += 15;
  };

  const addSummaryCards = () => {
    doc.setFillColor(COLORS.light[0], COLORS.light[1], COLORS.light[2]);
    doc.rect(15, currentY - 5, pageWidth - 30, 35, 'F');
    
    // Summary data
    const totalMaintenance = data.monthlyCosts.reduce((sum, item) => sum + item.maintenance, 0);
    const totalFuel = data.monthlyCosts.reduce((sum, item) => sum + item.fuel, 0);
    const totalCost = totalMaintenance + totalFuel;
    
    // Cards layout
    const cardWidth = (pageWidth - 50) / 3;
    const cardHeight = 30;
    
    // Card 1 - Total Maintenance
    doc.setFillColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
    doc.rect(20, currentY, cardWidth, cardHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Manutenção', 20 + cardWidth / 2, currentY + 12, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`R$ ${totalMaintenance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20 + cardWidth / 2, currentY + 22, { align: 'center' });
    
    // Card 2 - Total Fuel
    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.rect(20 + cardWidth + 10, currentY, cardWidth, cardHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Combustível', 20 + cardWidth + 10 + cardWidth / 2, currentY + 12, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`R$ ${totalFuel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20 + cardWidth + 10 + cardWidth / 2, currentY + 22, { align: 'center' });
    
    // Card 3 - Total Cost
    doc.setFillColor(COLORS.success[0], COLORS.success[1], COLORS.success[2]);
    doc.rect(20 + (cardWidth + 10) * 2, currentY, cardWidth, cardHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text('Custo Total', 20 + (cardWidth + 10) * 2 + cardWidth / 2, currentY + 12, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`R$ ${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 20 + (cardWidth + 10) * 2 + cardWidth / 2, currentY + 22, { align: 'center' });
    
    currentY += 45;
  };

  const addMonthlyBreakdown = () => {
    // Section title
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFontSize(14);
    doc.text('Evolução Mensal de Custos', 20, currentY);
    currentY += 10;
    
    // Table headers
    const headers = [['Mês', 'Manutenção', 'Combustível', 'Custo Total']];
    
    // Table data
    const tableData = data.monthlyCosts.map(item => [
      item.month,
      `R$ ${item.maintenance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${item.fuel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${(item.maintenance + item.fuel).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);
    
    // Add summary row
    const totalMaintenance = data.monthlyCosts.reduce((sum, item) => sum + item.maintenance, 0);
    const totalFuel = data.monthlyCosts.reduce((sum, item) => sum + item.fuel, 0);
    const totalCost = totalMaintenance + totalFuel;
    
    tableData.push([
      'TOTAL',
      `R$ ${totalMaintenance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${totalFuel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `R$ ${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    ]);
    
    // Create table
    doc.autoTable({
      head: headers,
      body: tableData,
      startY: currentY,
      theme: 'striped',
      styles: {
        fontSize: 10,
        cellPadding: 5,
      },
      headStyles: {
        fillColor: [COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]],
        textColor: 255,
        fontStyle: 'bold',
      },
      footStyles: {
        fillColor: [COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [COLORS.light[0], COLORS.light[1], COLORS.light[2]],
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 50 },
        2: { cellWidth: 50 },
        3: { cellWidth: 50 },
      }
    });
    
    currentY = doc.lastAutoTable.finalY + 15;
  };

  const addBranchBreakdown = () => {
    if (data.costsByBranch.length === 0) return;
    
    // Check if we need a new page
    if (currentY > pageHeight - 80) {
      doc.addPage();
      currentY = 20;
      addHeader();
    }
    
    // Section title
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFontSize(14);
    doc.text('Análise por Filial', 20, currentY);
    currentY += 10;
    
    // Table headers
    const headers = [['Filial', 'Manutenção', 'Combustível', 'Custo Total', '% do Total']];
    
    // Calculate total for percentage
    const totalCost = data.costsByBranch.reduce((sum, item) => sum + item.maintenance + item.fuel, 0);
    
    // Table data
    const tableData = data.costsByBranch.map(item => {
      const branchTotal = item.maintenance + item.fuel;
      const percentage = totalCost > 0 ? (branchTotal / totalCost * 100).toFixed(1) : '0.0';
      
      return [
        item.branch,
        `R$ ${item.maintenance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${item.fuel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `R$ ${branchTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `${percentage}%`
      ];
    });
    
    // Sort by total cost (descending)
    tableData.sort((a, b) => {
      const valueA = parseFloat(b[3].replace('R$ ', '').replace('.', '').replace(',', '.'));
      const valueB = parseFloat(a[3].replace('R$ ', '').replace('.', '').replace(',', '.'));
      return valueA - valueB;
    });
    
    // Create table
    doc.autoTable({
      head: headers,
      body: tableData,
      startY: currentY,
      theme: 'striped',
      styles: {
        fontSize: 10,
        cellPadding: 5,
      },
      headStyles: {
        fillColor: [COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [COLORS.light[0], COLORS.light[1], COLORS.light[2]],
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 45 },
        2: { cellWidth: 45 },
        3: { cellWidth: 45 },
        4: { cellWidth: 25 },
      }
    });
    
    currentY = doc.lastAutoTable.finalY + 15;
  };

  const addInsights = () => {
    // Check if we need a new page
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
      addHeader();
    }
    
    // Section title
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFontSize(14);
    doc.text('Insights e Recomendações', 20, currentY);
    currentY += 10;
    
    // Insights box
    doc.setFillColor(COLORS.light[0], COLORS.light[1], COLORS.light[2]);
    doc.rect(15, currentY - 5, pageWidth - 30, 50, 'F');
    doc.setDrawColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.rect(15, currentY - 5, pageWidth - 30, 50);
    
    doc.setTextColor(COLORS.dark[0], COLORS.dark[1], COLORS.dark[2]);
    doc.setFontSize(11);
    
    // Calculate insights
    const totalMaintenance = data.monthlyCosts.reduce((sum, item) => sum + item.maintenance, 0);
    const totalFuel = data.monthlyCosts.reduce((sum, item) => sum + item.fuel, 0);
    const totalCost = totalMaintenance + totalFuel;
    const maintenanceRatio = totalCost > 0 ? (totalMaintenance / totalCost * 100).toFixed(1) : '0.0';
    const fuelRatio = totalCost > 0 ? (totalFuel / totalCost * 100).toFixed(1) : '0.0';
    
    // Find highest cost branch
    const highestCostBranch = data.costsByBranch.length > 0 
      ? data.costsByBranch.reduce((max, current) => {
          const currentTotal = current.maintenance + current.fuel;
          const maxTotal = max.maintenance + max.fuel;
          return currentTotal > maxTotal ? current : max;
        })
      : null;
    
    const insights = [
      `• Manutenção representa ${maintenanceRatio}% do custo total totalizando R$ ${totalMaintenance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `• Combustível representa ${fuelRatio}% do custo total totalizando R$ ${totalFuel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ];
    
    if (highestCostBranch) {
      const branchTotal = highestCostBranch.maintenance + highestCostBranch.fuel;
      insights.push(`• ${highestCostBranch.branch} é a filial com maior custo: R$ ${branchTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }
    
    if (data.costsByBranch.length > 1) {
      insights.push(`• Análise comparativa entre ${data.costsByBranch.length} filiais disponível para otimização de custos`);
    }
    
    // Add insights text
    let insightY = currentY + 5;
    insights.forEach(insight => {
      const lines = doc.splitTextToSize(insight, pageWidth - 50);
      lines.forEach((line: string) => {
        doc.text(line, 20, insightY);
        insightY += 6;
      });
    });
    
    currentY = insightY + 10;
  };

  const addFooter = (pageNumber: number) => {
    const footerY = pageHeight - 15;
    doc.setTextColor(COLORS.gray[0], COLORS.gray[1], COLORS.gray[2]);
    doc.setFontSize(9);
    doc.text(`Página ${pageNumber}`, pageWidth / 2, footerY, { align: 'center' });
    doc.text('Relatório gerado pelo App Frota - Sistema de Gestão de Frotas', pageWidth / 2, footerY + 5, { align: 'center' });
  };

    // Generate PDF content
    console.log('[PDF] Gerando conteúdo do PDF...');
    addHeader();
    addFiltersInfo();
    addSummaryCards();
    addMonthlyBreakdown();
    addBranchBreakdown();
    addInsights();
    addFooter(1);

    // Save the PDF
    const fileName = `relatorio-custo-mensal-${new Date().toISOString().split('T')[0]}.pdf`;
    console.log('[PDF] Salvando PDF:', fileName);
    doc.save(fileName);
    console.log('[PDF] PDF gerado com sucesso!');
  } catch (error) {
    console.error('[PDF] Erro ao gerar PDF:', error);
    alert('Erro ao gerar o relatório PDF. Verifique o console para mais detalhes.');
  }
};
