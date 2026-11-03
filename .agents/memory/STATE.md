# Estado do Projeto — Flowrish

> **Última atualização:** 03/11/2026  
> **Versão:** 1.2.0 (Claymorphism Soft 3D)  
> **Testes Unitários:** 9/9 Aprovados (Vitest)  
> **Ambiente Operacional:** Linux Ubuntu 24.04 & Windows 11  
> **Persistência:** Firebase Auth + Cloud Firestore (`biblioteca-76f0c`)  
> **Referência Detalhada:** `docs/PROJECT_STATE.md` e `CHANGELOG.md`

---

## Destaques da Versão
- **Design System Claymorphism Soft 3D**: Interface completa com estética 3D tátil, paleta oliva/creme/rosa e alternância de temas claro/escuro.
- **Arquitetura Oficial de Trocas**: Fluxo de troca via WhatsApp conectando leitores pelo acervo pessoal.
- **Multiplataforma**: Scripts executáveis nativos no Linux (`iniciar-localhost.sh`, `exportar-sessao.sh`) e Windows.
- **Zero Mocks**: Todos os dados provêm de Firestore e APIs reais, com fallbacks estáticos locais em SVG (`assets/sem-capa.svg`).
