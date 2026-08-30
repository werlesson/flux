# Prompt — geração dos design refs do Flux

Prompt para gerar os artefatos de `.spec/init/design/`, consumidos pelo `/bc-harness:init:project-phases`.

---

## Prompt

Você vai produzir os **design refs** do Flux, um app mobile de corrida. Leia os três documentos anexados **antes de desenhar qualquer coisa** — eles são a fonte da verdade, e nada pode ser inventado fora deles:

### O que entregar

Para **cada tela** da lista abaixo, dois arquivos em `.spec/init/design/`:

1. **`NN-slug.png`** — a imagem do mockup da tela.
2. **`NN-slug.md`** — a definição textual da tela: propósito, elementos obrigatórios, estados, interações, e as US que ela cobre.

Mais um **`.spec/init/design/README.md`** com o índice: tabela `Tela | Arquivo | US cobertas`.

O par imagem + markdown é proposital. A imagem carrega o layout e a hierarquia visual; o markdown carrega o que a imagem não consegue garantir com precisão — textos exatos, limites, estados de erro. As tasks de frontend vão apontar `**Design ref:** .spec/init/design/NN-slug.png` e o agente que implementar lê os dois.

### Telas

| # | slug | Tela | US cobertas |
|---|---|---|---|
| 01 | `home` | Início — ponto de entrada: iniciar corrida livre, acessar biblioteca e histórico | US-2.1 |
| 02 | `training-library` | Biblioteca de treinos — lista com nome, nº de etapas e duração estimada; estado vazio | US-1.1, US-1.3, US-1.4 |
| 03 | `training-editor` | Editor de treino — etapas ordenadas, tipos, durações, blocos de repetição, duração estimada recalculada | US-1.1, US-1.2, US-1.3 |
| 04 | `training-preview` | Pré-início do treino — etapas, duração estimada, botão iniciar | US-2.2 |
| 05 | `activity-free-run` | Atividade em andamento — corrida livre | US-2.3, US-2.4, US-3.2 |
| 06 | `activity-structured` | Atividade em andamento — treino estruturado, com etapa atual, próxima e repetição corrente | US-4.2, US-4.3, US-4.4 |
| 07 | `activity-blocked` | Bloqueios ao iniciar — permissão negada e GPS sem precisão aceitável | US-2.1 |
| 08 | `activity-result` | Resultado — métricas, splits, mapa do percurso, etapas executadas | US-7.1, US-7.2 |
| 09 | `rpe-capture` | Captura de RPE — escala 1–10 e observações, ambos opcionais | US-7.3 |
| 10 | `activity-discard` | Confirmação de descarte da atividade | US-7.4 |
| 11 | `history-list` | Histórico — lista de atividades; estado vazio | US-8.1 |
| 12 | `history-detail` | Detalhe da atividade — métricas, splits, mapa, etapas, RPE, observações | US-8.2, US-8.3, US-8.4 |
| 13 | `activity-recovery` | Recuperação de atividade interrompida — retomar ou finalizar | US-6.3 |

Confira essa lista contra as user stories antes de começar. Se alguma US de tela não estiver coberta, acrescente a tela e diga o que acrescentou.

### Princípio de design que manda em tudo

**A tela 05 é consultada por alguém correndo.** A descrição do projeto define "Simplicidade — poucas informações durante a corrida" como princípio técnico, e o público-alvo é o corredor iniciante. Isso significa:

- Tempo e distância em tipografia enorme, legíveis de relance, em movimento, com o braço balançando.
- Nada de densidade de dashboard. Poucos números, muito espaço.
- Alvos de toque grandes — o usuário está suado, em movimento, possivelmente no frio.
- Contraste alto. A tela vai ser usada sob sol direto.

Nas demais telas a densidade pode subir, mas a hierarquia continua sendo: **o dado principal domina**.

### Restrições visuais

- **Android**, portrait, proporção 9:19.5 (ex.: 1080×2340). Respeite status bar e barra de navegação.
- **Tema escuro** como padrão — economiza bateria em OLED, e o app roda em atividade longa com GPS. O `app.json` do projeto usa `userInterfaceStyle: "automatic"`; desenhe o escuro e descreva no `.md` o equivalente claro.
- Interface inteiramente em **português do Brasil**.
- Sem elementos de marca inventados: nada de logotipo, ilustração decorativa ou mascote.
- Sem placeholder tipo *lorem ipsum*. Todo texto é texto real.

### Dados nas telas — use exatamente estes

Os documentos trazem exemplos concretos. Reaproveite-os para as telas ficarem coerentes entre si:

```text
Atividade em andamento     Resultado
00:18:42                   3,18 km
2,31 km                    29:41
Pace atual   8:06 /km      Pace médio       9:20/km
Pace médio   8:11 /km      Tempo correndo   17:22
GPS: boa precisão          Tempo caminhando 12:19
                           Melhor km        8:47/km

Splits                     Treino de exemplo
KM 1   9:42                5 min caminhada
KM 2   9:15                6× { 2 min corrida + 2 min caminhada }
KM 3   8:56                5 min caminhada
```

Regras de formatação a respeitar: distância em km com vírgula decimal e duas casas; pace no formato `mm:ss/km`; durações em `mm:ss` ou `hh:mm:ss` conforme a magnitude; RPE numa escala inteira de **1 a 10**.

Os cinco tipos de etapa são exatamente: **aquecimento, corrida, caminhada, recuperação, desaquecimento**. Não invente outros.

### Estados obrigatórios

Um mockup do caminho feliz não basta. Cada `.md` precisa descrever — e a imagem mostrar, quando couber:

- **05/06:** rodando, pausada, e GPS degradado/sem sinal (três estados do indicador: boa precisão, precisão degradada, sem sinal).
- **07:** permissão negada (bloqueia, com atalho para configurações) **e** GPS sem fix (só avisa, deixa iniciar).
- **02 e 11:** estado vazio, com texto explicativo.
- **08:** variante com treino estruturado (mostra etapas concluídas, puladas e não realizadas) e variante de corrida livre (sem seção de etapas); e o caso sem pontos válidos, em que o mapa é omitido com aviso.
- **09:** atividade salva sem RPE é permitida — mostre o caminho de pular.
- **12:** atividade pendente de avaliação, com o RPE ainda preenchível.

### Sobre a legibilidade do texto nas imagens

Se você estiver gerando as imagens por modelo de difusão, o texto tende a sair deformado — e um design ref com número ilegível é pior que nenhum, porque o agente implementa em cima dele. Duas saídas aceitáveis:

- **Preferida:** componha as telas como HTML/CSS ou SVG e exporte para PNG. O texto sai exato, o resultado é reproduzível, e dá para versionar a fonte junto.
- **Alternativa:** gere por imagem, mas confira cada número contra a tabela acima e regere o que saiu ilegível.

Em qualquer um dos casos, o `.md` de cada tela é obrigatório e deve conter os textos corretos — ele é a fonte da verdade textual, e a imagem é a fonte da verdade visual.

### Formato de cada `NN-slug.md`

```markdown
# NN — <Nome da tela>

**US cobertas:** US-x.y, US-x.z
**Imagem:** ./NN-slug.png

## Propósito
<uma frase>

## Elementos obrigatórios
- <elemento — texto exato quando for texto fixo>

## Estados
### <nome do estado>
<o que muda>

## Interações
- <ação → resultado>

## Notas de implementação
- <o que o agente precisa saber e a imagem não diz>
```

### Ao terminar

Reporte: quantas telas foram geradas, quais US ficaram sem cobertura de tela (se alguma), e qualquer ponto em que os documentos não determinavam o suficiente e você precisou decidir — declarando o que decidiu.
