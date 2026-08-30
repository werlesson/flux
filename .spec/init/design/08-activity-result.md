# 08 — Resultado da atividade

**US cobertas:** US-7.1, US-7.2
**Imagem:** ./08-activity-result.png

## Propósito
Retrato completo da atividade que acabou de terminar: métricas consolidadas, splits, percurso e, quando houver, execução das etapas.

## Elementos obrigatórios
- Título `Atividade concluída` e subtítulo `<origem> · 30 ago, 07:42` — origem é o nome do treino ou `Corrida livre`
- Destaques: `3,18 km` (`DISTÂNCIA`) e `29:41` (`TEMPO TOTAL`)
- Grade de métricas: `PACE MÉDIO` `9:20/km`, `MELHOR KM` `8:47/km`, `TEMPO CORRENDO` `17:22`, `TEMPO CAMINHANDO` `12:19`
- Mapa estático do percurso (polyline sobre os pontos válidos, enquadrando o trajeto inteiro)
- Seção `SPLITS`: `KM 1` `9:42`, `KM 2` `9:15`, `KM 3` `8:56` — melhor split destacado em ouro `#FFC857`
- Ações: `Avaliar esforço` (primária) e `Descartar atividade` (destrutiva)

## Estados
### Treino estruturado
Acrescenta a seção `ETAPAS EXECUTADAS · 14` com uma linha por etapa e status: `Concluída` (sálvia `#9BC7A8`), `Pulada` (ouro, com duração real sobre planejada, ex. `01:12/02:00`), `Não realizada` (cinza, linha esmaecida). A seção é encabeçada pela contagem `ETAPAS EXECUTADAS · 14` com a ação `Ver todas` à direita.
### Corrida livre
Sem a seção de etapas. Splits ganham a lista em linhas cheias e o mapa fica maior.
### Sem pontos válidos
O mapa é omitido e substituído pelo aviso `SEM PERCURSO PARA EXIBIR` com o texto `Nenhum ponto de GPS válido foi registrado nesta atividade, então o mapa não é exibido. O tempo gravado é mantido.` Distância `0,00 km`, `PACE MÉDIO` e `MELHOR KM` exibem `—`, e a seção de splits mostra `Nenhum quilômetro completo.`
### Menos de 1 km percorrido
Seção de splits mostra `Nenhum quilômetro completo.` e a distância parcial não gera split.

## Interações
- `Avaliar esforço` → tela 09
- `Descartar atividade` → tela 10 (confirmação)
- `Ver todas` → expande a lista completa das 14 etapas executadas
- Voltar do sistema → salva sem avaliação e vai para o histórico (equivale a `Salvar sem avaliar`)

## Notas de implementação
- Formatação: distância em km com vírgula e 2 casas; pace `mm:ss/km`; durações `mm:ss` até 59:59 e `hh:mm:ss` acima disso.
- `MELHOR KM` = `best_pace_seconds_per_km`, que corresponde ao melhor `activity_splits.pace_seconds_per_km`.
- O mapa usa somente `activity_points` com `is_valid = true`; lacunas de sinal não devem ser ligadas por segmento reto.
- `expo-maps` está em alpha na especificação: isolar a renderização do mapa em um componente único e degradar para o aviso de "sem percurso" em caso de falha.
- A data do exemplo (`30 ago, 07:42`) é ilustrativa; usar `started_at` formatado em pt-BR.
- Tema claro: cartões `#FFFFFF` sobre `#FBF7F2`; destaque de melhor split `#D6431A`.
