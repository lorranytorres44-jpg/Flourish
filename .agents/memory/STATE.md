# Estado do Projeto — Flowrish

> **Última atualização:** 03/11/2026  
> **Branch Ativa:** `Claymorphism`  
> **Testes Unitários:** 41/41 Aprovados (Vitest)  
> **Ambiente Operacional:** Linux Ubuntu 24.04 (compatível com Windows 11)  
> **Persistência:** Firebase Auth + Cloud Firestore (`biblioteca-76f0c`)  

---

## Resumo Arquitetural
- **Frontend**: Vanilla JavaScript (ES Modules), HTML5, CSS3 Tokens (Claymorphism Soft 3D, Dark Olive `#43442A`, Rosa Antigo `#DF949D`).
- **Zero Mocks**: Sem dados simulados no runtime; catálogo e perfis conectados a dados reais do Firestore. Reputação de usuários sem avaliações exibe "Novo leitor" sem estrelas falsas. Placeholders usam SVG local (`assets/sem-capa.svg`).
- **Servidor Local**: Porta `8080` (iniciável via `./iniciar-localhost.sh` no Linux ou `iniciar-localhost.bat` no Windows).

---

## Branches Principais
- `Claymorphism`: Versão mais recente e completa (Design System Soft 3D, remoção de mocks, adaptação Linux e suíte de exportação).
- `MVP`: Versão anterior contendo as 11 regras de negócio e testes.
- `main`: Versão base estável sincronizada com os repositórios remotos.
