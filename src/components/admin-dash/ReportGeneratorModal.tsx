"use client";

import { useState, useEffect } from 'react';
import {
  getAllEmployees,
  generateMonthlyReport,
  Employee,
  MonthlyReportData,
  getMonthName,
  isValidMonthYear,
} from '../admin-dash/reportUtils';
import {
  XCircleIcon,
  InformationCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { X } from 'lucide-react';

interface ReportGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerateReport: (reportData: MonthlyReportData, filters: ReportFilters) => void;
}

interface ReportFilters {
  funcionarioCpf: string;
  mes: number;
  ano: number;
  nomeEmpresa: string;
}

export default function ReportGeneratorModal({
  isOpen,
  onClose,
  onGenerateReport,
}: ReportGeneratorModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const [filters, setFilters] = useState<ReportFilters>({
    funcionarioCpf: '',
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    nomeEmpresa: 'MR Azzolini Transportes e Serviços',
  });

  useEffect(() => {
    if (isOpen) {
      loadEmployees();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const loadEmployees = async () => {
    setLoading(true);
    setError(null);

    try {
      const employeesList = await getAllEmployees();
      setEmployees(employeesList);
    } catch (err) {
      console.error('Erro ao carregar funcionários:', err);
      setError('Erro ao carregar lista de funcionários.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!filters.funcionarioCpf) {
      setError('Selecione um funcionário.');
      return;
    }

    if (!isValidMonthYear(filters.mes, filters.ano)) {
      setError('Período inválido. Não é possível gerar relatórios para períodos futuros.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const reportData = await generateMonthlyReport(
        filters.funcionarioCpf,
        filters.mes,
        filters.ano
      );

      if (!reportData || reportData.diasComRegistro === 0) {
        setError('Não foram encontrados registros para o funcionário no período selecionado.');
        return;
      }

      onGenerateReport(reportData, filters);
      handleClose();
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao gerar relatório.';
      setError(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const validatePeriod = (mes: number, ano: number) => {
    if (!isValidMonthYear(mes, ano)) {
      setError('Período inválido. Não é possível selecionar períodos futuros.');
    } else {
      setError(null);
    }
  };

  const handleMesChange = (newMes: number) => {
    setFilters({ ...filters, mes: newMes });
    validatePeriod(newMes, filters.ano);
  };

  const handleAnoChange = (newAno: number) => {
    setFilters({ ...filters, ano: newAno });
    validatePeriod(filters.mes, newAno);
  };

  const handleClose = () => {
    setFilters({
      funcionarioCpf: '',
      mes: new Date().getMonth() + 1,
      ano: new Date().getFullYear(),
      nomeEmpresa: 'MR Azzolini Transportes e Serviços',
    });
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 sm:p-6">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md sm:max-w-lg max-h-[80vh] sm:max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-700 to-gray-900 text-white p-3 sm:p-4 rounded-t-xl">
          <div className="flex justify-between items-center gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold">Gerar Relatório</h2>
              <p className="text-gray-200 text-xs sm:text-sm mt-1">
                Relatório mensal de ponto
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-300 transition-colors p-1"
              disabled={generating}
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 text-sm">
          {/* Mensagem de Erro */}
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center gap-2 text-sm">
              <XCircleIcon className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Informações da Empresa */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nome da Empresa
            </label>
            <input
              type="text"
              value={filters.nomeEmpresa}
              onChange={(e) => setFilters({ ...filters, nomeEmpresa: e.target.value })}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
              placeholder="Nome da empresa"
              disabled={true}
            />
          </div>

          {/* Seleção de Funcionário */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Funcionário *
            </label>
            {loading ? (
              <div className="flex items-center gap-2 p-2 text-gray-500 text-sm">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500"></div>
                Carregando funcionários...
              </div>
            ) : (
              <select
                value={filters.funcionarioCpf}
                onChange={(e) => setFilters({ ...filters, funcionarioCpf: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
                disabled={generating}
                aria-label="Selecionar funcionário"
              >
                <option value="">Selecione um funcionário</option>
                {employees.map((employee) => (
                  <option key={employee.cpf} value={employee.cpf}>
                    {employee.nome} - {employee.cpf}
                    {employee.departamento && ` (${employee.departamento})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Período */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Mês *
              </label>
              <select
                value={filters.mes}
                onChange={(e) => handleMesChange(parseInt(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
                disabled={generating}
                aria-label="Selecionar mês"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
                  <option key={mes} value={mes}>
                    {getMonthName(mes)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Ano *
              </label>
              <select
                value={filters.ano}
                onChange={(e) => handleAnoChange(parseInt(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
                disabled={generating}
                aria-label="Selecionar ano"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((ano) => (
                  <option key={ano} value={ano}>
                    {ano}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview */}
          {filters.funcionarioCpf && (
            <div className="bg-gray-50 rounded-md p-3 border">
              <h3 className="font-medium text-gray-800 mb-2 text-sm">
                Preview do Relatório
              </h3>
              <div className="text-xs text-gray-600 space-y-1">
                <p>
                  <strong>Empresa:</strong> {filters.nomeEmpresa}
                </p>
                <p>
                  <strong>Funcionário:</strong>{' '}
                  {employees.find((e) => e.cpf === filters.funcionarioCpf)?.nome}
                </p>
                <p>
                  <strong>CPF:</strong> {filters.funcionarioCpf}
                </p>
                <p>
                  <strong>Período:</strong> {getMonthName(filters.mes)} de {filters.ano}
                </p>
              </div>
            </div>
          )}

          {/* Informações sobre Horas Extras */}
          <div className="bg-gray-200 text-white p-3 sm:p-4 rounded-t-xl">
            <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2 text-sm">
              <InformationCircleIcon className="w-4 h-4" />
              Informações sobre o Relatório
            </h3>
            <div className="text-xs text-gray-900 space-y-1">
              <p>• <strong>Jornada Normal:</strong> 8 horas e 48 minutos por dia</p>
              <p>• <strong>Horas Extras:</strong> Tempo trabalhado acima da jornada normal</p>
              <p>• <strong>Dias Trabalhados:</strong> Dias com pelo menos uma entrada e uma saída</p>
              <p>• <strong>Cálculos:</strong> Baseados nos registros de ponto do funcionário</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-3 sm:px-4 py-3 rounded-b-xl flex flex-col sm:flex-row justify-end gap-2">
          <button
            onClick={handleClose}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg text-sm sm:text-base w-full sm:w-auto"
            disabled={generating}
            aria-label="Cancelar geração de relatório"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerateReport}
            disabled={generating || !filters.funcionarioCpf || !isValidMonthYear(filters.mes, filters.ano)}
            // className="bg-gradient-to-r from-gray-700 to-gray-900 text-white p-4 sm:p-6 rounded-t-xl"
            className={`px-3 py-1.5 rounded-md font-medium transition-all text-sm w-full sm:w-auto flex items-center justify-center gap-2 ${generating || !filters.funcionarioCpf || !isValidMonthYear(filters.mes, filters.ano)
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-gray-700 to-gray-900 text-white hover:from-gray-700 hover:to-indigo-700 transform hover:-translate-y-0.5 hover:shadow-md'
              }`}
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                Gerando PDF...
              </>
            ) : (
              <>
                <DocumentTextIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Gerar Relatório PDF</span>
                <span className="sm:hidden">Gerar PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
