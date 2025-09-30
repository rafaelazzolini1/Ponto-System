"use client";

import { useEffect, useState } from "react";
import { useAuth } from '../../hooks/useAuth';
import { Timestamp } from "firebase/firestore";
import Cookies from "js-cookie";
import { usePonto, RegistroPonto } from "../../components/ponto/usePonto";
import { ProtectedRoute } from "../../hooks/RoleBasedRedirect";
import { FaSignInAlt, FaSignOutAlt, FaClock, FaCalendarAlt, FaUser, FaSignOutAlt as FaLogout, FaFileAlt, FaChartBar, FaMapMarkerAlt, FaLayerGroup } from 'react-icons/fa';

export default function PontoPageEmployee() {
  const { user, logout } = useAuth();
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const {
    nome,
    cpf,
    registrosHoje,
    statusPonto,
    carregando,
    registrarPonto,
    carregarDados
  } = usePonto();

  // Atualizar hora atual a cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setHoraAtual(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Verificar autenticação e carregar dados
  useEffect(() => {
    const token = Cookies.get("firebaseToken");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    carregarDados();
  }, [carregarDados]);

  // Limpar mensagens após 5 segundos
  useEffect(() => {
    if (mensagemErro || mensagemSucesso) {
      const timer = setTimeout(() => {
        setMensagemErro(null);
        setMensagemSucesso(null);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [mensagemErro, mensagemSucesso]);

  const handleRegistrarPonto = async () => {
    try {
      setMensagemErro(null);
      const tipo = statusPonto.podeRegistrarEntrada ? 'entrada' : 'saida';
      await registrarPonto(tipo);
      setMensagemSucesso(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} registrada com sucesso!`);
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';
      setMensagemErro(mensagem);
    }
  };

  const formatarHora = (timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const obterSaudacao = () => {
    const hora = horaAtual.getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
  };

  const calcularHorasTrabalhadas = () => {
    if (registrosHoje.length < 2) return "0h 0m";

    let totalMinutos = 0;

    for (let i = 0; i < registrosHoje.length; i += 2) {
      const entrada = registrosHoje[i];
      const saida = registrosHoje[i + 1];

      if (entrada && saida && entrada.tipo === 'entrada' && saida.tipo === 'saida') {
        const entradaTime = entrada.timestamp.toDate().getTime();
        const saidaTime = saida.timestamp.toDate().getTime();
        const diferenca = (saidaTime - entradaTime) / (1000 * 60); // em minutos
        totalMinutos += diferenca;
      }
    }

    const horas = Math.floor(totalMinutos / 60);
    const minutos = Math.floor(totalMinutos % 60);

    return `${horas}h ${minutos}m`;
  };

  const obterProximoHorarioPermitido = () => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(0, 0, 0, 0);

    return amanha.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const obterEnderecoResumido = (endereco: string | undefined) => {
    if (!endereco) return 'Endereço não disponível';
    const partes = endereco.split(',');
    if (partes.length >= 2) {
      return `${partes[0].trim()}, ${partes[1].trim()}`;
    }
    return endereco;
  };

  return (
    <ProtectedRoute requiredRole="employee">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto flex flex-col space-y-6">
          {/* Mensagens de Feedback */}
          {mensagemErro && (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg animate-pulse">
              <div className="flex items-center gap-2">
                <span className="text-lg">❌</span>
                <span>{mensagemErro}</span>
              </div>
            </div>
          )}

          {mensagemSucesso && (
            <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg animate-pulse">
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <span>{mensagemSucesso}</span>
              </div>
            </div>
          )}

          {/* Alerta de Limite Diário Atingido */}
          {statusPonto.limiteDiarioAtingido && (
            <div className="p-4 bg-orange-100 border border-orange-400 text-orange-700 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <div>
                  <strong>Limite diário atingido!</strong>
                  <p className="text-sm mt-1">
                    Você já registrou 4 pontos hoje. Próximos registros só podem ser feitos na{' '}
                    <strong>{obterProximoHorarioPermitido()}</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                Sistema de Ponto Eletrônico
              </h1>
              <p className="text-gray-600 flex items-center gap-2">
                <FaUser className="text-gray-600" />
                {obterSaudacao()} {nome ?? "Carregando..."}
              </p>
            </div>
            <div className="text-center md:text-right">
              <div className="text-3xl font-mono text-gray-800 font-bold flex items-center justify-center md:justify-end gap-2">
                <FaClock className="text-black-600" />
                {horaAtual.toLocaleTimeString('pt-BR')}
              </div>
              <div className="text-sm text-gray-500 flex items-center justify-center md:justify-end gap-2">
                <FaCalendarAlt className="text-black-500" />
                {horaAtual.toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full md:w-auto bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-center gap-2"
            >
              <FaLogout />
              Sair
            </button>
          </div>

          {/* Conteúdo Principal */}
          <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col md:grid md:grid-cols-2 gap-6">
            {/* Painel de Registro */}
            <div className="flex flex-col">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FaClock className="text-2xl text-black-600" />
                Registrar Ponto
              </h2>

              {/* Status Atual */}
              <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 border">
                <h3 className="font-medium text-gray-700 mb-2">Status Atual:</h3>
                {statusPonto.ultimoRegistro ? (
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-4 h-4 rounded-full animate-pulse ${statusPonto.ultimoRegistro.tipo === 'entrada'
                      ? 'bg-green-500'
                      : 'bg-red-500'
                      }`}></div>
                    <span className="text-sm text-gray-600">
                      Última {statusPonto.ultimoRegistro.tipo} às{' '}
                      <span className="font-mono font-semibold">
                        {formatarHora(statusPonto.ultimoRegistro.timestamp)}
                      </span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                    <span className="text-sm text-gray-600">
                      Nenhum registro hoje
                    </span>
                  </div>
                )}

                {/* Contador de Registros Restantes */}
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${statusPonto.limiteDiarioAtingido ? 'bg-red-500' : 'bg-blue-500'
                    }`}></div>
                  <span className="text-sm text-gray-600">
                    {statusPonto.limiteDiarioAtingido
                      ? 'Limite diário atingido (4/4)'
                      : `Registros restantes: ${statusPonto.registrosRestantes}/4`
                    }
                  </span>
                </div>
              </div>

              {/* Botão de Registro Único */}
              <div className="space-y-4 flex flex-col">
                <button
                  onClick={handleRegistrarPonto}
                  disabled={statusPonto.limiteDiarioAtingido || carregando}
                  className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 ${statusPonto.limiteDiarioAtingido || carregando
                      ? 'bg-gray-300 cursor-not-allowed'
                      : statusPonto.podeRegistrarEntrada
                        ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 hover:shadow-xl transform hover:-translate-y-1 active:scale-95'
                        : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 hover:shadow-xl transform hover:-translate-y-1 active:scale-95'
                    }`}
                >
                  {carregando ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Registrando...
                    </div>
                  ) : (
                    <>
                      {statusPonto.podeRegistrarEntrada ? (
                        <>
                          <FaSignInAlt className="text-xl" />
                          <span>Registrar Entrada</span>
                        </>
                      ) : (
                        <>
                          <FaSignOutAlt className="text-xl" />
                          <span>Registrar Saída</span>
                        </>
                      )}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Registros do Dia */}
            <div className="flex flex-col">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FaFileAlt className="text-2xl text-black-600" />
                Registros de Hoje
              </h2>

              {registrosHoje.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FaLayerGroup className="mx-auto text-4xl text-black-600" />
                  <p className="text-lg">Nenhum registro hoje</p>
                  <p className="text-sm mt-2">Registre sua entrada para começar</p>
                </div>

              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {registrosHoje.map((registro, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-l-4 transition-all duration-200 hover:shadow-md ${registro.tipo === 'entrada'
                        ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-500'
                        : 'bg-gradient-to-r from-red-50 to-red-100 border-red-500'
                        }`}
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          {registro.tipo === 'entrada' ? (
                            <FaSignInAlt className="text-2xl text-green-600" />
                          ) : (
                            <FaSignOutAlt className="text-2xl text-red-600" />
                          )}
                          <div>
                            <span className="font-semibold capitalize text-gray-800">
                              {registro.tipo}
                            </span>


                            {/* Endereço Resumido */}
                            {registro.enderecoAproximado && (
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                  <FaMapMarkerAlt className="text-black-600" />
                                  <span>
                                    {obterEnderecoResumido(registro.enderecoAproximado)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono text-lg font-bold text-gray-800">
                            {formatarHora(registro.timestamp)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {registro.timestamp.toDate().toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resumo do Dia */}
          {/* {registrosHoje.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FaChartBar className="text-2xl text-blue-600" />
                Resumo do Dia
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                  <div className="text-3xl font-bold text-blue-600">
                    {registrosHoje.filter(r => r.tipo === 'entrada').length}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Entradas</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200">
                  <div className="text-3xl font-bold text-red-600">
                    {registrosHoje.filter(r => r.tipo === 'saida').length}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Saídas</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                  <div className="text-3xl font-bold text-green-600">
                    {registrosHoje.length}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Total</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
                  <div className="text-lg font-bold text-yellow-600">
                    {calcularHorasTrabalhadas()}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Tempo Trabalhado</div>
                </div>
              </div>
            </div>
          )} */}
        </div>
      </div>
    </ProtectedRoute>
  );
}