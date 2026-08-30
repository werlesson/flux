# 14 — Orientações por áudio e vibração

**US cobertas:** US-5.1, US-5.2, US-5.3
**Imagem:** ./14-audio-cues.png

## Propósito
Controlar locução e vibração durante a atividade e deixar explícito quando o app avisa — a tela que a US-5.1 exige ao permitir desativar o áudio mantendo a vibração.

## Elementos obrigatórios
- Sheet sobre a tela de atividade, título `Orientações`
- Linha `Locução` com legenda `voz em pt-BR` e interruptor
- Linha `Vibração` com legenda `continua com a locução desligada` e interruptor
- Seção `QUANDO O APP AVISA` com os três gatilhos, numerados: `Início e fim de cada etapa`, `30 segundos antes do fim da etapa`, `A cada quilômetro completo, com o pace do split`
- Caixa de exemplos das locuções: `“Comece a correr.”`, `“Faltam trinta segundos.”`, `“Dois quilômetros. Pace nove minutos e cinco segundos.”`
- Botão `Fechar`

## Estados
### Ambos ativos
Padrão, como na imagem.
### Locução desativada
Interruptor de locução desligado; a seção de gatilhos permanece, com a nota `Os avisos continuam apenas por vibração.` Vibração segue independente.
### Vibração desativada
Interruptor de vibração desligado; avisos continuam falados.
### Corrida livre
O gatilho 1 é omitido — corrida livre não tem etapas. O gatilho 3 continua valendo.

## Interações
- Alternar `Locução` → liga/desliga o TTS imediatamente, sem afetar a vibração
- Alternar `Vibração` → liga/desliga o haptics
- `Fechar` → volta à tela 05/06 com a atividade intacta
- Abertura: ícone de orientações no cabeçalho da tela de atividade

## Notas de implementação
- TTS com `expo-speech` em `pt-BR`; números verbalizados por extenso ("nove minutos e cinco segundos"), nunca lidos como `9:05`.
- Etapas com duração igual ou inferior a 30 s não disparam o aviso de 30 segundos.
- Os avisos precisam funcionar com a tela bloqueada, disparados pelo mesmo motor que faz a transição de etapas.
- As preferências são locais e persistem entre atividades.
- Esta tela foi acrescentada à lista original: sem ela a US-5.1 ("consigo desativar o áudio e manter apenas a vibração") não tem superfície de UI.
- Tema claro: sheet `#FFFFFF`, interruptor ativo `#D6431A`.
