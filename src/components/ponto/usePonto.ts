import { useState, useCallback, useEffect } from 'react';
import { doc, updateDoc, arrayUnion, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface RegistroPonto {
  tipo: 'entrada' | 'saida';
  timestamp: Timestamp;
  data: string;
  latitude?: number;
  longitude?: number;
  precisao?: number;
  enderecoAproximado?: string;
}

export interface StatusPonto {
  podeRegistrarEntrada: boolean;
  podeRegistrarSaida: boolean;
  ultimoRegistro?: RegistroPonto;
  limiteDiarioAtingido: boolean;
  registrosRestantes: number;
}

export interface GeolocationStatus {
  obtendo: boolean;
  sucesso: boolean;
  erro: string | null;
  latitude?: number;
  longitude?: number;
  precisao?: number;
  permissaoNegada: boolean;
}

export interface UsePontoReturn {
  nome: string | null;
  cpf: string | null;
  registrosHoje: RegistroPonto[];
  statusPonto: StatusPonto;
  carregando: boolean;
  geolocationStatus: GeolocationStatus;
  registrarPonto: (tipo: 'entrada' | 'saida') => Promise<void>;
  carregarDados: () => Promise<void>;
}

export const usePonto = (): UsePontoReturn => {
  const [nome, setNome] = useState<string | null>(null);
  const [cpf, setCpf] = useState<string | null>(null);
  const [registrosHoje, setRegistrosHoje] = useState<RegistroPonto[]>([]);
  const [statusPonto, setStatusPonto] = useState<StatusPonto>({
    podeRegistrarEntrada: true,
    podeRegistrarSaida: false,
    limiteDiarioAtingido: false,
    registrosRestantes: 4,
  });
  const [carregando, setCarregando] = useState(false);
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>({
    obtendo: false,
    sucesso: false,
    erro: null,
    permissaoNegada: false,
  });

  const getLocalDateString = useCallback((): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const calcularStatusPonto = useCallback((registros: RegistroPonto[]) => {
    const ultimoRegistro = registros[registros.length - 1];
    const limiteDiarioAtingido = registros.length >= 4;
    const registrosRestantes = Math.max(0, 4 - registros.length);

    if (limiteDiarioAtingido) {
      setStatusPonto({ podeRegistrarEntrada: false, podeRegistrarSaida: false, ultimoRegistro, limiteDiarioAtingido: true, registrosRestantes: 0 });
    } else if (!ultimoRegistro) {
      setStatusPonto({ podeRegistrarEntrada: true, podeRegistrarSaida: false, limiteDiarioAtingido: false, registrosRestantes });
    } else if (ultimoRegistro.tipo === 'entrada') {
      setStatusPonto({ podeRegistrarEntrada: false, podeRegistrarSaida: true, ultimoRegistro, limiteDiarioAtingido: false, registrosRestantes });
    } else {
      setStatusPonto({ podeRegistrarEntrada: true, podeRegistrarSaida: false, ultimoRegistro, limiteDiarioAtingido: false, registrosRestantes });
    }
  }, []);

  const buscarDadosUsuario = useCallback(async (uid: string) => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("uid", "==", uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      setNome("Usuário não encontrado. Verifique o campo 'uid' no Firestore.");
      return;
    }

    const userDoc = snapshot.docs[0];
    const cpfEncontrado = userDoc.id;
    const userData = userDoc.data();

    setCpf(cpfEncontrado);
    setNome(userData.nome);

    const registrosPonto = userData.registrosPonto || {};
    const hoje = getLocalDateString();
    const registrosHojeLoaded: RegistroPonto[] = registrosPonto[hoje] || [];

    setRegistrosHoje(registrosHojeLoaded);
    calcularStatusPonto(registrosHojeLoaded);
  }, [getLocalDateString, calcularStatusPonto]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await buscarDadosUsuario(firebaseUser.uid);
      } else {
        setNome(null);
        setCpf(null);
        setRegistrosHoje([]);
      }
    });

    return () => unsubscribe();
  }, [buscarDadosUsuario]);


  const carregarDados = useCallback(async () => {
    try {
      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        return;
      }

      await buscarDadosUsuario(firebaseUser.uid);
    } catch (error) {
      console.error("Erro ao buscar dados do usuário:", error);
      setNome("Erro ao carregar dados");
    }
  }, [buscarDadosUsuario]);

  const obterGeolocalizacao = useCallback(async (): Promise<GeolocationPosition | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGeolocationStatus({ obtendo: false, sucesso: false, erro: 'Geolocalização não é suportada neste navegador', permissaoNegada: false });
        resolve(null);
        return;
      }

      setGeolocationStatus({ obtendo: true, sucesso: false, erro: null, permissaoNegada: false });

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          setGeolocationStatus({ obtendo: false, sucesso: true, erro: null, latitude, longitude, precisao: accuracy, permissaoNegada: false });
          resolve(position);
        },
        (error) => {
          let errorMessage = 'Erro desconhecido ao obter localização';
          let permissaoNegada = false;

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permissão de localização negada. Ative a localização nas configurações do navegador.';
              permissaoNegada = true;
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Localização indisponível. Verifique se o GPS está ativado.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Tempo limite para obter localização. Tente novamente.';
              break;
            default:
              errorMessage = `Erro ao obter localização: ${error.message}`;
          }

          setGeolocationStatus({ obtendo: false, sucesso: false, erro: errorMessage, permissaoNegada });

          if (!permissaoNegada) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                setGeolocationStatus({ obtendo: false, sucesso: true, erro: 'Localização obtida com precisão reduzida', latitude, longitude, precisao: accuracy, permissaoNegada: false });
                resolve(position);
              },
              () => resolve(null),
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
            );
          } else {
            resolve(null);
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  }, []);

  const obterEnderecoAproximado = useCallback(async (latitude: number, longitude: number): Promise<string | undefined> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'PontoApp/1.0' } }
      );
      const data = await response.json();
      if (data && data.address) {
        const rua = data.address.road || data.address.pedestrian || 'Rua desconhecida';
        const bairro = data.address.suburb || data.address.neighbourhood || 'Bairro desconhecido';
        return `${rua}, ${bairro}`;
      }
      return undefined;
    } catch (error) {
      console.warn('Erro ao obter endereço:', error);
      return undefined;
    }
  }, []);

  const registrarPonto = useCallback(async (tipo: 'entrada' | 'saida') => {
    if (!cpf) {
      throw new Error('CPF não encontrado. Recarregue a página.');
    }

    const hoje = getLocalDateString();

    if (registrosHoje.length >= 4) {
      throw new Error('Limite diário de registros atingido. Próximos registros só podem ser feitos amanhã.');
    }

    const ultimoRegistro = registrosHoje[registrosHoje.length - 1];

    if (ultimoRegistro && ultimoRegistro.tipo === tipo) {
      throw new Error(`Não é possível registrar ${tipo} consecutivamente`);
    }

    if (registrosHoje.length === 0 && tipo === 'saida') {
      throw new Error('O primeiro registro do dia deve ser uma entrada');
    }

    if (ultimoRegistro) {
      const agora = new Date();
      const diferencaMinutos = (agora.getTime() - ultimoRegistro.timestamp.toDate().getTime()) / (1000 * 60);
      if (diferencaMinutos < 1) {
        throw new Error('Aguarde pelo menos 1 minuto entre registros');
      }
    }

    setCarregando(true);

    try {
      const position = await obterGeolocalizacao();

      const novoRegistro: RegistroPonto = {
        tipo,
        timestamp: Timestamp.fromDate(new Date()),
        data: hoje,
      };

      if (position) {
        const { latitude, longitude, accuracy } = position.coords;
        novoRegistro.latitude = latitude;
        novoRegistro.longitude = longitude;
        novoRegistro.precisao = accuracy;

        const endereco = await obterEnderecoAproximado(latitude, longitude);
        if (endereco) novoRegistro.enderecoAproximado = endereco;
      }

      await updateDoc(doc(db, "users", cpf), {
        [`registrosPonto.${hoje}`]: arrayUnion(novoRegistro),
      });

      const novosRegistros = [...registrosHoje, novoRegistro];
      setRegistrosHoje(novosRegistros);
      calcularStatusPonto(novosRegistros);

    } catch (error) {
      console.error("Erro ao registrar ponto:", error);
      throw error;
    } finally {
      setCarregando(false);
    }
  }, [cpf, registrosHoje, getLocalDateString, obterGeolocalizacao, obterEnderecoAproximado, calcularStatusPonto]);

  return {
    nome,
    cpf,
    registrosHoje,
    statusPonto,
    carregando,
    geolocationStatus,
    registrarPonto,
    carregarDados,
  };
};