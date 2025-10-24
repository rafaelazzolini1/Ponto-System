"use client";

import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DateTime } from 'luxon';
import {
  ArrowPathIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  ChartBarIcon,
  UsersIcon,
  ClockIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { ProtectedRoute } from '../../hooks/RoleBasedRedirect';
import { useAuth } from '../../hooks/useAuth';
import { RegistroPonto } from '../../components/ponto/usePonto';
import ReportGeneratorModal from '../../components/admin-dash/ReportGeneratorModal';
import { generatePDFReport, PDFReportOptions } from '../../components/admin-dash/pdfGenerator';
import { MonthlyReportData, ReportFilters } from '../../components/admin-dash/reportUtils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { AlarmClockCheckIcon } from 'lucide-react';
import BancoHoras from '../../components/admin-dash/BancoHoras';

interface EmployeeData {
  cpf: string;
  nome: string;
  departamento?: string;
  registrosPeriodo: RegistroPonto[];
  horasTrabalhadasPeriodo: string;
  horasTrabalhadasMinutos: number;
  statusAtual: 'trabalhando' | 'ausente' | 'completo' | 'sem_registro';
  ultimoRegistro?: RegistroPonto;
  totalRegistrosPeriodo: number;
}

interface DashboardFilters {
  dataInicio: string;
  dataFim: string;
  cpf: string;
  nome: string;
  status: 'todos' | 'trabalhando' | 'ausente' | 'completo' | 'sem_registro';
}

interface DashboardStats {
  totalFuncionarios: number;
  funcionariosTrabalhando: number;
  funcionariosAusentes: number;
  funcionariosCompletos: number;
  funcionariosSemRegistro: number;
  totalHorasHoje: number;
  mediaHorasPorFuncionario: number;
  registrosHoje: number;
}

type TabType = 'registros' | 'banco-horas';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const scrollPositionRef = useRef<number>(0);
  const [activeTab, setActiveTab] = useState<TabType>('registros');
  const [stats, setStats] = useState<DashboardStats>({
    totalFuncionarios: 0,
    funcionariosTrabalhando: 0,
    funcionariosAusentes: 0,
    funcionariosCompletos: 0,
    funcionariosSemRegistro: 0,
    totalHorasHoje: 0,
    mediaHorasPorFuncionario: 0,
    registrosHoje: 0,
  });

  const [filters, setFilters] = useState<DashboardFilters>({
    dataInicio: new Date().toISOString().split('T')[0],
    dataFim: '',
    cpf: '',
    nome: '',
    status: 'todos',
  });

  useEffect(() => {
    loadEmployeesData();
  }, [filters.dataInicio, filters.dataFim]);

  useEffect(() => {
    applyFilters();
  }, [employees, filters]);

  const loadEmployeesData = async (scrollToPosition?: number) => {
    setLoading(true);
    setError(null);

    if (!filters.dataInicio && !filters.dataFim) {
      setEmployees([]);
      setFilteredEmployees([]);
      setStats({
        totalFuncionarios: 0,
        funcionariosTrabalhando: 0,
        funcionariosAusentes: 0,
        funcionariosCompletos: 0,
        funcionariosSemRegistro: 0,
        totalHorasHoje: 0,
        mediaHorasPorFuncionario: 0,
        registrosHoje: 0,
      });
      setLoading(false);
      return;
    }

    if (filters.dataInicio && filters.dataFim) {
      const dataInicioDt = DateTime.fromISO(filters.dataInicio, { zone: 'America/Sao_Paulo' });
      const dataFimDt = DateTime.fromISO(filters.dataFim, { zone: 'America/Sao_Paulo' });
      if (dataFimDt < dataInicioDt) {
        setError('Data final não pode ser anterior à data inicial.');
        setEmployees([]);
        setFilteredEmployees([]);
        setLoading(false);
        return;
      }
    }

    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'employee')
      );

      const usersSnapshot = await getDocs(usersQuery);
      const employeesData: EmployeeData[] = [];

      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        const registrosPonto = userData.registrosPonto || {};

        const effectiveDataInicio = filters.dataInicio;
        const effectiveDataFim = filters.dataFim || filters.dataInicio;

        const registrosFiltrados: RegistroPonto[] = [];
        const dataInicioDt = DateTime.fromISO(effectiveDataInicio, { zone: 'America/Sao_Paulo' }).startOf('day');
        const dataFimDt = DateTime.fromISO(effectiveDataFim, { zone: 'America/Sao_Paulo' }).endOf('day');

        Object.keys(registrosPonto).forEach((dataKey) => {
          const dataRegistro = DateTime.fromFormat(dataKey, 'yyyy-MM-dd', { zone: 'America/Sao_Paulo' });
          if (dataRegistro >= dataInicioDt && dataRegistro <= dataFimDt) {
            const registrosData = registrosPonto[dataKey];
            if (Array.isArray(registrosData)) {
              registrosFiltrados.push(...registrosData);
            }
          }
        });

        registrosFiltrados.sort((a, b) => {
          const timestampA = a.timestamp instanceof Timestamp ? a.timestamp.toDate().getTime() : 0;
          const timestampB = b.timestamp instanceof Timestamp ? b.timestamp.toDate().getTime() : 0;
          return timestampA - timestampB;
        });

        const horasTrabalhadasMinutos = calcularMinutosTrabalhados(registrosFiltrados);
        const ultimoRegistro = registrosFiltrados[registrosFiltrados.length - 1];
        const statusAtual = determinarStatus(registrosFiltrados, ultimoRegistro, effectiveDataInicio === effectiveDataFim);

        employeesData.push({
          cpf: doc.id,
          nome: userData.nome,
          departamento: userData.departamento,
          registrosPeriodo: registrosFiltrados,
          horasTrabalhadasPeriodo: formatarMinutosParaHoras(horasTrabalhadasMinutos),
          horasTrabalhadasMinutos,
          statusAtual,
          ultimoRegistro,
          totalRegistrosPeriodo: registrosFiltrados.length,
        });
      });

      setEmployees(employeesData);
      calculateStats(employeesData);
      const finalScroll = typeof scrollToPosition === 'number' ? scrollToPosition : scrollPositionRef.current;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, finalScroll);
        });
      });
    } catch (err) {
      console.error('Erro ao carregar dados dos funcionários:', err);
      setError('Erro ao carregar dados dos funcionários. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    const now = Date.now();
    if (now - lastRefresh >= 1000) {
      setLastRefresh(now);
      const currentScroll = window.scrollY;
      scrollPositionRef.current = currentScroll;
      loadEmployeesData(currentScroll);
    }
  };

  const calcularMinutosTrabalhados = (registros: RegistroPonto[]): number => {
    if (registros.length < 2) return 0;

    let totalMinutos = 0;

    for (let i = 0; i < registros.length; i += 2) {
      const entrada = registros[i];
      const saida = registros[i + 1];

      if (
        entrada?.tipo === 'entrada' &&
        saida?.tipo === 'saida' &&
        entrada.timestamp instanceof Timestamp &&
        saida.timestamp instanceof Timestamp
      ) {
        const entradaTime = entrada.timestamp.toDate().getTime();
        const saidaTime = saida.timestamp.toDate().getTime();
        if (saidaTime > entradaTime) {
          totalMinutos += (saidaTime - entradaTime) / (1000 * 60);
        }
      }
    }

    return totalMinutos;
  };

  const formatarMinutosParaHoras = (minutos: number): string => {
    const horas = Math.floor(minutos / 60);
    const mins = Math.floor(minutos % 60);
    return `${horas}h ${mins}m`;
  };

  const determinarStatus = (
    registros: RegistroPonto[],
    ultimoRegistro?: RegistroPonto,
    isDiaUnico: boolean = true
  ): EmployeeData['statusAtual'] => {
    if (registros.length === 0) return 'sem_registro';

    if (isDiaUnico) {
      if (registros.length >= 4) return 'completo';
      if (!ultimoRegistro) return 'sem_registro';
      if (ultimoRegistro.tipo === 'entrada') return 'trabalhando';
      return 'ausente';
    } else {
      const hasEntrada = registros.some(r => r.tipo === 'entrada');
      const hasSaida = registros.some(r => r.tipo === 'saida');

      if (hasEntrada && hasSaida) return 'completo';
      if (hasEntrada) return 'trabalhando';
      return 'sem_registro';
    }
  };

  const calculateStats = (employeesData: EmployeeData[]) => {
    const totalFuncionarios = employeesData.length;
    const funcionariosTrabalhando = employeesData.filter(e => e.statusAtual === 'trabalhando').length;
    const funcionariosAusentes = employeesData.filter(e => e.statusAtual === 'ausente').length;
    const funcionariosCompletos = employeesData.filter(e => e.statusAtual === 'completo').length;
    const funcionariosSemRegistro = employeesData.filter(e => e.statusAtual === 'sem_registro').length;
    const totalHorasMinutos = employeesData.reduce((acc, e) => acc + e.horasTrabalhadasMinutos, 0);
    const registrosHoje = employeesData.reduce((acc, e) => acc + e.totalRegistrosPeriodo, 0);

    setStats({
      totalFuncionarios,
      funcionariosTrabalhando,
      funcionariosAusentes,
      funcionariosCompletos,
      funcionariosSemRegistro,
      totalHorasHoje: totalHorasMinutos,
      mediaHorasPorFuncionario: totalFuncionarios > 0 ? totalHorasMinutos / totalFuncionarios : 0,
      registrosHoje,
    });
  };

  const applyFilters = () => {
    if (error) return;

    let filtered = [...employees];

    if (filters.cpf) {
      filtered = filtered.filter(e => e.cpf.includes(filters.cpf));
    }

    if (filters.nome) {
      filtered = filtered.filter(e =>
        e.nome.toLowerCase().includes(filters.nome.toLowerCase())
      );
    }

    if (filters.status !== 'todos') {
      filtered = filtered.filter(e => e.statusAtual === filters.status);
    }

    setFilteredEmployees(filtered);
  };

  const formatarHora = (timestamp: Timestamp) => {
    return DateTime.fromJSDate(timestamp.toDate(), { zone: 'America/Sao_Paulo' }).toLocaleString({
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const getStatusColor = (status: EmployeeData['statusAtual']) => {
    switch (status) {
      case 'trabalhando': return 'text-green-600 bg-green-100';
      case 'ausente': return 'text-yellow-600 bg-yellow-100';
      case 'completo': return 'text-blue-600 bg-blue-100';
      case 'sem_registro': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: EmployeeData['statusAtual']) => {
    switch (status) {
      case 'trabalhando': return 'Trabalhando';
      case 'ausente': return 'Ausente';
      case 'completo': return 'Completo';
      case 'sem_registro': return 'Sem Registro';
      default: return 'Desconhecido';
    }
  };

  const getRegistrosEspecificos = (registros: RegistroPonto[]) => {
    const entradaInicial = registros.find(r => r.tipo === 'entrada' && registros.indexOf(r) === 0);
    const saidaInicial = registros.find(r => r.tipo === 'saida' && registros.indexOf(r) === 1);
    const entradaFinal = registros.find(r => r.tipo === 'entrada' && registros.indexOf(r) === 2);
    const saidaFinal = registros.find(r => r.tipo === 'saida' && registros.indexOf(r) === 3);
    return { entradaInicial, saidaInicial, entradaFinal, saidaFinal };
  };

  const calcularHorasExtras = (minutosTrabalhados: number): string => {
    const limiteHorasNormais = 8 * 60 + 48;
    if (minutosTrabalhados > limiteHorasNormais) {
      const minutosExtras = minutosTrabalhados - limiteHorasNormais;
      return formatarMinutosParaHoras(minutosExtras);
    }
    return '-';
  };

  const isInterval = filters.dataInicio && filters.dataFim && filters.dataInicio !== filters.dataFim;

  const dadosGraficoHoras = filteredEmployees
    .filter(e => e.horasTrabalhadasMinutos > 0)
    .map(e => ({
      nome: e.nome.split(' ')[0],
      horas: Math.round((e.horasTrabalhadasMinutos / 60) * 100) / 100,
    }))
    .sort((a, b) => b.horas - a.horas);

  const dadosGraficoTotalHoras = [
    { name: 'Total', horas: Math.round((stats.totalHorasHoje / 60) * 100) / 100, fill: '#8884d8' },
    { name: 'Média por Func.', horas: Math.round((stats.mediaHorasPorFuncionario / 60) * 100) / 100, fill: '#82ca9d' },
  ].filter(item => item.horas > 0);

  const horasTickFormatter = (value: number) => `${Math.floor(value)}h`;

  const horasTooltipFormatter = (value: number) => {
    const horas = Math.floor(value);
    const minutos = Math.round((value - horas) * 60);
    return [`${horas}h ${minutos}m`, 'Horas Trabalhadas'];
  };

  const handleGenerateReport = (reportData: MonthlyReportData, reportFilters: ReportFilters) => {
    try {
      const pdfOptions: PDFReportOptions = {
        nomeEmpresa: reportFilters.nomeEmpresa,
        assinaturaFuncionario: reportFilters.assinaturaFuncionario,
        reportData: reportData,
      };
      generatePDFReport(pdfOptions);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      setError('Erro ao gerar relatório PDF. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requiredRole="admin">
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center w-full max-w-md">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              Carregando Dashboard...
            </h2>
            <p className="text-gray-600 text-sm">
              Coletando dados dos funcionários.
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const showHorasPerFuncChart = dadosGraficoHoras.length > 0;
  const showTotalHorasChart = dadosGraficoTotalHoras.length > 0;

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 p-3 sm:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">
                  Dashboard Administrativa
                </h1>
                <p className="text-gray-600 text-xs sm:text-sm">
                  Bem-vindo, {user?.nome}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={() => setShowReportModal(true)}
                  className="bg-gradient-to-r from-green-600 to-green-700 text-white px-3 sm:px-4 py-2 rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-center gap-2 text-xs sm:text-sm w-full sm:w-auto"
                >
                  <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="whitespace-nowrap">Gerar Relatório PDF</span>
                </button>

                <button
                  onClick={logout}
                  className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg text-xs sm:text-sm w-full sm:w-auto"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>

          {/* Mensagem de Erro */}
          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-start gap-2">
              <ExclamationCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm">{error}</span>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-lg mb-4 sm:mb-6 overflow-hidden">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('registros')}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm lg:text-base font-medium transition-colors duration-200 flex items-center justify-center gap-1 sm:gap-2 ${
                  activeTab === 'registros'
                    ? 'border-b-2 border-gray-600 text-gray-800 bg-gray-100'
                    : 'text-gray-800 hover:text-gray-800 hover:bg-gray-200'
                }`}
              >
                <ClipboardDocumentListIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Registros de Ponto</span>
                <span className="sm:hidden">Registros de Ponto</span>
              </button>
              <button
                onClick={() => setActiveTab('banco-horas')}
                className={`flex-1 px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm lg:text-base font-medium transition-colors duration-200 flex items-center justify-center gap-1 sm:gap-2 ${
                  activeTab === 'banco-horas'
                    ? 'border-b-2 border-gray-600 text-gray-800 bg-gray-100'
                    : 'text-gray-800 hover:text-gray-800 hover:bg-gray-200'
                }`}
              >
                <BanknotesIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Banco de Horas</span>
                <span className="sm:hidden">Banco de Horas</span>
              </button>
            </div>
          </div>

          {/* Conteúdo das Tabs */}
          {activeTab === 'registros' ? (
            <div className="space-y-4 sm:space-y-6">

              {/* Gráficos */}
              {filteredEmployees.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-2">
                  {showHorasPerFuncChart && (
                    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                      <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                        <AlarmClockCheckIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="text-xs sm:text-sm lg:text-base">Horas por Funcionário</span>
                      </h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={dadosGraficoHoras}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="nome"
                            angle={-45}
                            textAnchor="end"
                            height={60}
                            fontSize={9}
                            interval={0}
                          />
                          <YAxis tickFormatter={horasTickFormatter} fontSize={10} />
                          <Tooltip
                            formatter={horasTooltipFormatter}
                            labelFormatter={(label) => `Funcionário: ${label}`}
                          />
                          <Bar dataKey="horas" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {showTotalHorasChart && (
                    <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
                      <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                        <ChartBarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="text-xs sm:text-sm lg:text-base">Total de Horas</span>
                      </h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={dadosGraficoTotalHoras}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" fontSize={10} />
                          <YAxis tickFormatter={horasTickFormatter} fontSize={10} />
                          <Tooltip formatter={horasTooltipFormatter} />
                          <Bar dataKey="horas">
                            {dadosGraficoTotalHoras.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* Tabela de Funcionários */}
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* Filtros */}
                <div className="p-3 sm:p-4 lg:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Data Início</label>
                      <input
                        type="date"
                        value={filters.dataInicio}
                        onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                        className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Data Fim</label>
                      <input
                        type="date"
                        value={filters.dataFim}
                        onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                        className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">CPF</label>
                      <input
                        type="text"
                        placeholder="Filtrar por CPF"
                        value={filters.cpf}
                        onChange={(e) => setFilters({ ...filters, cpf: e.target.value })}
                        className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Nome</label>
                      <input
                        type="text"
                        placeholder="Filtrar por nome"
                        value={filters.nome}
                        onChange={(e) => setFilters({ ...filters, nome: e.target.value })}
                        className="w-full px-2 sm:px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-xs sm:text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
                    <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-800">
                      Funcionários
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg flex items-center gap-2 text-xs sm:text-sm w-full sm:w-auto justify-center"
                  >
                    <ArrowPathIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Atualizar</span>
                  </button>
                </div>

                {filteredEmployees.length === 0 ? (
                  <div className="p-6 sm:p-8 text-center text-gray-500">
                    <DocumentTextIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4" />
                    <p className="text-sm sm:text-base lg:text-lg">Nenhum funcionário encontrado</p>
                    <p className="text-xs sm:text-sm mt-2">Ajuste os filtros para ver os dados</p>
                  </div>
                ) : (
                  <>
                    {/* Vista Desktop - Tabela */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Nome
                            </th>
                            {!isInterval && (
                              <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                            )}
                            <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Horas Trabalhadas
                            </th>
                            {!isInterval && (
                              <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Horas Extras
                              </th>
                            )}
                            {!isInterval && (
                              <>
                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Entrada Inicial
                                </th>
                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Saída Inicial
                                </th>
                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Entrada Final
                                </th>
                                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Saída Final
                                </th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredEmployees.map((employee) => {
                            const { entradaInicial, saidaInicial, entradaFinal, saidaFinal } = getRegistrosEspecificos(employee.registrosPeriodo);

                            return (
                              <tr key={employee.cpf} className="hover:bg-gray-50">
                                <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {employee.nome}
                                </td>
                                {!isInterval && (
                                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(employee.statusAtual)}`}>
                                      {getStatusText(employee.statusAtual)}
                                    </span>
                                  </td>
                                )}
                                <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {employee.horasTrabalhadasPeriodo}
                                </td>
                                {!isInterval && (
                                  <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <div className={`${employee.horasTrabalhadasMinutos > (8 * 60 + 48) ? 'text-red-600' : 'text-gray-400'}`}>
                                      {calcularHorasExtras(employee.horasTrabalhadasMinutos)}
                                    </div>
                                  </td>
                                )}
                                {!isInterval && (
                                  <>
                                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {entradaInicial ? formatarHora(entradaInicial.timestamp) : '-'}
                                    </td>
                                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {saidaInicial ? formatarHora(saidaInicial.timestamp) : '-'}
                                    </td>
                                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {entradaFinal ? formatarHora(entradaFinal.timestamp) : '-'}
                                    </td>
                                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                      {saidaFinal ? formatarHora(saidaFinal.timestamp) : '-'}
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Vista Mobile - Cards */}
                    <div className="lg:hidden divide-y divide-gray-200">
                      {filteredEmployees.map((employee) => {
                        const { entradaInicial, saidaInicial, entradaFinal, saidaFinal } = getRegistrosEspecificos(employee.registrosPeriodo);

                        return (
                          <div key={employee.cpf} className="p-4 hover:bg-gray-50">
                            {/* Nome e Status */}
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="font-semibold text-gray-900 text-sm">
                                {employee.nome}
                              </h3>
                              {!isInterval && (
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(employee.statusAtual)}`}>
                                  {getStatusText(employee.statusAtual)}
                                </span>
                              )}
                            </div>

                            {/* Informações principais */}
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Horas Trabalhadas:</span>
                                <span className="font-medium text-gray-900">{employee.horasTrabalhadasPeriodo}</span>
                              </div>
                              
                              {!isInterval && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Horas Extras:</span>
                                  <span className={`font-medium ${employee.horasTrabalhadasMinutos > (8 * 60 + 48) ? 'text-red-600' : 'text-gray-400'}`}>
                                    {calcularHorasExtras(employee.horasTrabalhadasMinutos)}
                                  </span>
                                </div>
                              )}

                              {/* Horários - apenas para dia único */}
                              {!isInterval && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <span className="text-gray-600 block mb-1">Entrada Inicial:</span>
                                      <span className="font-medium text-gray-900">
                                        {entradaInicial ? formatarHora(entradaInicial.timestamp) : '-'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600 block mb-1">Saída Inicial:</span>
                                      <span className="font-medium text-gray-900">
                                        {saidaInicial ? formatarHora(saidaInicial.timestamp) : '-'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600 block mb-1">Entrada Final:</span>
                                      <span className="font-medium text-gray-900">
                                        {entradaFinal ? formatarHora(entradaFinal.timestamp) : '-'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600 block mb-1">Saída Final:</span>
                                      <span className="font-medium text-gray-900">
                                        {saidaFinal ? formatarHora(saidaFinal.timestamp) : '-'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <BancoHoras />
          )}

          {/* Modal de Relatório */}
          <ReportGeneratorModal
            isOpen={showReportModal}
            onClose={() => setShowReportModal(false)}
            onGenerateReport={handleGenerateReport}
          />
        </div>
      </div>
    </ProtectedRoute>
  );
}