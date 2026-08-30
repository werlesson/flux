# 02 — Biblioteca de treinos

**US cobertas:** US-1.1, US-1.3, US-1.4
**Imagem:** ./02-training-library.png

## Propósito
Listar os treinos criados pelo usuário com nome, número de etapas e duração estimada, e dar acesso a criar, editar e excluir.

## Elementos obrigatórios
- Cabeçalho `Biblioteca de treinos` com voltar
- Cartão por treino contendo: nome (`Treino de exemplo`), linha de metadados `4 etapas · 34 min estimados`, resumo compacto das etapas em chips e menu `⋮`
- Chips do resumo, na ordem das etapas: `5 min caminhada`, `6× 2 min corrida + 2 min caminhada`, `5 min caminhada`
- Botão primário fixo `Novo treino`

## Estados
### Com treinos
Lista ordenada por atualização mais recente. Cada cartão é tocável (executar) e o `⋮` abre editar/excluir.

### Estado vazio
Sem cartões. Título `Nenhum treino salvo` e texto `Monte um treino com etapas de corrida e caminhada para o app conduzir a sessão no lugar de você cronometrar.` O botão `Novo treino` permanece.

### Confirmação de exclusão (US-1.4)
Diálogo com título `Excluir este treino?`, texto `As atividades já realizadas com ele continuam no histórico.`, ações `Excluir` (destrutiva) e `Cancelar`.

### Treino em execução
Se existe atividade em andamento vinculada a um treino, esse treino aparece com rótulo `Em execução` e as ações editar e excluir ficam desabilitadas (US-1.3, US-1.4).

## Interações
- Toque no cartão → tela 04 (pré-início)
- `⋮` → `Editar` (tela 03) e `Excluir` (confirmação)
- `Novo treino` → tela 03 vazia, com o campo de nome em foco

## Notas de implementação
- Contagem de etapas = número de linhas de `training_steps` do treino (4 no exemplo), **não** a sequência executável expandida (14). A duração estimada usa `estimated_duration_seconds` já materializado, exibido em minutos inteiros quando múltiplo de 60.
- Bloco com `repeat_count > 1` é renderizado como `N× <etapas separadas por " + ">`; bloco com `repeat_count = 1` renderiza só a etapa.
- Listar apenas `deleted_at IS NULL`.
- Tema claro: cartões `#FFFFFF` sobre `#FBF7F2`, chips `#F3EAE0`.
