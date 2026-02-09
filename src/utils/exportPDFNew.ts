import jsPDF from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable: { finalY: number };
  }
}

interface CostData {
  monthlyCosts: Array<{
    month: string;
    maintenance: number;
    fuel: number;
  }>;
  costsByBranch: Array<{
    branch: string;
    maintenance: number;
    fuel: number;
  }>;
}

interface CostFilters {
  branch?: string;
  startDate?: string;
  endDate?: string;
}

export const exportCostReportNew = (
  data: CostData,
  filters: CostFilters,
  userName?: string
): void => {
  try {
    console.log('[PDF NEW] Iniciando exportação PDF - Versão Nova 2026');
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let y = 20;

    // Cores
    const colors = {
      primary: [13, 45, 108],      // Azul escuro #0d2d6c
      secondary: [255, 211, 0],    // Amarelo #ffd300
      white: [255, 255, 255],
      light: [249, 250, 251],
      gray: [107, 114, 128]
    };

    // Logo
    const addLogo = () => {
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.rect(15, 10, 30, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text('FROTA', 30, 22, { align: 'center' });
    };

    // Header
    const addHeader = () => {
      // Background
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      addLogo();
      
      // Título
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text('Relatório de Custos', pageWidth / 2, 25, { align: 'center' });
    };

    // Info
    const addInfo = () => {
      y = 45;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text('Período e Filtros', 20, y);
      
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
      
      const formatDate = (date: string | undefined) => {
        if (!date) return '';
        const [year, month, day] = date.split('-');
        return `${day}/${month}/${year}`;
      };
      
      const startDate = formatDate(filters.startDate);
      const endDate = formatDate(filters.endDate);
      const branch = filters.branch === 'all' ? 'Todas as filiais' : filters.branch;
      
      doc.text(`Período: ${startDate || 'Início'} a ${endDate || 'Atual'}`, 20, y);
      y += 6;
      doc.text(`Filial: ${branch}`, 20, y);
      y += 6;
      if (userName) {
        doc.text(`Gerado por: ${userName}`, 20, y);
        y += 6;
      }
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, y);
      
      y += 15;
    };

    // Resumo
    const addSummary = () => {
      const totalMaintenance = data.monthlyCosts.reduce((sum, item) => sum + item.maintenance, 0);
      const totalFuel = data.monthlyCosts.reduce((sum, item) => sum + item.fuel, 0);
      const totalCost = totalMaintenance + totalFuel;
      
      // Cards
      doc.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
      doc.rect(15, y - 5, pageWidth - 30, 30, 'F');
      
      const cardWidth = 55;
      const startX = 20;
      
      // Card 1
      doc.setFillColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
      doc.rect(startX, y, cardWidth, 20, 'F');
      doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.setFontSize(9);
      doc.text('Manutenção', startX + cardWidth/2, y + 8, { align: 'center' });
      doc.setFontSize(11);
      doc.text(`R$ ${totalMaintenance.toFixed(2)}`, startX + cardWidth/2, y + 16, { align: 'center' });
      
      // Card 2
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.rect(startX + cardWidth + 10, y, cardWidth, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('Combustível', startX + cardWidth + 10 + cardWidth/2, y + 8, { align: 'center' });
      doc.setFontSize(11);
      doc.text(`R$ ${totalFuel.toFixed(2)}`, startX + cardWidth + 10 + cardWidth/2, y + 16, { align: 'center' });
      
      // Card 3
      doc.setFillColor(34, 197, 94);
      doc.rect(startX + (cardWidth + 10) * 2, y, cardWidth, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text('Total', startX + (cardWidth + 10) * 2 + cardWidth/2, y + 8, { align: 'center' });
      doc.setFontSize(11);
      doc.text(`R$ ${totalCost.toFixed(2)}`, startX + (cardWidth + 10) * 2 + cardWidth/2, y + 16, { align: 'center' });
      
      y += 35;
    };

    // Tabela mensal
    const addMonthlyTable = () => {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Evolução Mensal', 20, y);
      y += 10;
      
      const headers = [['Mês', 'Manutenção', 'Combustível', 'Total']];
      const rows = data.monthlyCosts.map(item => [
        item.month,
        `R$ ${item.maintenance.toFixed(2)}`,
        `R$ ${item.fuel.toFixed(2)}`,
        `R$ ${(item.maintenance + item.fuel).toFixed(2)}`
      ]);
      
      doc.autoTable({
        head: headers,
        body: rows,
        startY: y,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { 
          fillColor: colors.primary, 
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: colors.light },
        margin: { left: 20, right: 20 }
      });
      
      y = doc.lastAutoTable.finalY + 15;
    };

    // Tabela por filial
    const addBranchTable = () => {
      if (data.costsByBranch.length === 0) return;
      
      // Verifica espaço
      if (y > pageHeight - 80) {
        doc.addPage();
        addHeader();
        y = 45;
      }
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Análise por Filial', 20, y);
      y += 10;
      
      const totalCost = data.costsByBranch.reduce((sum, item) => sum + item.maintenance + item.fuel, 0);
      
      const headers = [['Filial', 'Manutenção', 'Combustível', 'Total', '%']];
      const rows = data.costsByBranch.map(item => {
        const branchTotal = item.maintenance + item.fuel;
        const percentage = totalCost > 0 ? (branchTotal / totalCost * 100).toFixed(1) : '0.0';
        return [
          item.branch,
          `R$ ${item.maintenance.toFixed(2)}`,
          `R$ ${item.fuel.toFixed(2)}`,
          `R$ ${branchTotal.toFixed(2)}`,
          `${percentage}%`
        ];
      });
      
      doc.autoTable({
        head: headers,
        body: rows,
        startY: y,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { 
          fillColor: colors.secondary, 
          textColor: colors.primary,
          fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: colors.light },
        margin: { left: 20, right: 20 }
      });
      
      y = doc.lastAutoTable.finalY + 15;
    };

    // Footer
    const addFooter = (pageNum: number) => {
      const footerY = pageHeight - 10;
      doc.setTextColor(colors.gray[0], colors.gray[1], colors.gray[2]);
      doc.setFontSize(8);
      doc.text('App Frota - Sistema de Gestão', pageWidth / 2, footerY, { align: 'center' });
      doc.text(`Página ${pageNum}`, pageWidth - 20, footerY, { align: 'right' });
    };

    // Gerar PDF
    addHeader();
    addInfo();
    addSummary();
    addMonthlyTable();
    addBranchTable();
    addFooter(1);

    // Salvar
    const fileName = `relatorio-custos-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    console.log('[PDF NEW] PDF gerado com sucesso!');
    
  } catch (error) {
    console.error('[PDF NEW] Erro ao gerar PDF:', error);
    alert('Erro ao gerar PDF. Tente novamente.');
  }
};
