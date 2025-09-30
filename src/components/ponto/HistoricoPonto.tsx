"use client";

import { useState, useEffect } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RegistroPonto } from '../ponto/usePonto';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart
} from 'recharts';

interface HistoricoPontoProps {
  cpf: string;
}

interface EstatisticasDia {
  data: string;
  registros: RegistroPonto[];
  horasTrabalhadas: string;
  horasTrabalhadasMinutos: number;
  completo: boolean;
  dataFormatada: string;
}

interface DadosGrafico {
  data: string;
  horas: number;
  registros: number;
  completo: boolean;
}

export default function HistoricoPonto({ cpf }: HistoricoPontoProps) {
  const [historico, setHistorico] = useState<EstatisticasDia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState<'semana' | 'mes'>('semana');
  const [graficoAtivo, setGraficoAtivo] = useState<'horas' | 'frequencia' | 'distribuicao'>('horas');

  useEffect(() => {
    carregarHistorico();
  }, [cpf, periodo]);

  const carregarHistorico = async () => {
    if (!cpf) return;

    setCarregando(true);
    try {
      const userDoc = await getDoc(doc(db, "users", cpf));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const registros = userData.registrosPonto || [];
        
        // Calcular período
        const hoje = new Date();
        const diasAtras = periodo === 'semana' ? 7 : 30;
        const dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - diasAtras);
        
        // Agrupar registros por dia
        const registrosPorDia: { [key: string]: RegistroPonto[] } = {};
        
        registros.forEach((registro: RegistroPonto) => {
          const dataRegistro = new Date(registro.data);
          if (dataRegistro >= dataInicio && dataRegistro <= hoje) {
            if (!registrosPorDia[registro.data]) {
              registrosPorDia[registro.data] = [];
            }
            registrosPorDia[registro.data].push(registro);
          }
        });

        // Criar estatísticas por dia
        const estatisticas: EstatisticasDia[] = [];
        
        for (let d = new Date(dataInicio); d <= hoje; d.setDate(d.getDate() + 1)) {
          const dataStr = d.toISOString().split('T')[0];
          const registrosDia = registrosPorDia[dataStr] || [];
          const horasTrabalhadasMinutos = calcularMinutosTrabalhados(registrosDia);
          
          estatisticas.push({
            data: dataStr,
            registros: registrosDia,
            horasTrabalhadas: formatarMinutosParaHoras(horasTrabalhadasMinutos),
            horasTrabalhadasMinutos,
            completo: registrosDia.length >= 2 && registrosDia.length % 2 === 0,
            dataFormatada: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          });
        }
        
        setHistorico(estatisticas.reverse()); // Mais recente primeiro
      }
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setCarregando(false);
    }
  };

  const calcularMinutosTrabalhados = (registros: RegistroPonto[]): number => {
    if (registros.length < 2) return 0;
    
    let totalMinutos = 0;
    
    for (let i = 0; i < registros.length; i += 2) {
      const entrada = registros[i];
      const saida = registros[i + 1];
      
      if (entrada && saida && entrada.tipo === 'entrada' && saida.tipo === 'saida') {
        const entradaTime = entrada.timestamp.toDate().getTime();
        const saidaTime = saida.timestamp.toDate().getTime();
        const diferenca = (saidaTime - entradaTime) / (1000 * 60);
        totalMinutos += diferenca;
      }
    }
    
    return totalMinutos;
  };

  const formatarMinutosParaHoras = (minutos: number): string => {
    const horas = Math.floor(minutos / 60);
    const mins = Math.floor(minutos % 60);
    return `${horas}h ${mins}m`;
  };

  const formatarData = (dataStr: string): string => {
    const data = new Date(dataStr + 'T00:00:00');
    return data.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });
  };

  const formatarHora = (timestamp: Timestamp): string => {
    return timestamp.toDate().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calcularTotalHoras = (): string => {
    const totalMinutos = historico.reduce((acc, dia) => acc + dia.horasTrabalhadasMinutos, 0);
    return formatarMinutosParaHoras(totalMinutos);
  };

  // Preparar dados para gráficos
  const dadosGraficoHoras: DadosGrafico[] = historico
    .slice()
    .reverse()
    .map(dia => ({
      data: dia.dataFormatada,
      horas: Math.round((dia.horasTrabalhadasMinutos / 60) * 100) / 100,
      registros: dia.registros.length,
      completo: dia.completo
    }));

  const dadosGraficoFrequencia = historico
    .slice()
    .reverse()
    .map(dia => ({
      data: dia.dataFormatada,
      trabalhado: dia.registros.length > 0 ? 1 : 0,
      completo: dia.completo ? 1 : 0
    }));

  const dadosDistribuicao = [
    {
      name: 'Dias Trabalhados',
      value: historico.filter(d => d.registros.length > 0).length,
      color: '#10B981'
    },
    {
      name: 'Dias Completos',
      value: historico.filter(d => d.completo).length,
      color: '#3B82F6'
    },
    {
      name: 'Dias Incompletos',
      value: historico.filter(d => d.registros.length > 0 && !d.completo).length,
      color: '#F59E0B'
    },
    {
      name: 'Dias sem Registro',
      value: historico.filter(d => d.registros.length === 0).length,
      color: '#EF4444'
    }
  ].filter(item => item.value > 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold">{`Data: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey === 'horas' ? 'Horas' : 'Registros'}: ${entry.value}${entry.dataKey === 'horas' ? 'h' : ''}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (carregando) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">📈</span>
            Histórico de Pontos
          </h2>
          
          <div className="flex flex-col md:flex-row gap-2">
            {/* Seletor de Período */}
            <div className="flex gap-2">
              <button
                onClick={() => setPeriodo('semana')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  periodo === 'semana'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Última Semana
              </button>
              <button
                onClick={() => setPeriodo('mes')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  periodo === 'mes'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Último Mês
              </button>
            </div>

            {/* Seletor de Gráfico */}
            <div className="flex gap-2">
              <button
                onClick={() => setGraficoAtivo('horas')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  graficoAtivo === 'horas'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📊 Horas
              </button>
              <button
                onClick={() => setGraficoAtivo('frequencia')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  graficoAtivo === 'frequencia'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📈 Frequência
              </button>
              <button
                onClick={() => setGraficoAtivo('distribuicao')}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  graficoAtivo === 'distribuicao'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🥧 Distribuição
              </button>
            </div>
          </div>
        </div>

        {/* Resumo do Período */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">
              {historico.filter(d => d.registros.length > 0).length}
            </div>
            <div className="text-sm text-gray-600">Dias Trabalhados</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">
              {historico.filter(d => d.completo).length}
            </div>
            <div className="text-sm text-gray-600">Dias Completos</div>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-lg font-bold text-purple-600">
              {calcularTotalHoras()}
            </div>
            <div className="text-sm text-gray-600">Total Trabalhado</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">
              {Math.round((historico.filter(d => d.registros.length > 0).length / historico.length) * 100)}%
            </div>
            <div className="text-sm text-gray-600">Frequência</div>
          </div>
        </div>

        {/* Gráficos */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {graficoAtivo === 'horas' && '📊 Horas Trabalhadas por Dia'}
            {graficoAtivo === 'frequencia' && '📈 Frequência de Trabalho'}
            {graficoAtivo === 'distribuicao' && '🥧 Distribuição de Dias'}
          </h3>
          
          <div style={{ width: '100%', height: 300 }}>
            {graficoAtivo === 'horas' && (
              <ResponsiveContainer>
                <BarChart data={dadosGraficoHoras}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="horas" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {graficoAtivo === 'frequencia' && (
              <ResponsiveContainer>
                <AreaChart data={dadosGraficoFrequencia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" />
                  <YAxis domain={[0, 1]} />
                  <Tooltip 
                    formatter={(value: any, name: string) => [
                      value === 1 ? 'Sim' : 'Não',
                      name === 'trabalhado' ? 'Trabalhou' : 'Completo'
                    ]}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="trabalhado" 
                    stackId="1"
                    stroke="#3B82F6" 
                    fill="#3B82F6" 
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="completo" 
                    stackId="2"
                    stroke="#10B981" 
                    fill="#10B981" 
                    fillOpacity={0.8}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {graficoAtivo === 'distribuicao' && (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={dadosDistribuicao}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {dadosDistribuicao.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Dias */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Detalhes por Dia</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {historico.map((dia, index) => (
            <div
              key={dia.data}
              className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
                dia.registros.length === 0
                  ? 'bg-gray-50 border-gray-200'
                  : dia.completo
                  ? 'bg-green-50 border-green-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-800">
                      {formatarData(dia.data)}
                    </span>
                    {dia.registros.length === 0 && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                        Sem registros
                      </span>
                    )}
                    {dia.registros.length > 0 && !dia.completo && (
                      <span className="text-xs bg-yellow-200 text-yellow-700 px-2 py-1 rounded">
                        Incompleto
                      </span>
                    )}
                    {dia.completo && (
                      <span className="text-xs bg-green-200 text-green-700 px-2 py-1 rounded">
                        Completo
                      </span>
                    )}
                    {dia.registros.length >= 4 && (
                      <span className="text-xs bg-blue-200 text-blue-700 px-2 py-1 rounded">
                        Limite Atingido
                      </span>
                    )}
                  </div>
                  
                  {dia.registros.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {dia.registros.map((registro, regIndex) => (
                        <span
                          key={regIndex}
                          className={`text-xs px-2 py-1 rounded font-mono ${
                            registro.tipo === 'entrada'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {registro.tipo === 'entrada' ? '🟢' : '🔴'} {formatarHora(registro.timestamp)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold text-gray-800">
                    {dia.horasTrabalhadas}
                  </div>
                  <div className="text-xs text-gray-500">
                    {dia.registros.length}/4 registros
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {historico.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📊</div>
            <p>Nenhum registro encontrado no período</p>
          </div>
        )}
      </div>
    </div>
  );
}

