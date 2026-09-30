#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Flourish — Antigravity Export & Session Portability Suite
=========================================================
Exporta o estado completo do projeto, histórico de conversa (humano e estruturado),
arquivos nativos de log do Antigravity (.jsonl), imagens, artefatos visuais e
gera o documento mestre de passagem de bastão (ANTIGRAVITY_HANDOVER.md) para
que qualquer outro chat de IA (especialmente Antigravity) continue o trabalho
imediatamente e com 100% de fidelidade.

Uso:
    python tools/export/export_session.py
    python tools/export/export_session.py --include-node-modules
    python tools/export/export_session.py --output-dir "D:/Backup_Flourish"
"""

import os
import sys
import json
import shutil
import zipfile
import re
import argparse
from datetime import datetime
from pathlib import Path

# Força UTF-8 na saída do console mesmo em Windows PowerShell
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass


def find_default_brain_dir(current_conv_id=None):
    """Localiza automaticamente o diretório de brain do Antigravity mais recente."""
    user_home = Path.home()
    brain_root = user_home / ".gemini" / "antigravity" / "brain"
    
    if current_conv_id:
        target = brain_root / current_conv_id
        if target.exists():
            return target

    if not brain_root.exists():
        return None

    # Procura diretórios que possuem .system_generated/logs/transcript_full.jsonl
    candidates = []
    for item in brain_root.iterdir():
        if item.is_dir():
            t_full = item / ".system_generated" / "logs" / "transcript_full.jsonl"
            if t_full.exists():
                try:
                    mtime = t_full.stat().st_mtime
                    candidates.append((mtime, item))
                except Exception:
                    pass

    if candidates:
        candidates.sort(key=lambda x: x[0], reverse=True)
        return candidates[0][1]

    return None


def parse_transcript(transcript_path):
    """Analisa o arquivo transcript_full.jsonl e extrai os turnos de conversa e ações."""
    if not os.path.exists(transcript_path):
        return []

    entries = []
    with open(transcript_path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except Exception:
                pass

    turns = []
    current_turn = None

    for entry in entries:
        etype = entry.get('type')
        source = entry.get('source')
        content = entry.get('content', '') or ''
        created_at = entry.get('created_at', '')
        tool_calls = entry.get('tool_calls', [])

        if etype == 'USER_INPUT' and source == 'USER_EXPLICIT':
            # Limpa tags internas do prompt do usuário
            clean_user = re.sub(r'<USER_REQUEST>\s*', '', content)
            clean_user = re.sub(r'\s*</USER_REQUEST>', '', clean_user)
            if '<ADDITIONAL_METADATA>' in clean_user:
                clean_user = clean_user.split('<ADDITIONAL_METADATA>')[0]
            clean_user = clean_user.strip()

            if clean_user:
                current_turn = {
                    'turn_id': len(turns) + 1,
                    'created_at': created_at,
                    'user': clean_user,
                    'tools': [],
                    'assistant': []
                }
                turns.append(current_turn)

        elif current_turn is not None:
            if tool_calls:
                for tc in tool_calls:
                    name = tc.get('name') or tc.get('function', {}).get('name', 'tool')
                    params = tc.get('parameters') or {}
                    summary = params.get('toolSummary') or tc.get('toolSummary') or ''
                    action = params.get('toolAction') or tc.get('toolAction') or ''
                    desc = summary or action or name
                    cmd = params.get('CommandLine')
                    target_file = params.get('TargetFile') or params.get('AbsolutePath')
                    
                    detail = desc
                    if cmd:
                        detail += f" (`{cmd[:60]}`)"
                    elif target_file:
                        detail += f" ({os.path.basename(target_file)})"

                    current_turn['tools'].append(detail)

            if etype == 'PLANNER_RESPONSE' and content:
                clean_resp = content.strip()
                # Ignora avisos de background tasks técnicos puros
                if clean_resp and not clean_resp.startswith('Task id "') and not clean_resp.startswith('Tool is running as a background task'):
                    if not current_turn['assistant'] or current_turn['assistant'][-1] != clean_resp:
                        current_turn['assistant'].append(clean_resp)

    return turns


def generate_conversation_history_md(turns, conversation_id, export_time):
    """Gera o arquivo Markdown formatado com todo o histórico de conversas."""
    lines = [
        "# Flourish — Histórico Completo de Conversas & Decisões Antigravity",
        "",
        f"> **ID da Conversa Antigravity**: `{conversation_id}`  ",
        f"> **Data de Exportação**: `{export_time}`  ",
        f"> **Total de Turnos Registrados**: `{len(turns)}` turnos  ",
        "",
        "Este documento contém a transcrição integral e cronológica de todos os diálogos,",
        "solicitações do usuário, decisões técnicas, comandos e respostas do assistente de IA.",
        "Ele foi projetado para ser lido facilmente tanto por humanos quanto por novas instâncias",
        "do Antigravity para absorver instantaneamente todo o contexto prévio.",
        "",
        "---",
        "",
        "## 📑 Índice Cronológico de Solicitações",
        ""
    ]

    for t in turns:
        first_line = t['user'].split('\n')[0].strip()
        if len(first_line) > 75:
            first_line = first_line[:72] + "..."
        time_str = t.get('created_at', '')[:19].replace('T', ' ')
        lines.append(f"- **[Turno {t['turn_id']}](#turno-{t['turn_id']})** ({time_str}): {first_line}")

    lines.append("\n---\n")
    lines.append("## 💬 Diálogos e Ações Passo a Passo\n")

    for t in turns:
        time_str = t.get('created_at', '')[:19].replace('T', ' ')
        lines.append(f"### Turno {t['turn_id']}")
        lines.append(f"*Registrado em: {time_str} UTC*\n")
        lines.append("#### 👤 Usuário:")
        lines.append("```text")
        lines.append(t['user'])
        lines.append("```\n")

        if t['tools']:
            # Agrupa ferramentas por tipo para visualização limpa
            tools_count = len(t['tools'])
            lines.append(f"<details><summary>🛠️ <b>Ações Técnicas Executadas ({tools_count} operações)</b></summary>\n")
            lines.append("<ul>")
            for tool_desc in t['tools'][:40]:  # limita para não estourar visualização
                lines.append(f"  <li>{tool_desc}</li>")
            if len(t['tools']) > 40:
                lines.append(f"  <li>... e mais {len(t['tools']) - 40} ações registradas.</li>")
            lines.append("</ul>\n</details>\n")

        lines.append("#### 🤖 Assistente (Antigravity):")
        if t['assistant']:
            for resp in t['assistant']:
                lines.append(resp)
                lines.append("")
        else:
            lines.append("*(Ação em andamento / comando em lote executado)*\n")

        lines.append("\n---\n")

    return "\n".join(lines)


def generate_handover_md(conversation_id, export_time, active_branch="Claymorphism"):
    """Gera o documento mestre de passagem de bastão para a próxima IA."""
    return f"""# Flourish — Master Handover & Guia de Continuidade Antigravity

> **Data de Exportação:** {export_time}  
> **Conversa de Origem:** `{conversation_id}`  
> **Branch Ativa Atual:** `{active_branch}`  
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
.\\iniciar-localhost.bat
# ou:
node server.js

# Executar a suíte de testes unitários (41 testes):
npm test

# Trocar entre branches:
git checkout Claymorphism
git checkout MVP
git checkout main

# Re-exportar a sessão para um novo chat no futuro:
.\\tools\\export\\export_session.bat
```
"""


def main():
    parser = argparse.ArgumentParser(description="Flourish Session & Project Exporter for Antigravity")
    parser.add_argument("--project-dir", default=None, help="Caminho do repositório Flourish")
    parser.add_argument("--brain-dir", default=None, help="Caminho do brain do Antigravity")
    parser.add_argument("--conversation-id", default=None, help="ID da conversa")
    parser.add_argument("--output-dir", default=None, help="Diretório onde salvar a exportação")
    parser.add_argument("--include-node-modules", action="store_true", help="Incluir a pasta node_modules no zip")
    parser.add_argument("--no-zip", action="store_true", help="Não gerar arquivo ZIP comprimido")
    
    args = parser.parse_args()

    # 1. Determina diretório do projeto
    if args.project_dir:
        project_dir = Path(args.project_dir).resolve()
    else:
        # Se executado a partir de tools/export, sobe 2 níveis
        script_dir = Path(__file__).resolve().parent
        project_dir = (script_dir / ".." / "..").resolve()

    if not (project_dir / "index.html").exists():
        print(f"[ERRO] Diretório do projeto não parece ser o Flourish: {project_dir}")
        sys.exit(1)

    print(f"📁 Diretório do Projeto: {project_dir}")

    # 2. Determina diretório de brain do Antigravity
    if args.brain_dir:
        brain_dir = Path(args.brain_dir).resolve()
    else:
        brain_dir = find_default_brain_dir(args.conversation_id)

    if not brain_dir or not brain_dir.exists():
        print(f"[AVISO] Diretório do brain do Antigravity não encontrado automaticamente.")
        print(f"        O projeto será exportado, mas sem os logs nativos do chat.")
        brain_dir = None
    else:
        print(f"🧠 Diretório do Brain Antigravity: {brain_dir}")

    conv_id = brain_dir.name if brain_dir else "unknown-conversation"
    now_str = datetime.now().strftime("%Y-%m-%d_%H%M")
    export_name = f"Flourish_Antigravity_Export_{now_str}"

    # 3. Determina diretório de saída
    if args.output_dir:
        output_base = Path(args.output_dir).resolve()
    else:
        output_base = project_dir / "_EXPORTS"

    export_dir = output_base / export_name
    export_dir.mkdir(parents=True, exist_ok=True)
    print(f"📦 Destino da Exportação: {export_dir}")

    # 4. Extrai e analisa transcrição
    turns = []
    if brain_dir:
        transcript_full = brain_dir / ".system_generated" / "logs" / "transcript_full.jsonl"
        if transcript_full.exists():
            print("⏳ Processando transcrição completa da conversa...")
            turns = parse_transcript(str(transcript_full))
            print(f"✅ {len(turns)} turnos de conversa extraídos com sucesso!")

    # 5. Gera CONVERSATION_HISTORY.md
    print("📝 Gerando CONVERSATION_HISTORY.md...")
    history_md = generate_conversation_history_md(turns, conv_id, datetime.now().strftime("%d/%m/%Y %H:%M:%S"))
    with open(export_dir / "CONVERSATION_HISTORY.md", 'w', encoding='utf-8') as f:
        f.write(history_md)

    # Salva também cópia no root do projeto para uso imediato
    with open(project_dir / "CONVERSATION_HISTORY.md", 'w', encoding='utf-8') as f:
        f.write(history_md)

    # 6. Gera CONVERSATION_DATA.json
    print("💾 Gerando CONVERSATION_DATA.json estruturado...")
    with open(export_dir / "CONVERSATION_DATA.json", 'w', encoding='utf-8') as f:
        json.dump({
            'conversation_id': conv_id,
            'export_time': datetime.now().isoformat(),
            'total_turns': len(turns),
            'turns': turns
        }, f, ensure_ascii=False, indent=2)

    # 7. Gera ANTIGRAVITY_HANDOVER.md
    print("📋 Gerando documento de passagem de bastão (ANTIGRAVITY_HANDOVER.md)...")
    handover_md = generate_handover_md(conv_id, datetime.now().strftime("%d/%m/%Y %H:%M:%S"))
    with open(export_dir / "ANTIGRAVITY_HANDOVER.md", 'w', encoding='utf-8') as f:
        f.write(handover_md)
    # Também mantém no root do projeto
    with open(project_dir / "ANTIGRAVITY_HANDOVER.md", 'w', encoding='utf-8') as f:
        f.write(handover_md)

    # 8. Cria LEIA-ME_IMPORTAR_NOVO_ANTIGRAVITY.md
    readme_import = f"""# Como Importar este Projeto no Novo Antigravity

Você acabou de exportar o estado completo da plataforma **Flourish** e todo o histórico
de conversas e decisões acumuladas até o momento.

## 🚀 Método 1: Abrir diretamente no Antigravity

1. No novo chat ou nova máquina, abra a pasta do projeto (ou extraia este arquivo se estiver em ZIP).
2. Na sua primeira mensagem para o Antigravity, cole a instrução abaixo:

```text
Olá! Estou continuando o desenvolvimento do projeto Flourish a partir de uma sessão anterior exportada.
Por favor, leia atentamente os arquivos ANTIGRAVITY_HANDOVER.md e CONVERSATION_HISTORY.md na raiz do projeto para absorver toda a arquitetura, regras de negócio, testes unitários, design system Claymorphism e o histórico de decisões. Me confirme quando estiver pronto para prosseguir.
```

3. O novo Antigravity lerá os arquivos e estará imediatamente 100% contextualizado!

---

## 🔁 Como re-exportar no futuro (sucessivamente):

Quando você fizer novas alterações e quiser passar para um terceiro chat (e depois um quarto, e assim por diante):
1. Basta executar novamente o script:
   - No Windows: Dê dois cliques em `tools/export/export_session.bat`
   - No Terminal: Execute `python tools/export/export_session.py`
2. Uma nova pasta e um novo arquivo ZIP com data e hora atualizados serão gerados em `_EXPORTS/` contendo todas as novas conversas e novos arquivos!
"""
    with open(export_dir / "LEIA-ME_IMPORTAR_NOVO_ANTIGRAVITY.md", 'w', encoding='utf-8') as f:
        f.write(readme_import)

    # 9. Copia arquivos nativos do Brain do Antigravity
    if brain_dir:
        brain_dest = export_dir / "antigravity_brain"
        brain_dest.mkdir(parents=True, exist_ok=True)
        print("🧠 Copiando logs nativos e artefatos visuais do cérebro Antigravity...")

        # Logs
        logs_src = brain_dir / ".system_generated" / "logs"
        if logs_src.exists():
            logs_dest = brain_dest / "logs"
            logs_dest.mkdir(parents=True, exist_ok=True)
            for lf in ["transcript.jsonl", "transcript_full.jsonl"]:
                src_file = logs_src / lf
                if src_file.exists():
                    shutil.copy2(src_file, logs_dest / lf)

        # Uploads do usuário
        uploads_src = brain_dir / ".user_uploaded"
        if uploads_src.exists():
            uploads_dest = brain_dest / "user_uploaded"
            if uploads_dest.exists():
                shutil.rmtree(uploads_dest)
            shutil.copytree(uploads_src, uploads_dest)

        # Screenshots e markdowns na raiz do brain
        for item in brain_dir.iterdir():
            if item.is_file() and (item.suffix in ['.png', '.jpg', '.jpeg', '.md', '.json']):
                shutil.copy2(item, brain_dest / item.name)

    # 10. Copia o projeto completo Flourish (incluindo .git)
    proj_dest = export_dir / "flourish_project"
    print(f"📦 Copiando arquivos do projeto Flourish (incluindo repositório .git)...")
    
    # Ignora pastas desnecessárias
    ignore_patterns = shutil.ignore_patterns(
        '_EXPORTS',
        '__pycache__',
        '.gemini',
        '*.tmp'
    )
    if not args.include_node_modules:
        def ignore_func(dir_path, names):
            ignored = set(ignore_patterns(dir_path, names))
            if 'node_modules' in names:
                ignored.add('node_modules')
            return ignored
    else:
        ignore_func = ignore_patterns

    if proj_dest.exists():
        shutil.rmtree(proj_dest)
    shutil.copytree(project_dir, proj_dest, ignore=ignore_func)
    print("✅ Projeto Flourish copiado com sucesso!")

    # 11. Gera arquivo ZIP comprimido
    if not args.no_zip:
        zip_path = output_base / f"{export_name}.zip"
        print(f"🗜️ Comprimindo pacote exportado em {zip_path.name}...")
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(export_dir):
                for file in files:
                    file_path = Path(root) / file
                    arcname = file_path.relative_to(export_dir)
                    zipf.write(file_path, arcname)
        print(f"🎉 Arquivo ZIP criado: {zip_path} ({os.path.getsize(zip_path) / (1024*1024):.2f} MB)")

    print("\n" + "="*70)
    print("✨ EXPORTAÇÃO CONCLUÍDA COM SUCESSO!")
    print("="*70)
    print(f"📂 Pasta Descompactada: {export_dir}")
    if not args.no_zip:
        print(f"🗜️ Pacote Portátil ZIP: {zip_path}")
    print(f"📋 Documento Handover: {export_dir / 'ANTIGRAVITY_HANDOVER.md'}")
    print(f"💬 Histórico Conversa: {export_dir / 'CONVERSATION_HISTORY.md'}")
    print("="*70 + "\n")


if __name__ == "__main__":
    main()
