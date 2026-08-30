# 03 — Editor de treino

**US cobertas:** US-1.1, US-1.2, US-1.3
**Imagem:** ./03-training-editor.png

## Propósito
Montar e alterar um treino: nome, etapas ordenadas com tipo e duração, blocos de repetição, com duração estimada recalculada a cada mudança.

## Elementos obrigatórios
- Cabeçalho `Editar treino` (ou `Novo treino`) com voltar e ação `Salvar`
- Campo `NOME` com o valor `Treino de exemplo`
- Seção `ETAPAS` com uma linha por etapa: alça de arraste `≡`, barra colorida do tipo, nome do tipo, duração em `mm:ss`, remover `✕`
- Bloco de repetição: cabeçalho `6× repetições` com ação `Desagrupar` e as etapas filhas recuadas
- Botão `+ Adicionar etapa`
- Barra inferior fixa: `DURAÇÃO ESTIMADA` + valor `34:00`
- Sheet `Nova etapa` com seção `TIPO` listando exatamente `Aquecimento`, `Corrida`, `Caminhada`, `Recuperação`, `Desaquecimento`, seção `DURAÇÃO` com seletor `min`/`s` e botão `Adicionar`

## Estados
### Treino vazio
Nenhuma linha de etapa; texto `Adicione a primeira etapa` no lugar da lista. `Salvar` desabilitado (US-1.1: treino sem etapas não pode ser salvo).
### Nome vazio
`Salvar` desabilitado, campo com borda de erro e mensagem `Informe um nome para o treino`.
### Duração inválida
Duração `00:00` bloqueia a adição, com mensagem `A duração precisa ser maior que zero`.
### Seleção múltipla para agrupar
Ao selecionar duas ou mais etapas consecutivas aparece a ação `Agrupar em bloco` e um campo de repetições com mínimo 2 (US-1.2).
### Bloco com repetições inválidas
Valor 1 ou menor bloqueia a confirmação, com mensagem `O bloco precisa repetir ao menos 2 vezes`.

## Interações
- Arrastar `≡` → reordena etapas; dentro do bloco a reordenação é local ao bloco
- `✕` → remove a etapa e recalcula a duração estimada imediatamente
- `Desagrupar` → devolve as etapas filhas à sequência linear, na mesma posição
- `+ Adicionar etapa` → abre o sheet `Nova etapa`
- `Adicionar` no sheet → insere a etapa ao fim da lista (ou ao fim do bloco, se o bloco estiver em foco)
- `Salvar` → persiste e volta para a tela 02

## Notas de implementação
- Duração estimada = soma de `duration_seconds` de cada bloco multiplicada pelo seu `repeat_count`. No exemplo: 300 + 6×(120+120) + 300 = 2040 s → `34:00`. Recalcular no cliente a cada alteração e materializar em `training_sessions.estimated_duration_seconds` ao salvar.
- Cores por tipo de etapa (usadas em todas as telas): aquecimento `#A89684`, corrida `#FF5E3A`, caminhada `#FFC857`, recuperação `#9BC7A8`, desaquecimento `#C79BB0`.
- Uma etapa solta é um `training_block` com `repeat_count = 1`; nunca gravar `training_steps` fora de um bloco.
- Editar um treino não altera `activity_steps` de atividades passadas (snapshot).
- Tema claro: mesmas cores de tipo, superfícies `#FFFFFF`, sheet `#FFFFFF` com sombra e véu `rgba(0,0,0,0.4)`.
