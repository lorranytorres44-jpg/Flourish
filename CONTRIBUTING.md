# Como Contribuir para o Flowrish

Agradecemos o interesse em colaborar com o Flowrish! Este projeto incentiva a leitura e a circulação sustentável de livros físicos.

## Fluxo de Contribuição
1. **Abra uma Issue**: Descreva o problema encontrado ou a melhoria proposta antes de iniciar o código.
2. **Crie uma Branch**:
   - Para tarefas novas: `git switch -c feat/nome-da-tarefa`
   - Para correções de bugs: `git switch -c fix/nome-do-bug`
   - Em caso de fork externo: faça um fork do repositório primeiro via `gh repo fork --clone`.
3. **Padrão de Commits**:
   - Utilize [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/): `tipo(escopo): descrição imperativa curta em inglês ou português`.
   - Exemplos: `feat(acervo): adicionar filtro por conservacao`, `fix(auth): corrigir foco no input de senha`.
4. **Verificação Obrigatória**:
   - Execute os testes automatizados antes de abrir o PR:
     ```bash
     npm test
     ```
   - Certifique-se de que não há dados mockados ou credenciais expostas no código.
5. **Abra o Pull Request**:
   - Envie seu ramo: `git push -u origin SEU-RAMO`
   - Abra o PR com o GitHub CLI ou pela interface web:
     ```bash
     gh pr create --fill
     ```
   - Preencha os campos do modelo de Pull Request.

## Direitos Autorais e Licenciamento
Ao enviar código para o Flowrish:
- Você declara possuir o direito autoral sobre o material fornecido ([Developer Certificate of Origin](https://developercertificate.org/)).
- Você concorda que seu trabalho seja disponibilizado sob a licença [MIT](LICENSE) do projeto.
- Não copie trechos de código ou imagens sem a devida licença e atribuição registrada em `THIRD_PARTY_LICENSES.md`.
