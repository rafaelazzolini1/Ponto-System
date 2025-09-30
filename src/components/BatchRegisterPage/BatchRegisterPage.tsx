"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { ProtectedRoute } from "../../hooks/RoleBasedRedirect";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import Cookies from "js-cookie";

interface RegistroPonto {
  tipo: 'entrada' | 'saida';
  timestamp: Timestamp;
  data: string;
} 

interface User {
  cpf: string;
  nome: string;
}

interface BatchRegistro {
  tipo: 'entrada' | 'saida';
  hora: string; // Formato HH:mm
}

export default function BatchRegisterPage() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [registros, setRegistros] = useState<BatchRegistro[]>([
    { tipo: "entrada", hora: "" },
  ]);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Carregar lista de usuários do Firestore
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersCollection = await getDocs(collection(db, "users"));
        const usersList: User[] = usersCollection.docs.map((doc) => ({
          cpf: doc.id,
          nome: doc.data().nome,
        }));
        setUsers(usersList);
      } catch (error) {
        setMensagemErro("Erro ao carregar usuários");
        console.error(error);
      }
    };
    fetchUsers();
  }, []);

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

  // Adicionar novo campo de registro
  const adicionarRegistro = () => {
    const ultimoRegistro = registros[registros.length - 1];
    const novoTipo = ultimoRegistro?.tipo === "entrada" ? "saida" : "entrada";
    setRegistros([...registros, { tipo: novoTipo, hora: "" }]);
  };

  // Remover um registro
  const removerRegistro = (index: number) => {
    setRegistros(registros.filter((_, i) => i !== index));
  };

  // Atualizar tipo ou hora de um registro
  const atualizarRegistro = (index: number, campo: keyof BatchRegistro, valor: string) => {
    const novosRegistros = [...registros];
    novosRegistros[index] = { ...novosRegistros[index], [campo]: valor };
    setRegistros(novosRegistros);
  };

  // Validar e registrar múltiplos pontos
  const handleRegistrarPontos = async () => {
    if (!selectedUser || !selectedDate) {
      setMensagemErro("Selecione um funcionário e uma data");
      return;
    } 

    if (registros.length > 4) {
      setMensagemErro("Não é possível registrar mais de 4 pontos por dia");
      return;
    }

    // Validar formato de hora e ordenação
    const registrosOrdenados = [...registros].sort((a, b) => a.hora.localeCompare(b.hora));
    for (let i = 0; i < registrosOrdenados.length; i++) {
      const hora = registrosOrdenados[i].hora;
      if (!/^\d{2}:\d{2}$/.test(hora)) {
        setMensagemErro(`Hora inválida no registro ${i + 1}: ${hora}`);
        return;
      }

      // Validar alternância de tipos
      if (i > 0 && registrosOrdenados[i].tipo === registrosOrdenados[i - 1].tipo) {
        setMensagemErro("Não é possível registrar entrada/saída consecutivamente");
        return;
      }

      // Validar intervalo mínimo de 1 minuto entre registros
      if (i > 0) {
        const [horaAtual, minAtual] = registrosOrdenados[i].hora.split(":").map(Number);
        const [horaAnterior, minAnterior] = registrosOrdenados[i - 1].hora.split(":").map(Number);
        const diffMinutos =
          (horaAtual * 60 + minAtual) - (horaAnterior * 60 + minAnterior);
        if (diffMinutos < 1) {
          setMensagemErro("Intervalo mínimo de 1 minuto entre registros");
          return;
        }
      }
    }

    setCarregando(true);
    try {
      const registrosPonto: RegistroPonto[] = registrosOrdenados.map((reg) => {
        const [ano, mes, dia] = selectedDate.split("-").map(Number);
        const [hora, minuto] = reg.hora.split(":").map(Number);
        const timestamp = new Date(ano, mes - 1, dia, hora, minuto);
        return {
          tipo: reg.tipo,
          timestamp: Timestamp.fromDate(timestamp),
          data: selectedDate,
        };
      });

      // Atualizar no Firestore
      await updateDoc(doc(db, "users", selectedUser), {
        [`registrosPonto.${selectedDate}`]: arrayUnion(...registrosPonto),
      });

      setMensagemSucesso("Registros salvos com sucesso!");
      setRegistros([{ tipo: "entrada", hora: "" }]); // Resetar formulário
    } catch (error) {
      setMensagemErro("Erro ao salvar registros");
      console.error(error);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Mensagens de Feedback */}
          {mensagemErro && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg animate-pulse">
              <div className="flex items-center gap-2">
                <span className="text-lg">❌</span>
                <span>{mensagemErro}</span>
              </div>
            </div>
          )}
          {mensagemSucesso && (
            <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg animate-pulse">
              <div className="flex items-center gap-2">
                <span className="text-lg">✅</span>
                <span>{mensagemSucesso}</span>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                  Registro em Lote de Pontos
                </h1>
                <p className="text-gray-600">Adicione múltiplos registros de ponto para um funcionário</p>
              </div>
              <button
                onClick={logout}
                className="bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg"
              >
                Sair
              </button>
            </div>
          </div>

          {/* Formulário */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">📅</span>
              Registrar Pontos em Lote
            </h2>

            {/* Seleção de Funcionário e Data */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Funcionário
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione um funcionário</option>
                  {users.map((user) => (
                    <option key={user.cpf} value={user.cpf}>
                      {user.nome} ({user.cpf})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Data
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Registros */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-700 mb-4">
                Registros de Ponto
              </h3>
              {registros.map((registro, index) => (
                <div key={index} className="flex items-center gap-4 mb-4">
                  <select
                    value={registro.tipo}
                    onChange={(e) =>
                      atualizarRegistro(index, "tipo", e.target.value as "entrada" | "saida")
                    }
                    className="p-3 border rounded-lg w-1/3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={index > 0} // Apenas o primeiro pode mudar o tipo
                  >
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                  </select>
                  <input
                    type="time"
                    value={registro.hora}
                    onChange={(e) => atualizarRegistro(index, "hora", e.target.value)}
                    className="p-3 border rounded-lg w-1/3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => removerRegistro(index)}
                    className="p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300"
                    disabled={registros.length === 1}
                  >
                    Remover
                  </button>
                </div>
              ))}
              <button
                onClick={adicionarRegistro}
                className="mt-2 p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
                disabled={registros.length >= 4}
              >
                Adicionar Registro
              </button>
            </div>

            {/* Botão de Envio */}
            <button
              onClick={handleRegistrarPontos}
              disabled={carregando || !selectedUser || !selectedDate || registros.some((r) => !r.hora)}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all duration-300 ${
                carregando || !selectedUser || !selectedDate || registros.some((r) => !r.hora)
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:shadow-xl transform hover:-translate-y-1 active:scale-95"
              }`}
            >
              {carregando ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Salvando...
                </div>
              ) : (
                "Salvar Registros"
              )}
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}