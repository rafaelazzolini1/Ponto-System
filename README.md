# Ponto System

O sistema de controle de ponto eletrônico foi desenvolvido para o controle e otimização dos processos de entrada e saída de funcionários de uma pequena empresa. Os registros são realizados através de um interface web/mobile. 
O principal objetivo do projeto era solucionar o problema de registros manuais por uma abordagem simplificada e dinâmica, além de estudo de tecnologias.

## Tecnologias

- **Next.js 15.0.5**
- **TypeScript**
- **Firebase** - Autenticação e banco de dados
- **Tailwind CSS** - Estilização

## Funcionalidades

- Registro de entrada e saída de funcionários
- Autenticação de usuários via Firebase
- Histórico de pontos registrados
- Painel administrativo para gestão
- Cálculo automático de horas trabalhadas
- Exportação de relatórios

## Estrutura do Projeto

```
ponto-system/
├── public/                     # Arquivos estáticos (imagens, ícones, etc)
├── src/                        # Código-fonte da aplicação
│   ├── app/                    # App Router do Next.js
│   │   ├── admin-dashboard/    # Painel administrativo (gestão de usuários e relatórios)
│   │   ├── api/                # API Routes (endpoints do backend)
│   │   ├── batch-register/     # Registro em lote de funcionários
│   │   ├── login/              # Página de autenticação
│   │   ├── ponto/              # Registro de ponto dos funcionários
│   │   ├── layout.tsx          # Layout global da aplicação
│   │   └── page.tsx            # Página inicial (dashboard ou redirect)
│   ├── components/             # Componentes React reutilizáveis
│   ├── hooks/                  # Custom hooks React
│   ├── lib/                    # Configurações e utilitários (Firebase, helpers)
│   └── types/                  # Definições de tipos TypeScript
└── middleware.ts               # Middleware para autenticação e proteção de rotas
```

## Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/rafaelazzolini1/Ponto-System.git
cd Ponto-System
```

### 2. Instale as dependências

```bash
npm install
# ou
yarn install
# ou
pnpm install
```

### 3. Configure as variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto baseado no `.env.example`:

```bash
cp .env.example .env.local
```

Preencha as variáveis com suas credenciais do Firebase:

- **Client-side**: Obtidas no Console do Firebase > Project Settings > General
- **Server-side**: Obtidas no Console do Firebase > Project Settings > Service Accounts

### 4. Execute o projeto

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## Firebase Setup

### Client SDK (Frontend)

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Crie um projeto ou selecione um existente
3. Adicione um app web
4. Copie as configurações e adicione ao `.env.local` com o prefixo `NEXT_PUBLIC_`

### Admin SDK (Backend)

1. No Firebase Console, vá em Project Settings > Service Accounts
2. Clique em "Generate new private key"
3. Extraia as seguintes informações do JSON:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`

**⚠️ Importante**: Mantenha as credenciais privadas seguras e nunca as comita no repositório.

## Como Funciona

### Autenticação

O sistema utiliza Firebase Authentication para gerenciar usuários. O fluxo é:

1. Usuário faz login com email/senha
2. Token JWT é gerado pelo Firebase
3. Token é armazenado no cliente
4. Requisições à API incluem o token para validação

### Registro de Ponto

1. Usuário autenticado acessa o dashboard
2. Clica em "Registrar Ponto"
3. Sistema captura timestamp atual
4. Registro é salvo no Firestore com:
   - ID do usuário
   - Tipo (entrada/saída)
   - Data e hora
   - Localização (opcional)

### Cálculo de Horas

O sistema calcula automaticamente:
- Horas trabalhadas por dia
- Total semanal e mensal
- Horas extras
- Atrasos e faltas

## Scripts

```bash
npm run dev      # Inicia servidor de desenvolvimento
npm run build    # Cria build de produção
npm run start    # Inicia servidor de produção
npm run lint     # Executa linter
```

### Vercel

1. Conecte o repositório no [Vercel](https://vercel.com)
2. Configure as variáveis de ambiente
3. Deploy automático a cada push

