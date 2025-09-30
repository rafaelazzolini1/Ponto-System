import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MonthlyReportData, formatHours, formatDate, getMonthName, calculateDailyHours, JORNADA_NORMAL_HORAS, JORNADA_NORMAL_MINUTOS, MAX_WORKED_MINUTOS, MAX_WORKED_HORAS } from '../admin-dash/reportUtils';

export interface PDFReportOptions {
  nomeEmpresa: string;
  assinaturaFuncionario: string;
  reportData: MonthlyReportData;
}

/**
 * Paleta de cores neutra e corporativa
 */
const colors = {
  headerBg: '#2D3748', // Cinza escuro
  textPrimary: '#1A202C', // Quase preto
  textSecondary: '#4A5568', // Cinza médio
  accent: '#2B6CB0', // Azul escuro corporativo
  tableHeaderBg: '#4A5568', // Cinza médio
  tableAlternateRow: '#F7FAFC', // Cinza claro
  white: '#FFFFFF',
  line: '#E2E8F0' // Cinza claro para linhas
};

/**
 * Função auxiliar para converter cor hexadecimal para RGB
 */
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return [r, g, b];
}

/**
 * Gera um PDF com o relatório mensal de ponto do funcionário
 * ATUALIZADA para compatibilidade com a nova estrutura de dados e ajuste de horários cappados
 */
export function generatePDFReport(options: PDFReportOptions): void {
  const { nomeEmpresa, assinaturaFuncionario, reportData } = options;
  const { funcionario, mes, ano, totalHoras, totalHorasExtras, diasTrabalhados, registrosPorDia } = reportData;

  // Criar novo documento PDF
  const doc = new jsPDF();
  
  // Configurações
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  let currentY = margin;

  // Função auxiliar para adicionar nova página se necessário
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
      return true;
    }
    return false;
  };

  // CABEÇALHO DA EMPRESA
  doc.setFillColor(...hexToRgb(colors.headerBg));
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(...hexToRgb(colors.white));
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(nomeEmpresa, pageWidth / 2, 25, { align: 'center' });
  
  currentY = 50;

  // TÍTULO DO RELATÓRIO
  doc.setTextColor(...hexToRgb(colors.accent));
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório Mensal', pageWidth / 2, currentY, { align: 'center' });
  
  currentY += 10;

  // INFORMAÇÕES DO FUNCIONÁRIO
  doc.setFillColor(...hexToRgb(colors.tableAlternateRow));
  doc.rect(margin, currentY, pageWidth - 2 * margin, 35, 'F');
  
  doc.setTextColor(...hexToRgb(colors.textPrimary));
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  const infoY = currentY + 10;
  doc.text(`Funcionário: ${funcionario.nome}`, margin + 10, infoY);
  doc.text(`CPF: ${funcionario.cpf}`, margin + 10, infoY + 8);
  doc.text(`Período: ${getMonthName(mes)} de ${ano}`, pageWidth - margin - 10, infoY, { align: 'right' });
  doc.text(`Data de emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin - 10, infoY + 8, { align: 'right' });
  
  currentY += 45;

  // RESUMO MENSAL (usando totais cappados)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRgb(colors.accent));
  doc.text('RESUMO MENSAL', margin, currentY);
  
  currentY += 8;

  // Tabela de resumo - usando totais cappados
  const resumoData = [
    ['Total de Horas Trabalhadas', formatHours(totalHoras)],
    ['Dias Trabalhados', diasTrabalhados.toString()],
    ['Total de Horas Extras', formatHours(totalHorasExtras)],
    ['Média Diária', formatHours(diasTrabalhados > 0 ? totalHoras / diasTrabalhados : 0)]
  ];

  autoTable(doc, {
    startY: currentY,
    head: [['Descrição', 'Valor']],
    body: resumoData,
    theme: 'grid',
    headStyles: {
      fillColor: hexToRgb(colors.tableHeaderBg),
      textColor: hexToRgb(colors.white),
      fontSize: 11,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 10,
      textColor: hexToRgb(colors.textPrimary)
    },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60, halign: 'center' }
    },
    margin: { left: margin, right: margin }
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // DETALHAMENTO DIÁRIO
  checkPageBreak(30);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRgb(colors.accent));
  doc.text('DETALHAMENTO DIÁRIO', margin, currentY);

  currentY += 15;

  // Preparar dados da tabela diária (com ajuste de horário se capping aplicado)
  const dailyTableData = registrosPorDia.map(dia => {
    const dataFormatada = formatDate(dia.data);
    const horasTrabalhadasDisplay = dia.horasTrabalhadas; // cappada
    const horasExtrasDisplay = dia.horasExtras; // máximo 1h
    const horasTrabalhadasOriginal = calculateDailyHours(dia.registros);
    
    let horasTrabalhadasStr = formatHours(horasTrabalhadasDisplay);
    let horasExtrasStr = horasExtrasDisplay > 0 ? formatHours(horasExtrasDisplay) : '-';
    let horariosDisplay = dia.registros.map(r => {
      const hora = r.timestamp.toDate().toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      return `${r.tipo}: ${hora}`;
    }).join(' | ');
    
    // Se horas originais excedem 9h48min, ajustar o horário da última saída para display
    if (horasTrabalhadasOriginal > JORNADA_NORMAL_HORAS + 1 && dia.registros.length >= 2) {
      const lastRegistro = dia.registros[dia.registros.length - 1];
      if (lastRegistro.tipo === 'saida') {
        let prevMinutos = 0;
        for (let i = 0; i < dia.registros.length - 2; i += 2) {
          const entrada = dia.registros[i];
          const saida = dia.registros[i + 1];
          if (entrada && saida && entrada.tipo === 'entrada' && saida.tipo === 'saida') {
            prevMinutos += (saida.timestamp.toDate().getTime() - entrada.timestamp.toDate().getTime()) / (1000 * 60);
          }
        }
        
        const lastEntry = dia.registros[dia.registros.length - 2];
        const remainingMin = (JORNADA_NORMAL_HORAS + 1) * 60 - prevMinutos;
        
        if (remainingMin > 0 && lastEntry) {
          const adjustedExitTime = new Date(lastEntry.timestamp.toDate().getTime() + remainingMin * 60 * 1000);
          const adjustedHora = adjustedExitTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          
          const parts = horariosDisplay.split(' | ');
          if (parts.length > 0) {
            const lastPartIndex = parts.length - 1;
            if (parts[lastPartIndex].startsWith('saida:')) {
              parts[lastPartIndex] = `saida: ${adjustedHora}`;
              horariosDisplay = parts.join(' | ');
            }
          }
        }
      }
    }
    
    const statusStr = dia.completo ? 'Completo' : 'Incompleto';
    
    return [
      dataFormatada,
      horariosDisplay || '-',
      horasTrabalhadasStr,
      horasExtrasStr,
      statusStr
    ];
  });

  // Verificar se precisa quebrar página para a tabela
  const estimatedTableHeight = (dailyTableData.length + 1) * 8 + 20;
  checkPageBreak(estimatedTableHeight);

  // FIXED: Using autoTable function directly
  autoTable(doc, {
    startY: currentY,
    head: [['Data', 'Horários', 'Horas Trabalhadas', 'Horas Extras', 'Status']],
    body: dailyTableData,
    theme: 'striped',
    headStyles: {
      fillColor: hexToRgb(colors.tableHeaderBg),
      textColor: hexToRgb(colors.white),
      fontSize: 10,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 9,
      textColor: hexToRgb(colors.textPrimary)
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 90 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 20, halign: 'center' }
    },
    margin: { left: margin, right: margin },
    alternateRowStyles: {
      fillColor: hexToRgb(colors.tableAlternateRow)
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 30;

  // OBSERVAÇÕES
  checkPageBreak(40);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRgb(colors.accent));
  doc.text('OBSERVAÇÕES:', margin, currentY);
  
  currentY += 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hexToRgb(colors.textPrimary));
  doc.text('• Jornada normal: 8h 48min por dia', margin + 5, currentY);
  doc.text('• Horas extras: tempo trabalhado acima da jornada normal (limitado a 2h/dia)', margin + 5, currentY + 8);
  doc.text('• Dias completos: dias com pelo menos uma entrada e uma saída', margin + 5, currentY + 16);
  
  currentY += 35;

  // CAMPO DE ASSINATURA
  checkPageBreak(60);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRgb(colors.accent));
  doc.text('DECLARAÇÃO E ASSINATURA', margin, currentY);
  
  currentY += 15;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hexToRgb(colors.textPrimary));
  
  const declaracaoTexto = [
    'Declaro que conferi todos os horários registrados neste relatório e que',
    'os mesmos correspondem fielmente aos dias e horários efetivamente trabalhados',
    'no período especificado.'
  ];
  
  declaracaoTexto.forEach((linha, index) => {
    doc.text(linha, margin, currentY + (index * 6));
  });
  
  currentY += 30;
  
  // Linha para assinatura
  doc.setLineWidth(0.5);
  doc.setDrawColor(...hexToRgb(colors.line));
  doc.line(margin, currentY + 20, pageWidth - margin, currentY + 20);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hexToRgb(colors.textPrimary));
  doc.text(`${funcionario.nome}`, pageWidth / 2, currentY + 30, { align: 'center' });
  doc.text('Assinatura do Funcionário', pageWidth / 2, currentY + 38, { align: 'center' });
  
  // Data da assinatura
  doc.text(`Data: ___/___/______`, pageWidth - margin - 50, currentY + 30);

  // RODAPÉ
  const rodapeY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(colors.textSecondary));
  doc.text('Relatório gerado automaticamente pelo Sistema de Ponto Eletrônico', pageWidth / 2, rodapeY, { align: 'center' });

  // Salvar o PDF
  const nomeArquivo = `relatorio_ponto_${funcionario.nome.replace(/\s+/g, '_')}_${getMonthName(mes)}_${ano}.pdf`;
  doc.save(nomeArquivo);
}

/**
 * Gera um PDF com relatório consolidado de múltiplos funcionários
 * ATUALIZADA para compatibilidade com a nova estrutura de dados e capping
 */
export function generateConsolidatedPDFReport(
  nomeEmpresa: string,
  mes: number,
  ano: number,
  reports: MonthlyReportData[]
): void {
  const doc = new jsPDF();
  
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  let currentY = margin;

  // CABEÇALHO DA EMPRESA
  doc.setFillColor(...hexToRgb(colors.headerBg));
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(...hexToRgb(colors.white));
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(nomeEmpresa, pageWidth / 2, 25, { align: 'center' });
  
  currentY = 50;

  // TÍTULO DO RELATÓRIO
  doc.setTextColor(...hexToRgb(colors.accent));
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO CONSOLIDADO MENSAL', pageWidth / 2, currentY, { align: 'center' });
  
  currentY += 10;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hexToRgb(colors.textPrimary));
  doc.text(`${getMonthName(mes)} de ${ano}`, pageWidth / 2, currentY, { align: 'center' });
  
  currentY += 25;

  // RESUMO GERAL (usando totais cappados dos reports)
  const totalHorasGeral = reports.reduce((acc, r) => acc + r.totalHoras, 0);
  const totalHorasExtrasGeral = reports.reduce((acc, r) => acc + r.totalHorasExtras, 0);
  const totalDiasGeral = reports.reduce((acc, r) => acc + r.diasTrabalhados, 0);

  doc.setFillColor(...hexToRgb(colors.tableAlternateRow));
  doc.rect(margin, currentY, pageWidth - 2 * margin, 25, 'F');
  
  doc.setTextColor(...hexToRgb(colors.textPrimary));
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  const resumoY = currentY + 8;
  doc.text(`Total de Funcionários: ${reports.length}`, margin + 10, resumoY);
  doc.text(`Total de Horas: ${formatHours(totalHorasGeral)}`, margin + 10, resumoY + 8);
  doc.text(`Total de Horas Extras: ${formatHours(totalHorasExtrasGeral)}`, pageWidth - margin - 10, resumoY, { align: 'right' });
  doc.text(`Média de Dias/Funcionário: ${(totalDiasGeral / reports.length).toFixed(1)}`, pageWidth - margin - 10, resumoY + 8, { align: 'right' });
  
  currentY += 35;

  // TABELA CONSOLIDADA (usando totais cappados)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRgb(colors.accent));
  doc.text('DETALHAMENTO POR FUNCIONÁRIO', margin, currentY);
  
  currentY += 15;

  const consolidatedData = reports.map(report => [
    report.funcionario.nome,
    report.funcionario.departamento || '-',
    formatHours(report.totalHoras),
    report.diasTrabalhados.toString(),
    formatHours(report.totalHorasExtras)
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Funcionário', 'Departamento', 'Total Horas', 'Dias Trabalhados', 'Horas Extras']],
    body: consolidatedData,
    theme: 'striped',
    headStyles: {
      fillColor: hexToRgb(colors.tableHeaderBg),
      textColor: hexToRgb(colors.white),
      fontSize: 11,
      fontStyle: 'bold'
    },
    bodyStyles: {
      fontSize: 10,
      textColor: hexToRgb(colors.textPrimary)
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 40 },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 30, halign: 'center' }
    },
    margin: { left: margin, right: margin },
    alternateRowStyles: {
      fillColor: hexToRgb(colors.tableAlternateRow)
    }
  });

  // RODAPÉ
  const rodapeY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(colors.textSecondary));
  doc.text('Relatório gerado automaticamente pelo Sistema de Ponto Eletrônico', pageWidth / 2, rodapeY, { align: 'center' });
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, rodapeY + 8, { align: 'center' });

  // Salvar o PDF
  const nomeArquivo = `relatorio_consolidado_${getMonthName(mes)}_${ano}.pdf`;
  doc.save(nomeArquivo);
}

/**
 * Função auxiliar para verificar se jsPDF está disponível
 */
export function isPDFGenerationAvailable(): boolean {
  try {
    return typeof jsPDF !== 'undefined';
  } catch {
    return false;
  }
}