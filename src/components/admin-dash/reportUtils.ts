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

export interface DailyWorkData {
  data: string;
  registros: RegistroPonto[];
  horasTrabalhadas: number;
  horasExtras: number;
  completo: boolean;
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

// Constantes
export const JORNADA_NORMAL_MINUTOS = 8 * 60 + 48;
export const JORNADA_NORMAL_HORAS = JORNADA_NORMAL_MINUTOS / 60;
export const MAX_OVERTIME_HORAS = 2;
export const MAX_WORKED_MINUTOS = 10 * 60 + 48;
export const MAX_WORKED_HORAS = MAX_WORKED_MINUTOS / 60;
export const NORMAL_END_TIME = '15:48';
export const OVERTIME_START_MINUTOS = JORNADA_NORMAL_MINUTOS + 120;
export const OVERTIME_START_HORAS = OVERTIME_START_MINUTOS / 60;

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
export async function getEmployeeData(cpf: string): Promise<any> {
  try {
    const userQuery = query(collection(db, 'users'), where('__name__', '==', cpf));
    const userSnapshot = await getDocs(userQuery);
    if (userSnapshot.empty) throw new Error('Funcionário não encontrado');
    return userSnapshot.docs[0].data();
  } catch (error) {
    console.error('Erro ao buscar dados do funcionário:', error);
    throw new Error('Erro ao carregar dados do funcionário');
  }
}

/**
 * Calcula as horas trabalhadas em um dia
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
 * Calcula as horas extras de um dia
 */
export function calculateDailyOvertime(horasTrabalhadas: number): number {
  return Math.max(0, horasTrabalhadas - OVERTIME_START_HORAS);
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
 * Gera dados completos do relatório mensal
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
      const horasTrabalhadasOriginal = calculateDailyHours(registros);
      const horasExtrasOriginal = calculateDailyOvertime(horasTrabalhadasOriginal);
      const horasTrabalhadasCappada = Math.min(horasTrabalhadasOriginal, JORNADA_NORMAL_HORAS + 1);
      const horasExtrasCappada = horasTrabalhadasCappada > JORNADA_NORMAL_HORAS ? 1 : 0;
      const completo = isDayComplete(registros);

      if (completo) diasTrabalhados++;
      totalHoras += horasTrabalhadasCappada;
      totalHorasExtras += horasExtrasCappada;

      dailyData.push({
        data,
        registros,
        horasTrabalhadas: horasTrabalhadasCappada,
        horasExtras: horasExtrasCappada,
        completo
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
  const date = new Date(year, month - 1, day); // month é 0-based
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