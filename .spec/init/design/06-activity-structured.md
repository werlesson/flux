# 06 — Atividade em andamento (treino estruturado)

**US cobertas:** US-4.2, US-4.3, US-4.4
**Imagem:** ./06-activity-structured.png

## Propósito
Executar um treino guiado: etapa atual e tempo restante dominam a tela, com próxima etapa, repetição corrente e as métricas gerais abaixo.

## Elementos obrigatórios
- Nome do treino em rótulo: `TREINO DE EXEMPLO` e repetição corrente `3 de 6`
- Cartão da etapa atual: tipo `Corrida`, rótulo `ETAPA ATUAL`, tempo restante `01:12` (184 px @1080), barra de progresso da etapa e legenda `restam nesta etapa`
- Cartão `PRÓXIMA`: `Caminhada` `02:00`
- Métricas gerais: `TEMPO TOTAL` `00:18:42`, `DISTÂNCIA` `2,31 km`, `PACE MÉDIO` `8:11 /km`
- Dois botões lado a lado: `PAUSAR` e `PULAR ETAPA`
- Indicador de GPS

## Estados
### Rodando · boa precisão
Como na imagem, cartão da etapa em coral.
### Rodando · precisão degradada
Indicador ouro em faixa própria no lugar da linha simples; resto inalterado.
### Rodando · sem sinal
Indicador vermelho com o mesmo texto da tela 05; distância deixa de avançar. O motor de treino continua avançando as etapas (depende de tempo, não de GPS).
### Pausada
Selo `PAUSADA`; cartão da etapa em ouro com rótulo `ETAPA CONGELADA` e legenda `o motor de treino não avança em pausa`; ações passam a `RETOMAR` e `FINALIZAR TREINO`.
### Última etapa
`PRÓXIMA` é substituída por `Última etapa do treino`. Ao concluir, o app anuncia o fim e vai para a tela 08.

## Interações
- `PULAR ETAPA` → registra a etapa atual como `skipped` com a duração executada e inicia a próxima (US-4.3)
- `PAUSAR` / `RETOMAR` → congela e retoma cronômetro, coleta e motor de treino
- `FINALIZAR TREINO` → etapas restantes viram `not_performed`; vai para a tela 08 (US-4.4)

## Notas de implementação
- `3 de 6` vem de `activity_steps.repetition_index` sobre `repeat_count` do bloco; só é exibido quando a etapa corrente pertence a um bloco com `repeat_count > 1`.
- Progresso da etapa = `actual_duration_seconds / planned_duration_seconds`; a transição é disparada pelo motor por timestamps, funcionando com a tela bloqueada.
- Cada etapa concluída é persistida no momento da transição, com status `completed`, `skipped` ou `not_performed`.
- Tema claro: cartão da etapa atual `#FDEDE7` com borda `#D6431A`; pausada `#FDF3E0` com borda `#9A6B00`.
