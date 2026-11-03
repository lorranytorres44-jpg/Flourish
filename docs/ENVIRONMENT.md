# Ambiente e Configuração de Execução — Flourish

> **Última atualização:** 03/11/2026  
> **Plataforma ativa:** Linux Ubuntu 24.04.1 LTS (Noble Numbat) x86_64  
> **Compatibilidade cruzada:** Windows 11 / Linux Ubuntu / macOS

---

## 1. Plataforma e Sistema Operacional
- **SO**: Linux Ubuntu 24.04 (Kernel 7.0.0-42-generic x86_64)
- **Shell**: bash / sh (Linux) | PowerShell / cmd (Windows)
- **Line Endings**: Padronizado via `.gitattributes` (`* text=auto eol=lf`)

---

## 2. Ferramentas Instaladas

| Ferramenta | Versão | Origem | Função | Desinstalação |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js** | `v22.23.4` | NodeSource (`deb.nodesource.com`) | Execução do servidor local e runner de testes | `sudo apt remove nodejs` |
| **npm** | `10.9.9` | NodeSource bundled | Gerenciamento de pacotes do projeto | Incluído no nodejs |
| **Python** | `3.12.3` | Repositório Ubuntu (`/usr/bin/python3`) | Scripts auxiliares, servidor HTTP e exportação | `sudo apt remove python3` |
| **Git** | `2.43.0` | Repositório Ubuntu (`/usr/bin/git`) | Controle de versão e sincronização com remotos | `sudo apt remove git` |
| **GitHub CLI** | `2.68.0` | Instalação local (`/home/nepo/.local/bin/gh`) | Operações no GitHub (PRs, releases) | `rm -f /home/nepo/.local/bin/gh` |

---

## 3. Variáveis de Ambiente e Autenticações
- **Firebase Auth & Firestore**: Integrados via SDK Web modular em `js/firebase.js` e credenciais públicas do app web em `js/firebase-config.js` (`projectId: biblioteca-76f0c`).
- **Google Books API**: Chave configurada em `js/firebase-config.js` para preenchimento de metadados por ISBN.
- **Porta Padrão Localhost**: `8080` (configurável via variável de ambiente `PORT`).

---

## 4. Scripts de Inicialização

- **Linux / macOS**:
  - Iniciar servidor: `./iniciar-localhost.sh`
  - Exportar sessão: `./exportar-sessao.sh`
- **Windows**:
  - Iniciar servidor: `iniciar-localhost.bat`
  - Exportar sessão: `exportar-sessao.bat`
