import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  MonthlyReportData, 
  formatHours, 
  formatDate, 
  getMonthName, 
  formatTimestamp,
  JORNADA_NORMAL_HORAS, 
  INICIO_HORA_EXTRA_HORAS,
  MAX_OVERTIME_HORAS
} from '../admin-dash/reportUtils';

export interface PDFReportOptions {
  nomeEmpresa: string;
  assinaturaFuncionario: string;
  reportData: MonthlyReportData;
}

interface AutoTableDoc extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
}

const colors = {
  headerBg: '#2D3748',
  textPrimary: '#1A202C',
  textSecondary: '#767676ff',
  accent: '#000000ff',
  tableHeaderBg: '#4A5568',
  tableAlternateRow: '#ffffffff',
  white: '#FFFFFF',
  line: '#E2E8F0'
};

function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return [r, g, b];
}

export function generatePDFReport(options: PDFReportOptions): void {
  const { nomeEmpresa, assinaturaFuncionario, reportData } = options;
  const { funcionario, mes, ano, totalHoras, totalHorasExtras, diasTrabalhados, registrosPorDia } = reportData;

  const doc = new jsPDF();

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  let currentY = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
      return true;
    }
    return false;
  };

  doc.setFillColor(...hexToRgb(colors.headerBg));
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(...hexToRgb(colors.white));
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(nomeEmpresa, pageWidth / 2, 25, { align: 'center' });

  currentY = 50;

  doc.setTextColor(...hexToRgb(colors.accent));
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório Mensal', margin, currentY);

  currentY += 18;

  checkPageBreak(45);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRgb(colors.accent));
  doc.text('DADOS DO EMPREGADOR', margin, currentY);

  currentY += 2;

  doc.setFillColor(...hexToRgb(colors.tableAlternateRow));
  doc.rect(margin, currentY, pageWidth - 2 * margin, 28, 'F');

  doc.setTextColor(...hexToRgb(colors.textPrimary));
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const empregadorY = currentY + 7;
  doc.text('Empresa: MR AZZOLINI TRANSPORTES E SERVICOS LTDA', margin + 5, empregadorY);
  doc.text('CNPJ: 60.274.408/0001-83', margin + 5, empregadorY + 7);
  doc.text('Endereço: Rua Pedro Paulo de Oliveira', margin + 5, empregadorY + 14);
  doc.text('Bairro: Jardim Santa Eliza', margin + 5, empregadorY + 21);

  currentY += 42;

  checkPageBreak(45);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRgb(colors.accent));
  doc.text('DADOS DO EMPREGADO', margin, currentY);

  currentY += 2;

  doc.setFillColor(...hexToRgb(colors.tableAlternateRow));
  doc.rect(margin, currentY, pageWidth - 2 * margin, 28, 'F');

  doc.setTextColor(...hexToRgb(colors.textPrimary));
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const empregadoY = currentY + 7;
  doc.text(`Nome: ${funcionario.nome}`, margin + 5, empregadoY);
  doc.text(`CPF: ${funcionario.cpf}`, margin + 5, empregadoY + 7);
  doc.text('N° CTPS: 038213', margin + 5, empregadoY + 14);
  doc.text('Cargo: Motorista', margin + 5, empregadoY + 21);

  currentY += 42;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRgb(colors.accent));
  doc.text('PERÍODO DE TRABALHO', margin, currentY);

  currentY += 5;

  const periodoHead = [['Dia', 'Expediente', 'Intervalo']];
  const periodoBody = [
    ['Segunda à Sexta feira', '06:00 às 15:48', '12:00 às 13:00'],
    ['Sábado', 'Compensado', ''],
    ['Domingo', 'Folga', '']
  ];

  autoTable(doc, {
    startY: currentY,
    head: periodoHead,
    body: periodoBody,
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
      0: { cellWidth: 50 },
      1: { cellWidth: 60, halign: 'center' },
      2: { cellWidth: 45, halign: 'center' }
    },
    margin: { left: margin, right: margin }
  });

  currentY = (doc as AutoTableDoc).lastAutoTable.finalY + 15;

  checkPageBreak(30);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRgb(colors.accent));
  doc.text('RESUMO MÊS', margin, currentY);

  currentY += 5;

  const resumoData = [
    ['Período:', `${getMonthName(mes)} de ${ano}`],
    ['Total de Horas Trabalhadas', formatHours(totalHoras)],
    ['Dias Trabalhados', diasTrabalhados.toString()],
    ['Total de Horas Extras', formatHours(totalHorasExtras)],
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

  currentY = (doc as AutoTableDoc).lastAutoTable.finalY + 15;

  checkPageBreak(30);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRgb(colors.accent));
  doc.text('DETALHAMENTO DIÁRIO', margin, currentY);

  currentY += 5;

  const dailyTableData = registrosPorDia.map(dia => {
    const dataFormatada = formatDate(dia.data);
    const horasTrabalhadasStr = formatHours(dia.horasTrabalhadas);
    const horasExtrasStr = dia.horasExtras > 0 ? formatHours(dia.horasExtras) : '-';
    
    const registrosParaExibir = dia.registrosAjustados && dia.registrosAjustados.length > 0
      ? dia.registrosAjustados
      : dia.registros;
        
    const horariosDisplay = registrosParaExibir.map(r => {
      const hora = formatTimestamp(r.timestamp);
      const tipoLabel = r.tipo === 'entrada' ? 'Entrada' : 'Saida';
      return `${tipoLabel}: ${hora}`;
    }).join(' | ');

    const statusStr = dia.completo ? 'Completo' : 'Incompleto';

    return [
      dataFormatada,
      horariosDisplay || '-',
      horasTrabalhadasStr,
      horasExtrasStr,
      statusStr
    ];
  });

  const estimatedTableHeight = (dailyTableData.length + 1) * 8 + 20;
  checkPageBreak(estimatedTableHeight);

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

  currentY = (doc as AutoTableDoc).lastAutoTable.finalY + 20;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...hexToRgb(colors.accent));
  doc.text('DECLARAÇÃO E ASSINATURA', margin, currentY);

  currentY += 8;

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

  currentY += 40;

  // Assinaturas lado a lado
  const signatureWidth = 70;
  const spacing = 15;
  
  // Assinatura do Funcionário (esquerda)
  const employeeLeft = margin + 5;
  doc.setLineWidth(0.5);
  doc.setDrawColor(...hexToRgb(colors.line));
  doc.line(employeeLeft, currentY, employeeLeft + signatureWidth, currentY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hexToRgb(colors.textPrimary));
  doc.text('Assinatura do Funcionário', employeeLeft + (signatureWidth / 2), currentY + 6, { align: 'center' });
  doc.text('___/___/______', employeeLeft + (signatureWidth / 2), currentY + 12, { align: 'center' });

  // Assinatura da Empresa (direita)
  const companyLeft = employeeLeft + signatureWidth + spacing;
  doc.setLineWidth(0.5);
  doc.setDrawColor(...hexToRgb(colors.line));
  doc.line(companyLeft, currentY, companyLeft + signatureWidth, currentY);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...hexToRgb(colors.textPrimary));
  doc.text('Assinatura da Empresa', companyLeft + (signatureWidth / 2), currentY + 6, { align: 'center' });
  doc.text('___/___/______', companyLeft + (signatureWidth / 2), currentY + 12, { align: 'center' });

  currentY += 20;

  // Rodapé
  const rodapeY = pageHeight - 12;
  doc.setFontSize(8);
  doc.setTextColor(...hexToRgb(colors.textSecondary));
  doc.text('Relatório gerado automaticamente pelo Sistema de Ponto', pageWidth / 2, rodapeY, { align: 'center' });
  doc.text(`Data de emissão: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, rodapeY + 5, { align: 'center' });

  const nomeArquivo = `relatorio_ponto_${funcionario.nome.replace(/\s+/g, '_')}_${getMonthName(mes)}_${ano}.pdf`;
  doc.save(nomeArquivo);
}