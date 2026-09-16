# Flourish — Design System Guidelines (Claymorphism Soft 3D & Dark Olive)

Este documento estabelece a especificação completa do Design System **Claymorphism Soft 3D** da plataforma **Flourish**, combinando a estética orgânica Dark Olive, Rosa Antigo, relevos táteis tridimensionais (claymorphic), tipografia arredondada e acolhedora (`Fredoka` & `Nunito`), e suporte completo a temas Claro e Escuro.

---

## 🌸 1. Identidade Visual & Logotipos

A identidade visual da Flourish é fundamentada na metáfora de florescimento, comunidade leitora e afeto pelo livro físico.

| Elemento | Arquivo | Aplicação Principal |
| :--- | :--- | :--- |
| **Logo Horizontal** | `assets/logo-horizontal.png` | Navbar principal e cabeçalhos em desktop/mobile |
| **Logomarca Ilustrada** | `assets/logomarca.png` | Hero section (`index.html`), telas de auth e rodapé |
| **Ícone / Favicon** | `assets/logo.png` | Favicon do navegador (`16x16`, `32x32`), badges e micro-ícones |
| **Variações em Creme** | `assets/logo-horizontal-creme.png`, `assets/logomarca-creme.png` | Aplicações sobre fundos escuros / contrastantes |
| **Variações em Marrom/Verde**| `assets/logo-horizontal-marrom.png`, `assets/logo-horizontal-verde.png` | Materiais impressos e exportações vetoriais |

---

## 🎨 2. Paleta de Cores e Tokens CSS

As variáveis estão padronizadas em `css/variables.css` utilizando a estratégia de tokens semânticos (`--bg`, `--surface`, `--text`, `--primary`, etc.).

### 2.1 Tema Principal — Dark Olive Organic

| Variável | Valor Hex | Função Semântica |
| :--- | :--- | :--- |
| `--bg` | `#43442A` | Fundo principal da página (Verde Oliva Orgânico Profundo) |
| `--surface` | `#4E5032` | Superfície de containers, navbar e rodapé |
| `--surface-card` | `#585A39` | Cards de livros, painéis e caixas de conteúdo |
| `--surface-elevated` | `#636541` | Modais suspensos, dropdowns e popovers |
| `--border` | `#6D6F49` | Bordas suaves estruturais |
| `--text` | `#FBF6EB` | Texto primário de alto contraste (Creme Claro) |
| `--text-secondary` | `#DDD7C6` | Texto secundário (Areia Acolhedor) |
| `--text-muted` | `#B5AFA0` | Legendas, metadados e textos atenuados |
| `--primary` | `#DF949D` | Cor primária de destaque (Rosa Antigo suave) |
| `--primary-hover` | `#E8A6AF` | Rosa Antigo hover com elevação |
| `--primary-text` | `#38191D` | Cor do texto com legibilidade sobre o botão rosa |
| `--secondary` | `#E3BBBD` | Ações secundárias e badges suaves |
| `--accent` | `#F7EFDA` | Destaques luminosos e tags especiais |

### 2.2 Tema Alternativo — Claro (Light Theme)

| Variável | Valor Hex | Função Semântica |
| :--- | :--- | :--- |
| `--bg` | `#F5F2EB` | Fundo creme claro natural |
| `--surface` | `#FFFFFF` | Superfície limpa de cards e containers |
| `--surface-card` | `#FAF8F5` | Cartões e painéis com contraste suave |
| `--border` | `#E2DCD2` | Bordas estruturais areia |
| `--text` | `#2D2A26` | Texto primário escuro de leitura confortável |
| `--text-secondary` | `#6B665E` | Texto de apoio e descrições |
| `--primary` | `#DF949D` | Rosa Antigo de assinatura mantido |
| `--primary-hover` | `#D3838D` | Ajuste de contraste para hover em fundo claro |

---

## 📐 3. Tipografia

- **Títulos (`<h1>`, `<h2>`, `<h3>`, `<h4>`, `.eyebrow`)**:
  - **Família**: `'Fredoka', -apple-system, sans-serif`
  - **Pesos**: `500` (médio), `600` (semi-bold), `700` (bold)
  - **Características**: Geometria amigável, terminações suaves e sensação acolhedora ("friendly soft geometry").
- **Texto Corrido, Botões e Controles (`<body>`, `<p>`, `input`, `button`)**:
  - **Família**: `'Nunito', -apple-system, sans-serif`
  - **Pesos**: `400` (regular), `600` (semi-bold), `700` (bold)
  - **Características**: Excelente legibilidade em telas móveis e desktop, ritmo tipográfico humanista.

---

## 🫧 4. Física do Claymorphism (Sombras 3D Soft)

O estilo **Claymorphism** reproduz a sensação de objetos feitos de argila macia ou borracha inflável, obtido através da combinação de sombras projetadas suaves (`drop-shadow` difusas) e reflexos internos (`inset shadow` superior claro e inferior escuro).

### 4.1 Botão 3D Primário (`.btn-primary`)
```css
background: var(--primary); /* #DF949D */
color: var(--primary-text); /* #38191D */
border-radius: 9999px;
border: none;
font-weight: 700;
box-shadow: 
  inset 0 2px 4px rgba(255, 255, 255, 0.45),
  inset 0 -3px 5px rgba(0, 0, 0, 0.22),
  0 6px 16px rgba(25, 26, 15, 0.35);
transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease;
```
*No estado `:active`:*
```css
transform: translateY(2px) scale(0.98);
box-shadow: 
  inset 0 2px 3px rgba(0, 0, 0, 0.3),
  inset 0 -1px 2px rgba(255, 255, 255, 0.2),
  0 2px 6px rgba(25, 26, 15, 0.3);
```

### 4.2 Cards de Livro e Painéis (`.book-card`, `.card`)
```css
background: var(--surface-card);
border-radius: 20px;
border: 1px solid rgba(255, 255, 255, 0.08);
box-shadow: 
  inset 0 1px 2px rgba(255, 255, 255, 0.12),
  0 8px 24px rgba(20, 21, 12, 0.25);
```

### 4.3 Inputs Côncavos Recortados (`.form-control`, `input`, `select`)
```css
background: #3B3C24; /* Recuo escuro para sensação de profundidade */
border: 1px solid var(--border);
border-radius: 14px;
color: var(--text);
box-shadow: 
  inset 0 2px 5px rgba(0, 0, 0, 0.4),
  0 1px 2px rgba(255, 255, 255, 0.04);
```

---

## 🧭 5. Componentes de Interface & Navbar

1. **Sliding Pill Indicator (`.nav-pill-slider`)**:
   - Um pílula flutuante que desliza dinamicamente abaixo ou ao redor do link ativo na navbar, calculando coordenadas via `getBoundingClientRect()`.
2. **Pílula de Pontos (`.nav-points-pill`)**:
   - Exibe o saldo do leitor: `🌸 10 pts` em relevo 3D tátil.
3. **Pílula de Perfil (`.nav-avatar-btn`)**:
   - Pílula compacta contendo avatar circular e chevron animado.
4. **Alternador de Tema (`.theme-toggle-btn`)**:
   - Botão circular claymorphic com ícone `☀️ / 🌙` e suporte a transição fluida.
5. **Colunas de Troca no Detalhe do Livro (`.trade-modal-grid`)**:
   - Layout de dupla coluna destacando o livro solicitado à esquerda e a seleção do acervo próprio à direita.

---

## ⚡ 6. Regras de Código e Manutenibilidade

- **Zero Breaking Changes**: Qualquer novo componente deve preservar contratos de eventos, IDs e integrações com o Firebase e regras de negócio.
- **Transições Suaves**: Utilizar preferencialmente curvas cúbicas amigáveis (`cubic-bezier(0.34, 1.56, 0.64, 1)` para saltos elásticos e `ease` para fundos).
- **Acessibilidade**: Contrastes validados WCAG AA (texto `#FBF6EB` sobre fundo `#43442A` e texto `#38191D` sobre `#DF949D`). Todos os links interativos possuem `:focus-visible` com anel de foco visível.
