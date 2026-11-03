# 🌸 Flowrish

> **Plataforma comunitária e colaborativa para troca de livros físicos entre leitores, com combinação direta pelo WhatsApp e interface Claymorphism Soft 3D.**

[![Release SemVer](https://img.shields.io/badge/release-v1.2.0-DF949D.svg?style=flat-square)](CHANGELOG.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-43442A.svg?style=flat-square)](LICENSE)
[![Tests: Vitest](https://img.shields.io/badge/tests-9%20passed-6FA779.svg?style=flat-square)](tests/unit/)
[![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-F7EFDA.svg?style=flat-square&logoColor=353620)](#instalação-e-execução)
[![Design: Claymorphism](https://img.shields.io/badge/design-Claymorphism%20Soft%203D-DF949D.svg?style=flat-square)](#design-system-claymorphism-soft-3d)

---

## 📖 Sobre o Projeto

O **Flowrish** nasceu para dar nova vida a livros físicos parados na estante. Através de um catálogo interativo, leitores podem anunciar suas obras, descobrir novos títulos e propor trocas livro por livro diretamente pelo WhatsApp, promovendo a sustentabilidade, a economia circular e o acesso democrático à leitura.

O projeto foi construído sem frameworks pesados de frontend (Vanilla ES Modules puro), garantindo performance extrema, carregamento instantâneo e total portabilidade multiplataforma.

---

## ✨ Principais Funcionalidades

- **Biblioteca Interativa**: Catálogo completo com busca em tempo real por título/autor e filtros combinados por gênero literário, conservação e origem.
- **Troca Descomplicada pelo WhatsApp**:
  - Modal inteligente na página do livro onde o interessado seleciona qual livro do seu próprio acervo deseja oferecer em troca.
  - Geração automática de link do WhatsApp com mensagem de respeito padronizada e recomendação do método seguro **Clique e Retire** dos Correios.
- **Meu Acervo**: Painel exclusivo para o leitor gerenciar suas obras anunciadas, editar dados ou remover anúncios após a troca.
- **Perfil do Anunciante & Avaliações Reais**:
  - Página pública do leitor exibindo sua bio, localização e acervo disponível.
  - Sistema de reputação autêntico (sem notas fictícias): avaliações de 1 a 5 estrelas entre leitores com espaço para réplica do anunciante.
- **Design System Claymorphism Soft 3D**:
  - Estética visual orgânica com sombras suaves `inset` e `drop-shadow` em dupla camada, bordas arredondadas e cliques táteis.
  - Alternância instantânea entre **Modo Claro** e **Modo Escuro** com persistência em `localStorage`.
- **Zero Mocks**:
  - Todo o sistema opera com dados autênticos do Firebase Firestore (`biblioteca-76f0c`) e metadados oficiais via Google Books API.
  - Fallback local de capas em SVG nativo ([`assets/sem-capa.svg`](assets/sem-capa.svg)), dispensando serviços externos instáveis.

---

## 🎨 Design System: Claymorphism Soft 3D

O Flowrish adota uma identidade visual autoral baseada no conceito **Soft 3D / Claymorphism**:

| Elemento | Especificação / Token | Efeito Visual |
|---|---|---|
| **Verde Oliva** | `#43442A` / `#353620` | Conforto visual e base acolhedora |
| **Rosa Antigo** | `#DF949D` / `#C97E87` | Botões táteis com relevo e micro-interações |
| **Creme Suave** | `#F7EFDA` / `#FBF6EB` | Tipografia calorosa e superfícies táteis |
| **Sombras Clay** | Inset highlights + drop shadows | Sensação física de toque e profundidade |

---

## 🚀 Instalação e Execução

### Pré-requisitos
- **Node.js** 20+ (LTS) e **npm**
- **Git**

### Passo a Passo

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/nepotira/Flourish.git
   cd Flourish
   ```

2. **Instale as dependências de desenvolvimento**:
   ```bash
   npm install
   ```

3. **Inicie o servidor local**:
   - **Linux / macOS**:
     ```bash
     ./iniciar-localhost.sh
     ```
   - **Windows**:
     Dê dois cliques em `iniciar-localhost.bat` ou execute no terminal:
     ```cmd
     iniciar-localhost.bat
     ```

4. **Acesse a aplicação**:
   Abra seu navegador em [http://localhost:8080](http://localhost:8080).

---

## 🧪 Testes Automatizados

O Flowrish utiliza **Vitest** para assegurar a corretude dos validadores e regras de negócio:

```bash
# Executa todos os testes unitários
npm test
```

Evidência atual de verificação:
```text
✓ tests/unit/validators.test.js (5 tests)
✓ tests/unit/theme-and-data.test.js (4 tests)
Test Files: 2 passed (2) | Tests: 9 passed (9)
```

---

## 📁 Estrutura de Pastas

```text
Flourish/
├── .agents/memory/         # Memória viva do projeto (STATE, HANDOFF, LESSONS)
├── .github/                # Configurações do GitHub (Dependabot, templates, CODEOWNERS)
├── assets/                 # SVGs nativos, logos em alta resolução e termos PDF
├── css/                    # Folhas de estilo modulares
│   ├── animations.css      # Efeitos de flutuação e transições 3D
│   ├── base.css            # Tipografia e reset
│   ├── components.css      # Botões táteis, cards, inputs e modais
│   ├── variables.css       # Tokens de cor e sombras Claymorphism
│   └── pages/              # Estilos específicos por página
├── docs/                   # Documentação técnica e registros de ambiente
│   ├── ENVIRONMENT.md      # Registro do ambiente operacional
│   └── PROJECT_STATE.md    # Estado da arquitetura e rotas
├── js/                     # Módulos JavaScript (ES Modules nativos)
│   ├── acervo.js           # Gerenciamento de acervo do usuário
│   ├── anunciante.js       # Perfil público do anunciante
│   ├── book-actions.js     # Ações de edição, exclusão e proposta
│   ├── book-card.js        # Componente de cartão de livro
│   ├── reviews.js          # Módulo de avaliações de perfil
│   ├── storage.js          # Integração Firestore e Firebase Auth
│   ├── theme.js            # Controle de tema claro/escuro
│   └── validators.js       # Validação de telefone e URLs de WhatsApp
├── tests/unit/             # Suíte de testes unitários Vitest
├── CHANGELOG.md            # Histórico de lançamentos (Keep a Changelog + SemVer)
├── CONTRIBUTING.md         # Guia de contribuição para a comunidade
├── LICENSE                 # Licença oficial MIT
├── NOTICE                  # Avisos de direitos autorais
├── SECURITY.md             # Política de reporte de segurança
├── server.js               # Servidor local Node.js nativo (sem bundlers)
└── index.html              # Página inicial da plataforma
```

---

## 📜 Governança e Licença

Distribuído sob a licença **MIT**. Veja o arquivo [`LICENSE`](LICENSE) para mais detalhes.

- **Histórico de Mudanças**: consulte o [`CHANGELOG.md`](CHANGELOG.md).
- **Como Contribuir**: leia nosso guia em [`CONTRIBUTING.md`](CONTRIBUTING.md).
- **Segurança**: conheça nossa política em [`SECURITY.md`](SECURITY.md).
- **Documentação de Terceiros**: consulte [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).

---

Criado com carinho por **Lorrany Torres** e **Nepotira** 🌸
