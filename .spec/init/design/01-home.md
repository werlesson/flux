# 01 — Início

**US cobertas:** US-2.1
**Imagem:** ./01-home.png

## Propósito
Ponto de entrada do app: iniciar uma corrida livre em um toque, ou navegar para a biblioteca de treinos e o histórico.

## Elementos obrigatórios
- Título do app: `Flux`
- Cartão de corrida livre com rótulo `CORRIDA LIVRE`, descrição `Grava tempo, distância, pace e percurso sem seguir um treino.` e botão primário `Iniciar corrida livre` (altura mínima 96 px @1080, ou seja ~48 dp)
- Linha `Biblioteca de treinos` com contagem de treinos salvos (`1 treino` / `Nenhum treino` / `N treinos`)
- Linha `Histórico` com resumo da última atividade no formato `Última: 3,18 km · 29:41`
- Ambas as linhas com chevron `›` indicando navegação

## Estados
### Sem treinos salvos
A linha da biblioteca exibe `Nenhum treino`. O botão de corrida livre não muda.

### Sem atividades no histórico
A linha do histórico exibe `Nenhuma atividade` em vez do resumo.

### Atividade pendente de resolução
Se existe atividade sem `finished_at`, a tela 13 é exibida sobre esta no início e nenhuma nova atividade pode ser iniciada até a resolução (US-6.3).

## Interações
- Toque em `Iniciar corrida livre` → verifica permissão de localização (foreground e background) e fix de GPS; conforme o resultado vai para a tela 05 ou para a tela 07
- Toque em `Biblioteca de treinos` → tela 02
- Toque em `Histórico` → tela 11

## Notas de implementação
- O resumo da última atividade vem de `activities` ordenado por `started_at DESC` limitado a 1; formatar `distance_meters` como km com vírgula e duas casas, e `elapsed_duration_seconds` como `mm:ss` (ou `hh:mm:ss` acima de 1 hora).
- Tema claro: fundo `#FBF7F2`, superfícies `#FFFFFF` com borda `#EADFD2`, texto `#1A120E`, secundário `#6B5B4C`, coral de ação `#D6431A` com texto branco.
- Nenhum logotipo ou ilustração: a marca é apenas o wordmark textual.
