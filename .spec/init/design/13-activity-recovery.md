# 13 — Recuperação de atividade interrompida

**US cobertas:** US-6.3
**Imagem:** ./13-activity-recovery.png

## Propósito
Ao abrir o app com uma atividade sem `finished_at`, oferecer retomar ou finalizar com o que já foi gravado — sem permitir ignorar a decisão.

## Elementos obrigatórios
- Diálogo modal sobre a tela 01, com véu escuro
- Selo `ATIVIDADE NÃO FINALIZADA`
- Título `Você tem uma corrida interrompida`
- Texto `O app foi encerrado durante a atividade. Tudo que havia sido gravado até ali está salvo.`
- Quadro com o que existe no banco: `Iniciada 30 ago, 07:42`, `Distância 2,31 km`, `Tempo 00:18:42`, `Etapa Corrida · 3 de 6`
- Ações `Retomar atividade` (primária) e `Finalizar com o que foi gravado`
- O diálogo não é dispensável: sem toque fora e sem botão fechar

## Estados
### Atividade de corrida livre
A linha `Etapa` é omitida.
### Sem pontos gravados
`Distância` exibe `0,00 km`; as duas ações continuam disponíveis.

## Interações
- `Retomar atividade` → tela 05 ou 06 com cronômetro, distância, splits e etapa corrente continuando de onde pararam; o foreground service sobe novamente
- `Finalizar com o que foi gravado` → consolida as métricas existentes, grava `finished_at` e vai para a tela 08
- Botão voltar do sistema → não fecha o diálogo

## Notas de implementação
- Detecção na abertura: `activities` com `finished_at IS NULL`. Enquanto existir, nenhuma nova atividade pode ser iniciada (US-6.3).
- Ao retomar, o tempo entre o encerramento e a reabertura conta para `elapsed` mas não para `moving`; não inventar pontos nem distância para o intervalo.
- Ao finalizar, etapas não executadas viram `not_performed`, como na tela 06.
- Tema claro: diálogo `#FFFFFF`, selo `#9A6B00`.
