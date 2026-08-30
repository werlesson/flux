# 09 — Captura de RPE

**US cobertas:** US-7.3
**Imagem:** ./09-rpe-capture.png

## Propósito
Coletar o esforço percebido de 1 a 10 e observações livres, deixando claro que os dois campos são opcionais.

## Elementos obrigatórios
- Título `Como foi o treino?`
- Texto `O esforço percebido é opcional. Você pode responder depois, pelo histórico.`
- Rótulo `RPE` e leitura do valor à direita: `—/10` sem seleção, `6/10 · Controlado` com seleção
- Grade com os dez valores inteiros `1`…`10`, alvos de 168 px @1080 (~84 dp) de altura
- Âncoras da escala: `1–3 Fácil`, `4–6 Controlado`, `7–10 Difícil`
- Seção `OBSERVAÇÕES · OPCIONAL` com campo de texto multilinha; placeholder `Como você se sentiu, o clima, o terreno…`
- Ações `Salvar avaliação` e `Salvar sem avaliar`

## Estados
### Sem seleção
Leitura `—/10`. `Salvar avaliação` desabilitada; `Salvar sem avaliar` é a ação primária (verde) — é o caminho de pular.
### Com RPE selecionado
Valor destacado em coral, âncora correspondente realçada, leitura `6/10 · Controlado`. `Salvar avaliação` passa a primária; `Salvar sem avaliar` fica como contorno.
### Só observações, sem RPE
Permitido: `Salvar avaliação` fica habilitada e grava `notes` com `rpe` nulo — a atividade continua marcada como pendente de avaliação.

## Interações
- Toque em um número → seleciona (toque no mesmo número desmarca)
- `Salvar avaliação` → grava `rpe` e `notes` na atividade e vai para a tela 11
- `Salvar sem avaliar` → grava a atividade sem `rpe`, marcada como pendente, e vai para a tela 11
- Voltar do sistema → equivale a `Salvar sem avaliar`; nunca descarta a atividade

## Notas de implementação
- `rpe` é inteiro de 1 a 10 validado na aplicação (o banco aceita nulo).
- As três âncoras (`Fácil`, `Controlado`, `Difícil`) são rótulos de faixa derivados do valor, não um segundo controle — decisão de design tomada a partir do exemplo da descrição do projeto.
- A atividade já existe no banco desde o início; esta tela faz `UPDATE`, nunca `INSERT`.
- Tema claro: valor selecionado `#D6431A` com texto branco, não selecionados `#FFFFFF` com borda `#EADFD2`.
