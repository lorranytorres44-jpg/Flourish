# AGENTS.md — Flowrish
> Manual de operação para agentes de IA que atuam no repositório.

## Projeto
Plataforma colaborativa e sustentável para troca de livros físicos entre leitores, combinada de forma ágil via WhatsApp.
- **Stack**: Vanilla JavaScript (ES Modules nativos sem bundlers), HTML5, CSS3 Tokens (Claymorphism Soft 3D), Firebase Auth, Cloud Firestore, Vitest.
- **Mantenedores**: Lorrany Torres, Nepotira
- **Licença**: MIT (SPDX: `MIT`)

## Perfil do Projeto
- **Tipo**: Aplicação Web Frontend SPA/MPA leve conectada a BaaS (Firebase).
- **Equipe**: Pequena (revisão e integração por Pull Request).
- **Risco de Ações**: Médio (banco de dados real com leitores e acervos cadastrados; proibido qualquer dado mockado ou simulado em código de produção).
- **Distribuição**: Repositório público no GitHub com releases SemVer.
- **Plataforma de Trabalho**: Linux Ubuntu 24.04 & Windows 11 (scripts duplos `.sh` e `.bat`).
- **Compilação**: Sem build pesado; executa nativamente via `server.js` em Node.js ou servidor Python.

## Comandos Operacionais (Manter sempre verdadeiros)
- **Instalar Dependências**: `npm install`
- **Rodar Servidor Local**: `./iniciar-localhost.sh` (Linux) ou `iniciar-localhost.bat` (Windows)
- **Testar**: `npm test` (roda Vitest em `tests/unit/`)
- **Exportar Sessão / Memória**: `./exportar-sessao.sh` (Linux) ou `exportar-sessao.bat` (Windows)

## Regras Essenciais
1. **Zero Mocks**: Proibido qualquer array simulado ou dado fictício em código de produção. Fallbacks devem ser estáticos e locais (`assets/sem-capa.svg`).
2. **Conventional Commits**: `tipo(escopo): descrição imperativa em inglês ou português`.
3. **SemVer 2.0.0**: Toda release segue SemVer formal (`vMAJOR.MINOR.PATCH`). O histórico é mantido em `CHANGELOG.md` no padrão Keep a Changelog.
4. **Governança e Memória**: Atualizar `.agents/memory/STATE.md`, `HANDOFF.md` e `LESSONS.md` a cada ciclo relevante.
5. **Segurança**: Nunca comitar credenciais, chaves privadas ou tokens no Git.

## Mapa da Documentação
- `README.md` — Apresentação oficial, funcionalidades, instalação e uso.
- `CHANGELOG.md` — Histórico completo de versões e alterações.
- `LICENSE` / `NOTICE` / `THIRD_PARTY_LICENSES.md` — Atribuições e licenciamento.
- `CONTRIBUTING.md` / `SECURITY.md` — Políticas comunitárias e de segurança.
- `docs/PROJECT_STATE.md` — Arquitetura detalhada, catálogo de rotas e cobertura de testes.
- `docs/ENVIRONMENT.md` — Registro de ferramentas e dependências de sistema instaladas.
