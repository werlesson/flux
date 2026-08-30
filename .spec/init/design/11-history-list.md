# 11 — Histórico

**US cobertas:** US-8.1
**Imagem:** ./11-history-list.png

## Propósito
Listar as atividades registradas, da mais recente para a mais antiga, com o suficiente para reconhecer cada corrida.

## Elementos obrigatórios
- Cabeçalho `Histórico` com voltar
- Cartão por atividade com: data e hora (`30 ago · 07:42`), origem (`Treino de exemplo` ou `Corrida livre`), distância (`3,18 km`), tempo total (`29:41`), `Pace médio 9:20/km`
- Marcação de avaliação: `RPE 6` quando preenchido, selo ouro `Pendente de avaliação` quando `rpe` é nulo
- Ordem estritamente decrescente por data de início

## Estados
### Com atividades
Como na imagem: primeiro cartão avaliado, segundo pendente de avaliação.
### Estado vazio
Título `Nenhuma atividade registrada` e texto `Suas corridas aparecem aqui, da mais recente para a mais antiga, com distância, tempo e pace médio.` Botão `Iniciar corrida livre` ao pé.
### Offline
Idêntico ao estado normal: a lista lê apenas SQLite local, sem nenhum indicador de rede.

## Interações
- Toque no cartão → tela 12
- Toque em `Iniciar corrida livre` (estado vazio) → mesmo fluxo da tela 01

## Notas de implementação
- Consulta: `activities` com `finished_at IS NOT NULL`, ordenado por `started_at DESC`. Atividade em andamento não aparece no histórico — ela cai na tela 13.
- A origem usa `training_session_name` (snapshot), então continua correta depois que o treino é excluído da biblioteca.
- "Pendente de avaliação" é exatamente `rpe IS NULL`.
- Datas em pt-BR; o ano só é exibido quando diferente do ano atual.
- Tema claro: cartões `#FFFFFF`; selo pendente `#9A6B00` sobre `#FDF3E0`.
