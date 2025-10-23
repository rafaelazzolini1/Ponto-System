"use client";

import { useState, useEffect } from 'react';
import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DateTime } from 'luxon';
import {
  BanknotesIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { RegistroPonto } from '../ponto/usePonto';

interface BancoHorasData {
  cpf: string;
  nome: string;
  saldoMinutos: number;
  saldoFormatado: string;
  tipo: 'credito' | 'debito' | 'neutro';
}

interface BancoHorasFilters {
  dataInicio: string;
  dataFim: string;
  cpf: string;
  nome: string;
}

export default function BancoHoras() {
  const [bancoHoras, setBancoHoras] = useState<BancoHorasData[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const [filters, setFilters] = useState<BancoHorasFilters>({
    dataInicio: new Date().toISOString().split('T')[0],
    dataFim: '',
    cpf: '',
    nome: '',
  });

  useEffect(() => {
    loadBancoHoras();
  }, [filters.dataInicio, filters.dataFim]);

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

  const formatarSaldoHoras = (minutos: number, comSinal: boolean = false): string => {
    const sinal = minutos >= 0 ? '+' : '';
    const minutosAbs = Math.abs(minutos);
    const horas = Math.floor(minutosAbs / 60);
    const mins = Math.floor(minutosAbs % 60);

    if (comSinal) {
      return `${sinal}${horas}h ${mins}m`;
    }
    return `${horas}h ${mins}m`;
  };

  const loadBancoHoras = async () => {
    setLoading(true);

    if (!filters.dataInicio) {
      setBancoHoras([]);
      setLoading(false);
      return;
    }

    const JORNADA_DIARIA_MINUTOS = 10 * 60 + 48; // 10:48 em minutos

    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'employee')
      );

      const usersSnapshot = await getDocs(usersQuery);
      const bancoHorasData: BancoHorasData[] = [];

      const effectiveDataInicio = filters.dataInicio;
      const effectiveDataFim = filters.dataFim || filters.dataInicio;

      const dataInicioDt = DateTime.fromISO(effectiveDataInicio, { zone: 'America/Sao_Paulo' }).startOf('day');
      const dataFimDt = DateTime.fromISO(effectiveDataFim, { zone: 'America/Sao_Paulo' }).endOf('day');

      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        const registrosPonto = userData.registrosPonto || {};

        const registrosPorDia = new Map<string, RegistroPonto[]>();

        Object.keys(registrosPonto).forEach((dataKey) => {
          const dataRegistro = DateTime.fromFormat(dataKey, 'yyyy-MM-dd', { zone: 'America/Sao_Paulo' });

          if (dataRegistro >= dataInicioDt && dataRegistro <= dataFimDt) {
            const registrosData = registrosPonto[dataKey];
            if (Array.isArray(registrosData)) {
              if (!registrosPorDia.has(dataKey)) {
                registrosPorDia.set(dataKey, []);
              }
              registrosPorDia.get(dataKey)!.push(...registrosData);
            }
          }
        });

        let saldoTotal = 0;

        registrosPorDia.forEach((registrosDia) => {
          const minutosDia = calcularMinutosTrabalhados(registrosDia);
          const diferenca = minutosDia - JORNADA_DIARIA_MINUTOS;
          saldoTotal += diferenca;
        });

        bancoHorasData.push({
          cpf: doc.id,
          nome: userData.nome,
          saldoMinutos: saldoTotal,
          saldoFormatado: formatarSaldoHoras(saldoTotal, true),
          tipo: saldoTotal > 0 ? 'credito' : saldoTotal < 0 ? 'debito' : 'neutro',
        });
      });

      bancoHorasData.sort((a, b) => b.saldoMinutos - a.saldoMinutos);
      setBancoHoras(bancoHorasData);
    } catch (err) {
      console.error('Erro ao carregar banco de horas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    const now = Date.now();
    if (now - lastRefresh >= 1000) {
      setLastRefresh(now);
      loadBancoHoras();
    }
  };

  const filteredBancoHoras = bancoHoras.filter(emp => {
    const matchCpf = filters.cpf ? emp.cpf.includes(filters.cpf) : true;
    const matchNome = filters.nome ? emp.nome.toLowerCase().includes(filters.nome.toLowerCase()) : true;
    return matchCpf && matchNome;
  });

  return (

    <div className="space-y-6">
      {/* Tabela Banco de Horas */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">

        {/* Filtros */}
        <div className="bg-white rounded-xl sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Data Início</label>
              <input
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters({ ...filters, dataInicio: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Data Fim</label>
              <input
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters({ ...filters, dataFim: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                <MagnifyingGlassIcon className="w-4 h-4 inline mr-1" />
                Buscar por CPF
              </label>
              <input
                type="text"
                placeholder="Digite o CPF"
                value={filters.cpf}
                onChange={(e) => setFilters({ ...filters, cpf: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                <MagnifyingGlassIcon className="w-4 h-4 inline mr-1" />
                Buscar por Nome
              </label>
              <input
                type="text"
                placeholder="Digite o nome"
                value={filters.nome}
                onChange={(e) => setFilters({ ...filters, nome: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">

          <div className="p-4 sm:p-6 border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <BanknotesIcon className="w-6 h-6 text-black" />
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                Banco de Horas
              </h2>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg flex items-center gap-2 text-sm"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>

        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dados...</p>
          </div>
        ) : filteredBancoHoras.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-gray-500">
            <BanknotesIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-base sm:text-lg">Nenhum funcionário encontrado</p>
            <p className="text-xs sm:text-sm mt-2">Ajuste os filtros para ver os dados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CPF
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo de Horas
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBancoHoras.map((emp) => (
                  <tr key={emp.cpf} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {emp.nome}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {emp.cpf}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-bold">
                      <span className={
                        emp.tipo === 'credito'
                          ? 'text-green-600'
                          : emp.tipo === 'debito'
                            ? 'text-red-600'
                            : 'text-gray-600'
                      }>
                        {emp.saldoFormatado}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${emp.tipo === 'credito'
                        ? 'bg-green-100 text-green-800'
                        : emp.tipo === 'debito'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                        }`}>
                        {emp.tipo === 'credito' ? 'Crédito' : emp.tipo === 'debito' ? 'Débito' : 'Neutro'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div >
  );
}