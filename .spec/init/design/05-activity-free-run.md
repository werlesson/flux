# 05 — Atividade em andamento (corrida livre)

**US cobertas:** US-2.3, US-2.4, US-3.2
**Imagem:** ./05-activity-free-run.png

## Propósito
Tela consultada por alguém correndo: tempo e distância legíveis de relance, pace secundário, um alvo de toque grande e o estado do GPS.

## Elementos obrigatórios
- Rótulo do contexto: `CORRIDA LIVRE`
- Tempo decorrido `00:18:42` em tipografia dominante (208 px @1080), com rótulo `TEMPO`
- Distância `2,31 km` (192 px @1080), com rótulo `DISTÂNCIA`
- `Pace atual` `8:06 /km` e `Pace médio` `8:11 /km`
- Botão `PAUSAR` de largura cheia, altura 264 px @1080 (~132 dp)
- Indicador de GPS: `GPS: boa precisão`

## Estados
### Rodando · boa precisão
Como na imagem. Indicador verde `GPS: boa precisão`.
### Rodando · precisão degradada
Indicador ouro `GPS: precisão degradada` dentro de uma faixa `#2A1F0C`. Métricas continuam sendo atualizadas.
### Rodando · sem sinal
Indicador vermelho `GPS: sem sinal` com texto `O tempo continua contando. A distância volta a avançar quando o sinal retornar.` A distância fica cinza e o rótulo passa a `DISTÂNCIA · SEM AVANÇAR`; `Pace atual` exibe `—`.
### Pausada
Selo `PAUSADA` ao lado do rótulo do contexto; tempo em ouro com rótulo `TEMPO · PARADO`; `Pace atual` exibe `—`; `PAUSAR` é substituído por `RETOMAR` (primário) e `FINALIZAR` (contorno, vermelho).

## Interações
- `PAUSAR` → estado pausada: cronômetro para, nenhum ponto entra no percurso
- `RETOMAR` → volta ao estado rodando de onde parou
- `FINALIZAR` → consolida métricas e vai para a tela 08
- Tela bloqueada → a atividade continua; ver tela 15

## Notas de implementação
- Cronômetro derivado de timestamps (`started_at` + soma das pausas), nunca de contagem de ticks; recalcular ao voltar do background.
- `Pace atual` usa janela recente de amostras válidas; `Pace médio` usa `distance` e `moving_duration` acumulados. Exibir `—` quando não houver base suficiente.
- Três estados do indicador derivam da `accuracy` média das amostras recentes, não de uma leitura isolada. Sem amostra válida por um intervalo → `sem sinal`.
- Tempo pausado conta para `elapsed_duration_seconds` e não para `moving_duration_seconds`.
- Manter a tela acesa é opcional; o design assume brilho alto e contraste máximo (texto `#FAF3E6` sobre `#15100F`).
- Tema claro: fundo `#FFFFFF`, números `#1A120E`, verde `#D6431A`, âmbar `#9A6B00`, vermelho `#C0392B` — mesma hierarquia de tamanhos.
