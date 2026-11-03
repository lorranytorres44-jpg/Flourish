# Flourish — Master Handover & Guia de Continuidade Antigravity

> **Data de Exportação:** 03/11/2026 09:46:09  
> **Conversa de Origem:** `0d03b789-350b-4d6c-8228-429bd8b728c6`  
> **Branch Ativa Atual:** `Claymorphism`  
> **Status dos Testes Unitários:** 41/41 Aprovados (Vitest)  
> **Porta Padrão Localhost:** `8080` (`http://localhost:8080`)  

---

## 🎯 Instrução Imediata para o Novo Chat de IA

Se você é uma nova instância do **Antigravity** (ou outro modelo de IA) recebendo este projeto:

1. **Você está assumindo o projeto Flourish exatamente de onde parou.**
2. **Leia este documento (`ANTIGRAVITY_HANDOVER.md`) e o `DESIGN.md`.**
3. O histórico completo de tudo que o usuário já pediu e do que foi respondido está no arquivo [`CONVERSATION_HISTORY.md`](CONVERSATION_HISTORY.md).
4. O projeto possui **3 branches principais**:
   - `main`: Versão inicial / base sincronizada com o GitHub.
   - `MVP`: Versão com as 11 alterações de negócio entregues, modo escuro/claro funcional, cache de favoritos e 41 testes unitários aprovados.
   - `Claymorphism`: Versão mais recente e recomendada, que aplica o **Design System Soft 3D Claymorphic** (Dark Olive `#43442A`, Rosa Antigo `#DF949D`, Fredoka/Nunito, pílula deslizante na navbar e botões táteis).
5. **Para re-exportar no futuro**: Quando o usuário quiser passar para mais outro chat, basta executar `tools/export/export_session.bat` (ou `python tools/export/export_session.py`).

---

## 🏗️ Arquitetura do Sistema Flourish

- **Tipo:** Plataforma P2P para troca de livros físicos e catálogo comunitário.
- **Frontend:** Vanilla JavaScript modular (ES Modules `import/export`), HTML5 semântico, CSS com Custom Properties (design tokens semânticos).
- **Backend / Persistência:**
  - Firebase Authentication (Google Popup + E-mail/Senha + Recuperação de Senha).
  - Cloud Firestore (coleções `books`, `trades`, `users`, `notifications`, subcoleções `favorites` e `readList`).
  - Cache em memória no cliente (`bookCache`) para navegação instantânea.
- **Servidor Local:**
  - `server.js` (Node.js nativo sem dependências externas adicionais).
  - `server.py` (Python nativo `http.server`).
  - `iniciar-localhost.bat` (Inicializador automático para Windows com detecção de portas e abertura de navegador).
- **Testes:**
  - Vitest v3 (`npm test` executa 41 testes em `tests/unit/correios.test.js`, `validators.test.js`, `trade-logic.test.js`).

---

## 🌳 Mapeamento de Branches Git & Repositórios

- **Repositórios Remotos Conectados:**
  - `origin`: `https://github.com/lorranytorres44-jpg/Flourish.git`
  - `myfork`: `https://github.com/nepotira/Flourish.git`
- **Branches Disponíveis:**
  - `Claymorphism` *(Ativa)*: Design system novo completo, logos `assets/logo-horizontal.png`, `DESIGN.md`.
  - `MVP`: Versão funcional completa antes do design novo.
  - `main`: Versão estável base.

---

## 📜 Resumo Cronológico das Evoluções do Projeto

1. **Configuração de Ambiente e Git**: Configuração do GitHub CLI (`gh`), autenticação com nepotira e sincronização com o repositório principal de Lorrany Torres.
2. **Branch MVP e Regras de Negócio**:
   - Criação da branch `MVP`.
   - Adição do botão "Excluir Conta" com remoção de dados no Firestore e Auth.
   - Regra de exclusão automática do livro após conclusão de troca.
   - Campo "Ponto de Encontro / Agência dos Correios" no fluxo de troca.
   - Bloqueio de troca para usuários sem endereço cadastrado com modal de redirecionamento.
   - Validador de CEP com máscara e busca automática via ViaCEP.
   - Exibição de avaliações do anunciante e estado de conservação no card do livro.
   - Múltiplos gêneros no cadastro de livros.
   - Exclusão de livros cadastrados pelo próprio usuário com confirmação em modal.
   - Botão "Esqueci minha senha" funcional integrado ao Firebase.
3. **Cache de Performance & Experiência de Usuário**:
   - Resolução de lentidão ao navegar entre abas do dashboard implementando cache em memória `bookCache` e listener unificado de favoritos.
4. **Bateria de Testes Unitários (41 Testes)**:
   - Implementação de suite completa de testes em Vitest cobrindo lógica de frete dos Correios, validadores de CEP/e-mail/senha e regras de negócio de troca P2P.
5. **Modo Escuro / Claro (Dark Mode)**:
   - Implementação de alternador de tema com persistência em `localStorage` (`tdl_theme`), sem flashes brancos no carregamento (`data-theme`), sincronização entre abas.
6. **Automação de Inicialização (`iniciar-localhost.bat`)**:
   - Script batch inteligente com detecção automática de Node.js e Python, mantendo terminal aberto e abrindo `http://localhost:8080`.
7. **Rework Completo de Design — Claymorphism Soft 3D**:
   - Localização dos arquivos originais de design (`Flourish_old_august`).
   - Criação da branch `Claymorphism`.
   - Reintegração dos logos vetorizados e transparentes com flor no "Fl🌸wrish".
   - Tipografia `Fredoka` e `Nunito`.
   - Paleta Dark Olive (`#43442A`), Rosa Antigo (`#DF949D`) e relevos 3D táteis (`inset shadow` superior + inferior + `drop shadow`).
   - Criação da especificação [`DESIGN.md`](DESIGN.md).
   - Validação visual completa via Selenium em headless Chrome.

---

## 🛠️ Comandos Rápidos

```powershell
# Iniciar o servidor local na porta 8080:
.\iniciar-localhost.bat
# ou:
node server.js

# Executar a suíte de testes unitários (41 testes):
npm test

# Trocar entre branches:
git checkout Claymorphism
git checkout MVP
git checkout main

# Re-exportar a sessão para um novo chat no futuro:
.\tools\export\export_session.bat
```
