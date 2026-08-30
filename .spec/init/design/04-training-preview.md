# 04 — Pré-início do treino

**US cobertas:** US-2.2
**Imagem:** ./04-training-preview.png

## Propósito
Mostrar o que vai ser executado — etapas, duração estimada e estado do GPS — antes de confirmar o início da atividade.

## Elementos obrigatórios
- Cabeçalho com o nome do treino: `Treino de exemplo`
- Métricas de topo: `DURAÇÃO ESTIMADA` `34:00` e `ETAPAS` `14`
- Lista das etapas na ordem planejada, com bloco de repetição exibido como `6× repetições` e as etapas filhas recuadas: `Caminhada 05:00`, `Corrida 02:00`, `Caminhada 02:00`, `Caminhada 05:00`
- Indicador de GPS acima do botão: `GPS: boa precisão`
- Botão primário `Iniciar treino`

## Estados
### GPS sem precisão aceitável
Indicador em ouro `GPS: sem precisão aceitável`. O toque em `Iniciar treino` abre o sheet de aviso da tela 07 (variante GPS sem fix).
### Permissão ausente ou negada
O toque em `Iniciar treino` dispara a solicitação; se negada, tela 07 (variante permissão negada).

## Interações
- `Iniciar treino` → cria a `activity` com `started_at` e vai para a tela 06
- Voltar → tela 02, sem criar atividade

## Notas de implementação
- `ETAPAS 14` é a contagem da **sequência executável expandida** (1 + 6×2 + 1), diferente das 4 entradas exibidas na biblioteca.
- A expansão dos blocos acontece ao iniciar; a lista desta tela é apenas apresentação.
- A atividade grava `training_session_id` e `training_session_name` (snapshot do nome).
- Tema claro: fundo `#FBF7F2`, linhas de etapa `#FFFFFF`, coral de ação `#D6431A`.
