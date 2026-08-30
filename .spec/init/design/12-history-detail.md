# 12 — Detalhe da atividade

**US cobertas:** US-8.2, US-8.3, US-8.4
**Imagem:** ./12-history-detail.png

## Propósito
Revisitar uma corrida com o mesmo nível de informação do dia em que foi feita, e completar ou corrigir a avaliação subjetiva.

## Elementos obrigatórios
- Cabeçalho com data e hora da atividade (`30 ago, 07:42`) e ação `Excluir`
- Origem: nome do treino ou `Corrida livre`
- Destaques `3,18 km` e `29:41`, e a mesma grade de métricas da tela 08
- Mapa estático do percurso
- Seção `SPLITS`
- Seção `ETAPAS EXECUTADAS · 14` resumida em contagens: `11 concluídas`, `2 puladas`, `1 não realizada`, com ação `Ver todas`
- Seção `ESFORÇO PERCEBIDO` com valor `6/10`, rótulo da faixa (`Controlado`), observações e ação `Editar`

## Estados
### Avaliada
Como no primeiro quadro: RPE e observações exibidos, ação `Editar`.
### Pendente de avaliação
No lugar da seção de esforço, faixa ouro com `PENDENTE DE AVALIAÇÃO`, texto `Esta atividade foi salva sem esforço percebido. Você pode preencher agora — as métricas objetivas não mudam.` e botão `Avaliar esforço`. Após o preenchimento a atividade deixa de ser pendente aqui e na tela 11.
### Corrida livre
Sem a seção de etapas executadas. Splits podem terminar com uma célula `0,31 km · sem split` indicando a distância parcial que não fechou quilômetro.
### Sem pontos válidos
Mapa omitido com o mesmo aviso da tela 08.
### Confirmação de exclusão
Diálogo `Excluir esta atividade?` com texto `Os pontos de GPS e os splits também serão apagados. Não é possível desfazer.` e ações `Excluir` / `Cancelar`.

## Interações
- `Editar` / `Avaliar esforço` → abre a tela 09 em modo de edição, pré-preenchida quando houver valor
- `Ver todas` → lista completa das etapas executadas com status e duração real
- `Excluir` → confirmação; ao confirmar, apaga em cascata e volta para a tela 11
- Nenhuma métrica objetiva é editável em qualquer estado

## Notas de implementação
- As contagens de etapas vêm de `activity_steps` agrupadas por `step_execution_status_id`; 11 + 2 + 1 = 14 no exemplo.
- Excluir a atividade não afeta o treino da biblioteca que a originou.
- Funciona offline; nenhum dado desta tela depende de rede além dos tiles do mapa, que devem degradar sem quebrar o layout.
- Tema claro: igual à tela 08, com a faixa de pendência `#9A6B00` sobre `#FDF3E0`.
