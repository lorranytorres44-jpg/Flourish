# Estado do Projeto — Flowrish

> **Data de Atualização:** 03 de Novembro de 2026  
> **Versão:** 1.2.0 (Claymorphism Soft 3D Release)  
> **Status:** Conforme & Estável  
> **Branch Ativa:** `integrate-whatsapp-claymorphism` (a ser integrada à `main`, `MVP` e `Claymorphism`)  

---

## 1. Visão Geral da Arquitetura
- **Frontend**: Vanilla JavaScript (ES Modules nativos sem bundlers), HTML5 semântico, CSS3 com variáveis de design tokens (Claymorphism Soft 3D).
- **Backend / Persistência**: Firebase Authentication + Cloud Firestore (`biblioteca-76f0c`).
- **Mecanismo de Troca**: Conexão ágil e descentralizada via WhatsApp (`whatsappUrl`) combinando livros anunciados no acervo.
- **Avaliações**: Sistema livre de reputação de perfil (`ratings`), permitindo que leitores avaliem uns aos outros após a troca com réplica do dono do perfil.
- **Design System**: Claymorphism Soft 3D com paleta oliva escuro (`#43442A` / `#353620`), rosa antigo (`#DF949D`) e creme (`#F7EFDA`), suporte a temas claro/escuro persistente e sombras suaves `inset` e `drop-shadow`.

---

## 2. Inventário de Páginas e Rotas
1. `index.html` — Vitrine de livros em destaque (carrossel), hero com flor 3D animada e navegação.
2. `biblioteca.html` — Catálogo completo com busca em tempo real, filtros por gênero e conservação.
3. `livro.html` — Página detalhada do livro com galeria de fotos, informações do leitor anunciante e modal de proposta de troca via WhatsApp.
4. `cadastrar-livro.html` — Formulário de anúncio de livro com pré-visualização instantânea e upload de fotos.
5. `acervo.html` — Painel do usuário para visualização, edição e exclusão de seus livros anunciados.
6. `anunciante.html` — Perfil público do anunciante com catálogo de livros e avaliações recebidas.
7. `perfil.html` — Perfil do usuário logado (dados pessoais, biografia, telefone/WhatsApp, avaliações e configurações).
8. `ajuda.html` — Central de ajuda com perguntas frequentes e orientações de segurança.
9. `login.html` / `cadastro.html` / `redefinir-senha.html` — Telas de autenticação com validação e medidor de força de senha.

---

## 3. Estado das Suítes de Teste
- **Testes Unitários (Vitest)**: 9/9 testes aprovados em `tests/unit/` (validadores de telefone WhatsApp e lógica de domínio).
- **Regras do Firestore**: Cobertura em `tests/rules/firestore.rules.test.js`.
