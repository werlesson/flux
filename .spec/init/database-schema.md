# Flux — Database Schema

<!-- inputs: project-description.md@sha256:95865153b13f user-stories.md@sha256:4c853ddaf0ce -->

## Overview

O modelo gira em torno de duas árvores. A do **planejamento**: uma **training_session** (o treino da biblioteca) contém **training_blocks** ordenados, e cada bloco contém **training_steps** ordenadas — o bloco carrega o `repeat_count`, o que permite guardar `6× [2min corrida + 2min caminhada]` como 1 bloco e 2 etapas, sem duplicar nada. E a da **execução**: uma **activity** (o conceito `Activity (Workout)` da descrição) reúne **activity_points** (as amostras de GPS), **activity_splits** (os quilômetros fechados) e **activity_steps** (o registro do que foi de fato executado).

**activity_steps é um snapshot, não uma referência viva.** Ele copia tipo, instrução e duração planejada da etapa no momento da execução, e guarda a duração real e o status de execução. É o que permite editar um treino sem alterar o histórico (US-1.3) e registrar etapas puladas ou não realizadas (US-4.3, US-4.4).

Fora dessas duas árvores existe uma única tabela de configuração, **app_preferences**, que guarda as preferências de locução e vibração exigidas pela US-5.1 como pares chave-valor. Ela não se relaciona com nenhuma outra tabela.

Convenções em vigor: **nenhum ORM** está instalado — o projeto usa `expo-sqlite` com SQL direto — então vale o perfil padrão: tabelas no plural em `snake_case`, `id bigint [pk, increment]`, chaves estrangeiras `<singular>_id`, e `created_at`/`updated_at` nas tabelas de domínio. **Nenhum campo enum**: todo valor categórico vive numa tabela lookup com FK. **Soft delete apenas em `training_sessions`** (`deleted_at`); atividades, pontos e splits são apagados de verdade, conforme o princípio de privacidade da descrição e a US-8.4.

## Schema (DBML)

```dbml
// ─────────────────────────────────────────────
// Lookup tables
// ─────────────────────────────────────────────

Table step_types {
  id bigint [pk, increment]
  name varchar [not null]
  slug varchar [unique, not null]
  description text [null]
  is_active boolean [not null, default: true]
  created_at timestamp
  updated_at timestamp
}

Table activity_types {
  id bigint [pk, increment]
  name varchar [not null]
  slug varchar [unique, not null]
  description text [null]
  is_active boolean [not null, default: true]
  created_at timestamp
  updated_at timestamp
}

Table activity_statuses {
  id bigint [pk, increment]
  name varchar [not null]
  slug varchar [unique, not null]
  description text [null]
  is_active boolean [not null, default: true]
  created_at timestamp
  updated_at timestamp
}

Table step_execution_statuses {
  id bigint [pk, increment]
  name varchar [not null]
  slug varchar [unique, not null]
  description text [null]
  is_active boolean [not null, default: true]
  created_at timestamp
  updated_at timestamp
}

Table gps_rejection_reasons {
  id bigint [pk, increment]
  name varchar [not null]
  slug varchar [unique, not null]
  description text [null]
  is_active boolean [not null, default: true]
  created_at timestamp
  updated_at timestamp
}

// ─────────────────────────────────────────────
// Domain — usuário local
// ─────────────────────────────────────────────

// MVP não tem autenticação. Existe uma única linha local, criada na
// primeira execução, preparando a sincronização futura sem migração.
Table users {
  id bigint [pk, increment]
  name varchar [null]
  created_at timestamp
  updated_at timestamp
}

// ─────────────────────────────────────────────
// Domain — planejamento (biblioteca de treinos)
// ─────────────────────────────────────────────

Table training_sessions {
  id bigint [pk, increment]
  user_id bigint [ref: > users.id, not null]
  name varchar [not null]
  // duração estimada, derivada dos blocos; materializada para listar a
  // biblioteca sem percorrer a árvore inteira (US-1.1)
  estimated_duration_seconds integer [not null, default: 0]
  created_at timestamp
  updated_at timestamp
  deleted_at timestamp [null]
}

// Uma etapa solta é um bloco de repeat_count = 1. Toda training_step
// pertence a um bloco — não há etapa órfã.
Table training_blocks {
  id bigint [pk, increment]
  training_session_id bigint [ref: > training_sessions.id, not null]
  position integer [not null]
  repeat_count integer [not null, default: 1]
  created_at timestamp
  updated_at timestamp

  indexes {
    (training_session_id, position) [unique]
  }
}

Table training_steps {
  id bigint [pk, increment]
  training_block_id bigint [ref: > training_blocks.id, not null]
  step_type_id bigint [ref: > step_types.id, not null]
  position integer [not null]
  duration_seconds integer [not null]
  // fora do MVP: etapas por distância (descrição, seção "Treinos Estruturados")
  distance_meters decimal(10,2) [null]
  target_rpe integer [null]
  instructions text [null]
  created_at timestamp
  updated_at timestamp

  indexes {
    (training_block_id, position) [unique]
  }
}

// ─────────────────────────────────────────────
// Domain — execução (atividades)
// ─────────────────────────────────────────────

Table activities {
  id bigint [pk, increment]
  user_id bigint [ref: > users.id, not null]
  activity_type_id bigint [ref: > activity_types.id, not null]
  activity_status_id bigint [ref: > activity_statuses.id, not null]

  // null em corrida livre; também fica null se o treino de origem for
  // excluído da biblioteca — daí o snapshot do nome abaixo
  training_session_id bigint [ref: > training_sessions.id, null]
  training_session_name varchar [null]

  started_at timestamp [not null]
  finished_at timestamp [null]

  // métricas consolidadas ao finalizar (US-7.1)
  // tempo de ATIVIDADE: o intervalo entre início e fim menos as pausas manuais
  // (US-2.4). Não é relógio de parede — esse continua derivável de
  // finished_at - started_at sempre que for necessário.
  elapsed_duration_seconds integer [not null, default: 0]
  moving_duration_seconds integer [not null, default: 0]
  distance_meters decimal(10,2) [not null, default: 0]
  average_pace_seconds_per_km integer [null]
  best_pace_seconds_per_km integer [null]

  // avaliação subjetiva, opcional e editável depois (US-7.3, US-8.3)
  rpe integer [null]
  notes text [null]

  created_at timestamp
  updated_at timestamp

  indexes {
    (user_id, started_at)
    activity_status_id
  }
}

// Amostras de GPS. Guarda também as rejeitadas (is_valid = false) para
// permitir recalibrar os limiares do filtro contra corridas reais.
// Só as válidas somam distância e compõem o percurso (US-3.1).
Table activity_points {
  id bigint [pk, increment]
  activity_id bigint [ref: > activities.id, not null]
  latitude decimal(10,7) [not null]
  longitude decimal(10,7) [not null]
  altitude decimal(8,2) [null]
  accuracy decimal(8,2) [null]
  speed decimal(8,2) [null]
  recorded_at timestamp [not null]
  is_valid boolean [not null, default: true]
  rejection_reason_id bigint [ref: > gps_rejection_reasons.id, null]
  created_at timestamp

  indexes {
    (activity_id, recorded_at)
    (activity_id, is_valid)
  }
}

// Um split por quilômetro completo, persistido no momento em que fecha
// (US-2.5). Divisões não-quilométricas ficam para uma fase posterior.
Table activity_splits {
  id bigint [pk, increment]
  activity_id bigint [ref: > activities.id, not null]
  kilometer integer [not null]
  duration_seconds integer [not null]
  pace_seconds_per_km integer [not null]
  created_at timestamp

  indexes {
    (activity_id, kilometer) [unique]
  }
}

// Snapshot da execução: copia o que era a etapa no momento da corrida.
// Editar ou excluir o treino não altera estas linhas (US-1.3, US-1.4).
Table activity_steps {
  id bigint [pk, increment]
  activity_id bigint [ref: > activities.id, not null]
  training_step_id bigint [ref: > training_steps.id, null]
  step_type_id bigint [ref: > step_types.id, not null]
  step_execution_status_id bigint [ref: > step_execution_statuses.id, not null]

  position integer [not null]
  // qual repetição do bloco originou esta execução: 1..repeat_count (US-4.2)
  repetition_index integer [not null, default: 1]

  // snapshot do planejado
  planned_duration_seconds integer [not null]
  instructions text [null]

  // o que de fato aconteceu
  actual_duration_seconds integer [not null, default: 0]
  distance_meters decimal(10,2) [not null, default: 0]
  started_at timestamp [null]
  finished_at timestamp [null]

  created_at timestamp
  updated_at timestamp

  indexes {
    (activity_id, position) [unique]
  }
}

// Intervalos de pausa manual de uma atividade. É o que permite calcular
// elapsed_duration_seconds como tempo de atividade e reconstruí-lo após uma
// recuperação: sem a lista de pausas, o tempo pausado seria indistinguível do
// tempo parado involuntário (US-2.4, US-6.3).
Table activity_pause_intervals {
  id bigint [pk, increment]
  activity_id bigint [ref: > activities.id, not null]
  started_at timestamp [not null]
  // null enquanto a pausa está aberta; preenchido ao retomar ou ao finalizar
  finished_at timestamp [null]
  created_at timestamp

  indexes {
    (activity_id, started_at)
  }
}

// ─────────────────────────────────────────────
// Domain — configuração local do dispositivo
// ─────────────────────────────────────────────

// Preferências do app em pares chave-valor (US-5.1): locução e vibração
// ligáveis de forma independente, persistindo entre atividades. Chave-valor
// para não exigir uma migração a cada preferência nova. Não carrega user_id
// de propósito — são preferências do aparelho, não dados do usuário.
Table app_preferences {
  id bigint [pk, increment]
  key varchar [unique, not null]
  // escalar codificado em JSON, para que boolean, número e texto façam
  // roundtrip com o tipo preservado em vez de virar string solta
  value text [not null]
  created_at timestamp
  updated_at timestamp
}
```

## Relationships

- Um **user** tem muitos **training_sessions** e muitas **activities**.
- Um **training_session** tem muitos **training_blocks**, ordenados por `position`.
- Um **training_block** tem muitos **training_steps**, ordenados por `position`, e se repete `repeat_count` vezes.
- Um **training_step** pertence a um **step_type**.
- Uma **activity** pertence a um **activity_type** (corrida livre ou treino estruturado) e a um **activity_status**.
- Uma **activity** opcionalmente referencia o **training_session** que a originou — a FK é nullable, porque corrida livre não tem treino e porque o treino pode ser excluído depois.
- Uma **activity** tem muitos **activity_points**, muitos **activity_splits**, muitos **activity_steps** e muitos **activity_pause_intervals**.
- Um **activity_pause_interval** com `finished_at` nulo é a pausa ainda aberta — existe no máximo uma por atividade.
- Um **activity_point** opcionalmente referencia um **gps_rejection_reason** — preenchido apenas quando `is_valid = false`.
- Um **activity_step** pertence a um **step_type** e a um **step_execution_status**, e opcionalmente referencia o **training_step** que lhe deu origem (nullable, para sobreviver à exclusão do treino).
- **app_preferences** não se relaciona com nada: não tem chave estrangeira e nenhuma tabela aponta para ela. É configuração do aparelho, lida por chave.
- Não há relacionamento muitos-para-muitos no modelo — nenhuma tabela pivot é necessária.

## Lookup Table Seeds

**step_types** — os cinco tipos iniciais da descrição:

| slug | name |
|---|---|
| `warmup` | Aquecimento |
| `run` | Corrida |
| `walk` | Caminhada |
| `recovery` | Recuperação |
| `cooldown` | Desaquecimento |

**activity_types**:

| slug | name |
|---|---|
| `free_run` | Corrida livre |
| `structured` | Treino estruturado |

**activity_statuses**:

| slug | name |
|---|---|
| `in_progress` | Em andamento |
| `paused` | Pausada |
| `finished` | Finalizada |

**step_execution_statuses** — os três desfechos possíveis de uma etapa (US-4.3, US-4.4, US-7.1):

| slug | name |
|---|---|
| `completed` | Concluída |
| `skipped` | Pulada |
| `not_performed` | Não realizada |

**gps_rejection_reasons** — espelham os critérios de filtragem da US-3.1:

| slug | name |
|---|---|
| `low_accuracy` | Precisão acima do limiar |
| `implausible_speed` | Velocidade fisicamente implausível |
| `position_jump` | Salto abrupto de posição |
| `stale_sample` | Intervalo entre medições fora do aceitável |

**app_preferences** — não é tabela lookup, mas nasce semeada com os padrões da tela 14, onde os dois interruptores começam ativos:

| key | value | significado |
|---|---|---|
| `audio_cues_enabled` | `true` | Locução TTS em `pt-BR` ligada |
| `haptic_cues_enabled` | `true` | Vibração dos avisos ligada |

## Notes & Conventions

- **Sem ORM.** Nenhum ORM está instalado no projeto; `expo-sqlite` usa SQL direto. O schema segue o perfil de convenções padrão, não o de um framework específico.
- **Tipos DBML × SQLite.** SQLite não tem `bigint`, `boolean`, `decimal` nem `timestamp` nativos. Na migração real: `bigint` → `INTEGER`, `boolean` → `INTEGER` (0/1), `decimal` → `REAL`, `timestamp` → `TEXT` em ISO-8601 UTC. O DBML aqui é modelagem, não DDL literal.
- **Nenhum campo enum.** Os cinco conjuntos categóricos (tipo de etapa, tipo e status de atividade, status de execução da etapa, motivo de rejeição de GPS) vivem em tabelas lookup com FK.
- **Soft delete só em `training_sessions`.** Permite sumir da biblioteca sem quebrar a FK das atividades antigas (US-1.4). Atividades, pontos e splits são hard delete — a US-8.4 exige remover permanentemente o rastro de localização, e o princípio de privacidade da descrição trata percurso como dado sensível.
- **`elapsed_duration_seconds` é tempo de atividade, não relógio de parede.** Guarda o intervalo entre início e fim **menos as pausas manuais** (US-2.4): durante a pausa o cronômetro exibido congela, e o número do resultado é o mesmo que o corredor viu correndo. O relógio de parede puro segue derivável de `finished_at - started_at`, então nada se perde. A consequência é que `elapsed_duration_seconds - moving_duration_seconds` passa a ser o tempo parado **sem** pausa manual — semáforo, água —, que é exatamente o `TEMPO CAMINHANDO` da tela 08. Com a definição anterior essa diferença misturava pausa manual e parada involuntária, e a decomposição da tela de resultado não fechava.
- **`activity_pause_intervals` é a fonte da verdade das pausas.** Sem a lista de intervalos não há como recalcular `elapsed_duration_seconds` ao recuperar uma atividade interrompida (US-6.3), nem distinguir tempo pausado de tempo parado. O índice `(activity_id, started_at)` cobre a leitura ordenada; a pausa aberta é a linha com `finished_at IS NULL`.
- **Exclusão em cascata.** Apagar uma `activity` deve apagar seus `activity_points`, `activity_splits`, `activity_steps` e `activity_pause_intervals` — vale para o descarte na tela de resultado (US-7.4) e para a exclusão pelo histórico (US-8.4).
- **`activity_steps` é snapshot, não referência.** Copia `step_type_id`, `instructions` e `planned_duration_seconds` no momento da execução. Sem isso, editar um treino reescreveria o histórico, violando a US-1.3.
- **`training_session_name` duplica o nome do treino** na atividade de propósito. É a única denormalização do schema, e existe para que o histórico continue mostrando a origem depois que o treino for excluído (US-8.1).
- **Pontos rejeitados são persistidos** com `is_valid = false` e o motivo. É o que torna possível ajustar os limiares do filtro contra corridas reais — a descrição deixa esses valores explicitamente para experimentação em campo. O índice `(activity_id, is_valid)` mantém a consulta do percurso rápida apesar do volume extra.
- **Volume de dados.** A descrição levanta a preocupação com milhares de pontos por corrida, e guardar os rejeitados aumenta esse número. O índice `(activity_id, recorded_at)` cobre a leitura sequencial do percurso; uma política de expurgo dos rejeitados após a calibração do filtro deve ser considerada.
- **Uma etapa solta é um bloco de `repeat_count = 1`.** Não existe `training_step` fora de um `training_block` — isso evita dois caminhos de leitura para montar a sequência executável.
- **Paces são armazenados em segundos por quilômetro** (inteiro), não como texto `mm:ss`. Formatação é responsabilidade da camada de apresentação.
- **Distâncias em metros**, durações em segundos. A descrição exibe km e `mm:ss`, mas converter na apresentação evita erro de arredondamento acumulado.
- **`rpe` é `null` por decisão de produto** (US-7.3): a atividade pode ser salva sem avaliação e completada depois. Uma atividade com `rpe IS NULL` é o que a US-8.1 chama de "pendente de avaliação". A faixa 1–10 é validada pela aplicação, não pelo banco.
- **`app_preferences` é chave-valor de propósito.** O MVP tem duas preferências (locução e vibração), mas o formato evita uma migração a cada preferência nova, e o custo é baixo porque nada consulta essa tabela por outro critério que não a chave. O `value` guarda um escalar **codificado em JSON** — sem isso, `false` e `"false"` ficariam indistinguíveis num `TEXT`. É a única tabela do schema que abre mão de tipagem por coluna, e o faz porque não é dado de domínio.
- **`app_preferences` não tem `user_id`.** As preferências são do aparelho, não do usuário: a US-5.1 e o design ref da tela 14 as descrevem como locais, e desligar a locução num celular não deveria desligá-la em outro. Por isso ela fica fora do escopo da sincronização futura que motivou a tabela `users`.
- **A persistência das preferências fica em SQLite, não em AsyncStorage.** Decisão do desenvolvedor, para manter um único mecanismo de persistência no app e não acrescentar dependência fora da Tech Stack — o `expo-sqlite` já está no projeto.
- **Conceitos não persistidos:** **Motor de treino** e **Filtro de GPS** são componentes de runtime, não entidades — mas o resultado do filtro é persistido em `activity_points.is_valid` e `gps_rejection_reasons`. **Pace** e **elapsed_time vs moving_time** não são tabelas: são colunas materializadas em `activities` e `activity_splits`. **Auto-pause** está fora do MVP e não tem representação. **Development Build** é preocupação de build, não de dados. **Repositório git aninhado** apareceu na varredura de conceitos por ser um item de Open Questions da descrição, não um conceito de domínio — e já foi resolvido.

## Open Questions

- **Limiares do filtro de GPS.** Os `gps_rejection_reasons` estão modelados, mas os valores que disparam cada motivo seguem indefinidos, a serem determinados por experimentação em campo.
- **Política de expurgo dos pontos rejeitados.** Guardá-los é útil para calibrar o filtro, mas não há decisão sobre por quanto tempo mantê-los depois disso.
- **Retenção de coordenadas.** Segue sem política automática — a exclusão manual (US-8.4) atende ao caso pontual.
- **Cadência de gravação.** Com que frequência os `activity_points` e o estado da `activity` são escritos durante a corrida (US-6.2) ainda não está definido. Afeta diretamente o volume de escrita em SQLite.
- **`users.name` é nullable e sem uso no MVP.** A tabela existe apenas para carregar o `user_id` local decidido na descrição do projeto. Se a sincronização futura não vier, ela pode ser removida.
