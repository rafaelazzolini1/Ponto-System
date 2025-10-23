import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';

// Interfaces
export interface RegistroPonto {
  tipo: 'entrada' | 'saida';
  timestamp: Timestamp;
  data: string;
}

export interface ReportFilters {
  nomeEmpresa: string;
  assinaturaFuncionario: string;
  funcionarioCpf: string;
  mes: number;
  ano: number;
}

export interface Employee {
  cpf: string;
  nome: string;
  departamento?: string;
  email?: string;
}

export interface EmployeeData {
  nome: string;
  departamento?: string;
  email?: string;
  registrosPonto?: { [data: string]: RegistroPonto[] };
}

export interface DailyWorkData {
  data: string;
  registros: RegistroPonto[];
  registrosAjustados?: RegistroPonto[]; // Registros com última saída ajustada
  horasTrabalhadas: number;
  horasExtras: number;
  completo: boolean;
  horasTrabalhadasReais?: number; // Adicionar campo para horas reais
}

export interface MonthlyReportData {
  funcionario: Employee;
  mes: number;
  ano: number;
  totalHoras: number;
  totalHorasExtras: number;
  diasTrabalhados: number;
  diasComRegistro: number;
  registrosPorDia: DailyWorkData[];
  resumo: {
    mediaDiariaHoras: number;
    maiorDiaHoras: number;
    menorDiaHoras: number;
    diasComHorasExtras: number;
  };
}

// Constantes ATUALIZADAS
export const JORNADA_NORMAL_MINUTOS = 8 * 60 + 48; // 528 minutos (8h48min) - jornada base
export const JORNADA_NORMAL_HORAS = JORNADA_NORMAL_MINUTOS / 60; // 8.8 horas

export const INICIO_HORA_EXTRA_MINUTOS = 10 * 60 + 48; // 648 minutos (10h48min) - quando começa hora extra
export const INICIO_HORA_EXTRA_HORAS = INICIO_HORA_EXTRA_MINUTOS / 60; // 10.8 horas

export const MAX_OVERTIME_HORAS = 2; // Máximo de 2 horas extras
export const MAX_WORKED_MINUTOS = INICIO_HORA_EXTRA_MINUTOS + (MAX_OVERTIME_HORAS * 60); // 10h48min + 2h = 12h48min
export const MAX_WORKED_HORAS = MAX_WORKED_MINUTOS / 60; // 12.8 horas

export const NORMAL_END_TIME = '15:48';

/**
 * Busca todos os funcionários
 */
export async function getAllEmployees(): Promise<Employee[]> {
  try {
    const usersQuery = query(collection(db, 'users'), where('role', '==', 'employee'));
    const usersSnapshot = await getDocs(usersQuery);
    const employees: Employee[] = [];
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      employees.push({ cpf: doc.id, nome: userData.nome, departamento: userData.departamento, email: userData.email });
    });
    return employees.sort((a, b) => a.nome.localeCompare(b.nome));
  } catch (error) {
    console.error('Erro ao buscar funcionários:', error);
    throw new Error('Erro ao carregar lista de funcionários');
  }
}

/**
 * Busca dados de um funcionário específico
 */
export async function getEmployeeData(cpf: string): Promise<EmployeeData> {
  try {
    const userQuery = query(collection(db, 'users'), where('__name__', '==', cpf));
    const userSnapshot = await getDocs(userQuery);
    if (userSnapshot.empty) throw new Error('Funcionário não encontrado');
    const userData = userSnapshot.docs[0].data();
    if (!userData.nome) throw new Error('Nome do funcionário não encontrado no documento');
    return userData as EmployeeData;
  } catch (error) {
    console.error('Erro ao buscar dados do funcionário:', error);
    throw new Error('Erro ao carregar dados do funcionário');
  }
}

/**
 * Calcula as horas trabalhadas em um dia (REAIS)
 */
export function calculateDailyHours(registros: RegistroPonto[]): number {
  if (registros.length < 2) return 0;
  let totalMinutos = 0;
  for (let i = 0; i < registros.length; i += 2) {
    const entrada = registros[i];
    const saida = registros[i + 1];
    if (entrada && saida && entrada.tipo === 'entrada' && saida.tipo === 'saida') {
      const diferenca = (saida.timestamp.toDate().getTime() - entrada.timestamp.toDate().getTime()) / (1000 * 60);
      totalMinutos += diferenca;
    }
  }
  return totalMinutos / 60;
}

/**
 * Calcula as horas extras de um dia (NOVA LÓGICA)
 * Horas extras = tempo trabalhado acima de 10h48min, limitado a 2h
 */
export function calculateDailyOvertime(horasTrabalhadasReais: number): number {
  if (horasTrabalhadasReais <= INICIO_HORA_EXTRA_HORAS) {
    return 0; // Não tem hora extra se trabalhou 10h48min ou menos
  }
  
  const horasExtras = horasTrabalhadasReais - INICIO_HORA_EXTRA_HORAS;
  return Math.min(horasExtras, MAX_OVERTIME_HORAS); // Limita a 2 horas extras
}

/**
 * Calcula as horas para exibição no relatório
 * Remove as 2 horas "ocultas" (entre 8h48min e 10h48min)
 */
export function calculateDisplayHours(horasTrabalhadasReais: number): number {
  if (horasTrabalhadasReais <= INICIO_HORA_EXTRA_HORAS) {
    // Se trabalhou até 10h48min, exibe como está (mas limitado a 8h48min)
    return Math.min(horasTrabalhadasReais, JORNADA_NORMAL_HORAS);
  }
  
  // Se trabalhou mais de 10h48min:
  // - Remove as 2 horas "ocultas" (diferença entre 8h48min e 10h48min)
  // - Adiciona as horas extras (limitadas a 2h)
  const horasExtras = calculateDailyOvertime(horasTrabalhadasReais);
  return JORNADA_NORMAL_HORAS + horasExtras;
}

/**
 * Ajusta o horário da última saída para refletir as horas trabalhadas do relatório
 * Mantém os horários reais das entradas e saídas intermediárias
 */
export function adjustLastExitTime(registros: RegistroPonto[], horasTrabalhadasDisplay: number): RegistroPonto[] {
  console.log('🔧 adjustLastExitTime chamada!');
  console.log('Registros recebidos:', registros.length);
  console.log('Horas display:', horasTrabalhadasDisplay);
  
  if (registros.length < 2) {
    console.log('⚠️ Menos de 2 registros, retornando original');
    return registros;
  }
  
  // Encontra o índice da última saída
  let lastSaidaIndex = -1;
  for (let i = registros.length - 1; i >= 0; i--) {
    if (registros[i].tipo === 'saida') {
      lastSaidaIndex = i;
      break;
    }
  }
  
  console.log('Índice última saída:', lastSaidaIndex);
  
  if (lastSaidaIndex === -1) {
    console.log('⚠️ Nenhuma saída encontrada');
    return registros;
  }
  
  // Encontra a última entrada correspondente
  const lastEntradaIndex = lastSaidaIndex - 1;
  if (lastEntradaIndex < 0 || registros[lastEntradaIndex].tipo !== 'entrada') {
    console.log('⚠️ Entrada anterior não encontrada');
    return registros;
  }
  
  console.log('Índice última entrada:', lastEntradaIndex);
  
  // Calcula o total de minutos trabalhados até a penúltima saída
  let minutosAnteriores = 0;
  for (let i = 0; i < lastEntradaIndex; i += 2) {
    const entrada = registros[i];
    const saida = registros[i + 1];
    if (entrada?.tipo === 'entrada' && saida?.tipo === 'saida') {
      const diferenca = (saida.timestamp.toDate().getTime() - entrada.timestamp.toDate().getTime()) / (1000 * 60);
      minutosAnteriores += diferenca;
      console.log(`Período ${i/2 + 1}: ${diferenca.toFixed(0)} minutos`);
    }
  }
  
  // Calcula quantos minutos faltam para completar as horas do relatório
  const minutosDisplayTotal = horasTrabalhadasDisplay * 60;
  const minutosFaltantes = minutosDisplayTotal - minutosAnteriores;
  
  // Debug logs
  console.log('=== CÁLCULOS ===');
  console.log('Horas Display:', horasTrabalhadasDisplay);
  console.log('Minutos Display Total:', minutosDisplayTotal);
  console.log('Minutos Anteriores:', minutosAnteriores);
  console.log('Minutos Faltantes:', minutosFaltantes);
  console.log('Última Entrada:', registros[lastEntradaIndex].timestamp.toDate().toLocaleTimeString('pt-BR'));
  console.log('Saída Original:', registros[lastSaidaIndex].timestamp.toDate().toLocaleTimeString('pt-BR'));
  
  // Se os minutos faltantes forem negativos ou zero, mantém o horário original
  if (minutosFaltantes <= 0) {
    console.log('⚠️ Minutos faltantes <= 0, mantendo original');
    return registros;
  }
  
  // Cria cópia profunda dos registros
  const registrosAjustados = registros.map(r => ({
    tipo: r.tipo,
    timestamp: r.timestamp,
    data: r.data
  }));
  
  // Calcula o novo horário de saída baseado na última entrada + minutos faltantes
  const lastEntrada = registros[lastEntradaIndex];
  const novoHorarioSaida = new Date(lastEntrada.timestamp.toDate().getTime() + (minutosFaltantes * 60 * 1000));
  
  console.log('✅ Nova Saída Calculada:', novoHorarioSaida.toLocaleTimeString('pt-BR'));
  
  // Atualiza a última saída com o novo horário
  registrosAjustados[lastSaidaIndex] = {
    tipo: 'saida',
    timestamp: Timestamp.fromDate(novoHorarioSaida),
    data: registros[lastSaidaIndex].data
  };
  
  console.log('✅ Ajuste concluído! Retornando', registrosAjustados.length, 'registros ajustados');
  
  return registrosAjustados;
}

/**
 * Verifica se um dia está completo
 */
export function isDayComplete(registros: RegistroPonto[]): boolean {
  if (registros.length < 2) return false;
  return registros.some(r => r.tipo === 'entrada') && registros.some(r => r.tipo === 'saida');
}

/**
 * Filtra registros por mês e ano
 */
export function filterRegistrosByMonth(registrosPonto: { [data: string]: RegistroPonto[] }, mes: number, ano: number): RegistroPonto[] {
  const registrosFiltrados: RegistroPonto[] = [];
  Object.keys(registrosPonto).forEach((dataKey) => {
    const [year, month, day] = dataKey.split('-').map(Number);
    if (month === mes && year === ano) {
      registrosFiltrados.push(...registrosPonto[dataKey]);
    }
  });
  return registrosFiltrados.sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());
}

/**
 * Agrupa registros por dia
 */
export function groupRegistrosByDay(registrosPonto: { [data: string]: RegistroPonto[] }, mes: number, ano: number): Map<string, RegistroPonto[]> {
  const registrosPorDia = new Map<string, RegistroPonto[]>();
  Object.keys(registrosPonto).forEach((dataKey) => {
    const [year, month, day] = dataKey.split('-').map(Number);
    if (month === mes && year === ano) {
      const registrosOrdenados = [...registrosPonto[dataKey]].sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());
      registrosPorDia.set(dataKey, registrosOrdenados);
    }
  });
  return registrosPorDia;
}

/**
 * Gera dados completos do relatório mensal (LÓGICA ATUALIZADA)
 */
export async function generateMonthlyReport(funcionarioCpf: string, mes: number, ano: number): Promise<MonthlyReportData> {
  try {
    const employees = await getAllEmployees();
    const funcionario = employees.find(emp => emp.cpf === funcionarioCpf);
    if (!funcionario) throw new Error('Funcionário não encontrado');

    const userData = await getEmployeeData(funcionarioCpf);
    const registrosPonto = userData.registrosPonto || {};

    const registrosPorDia = groupRegistrosByDay(registrosPonto, mes, ano);
    const dailyData: DailyWorkData[] = [];
    let totalHoras = 0;
    let totalHorasExtras = 0;
    let diasTrabalhados = 0;

    registrosPorDia.forEach((registros, data) => {
      const horasTrabalhadasReais = calculateDailyHours(registros);
      const horasExtras = calculateDailyOvertime(horasTrabalhadasReais);
      const horasTrabalhadasDisplay = calculateDisplayHours(horasTrabalhadasReais);
      const completo = isDayComplete(registros);
      
      console.log('📊 Processando dia:', data);
      console.log('Horas Reais:', horasTrabalhadasReais);
      console.log('Horas Display:', horasTrabalhadasDisplay);
      console.log('Registros originais:', registros.length);
      
      // Ajusta a última saída para refletir as horas do relatório
      const registrosAjustados = adjustLastExitTime(registros, horasTrabalhadasDisplay);
      
      console.log('Registros ajustados:', registrosAjustados.length);
      console.log('---');

      if (completo) diasTrabalhados++;
      totalHoras += horasTrabalhadasDisplay;
      totalHorasExtras += horasExtras;

      dailyData.push({
        data,
        registros, // Registros originais (reais)
        registrosAjustados, // Registros com última saída ajustada para o relatório
        horasTrabalhadas: horasTrabalhadasDisplay, // Horas para exibição no relatório
        horasExtras: horasExtras,
        completo,
        horasTrabalhadasReais: horasTrabalhadasReais // Armazena horas reais para referência
      });
    });

    // Ordenação corrigida para evitar deslocamento de fuso horário
    dailyData.sort((a, b) => {
      const [yearA, monthA, dayA] = a.data.split('-').map(Number);
      const [yearB, monthB, dayB] = b.data.split('-').map(Number);
      return (yearA - yearB) || (monthA - monthB) || (dayA - dayB);
    });

    const diasComHoras = dailyData.filter(d => d.horasTrabalhadas > 0);
    const horasPorDia = diasComHoras.map(d => d.horasTrabalhadas);

    const resumo = {
      mediaDiariaHoras: diasComHoras.length > 0 ? totalHoras / diasComHoras.length : 0,
      maiorDiaHoras: horasPorDia.length > 0 ? Math.max(...horasPorDia) : 0,
      menorDiaHoras: horasPorDia.length > 0 ? Math.min(...horasPorDia) : 0,
      diasComHorasExtras: dailyData.filter(d => d.horasExtras > 0).length
    };

    return {
      funcionario,
      mes,
      ano,
      totalHoras,
      totalHorasExtras,
      diasTrabalhados,
      diasComRegistro: dailyData.length,
      registrosPorDia: dailyData,
      resumo
    };
  } catch (error) {
    console.error('Erro ao gerar relatório mensal:', error);
    throw new Error('Erro ao gerar dados do relatório');
  }
}

/**
 * Formata timestamp para horário HH:MM
 */
export function formatTimestamp(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Formata horas para exibição
 */
export function formatHours(horas: number): string {
  if (horas === 0) return "0h 0m";
  const horasInteiras = Math.floor(horas);
  const minutos = Math.round((horas - horasInteiras) * 60);
  return `${horasInteiras}h ${minutos}m`;
}

/**
 * Formata data para exibição brasileira
 */
export function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  });
}

/**
 * Formata data para exibição com dia da semana
 */
export function formatDateWithWeekday(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  });
}

/**
 * Obtém nome do mês
 */
export function getMonthName(mes: number): string {
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return meses[mes - 1] || 'Mês inválido';
}

/**
 * Valida se um mês/ano é válido
 */
export function isValidMonthYear(mes: number, ano: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (ano > currentYear || (ano === currentYear && mes > currentMonth)) return false;
  if (ano < 2020) return false;
  if (mes < 1 || mes > 12) return false;
  return true;
}

/**
 * Calcula estatísticas gerais
 */
export interface GeneralStats {
  totalFuncionarios: number;
  totalHorasTrabalhadasMes: number;
  totalHorasExtrasMes: number;
  mediaDiasTrabalhadosPorFuncionario: number;
  funcionarioComMaisHoras: { nome: string; horas: number } | null;
  funcionarioComMaisExtras: { nome: string; horas: number } | null;
}

export async function calculateGeneralStats(mes: number, ano: number): Promise<GeneralStats> {
  try {
    const employees = await getAllEmployees();
    const reports: MonthlyReportData[] = [];
    for (const employee of employees) {
      try {
        const report = await generateMonthlyReport(employee.cpf, mes, ano);
        reports.push(report);
      } catch (error) {
        console.warn(`Erro ao gerar relatório para ${employee.nome}:`, error);
      }
    }
    const totalHorasTrabalhadasMes = reports.reduce((acc, r) => acc + r.totalHoras, 0);
    const totalHorasExtrasMes = reports.reduce((acc, r) => acc + r.totalHorasExtras, 0);
    const totalDiasTrabalhados = reports.reduce((acc, r) => acc + r.diasTrabalhados, 0);
    const funcionarioComMaisHoras = reports.length > 0 ? reports.reduce((max, r) => r.totalHoras > max.totalHoras ? r : max) : null;
    const funcionarioComMaisExtras = reports.length > 0 ? reports.reduce((max, r) => r.totalHorasExtras > max.totalHorasExtras ? r : max) : null;
    return {
      totalFuncionarios: reports.length,
      totalHorasTrabalhadasMes,
      totalHorasExtrasMes,
      mediaDiasTrabalhadosPorFuncionario: reports.length > 0 ? totalDiasTrabalhados / reports.length : 0,
      funcionarioComMaisHoras: funcionarioComMaisHoras ? { nome: funcionarioComMaisHoras.funcionario.nome, horas: funcionarioComMaisHoras.totalHoras } : null,
      funcionarioComMaisExtras: funcionarioComMaisExtras && funcionarioComMaisExtras.totalHorasExtras > 0 ? { nome: funcionarioComMaisExtras.funcionario.nome, horas: funcionarioComMaisExtras.totalHorasExtras } : null
    };
  } catch (error) {
    console.error('Erro ao calcular estatísticas gerais:', error);
    throw new Error('Erro ao calcular estatísticas gerais');
  }
}

/**
 * Extrai registros de um período
 */
export function extractRegistrosFromPeriod(registrosPonto: { [data: string]: RegistroPonto[] }, dataInicio: string, dataFim: string): RegistroPonto[] {
  const registrosFiltrados: RegistroPonto[] = [];
  const [yearI, monthI, dayI] = dataInicio.split('-').map(Number);
  const [yearF, monthF, dayF] = dataFim.split('-').map(Number);
  const inicio = new Date(yearI, monthI - 1, dayI);
  const fim = new Date(yearF, monthF - 1, dayF);
  Object.keys(registrosPonto).forEach((dataKey) => {
    const [year, month, day] = dataKey.split('-').map(Number);
    const dataRegistro = new Date(year, month - 1, day);
    if (dataRegistro >= inicio && dataRegistro <= fim) {
      registrosFiltrados.push(...registrosPonto[dataKey]);
    }
  });
  return registrosFiltrados.sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());
}

/**
 * Calcula minutos trabalhados
 */
export function calcularMinutosTrabalhados(registros: RegistroPonto[]): number {
  if (registros.length < 2) return 0;
  let totalMinutos = 0;
  for (let i = 0; i < registros.length; i += 2) {
    const entrada = registros[i];
    const saida = registros[i + 1];
    if (entrada?.tipo === 'entrada' && saida?.tipo === 'saida' && entrada.timestamp instanceof Timestamp && saida.timestamp instanceof Timestamp) {
      const diferenca = (saida.timestamp.toDate().getTime() - entrada.timestamp.toDate().getTime()) / (1000 * 60);
      if (diferenca > 0) totalMinutos += diferenca;
    }
  }
  return totalMinutos;
}

/**
 * Formata minutos para horas
 */
export function formatarMinutosParaHoras(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const mins = Math.floor(minutos % 60);
  return `${horas}h ${mins}m`;
}