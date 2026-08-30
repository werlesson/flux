# 10 — Confirmação de descarte

**US cobertas:** US-7.4
**Imagem:** ./10-activity-discard.png

## Propósito
Exigir confirmação explícita antes de apagar definitivamente uma atividade e todo o seu rastro de localização.

## Elementos obrigatórios
- Diálogo modal sobre a tela 08, com véu escuro
- Título `Descartar esta atividade?`
- Texto `A atividade, os pontos de GPS e os splits serão apagados definitivamente. Não é possível desfazer.`
- Resumo do que será perdido: `3,18 km · 29:41` e `3 splits`
- Ações `Descartar` (destrutiva, vermelha) e `Cancelar`

## Estados
### Padrão
Como na imagem.
### Atividade sem splits
O resumo mostra apenas `0,00 km · 04:35` e omite a contagem de splits.

## Interações
- `Descartar` → apaga `activity`, `activity_points`, `activity_splits` e `activity_steps` em cascata, e volta para a tela 01
- `Cancelar` → fecha o diálogo e permanece na tela 08, sem perder nada
- Toque fora do diálogo → equivale a `Cancelar`

## Notas de implementação
- Hard delete, em transação única. Nada de `deleted_at`: a especificação prevê soft delete só em `training_sessions`.
- Não descartar o treino de origem, apenas a atividade.
- Após o descarte não deve restar nenhuma linha referenciando a atividade — o histórico é consultado imediatamente depois.
- Tema claro: diálogo `#FFFFFF`, ação destrutiva `#C0392B` com texto branco, véu `rgba(0,0,0,0.45)`.
