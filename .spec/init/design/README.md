# Flux — Design refs

Mockups, definições textuais das telas do MVP e os assets de marca. Cada tela tem um par:

- `NN-slug.png` — fonte da verdade **visual** (layout, hierarquia, densidade). Quadros em 540×1170 exportados em 2× (1080×2340, Android portrait 9:19,5).
- `NN-slug.md` — fonte da verdade **textual**: propósito, elementos obrigatórios com textos exatos, estados, interações e notas de implementação.

As tasks de frontend apontam `**Design ref:** .spec/init/design/NN-slug.png`; leia sempre os dois arquivos.

```text
.spec/init/design/
├── README.md              # este índice
├── NN-slug.png / .md      # 15 telas
└── brand/                 # símbolo, lockups e ícone do app
```

## Índice das telas

| Tela | Arquivo | US cobertas |
|---|---|---|
| 01 — Início | `01-home.png` · `01-home.md` | US-2.1 |
| 02 — Biblioteca de treinos | `02-training-library.png` · `02-training-library.md` | US-1.1, US-1.3, US-1.4 |
| 03 — Editor de treino | `03-training-editor.png` · `03-training-editor.md` | US-1.1, US-1.2, US-1.3 |
| 04 — Pré-início do treino | `04-training-preview.png` · `04-training-preview.md` | US-2.2 |
| 05 — Atividade em andamento (corrida livre) | `05-activity-free-run.png` · `05-activity-free-run.md` | US-2.3, US-2.4, US-3.2 |
| 06 — Atividade em andamento (treino estruturado) | `06-activity-structured.png` · `06-activity-structured.md` | US-4.2, US-4.3, US-4.4 |
| 07 — Bloqueios ao iniciar | `07-activity-blocked.png` · `07-activity-blocked.md` | US-2.1 |
| 08 — Resultado da atividade | `08-activity-result.png` · `08-activity-result.md` | US-7.1, US-7.2 |
| 09 — Captura de RPE | `09-rpe-capture.png` · `09-rpe-capture.md` | US-7.3 |
| 10 — Confirmação de descarte | `10-activity-discard.png` · `10-activity-discard.md` | US-7.4 |
| 11 — Histórico | `11-history-list.png` · `11-history-list.md` | US-8.1 |
| 12 — Detalhe da atividade | `12-history-detail.png` · `12-history-detail.md` | US-8.2, US-8.3, US-8.4 |
| 13 — Recuperação de atividade interrompida | `13-activity-recovery.png` · `13-activity-recovery.md` | US-6.3 |
| 14 — Orientações por áudio e vibração | `14-audio-cues.png` · `14-audio-cues.md` | US-5.1, US-5.2, US-5.3 |
| 15 — Notificação persistente (tela bloqueada) | `15-background-notification.png` · `15-background-notification.md` | US-6.1 |

**Telas 14 e 15 foram acrescentadas** à lista original: US-5.1 exige um controle para desativar o áudio mantendo a vibração, e US-6.1 exige a notificação persistente do foreground service. Nenhuma das 13 telas cobria essas superfícies.

## US sem tela dedicada (por natureza)

| US | Onde aparece |
|---|---|
| US-2.5 Splits por quilômetro | Seção `SPLITS` nas telas 08 e 12; anúncio por km na tela 14 |
| US-3.1 Descartar amostras imprecisas | Lógica de runtime; efeito visível no indicador de GPS (05/06) e no percurso (08/12) |
| US-3.3 Perda temporária de sinal | Estado `sem sinal` das telas 05 e 06 |
| US-4.1 Avanço automático entre etapas | Comportamento da tela 06 (cartão de etapa atual e próxima) |
| US-6.2 Persistir durante a execução | Sem UI própria; consequência visível na tela 13 |

## Brand

Assets de marca em `brand/`. **Não são telas** — nenhuma US aponta para eles; são referência para o ícone do app, o splash e qualquer cabeçalho que precise da marca.

| Arquivo | Formato | Uso |
|---|---|---|
| `flux-mark.svg` · `flux-mark.png` | 72×74 · 1024×1024 | Símbolo isolado, cores do tema escuro |
| `flux-mark-mono.svg` | 72×74 | Mesma geometria em `currentColor` — herda a cor do contexto |
| `flux-lockup.svg` · `flux-lockup.png` | 238×74 · 2400×800 | Símbolo + palavra "Flux", texto claro — **fundos escuros** |
| `flux-lockup-light.svg` · `flux-lockup-light.png` | 238×74 · 2400×800 | Mesma composição para **fundos claros** |
| `flux-icon.svg` · `flux-icon.png` | 104×104 · 1024×1024 | Ícone do app: quadrado arredondado com o símbolo vazado |

**O símbolo** são três barras inclinadas (`skewX(-14°)`), de alturas decrescentes (74 / 54 / 34) e pontas arredondadas (`rx 6.5`), espaçadas 20 unidades. A inclinação e o decaimento sugerem movimento e velocidade — e ecoam a leitura de um gráfico de splits.

**Cores do símbolo:**

| Barra | Fundo escuro | Fundo claro |
|---|---|---|
| 1 (mais alta) | `#FF5E3A` | `#D6431A` |
| 2 | `#FF8A62` | `#E8794F` |
| 3 (mais baixa) | `#7A4634` | `#C7A48E` |

A versão mono usa uma cor só, diferenciando as barras por opacidade: `1` / `0,72` / `0,4`.

**O ícone** aplica gradiente vertical `#FF7048 → #E24A22` num quadrado de canto `rx 24`, com o símbolo vazado em `#FFF3EA` nas mesmas três opacidades da versão mono, escalado a 62% e centralizado.

**Tipografia do lockup:** Barlow 600, `font-size` 62, `letter-spacing` -2,2. Texto `#FAF3E6` no escuro, `#1A120E` no claro.

Notas de uso:

- `flux-mark-mono.svg` **não tem PNG** de propósito — ele existe para herdar a cor do contexto via `currentColor`, o que um raster não faz.
- Prefira o **SVG** em qualquer superfície da aplicação; os PNGs existem para onde SVG não serve (ícone do app, stores, prévia em ferramentas externas).
- Os lockups em PNG são 2400×800 com respiro nas laterais, então a proporção não bate com a do SVG (238×74). Para alinhamento preciso, use o SVG.
- **O ícone ainda não está ligado ao app.** O `app.json` aponta para `./assets/images/icon.png` e `./assets/expo.icon`, que continuam sendo os do template do `create-expo-app`. Trocar pelo `flux-icon.png` é tarefa de implementação, não está feita.

## Convenções visuais

- Tema escuro é o padrão desenhado, na paleta **Solar** — carvão quente com coral e ouro, escolhida para representar calor e movimento. Fundo `#15100F`, superfícies `#211814` / `#2A2019`, bordas `#382A20`, texto `#FAF3E6`, secundário `#A89684`.
- Semântica: coral `#FF5E3A` é **exclusivo de ação** (botões primários, links, etapa de corrida, valor selecionado); ouro `#FFC857` é **dado em destaque** (melhor km, melhor split, pausa, caminhada, precisão degradada); sálvia `#9BC7A8` é **confirmação passiva** (boa precisão de GPS, etapa concluída); vermelho `#FF4D4D` é destrutivo e sem sinal. Cada `.md` traz o equivalente claro.
- Cores por tipo de etapa: aquecimento `#A89684`, corrida `#FF5E3A`, caminhada `#FFC857`, recuperação `#9BC7A8`, desaquecimento `#C79BB0`.
- Acabamento: lavagem quente no topo de cada tela (`linear-gradient` do coral a 10% até transparente em 40% da altura), hairline interna clara nas superfícies (`inset 0 1px 0 rgba(255,255,255,0.045)`), botões primários em pílula com gradiente vertical e sombra colorida (`0 14px 34px rgba(255,94,58,0.26)`), barras proporcionais nos splits. Densidade reduzida nas telas 08 e 12: mapa menor e mais respiro entre as seções.
- Tipografia: Barlow (números e títulos), JetBrains Mono (rótulos, métricas tabulares, dados).
- Formatação de dados: distância `0,00 km`; pace `mm:ss/km`; duração `mm:ss` ou `hh:mm:ss`; RPE inteiro de 1 a 10.
- Alvos de toque nunca abaixo de 88 px @1080 (~44 dp); na tela de atividade, 264 px (~132 dp).

## Reprodutibilidade

Os PNGs das telas foram exportados de um documento HTML de composição, o que garante texto exato em vez de texto gerado por difusão. **Esse HTML não está versionado no repositório** — nenhum `.html` existe no projeto hoje. Enquanto ele não for adicionado, os PNGs são o único artefato e não há como regerá-los ou editá-los em lote; correções precisam ser feitas asset por asset. Vale recuperar o arquivo-fonte e commitá-lo aqui.
