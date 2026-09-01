# Flux — Project Description

## Overview

Flux é um **aplicativo mobile de acompanhamento e treinamento de corrida** que usa apenas o GPS e os sensores do smartphone, sem depender de relógio esportivo dedicado. O objetivo inicial é substituir bem o núcleo funcional de um Garmin — **cronômetro, GPS, distância, pace, splits, percurso e execução de treinos estruturados** — para quem não quer ou não precisa comprar um dispositivo.

O produto não é um cronômetro com GPS. A tese é que o valor está no ciclo completo **Planejar → Executar → Registrar → Analisar → Evoluir**: o corredor monta seus treinos, o app os executa guiando por áudio, registra dados objetivos (distância, pace, splits) e subjetivos (RPE, observações), e esse histórico alimenta a análise da evolução. A ambição de longo prazo é evoluir de tracker para **treinador digital de corrida**.

O público é o **corredor iniciante ou em retomada** — alguém que ainda alterna corrida e caminhada, não tem cinta cardíaca, e não domina conceitos como pace e splits. Por isso caminhada é tratada como componente legítimo do treino, não como falha, e a percepção de esforço (RPE) substitui a frequência cardíaca como métrica subjetiva.

**Fronteira do MVP:** o primeiro release entrega corrida livre **e** o motor de treinos estruturados, com treinos criados pelo próprio usuário, orientação por áudio/vibração, splits por quilômetro, mapa estático do percurso no resultado, RPE e histórico — rodando **offline e em background, apenas em Android**. Ficam explicitamente fora: auto-pause automático, iOS, backend/sincronização, autenticação, mapas ao vivo, gráficos, recordes, calendário de planos e integrações com sensores ou plataformas externas.

### Key Concepts

- **Activity (Workout):** uma atividade realizada e gravada. Guarda `started_at`, `finished_at`, `elapsed_duration`, `moving_duration`, `distance`, `average_pace`, `best_pace`, `rpe` e `notes`. É a unidade do histórico.
- **WorkoutPoint:** uma amostra de localização **já validada** pelo filtro de GPS e incorporada ao percurso. Carrega latitude, longitude, altitude, accuracy, speed e `recorded_at`. Amostras rejeitadas pelo filtro não viram WorkoutPoint.
- **Split:** segmento de **1 km completo** dentro de uma atividade, com duração e pace próprios. Gerado automaticamente ao cruzar cada quilômetro. É a base da análise de evolução e do feedback de áudio por km.
- **TrainingSession (treino):** um treino planejado e reutilizável, criado pelo usuário, composto por etapas ordenadas. Vive numa **biblioteca** — não é atribuído a uma data.
- **TrainingStep (etapa):** unidade executável de um treino. Tem tipo, ordem, duração, intensidade esperada e instrução exibida/falada. Tipos iniciais: **aquecimento, corrida, caminhada, recuperação, desaquecimento**.
- **Bloco de repetição:** agrupamento de etapas repetido N vezes (ex.: `6× [2min corrida + 2min caminhada]`). O modelo deve representar repetições **sem duplicar as etapas** no banco.
- **elapsed_time vs moving_time:** `elapsed_time` é o **tempo de atividade** — o intervalo entre início e fim **menos os períodos de pausa manual**; `moving_time` conta só os períodos em que houve deslocamento real. O tempo pausado não entra em nenhuma das duas: durante a pausa o cronômetro exibido congela, e é isso que o corredor vê tanto na tela de atividade quanto no resultado. O tempo de parede puro continua derivável de `finished_at - started_at` sempre que for necessário. A diferença `elapsed_time - moving_time` é, portanto, o tempo parado **sem** pausa manual — semáforo, água — que a tela de resultado apresenta como tempo caminhando. As duas métricas coexistem desde o MVP e alimentam paces diferentes.
- **Pace:** tempo por quilômetro (`mm:ss/km`). Existe em três formas: **pace atual** (janela recente), **pace médio** (da atividade) e **pace do split** (por km).
- **RPE (Rate of Perceived Exertion):** avaliação subjetiva de esforço numa escala de **1 a 10**, coletada ao finalizar a atividade, acompanhada de um campo de observações opcional. Substitui a frequência cardíaca para o público-alvo.
- **Motor de treino:** o componente que percorre as etapas do TrainingSession durante a atividade, controla as transições automaticamente e dispara as orientações. Precisa continuar correto com a tela bloqueada.
- **Filtro de GPS:** camada que valida cada amostra antes de incorporá-la ao percurso, descartando pontos imprecisos que inflariam a distância. É apontado no documento de origem como **o componente técnico mais crítico do produto**.
- **Auto-pause:** detecção de paradas involuntárias (semáforo, água). **Fora do MVP** — a heurística precisa ser especificada e testada antes de ser confiável. O MVP tem apenas pausa manual, mas já calcula `moving_time`.
- **Development Build:** build nativo próprio do app. É **obrigatório** — localização em background não funciona no Expo Go.

## Tech Stack

O repositório já contém um app Expo inicializado em `apps/mobile/` (template padrão, ainda sem código do Flux). Versões abaixo são as efetivamente instaladas; pacotes marcados como *a instalar* são decisões desta especificação.

| Camada | Tecnologia |
|---|---|
| Runtime mobile | Expo SDK `~57.0.18`, React Native `0.86.3`, React `19.2.3` |
| Linguagem | TypeScript `~6.0.3` (`strict: true`), alias `@/*` → `./src/*` |
| Navegação | `expo-router` `~57.0.17` (typed routes e React Compiler habilitados) |
| Plataforma alvo (MVP) | **Android apenas** — iOS adiado |
| Distribuição | **Development Build** obrigatório (Expo Go não suporta background location) |
| GPS / localização | `expo-location` *(a instalar)* — com `isAndroidBackgroundLocationEnabled` e `isAndroidForegroundServiceEnabled` no config plugin |
| Execução em background | `expo-task-manager` *(a instalar)* — task registrada via `TaskManager.defineTask()` no topo do módulo |
| Persistência local | `expo-sqlite` *(a instalar)* — offline-first, sem backend |
| Mapas | `expo-maps` *(a instalar)* — `GoogleMaps.View` com prop `polylines`; exige chave em `android.config.googleMaps.apiKey`. ⚠️ **em alpha, com breaking changes frequentes** |
| Áudio das orientações | `expo-speech` *(a instalar)* — TTS em `pt-BR`; escolhido porque os avisos precisam falar números dinâmicos ("Dois quilômetros. Pace nove minutos e cinco segundos"), o que áudio pré-gravado não cobre |
| Vibração | `expo-haptics` *(a instalar)* |
| Testes | `jest-expo` (Jest) *(a instalar)* — nenhum runner configurado hoje |
| Gerenciador de pacotes | pnpm (`pnpm-lock.yaml`) |
| Estrutura | Monorepo raso: `apps/mobile/` com código em `src/` (`app/`, `components/`, `constants/`, `hooks/`) |
| Idioma | UI e locuções em **pt-BR** |
| Backend | **Nenhum** no MVP. Evolução prevista (adiada): Laravel API + PostgreSQL |

## Core Workflows

### 1. Criar e gerenciar treinos

O usuário monta seus próprios treinos numa biblioteca local. Não há calendário nem plano prescrito — ele escolhe manualmente qual treino executar.

1. Usuário abre a biblioteca de treinos e cria um novo.
2. Adiciona etapas ordenadas, cada uma com **tipo** (aquecimento, corrida, caminhada, recuperação, desaquecimento), **duração** e **instrução** opcional.
3. Agrupa etapas em blocos de repetição quando aplicável.
4. O app calcula e exibe a **duração estimada total** do treino.
5. Treino fica salvo em SQLite, reutilizável em quantas atividades quiser.

Exemplo de treino representado:

```text
5 min caminhada
6× {
    2 min corrida
    2 min caminhada
}
5 min caminhada
```

**Regra:** o bloco de repetição é armazenado como estrutura, não como 12 etapas duplicadas — mas é **expandido em 14 etapas executáveis** em tempo de execução pelo motor de treino.

### 2. Iniciar uma atividade

1. Usuário escolhe **corrida livre** ou seleciona um treino da biblioteca.
2. App verifica permissões de localização (foreground **e** background) e as solicita se ausentes.
3. App aguarda **fix de GPS com precisão aceitável** antes de liberar o início — evita que os primeiros metros sejam lixo.
4. Usuário inicia; o foreground service Android sobe e a coleta de GPS começa.
5. Uma Activity é criada em SQLite imediatamente, com `started_at` — antes de qualquer ponto ser gravado.

### 3. Rastrear a corrida em tempo real

A tela de atividade prioriza legibilidade: poucas informações, tipografia grande, consultável de relance em movimento.

```text
CORRIDA

00:18:42

2,31 km

Pace atual       8:06 /km
Pace médio       8:11 /km

[ PAUSAR ]

GPS: boa precisão
```

Durante o treino estruturado, a tela mostra também **etapa atual** e **próxima etapa**.

- O cronômetro é calculado por **timestamps**, nunca por contagem de ticks — ticks divergem após background.
- O indicador de qualidade do GPS reflete a `accuracy` das amostras recentes.
- Pausa e retomada são **manuais** no MVP; auto-pause fica para depois.
- Durante a pausa o cronômetro **congela**: o tempo pausado não entra no `elapsed_time`, e o número exibido ao retomar continua de onde parou.

### 4. Validar e filtrar os pontos de GPS

Somar cegamente todas as amostras produz distância inflada. Cada amostra passa por validação antes de virar WorkoutPoint.

1. Amostra chega com latitude, longitude, altitude, accuracy, speed e timestamp.
2. Filtro avalia, entre outros critérios: **precisão máxima aceitável**, distância desde o último ponto aceito, intervalo entre medições, **velocidade fisicamente plausível** e saltos abruptos de posição.
3. Amostra aprovada → vira WorkoutPoint, entra no percurso e soma distância.
4. Amostra rejeitada → descartada; a distância não avança.
5. Perda temporária de sinal é tratada como lacuna, não como deslocamento em linha reta.

Referência de ordem de grandeza dada no documento de origem:

```text
accuracy = 5 m   → provavelmente aceitável
accuracy = 60 m  → provavelmente rejeitar
```

**Os limiares exatos não estão definidos** — serão determinados por experimentação em campo (ver Open Questions).

### 5. Executar um treino estruturado

1. Motor de treino expande blocos de repetição na sequência linear de etapas executáveis.
2. Inicia a primeira etapa e exibe/fala sua instrução.
3. Acompanha o progresso da etapa (duração no MVP; distância fica para depois).
4. Ao completar, **transiciona automaticamente** para a próxima etapa e emite a orientação correspondente.
5. Repete até a última etapa; então sinaliza que o treino acabou.
6. Cada etapa executada é registrada com sua duração e ritmo reais, permitindo comparar planejado × executado.

O motor precisa manter a contagem correta enquanto o app está em background — a transição não pode depender da tela estar acesa.

### 6. Orientar por áudio e vibração

O usuário não deve precisar olhar a tela durante o exercício.

Gatilhos de orientação:
- Início e fim de cada etapa do treino.
- Aviso de **30 segundos** para o fim da etapa.
- Cada quilômetro completo, com o pace do split.

```text
Comece a correr.
Caminhe por dois minutos.
Faltam trinta segundos.
Dois quilômetros. Pace nove minutos e cinco segundos.
```

Os avisos combinam **TTS em pt-BR** (`expo-speech`) e **vibração** (`expo-haptics`), e devem funcionar com a tela bloqueada.

### 7. Registrar splits por quilômetro

A cada quilômetro completo o sistema fecha um Split com sua duração e pace.

```text
KM 1    9:42
KM 2    9:15
KM 3    8:56
```

O split é persistido no momento em que fecha — não é recalculado só no fim — para sobreviver a um encerramento inesperado.

### 8. Manter o rastreamento em background

Requisito não-negociável: bloquear o celular não pode degradar a atividade.

```text
atividade iniciada
        ↓
usuário bloqueia o celular
        ↓
GPS continua sendo coletado
        ↓
cronômetro continua correto
        ↓
motor do treino continua
        ↓
áudio/vibração continuam
        ↓
atividade permanece consistente
```

No Android isso exige **foreground service** com notificação persistente e permissão `ACCESS_BACKGROUND_LOCATION`, além do development build.

### 9. Persistir e recuperar a atividade

Uma corrida nunca deve ser perdida — nem por falta de internet, nem por crash.

1. Estado da atividade é gravado em SQLite **periodicamente durante a execução**, não apenas ao finalizar.
2. Pontos, splits e etapas executadas são persistidos conforme acontecem.
3. Se o app for encerrado inesperadamente, na próxima abertura ele detecta a atividade sem `finished_at`.
4. Oferece **retomar** ou **finalizar com o que foi gravado**.

Todo o fluxo funciona **offline**: GPS, cronômetro, motor de treino, SQLite, histórico e estatísticas não dependem de rede.

### 10. Finalizar e registrar percepção de esforço

Ao encerrar, o app consolida as métricas e pede a avaliação subjetiva.

```text
Distância           3,18 km
Tempo total         29:41
Tempo correndo      17:22
Tempo caminhando    12:19
Pace médio          9:20/km
Melhor km           8:47/km

Splits
1 km     9:42
2 km     9:15
3 km     8:56
```

Em seguida:

```text
Como foi o treino?

RPE: 6/10

[ Fácil ]  [ Controlado ]  [ Difícil ]
```

Mais um campo livre de observações, opcional. A tela de resultado exibe também o **mapa estático do percurso** (polyline sobre os WorkoutPoints validados) — que serve tanto ao usuário quanto à verificação visual da qualidade do filtro de GPS.

### 11. Consultar histórico e evolução

1. Usuário abre o histórico e vê as atividades realizadas, mais recentes primeiro.
2. Seleciona uma para ver o detalhe completo: métricas, splits, execução das etapas, RPE, observações e percurso.
3. Os dados objetivos + subjetivos acumulados formam a base para a análise de evolução — que no MVP é **consulta**, não recomendação automática.

## Open Questions

- **Limiares do filtro de GPS.** Precisão máxima aceitável, distância mínima/máxima entre pontos, velocidade plausível e regra de salto abrupto precisam ser definidos por experimentação em campo. O documento de origem deliberadamente não os fixa.
- **Frequência de coleta do GPS.** Ainda não decidida — é o principal trade-off entre precisão da distância e consumo de bateria.
- **Frequência de gravação do estado em SQLite** durante a atividade, e estratégia de armazenamento para milhares de pontos por corrida.
- **Detecção de movimento para `moving_time`.** O MVP calcula `moving_time` sem auto-pause; falta definir o critério (limiar de velocidade? deslocamento mínimo?) que separa "parado" de "em movimento".
- **`expo-maps` está em alpha**, com breaking changes frequentes assumidos pela própria documentação. Decisão registrada, mas vale reavaliar contra `react-native-maps` antes de construir a tela de resultado.
- **Chave da API do Google Maps** ainda não provisionada (`android.config.googleMaps.apiKey`).
- **Política de retenção e exportação** de coordenadas — por quanto tempo guardar, como exportar e como excluir atividades. Relevante pelo princípio de privacidade, ainda sem decisão.
- **Repositório git aninhado:** `apps/mobile/` tem seu próprio `.git` dentro do repositório raiz. Provável resíduo do `create-expo-app`; precisa ser resolvido antes que o versionamento fique inconsistente.
