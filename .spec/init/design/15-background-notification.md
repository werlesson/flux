# 15 — Notificação persistente (tela bloqueada)

**US cobertas:** US-6.1
**Imagem:** ./15-background-notification.png

## ⚠️ Decisão de escopo — ações e estados adiados para depois do MVP

O `expo-location` expõe **apenas quatro campos** para a notificação do foreground service: `notificationTitle`, `notificationBody`, `notificationColor` e `killServiceOnDestroy`. Não há suporte a botões de ação, nem à flag `ongoing`, nem forma documentada de atualizar o conteúdo com o serviço em execução.

A única saída para entregar esta tela como desenhada seria **patchear o código Kotlin do `expo-location`** — o que foi tentado e descartado: acopla o projeto a um fork de biblioteca nativa, quebra a cada atualização do SDK, e exige `expo-notifications` só para construir os intents.

**Fica no MVP:** a notificação persistente com título e métricas, definida ao iniciar a atividade.

**Fica para depois do MVP:** os botões `PAUSAR`/`RETOMAR` e `FINALIZAR`, a linha de contexto atualizada em tempo real, e as variações por estado (pausada, sem sinal). O corredor desbloqueia o aparelho para controlar a atividade.

O restante deste documento descreve o alvo completo e permanece válido como referência para quando o tema for retomado.

## Propósito
Mostrar que a atividade continua com o celular no bolso, e dar controle sem desbloquear — a notificação do foreground service exigida no Android.

## Elementos obrigatórios
- Tela de bloqueio com hora e data
- Notificação do app com identificação `Flux · agora`
- Título `Atividade em andamento`
- Linha de métricas `2,31 km · 00:18:42`
- Linha de contexto `Corrida · 3 de 6 · faltam 01:12`
- Ações na notificação: `PAUSAR` e `FINALIZAR`
- Nota de comportamento: a notificação não pode ser dispensada enquanto a atividade existir

## Estados
### Corrida livre
A linha de contexto é omitida; ficam distância e tempo.
### Pausada
Título passa a `Atividade pausada`; a ação `PAUSAR` passa a `RETOMAR`; as métricas ficam congeladas.
### Sem sinal de GPS
A linha de contexto ganha o sufixo `· sem sinal`; o tempo continua avançando.

## Interações
- `PAUSAR` / `RETOMAR` → mesmo efeito dos botões da tela 05/06, sem desbloquear
- `FINALIZAR` → encerra a coleta e deixa a atividade pronta para a tela 08 na próxima abertura
- Toque no corpo da notificação → abre a tela 05 ou 06

## Notas de implementação
- Requer foreground service com `ACCESS_BACKGROUND_LOCATION` e development build (`expo-location` + `expo-task-manager`); não funciona em Expo Go.
- Atualizar o conteúdo da notificação em intervalo fixo e barato; o cronômetro exibido deriva de timestamps, como na tela de atividade.
- A notificação é `ongoing` (não dispensável) e deve sobreviver a otimizações de bateria do fabricante.
- Esta tela foi acrescentada à lista original: a US-6.1 pede a notificação persistente, que nenhuma das 13 telas cobria.
- Tema claro: a notificação segue o tema do sistema Android; o conteúdo textual é o mesmo.
