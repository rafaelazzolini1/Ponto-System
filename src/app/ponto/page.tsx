"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from '../../hooks/useAuth';
import { Timestamp } from "firebase/firestore";
import Cookies from "js-cookie";
import { usePonto } from "../../components/ponto/usePonto";
import { ProtectedRoute } from "../../hooks/RoleBasedRedirect";
import { FaSignInAlt, FaSignOutAlt, FaClock, FaCalendarAlt, FaUser, FaSignOutAlt as FaLogout, FaFileAlt, FaMapMarkerAlt, FaLayerGroup, FaCheckCircle, FaXRay, FaCheck } from 'react-icons/fa';

export default function PontoPageEmployee() {
  const { logout } = useAuth();
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [carregamentoInicial, setCarregamentoInicial] = useState(true);

  const {
    nome,
    registrosHoje,
    statusPonto,
    carregando,
    registrarPonto,
    carregarDados
  } = usePonto();

  useEffect(() => {
    const interval = setInterval(() => {
      setHoraAtual(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const inicializar = async () => {
      const token = Cookies.get("firebaseToken");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      await carregarDados();
      setCarregamentoInicial(false);
    };

    inicializar();
  }, []);

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

  const formatarHora = useCallback((timestamp: Timestamp) => {
    return timestamp.toDate().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const obterSaudacao = useCallback(() => {
    const hora = horaAtual.getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
  }, [horaAtual]);

  const obterProximoHorarioPermitido = useCallback(() => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(0, 0, 0, 0);

    return amanha.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }, []);

  const obterEnderecoResumido = useCallback((endereco: string | undefined) => {
    if (!endereco) return 'Endereço não disponível';
    const partes = endereco.split(',');
    if (partes.length >= 2) {
      return `${partes[0].trim()}, ${partes[1].trim()}`;
    }
    return endereco;
  }, []);

  if (carregamentoInicial) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

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
                <FaCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span>{mensagemSucesso}</span>
              </div>
            </div>
          )}

          {/* Alerta de Limite Diário Atingido */}
          {statusPonto.limiteDiarioAtingido && (
            <div className="p-4 bg-green-100 border border-green-200 text-green-800 rounded-lg">
              <div className="flex items-center gap-2">
                <FaCheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <strong>Dia de trabalho completo!</strong>
                  <p className="text-sm mt-1">
                    Você registrou 4 pontos hoje. Próximos registros podem ser feitos amanhã,{' '}
                    <strong>{obterProximoHorarioPermitido()}</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col md:flex-row justify-between gap-4">
            <div className="flex-1 items-start">
              <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                Ponto Eletrônico
              </h1>
              <p className="text-gray-600 flex items-center gap-2">
                <FaUser className="text-gray-600" />
                {obterSaudacao()}, {nome || "Carregando..."}
              </p>
            </div>
            <div className="text-center md:text-right">
              <div className="text-3xl font-mono text-gray-800 font-bold flex items-center justify-center md:justify-flex gap-2">
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
          </div>

          {/* Conteúdo Principal */}
          <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col md:grid md:grid-cols-1 gap-6">
            {/* Painel de Registro */}
            <div className="flex flex-col">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FaClock className="text-2xl text-black-600" />
                Registrar Ponto
              </h2>

              {/* Botão de Registro Único */}
              <div className="space-y-4 flex mb-10 flex-col">
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
                <FaFileAlt className="text-2xl text-gray-600" />
                Registros de Hoje
              </h2>

              {registrosHoje.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FaLayerGroup className="mx-auto text-4xl text-gray-600" />
                  <p className="text-lg">Nenhum registro hoje</p>
                  <p className="text-sm mt-2">Registre sua entrada para começar</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {registrosHoje.map((registro, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border-l-4 transition-all duration-200 hover:shadow-md ${registro.tipo === 'entrada'
                        ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-500'
                        : 'bg-gradient-to-r from-red-50 to-red-100 border-red-500'
                        }`}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            {registro.tipo === 'entrada' ? (
                              <FaSignInAlt className="text-2xl text-green-600" />
                            ) : (
                              <FaSignOutAlt className="text-2xl text-red-600" />
                            )}
                            <span className="font-semibold capitalize text-gray-800 text-base">
                              {registro.tipo}
                            </span>
                          </div>
                          <div className="font-mono text-lg font-bold text-gray-800">
                            {formatarHora(registro.timestamp)}
                          </div>
                        </div>

                        {registro.enderecoAproximado && (
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-1 text-xs text-gray-600 flex-1">
                              <FaMapMarkerAlt className="text-gray-600 flex-shrink-0" />
                              <span className="break-words">
                                {obterEnderecoResumido(registro.enderecoAproximado)}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                              {registro.timestamp.toDate().toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
          <button
            onClick={logout}
            className="w-full md:w-auto bg-gradient-to-r from-gray-500 to-gray-600 mt-10 text-white px-6 py-3 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg flex items-center justify-center gap-2"
          >
            <FaLogout />
            Sair
          </button>
        </div>
      </div>
    </ProtectedRoute >
  );
}