# Flux — Project Phases

<!-- inputs: project-description.md@sha256:b1fb623c6dee user-stories.md@sha256:1025d7530e38 database-schema.md@sha256:a1c2b328601e -->

## Overview

O build do Flux é organizado em **21 fases**, sempre **fundação antes de fluxo**. As fases 1 a 5 constroem a base — dependências e build nativo, schema SQLite com migrações e seeds, repositórios com todos os relacionamentos resolvidos, e a fundação de UI (tokens de tema escuro e claro, tipografia, formatadores e componentes compartilhados). Só a partir da fase 6 começam os fluxos do produto, e eles vêm na ordem decidida com o desenvolvedor: **corrida livre primeiro** (filtro de GPS → núcleo da atividade → telas → splits → background → recuperação → resultado → histórico → mapa), e só depois o eixo de treinos (biblioteca → editor → motor → execução estruturada → orientações por áudio). Essa ordem coloca o componente apontado na descrição como o mais crítico do produto — o filtro de GPS — na primeira fase de fluxo, e entrega um app que grava corridas antes de o motor de treino existir.

O **corte do MVP é a fase 21**: todas as 21 fases compõem o primeiro release. A **fase 14 (mapa do percurso)** é deliberadamente isolada porque `expo-maps` está em alpha e a chave do Google Maps ainda não foi provisionada — é a única fase que pode ser cortada sem tocar nas demais, degradando as telas 08 e 12 para o estado "sem percurso para exibir" que os design refs já especificam. Os limiares do filtro de GPS entram com **defaults provisórios documentados em um módulo único**, com os testes escritos contra os limiares configurados e não contra números fixos; a **fase 20** é a calibração em campo que fixa os valores definitivos. Cada fase (pai + subfases) é dimensionada para uma sessão de agente e é referenciada por número quando entregue à implementação.

**Conventions:**
- `[ ]` pending · `[x]` done in the codebase.
- Phases and sub-phases are numbered (`Phase 1`, `Phase 5.3`) for reference by AI agents.
- Business-logic tasks list the **feature tests** to generate; frontend-only tasks list validatable acceptance criteria and a design reference.
- Rótulos de campo (`Task`, `Acceptance criteria`, `Feature tests`, `Design ref`, `Traces`) são contrato de máquina e ficam em inglês; todo o conteúdo é pt-BR.
- Durações em segundos, distâncias em metros, paces em segundos por quilômetro — formatação só na apresentação.

---

## Phase 1: Fundação do projeto — dependências, configuração nativa e tooling

**Goal:** Transformar o template do `create-expo-app` num projeto Flux capaz de usar GPS em background, SQLite, TTS e vibração, com runner de testes. · **Depends on:** none · **Covers:** Tech Stack, workflow 8 (pré-requisitos), assets de marca

### Phase 1.1: Dependências e configuração do Expo

- [ ] **Task:** Instalar as dependências de runtime do Flux via `npx expo install`
  - **Acceptance criteria:**
    - `expo-location`, `expo-task-manager`, `expo-sqlite`, `expo-speech` e `expo-haptics` constam em `apps/mobile/package.json` em versões compatíveis com o SDK 57
    - `pnpm install` completa sem conflito de peer dependencies
    - O app inicia no device sem erro de módulo nativo ausente
    - `expo-maps` **não** é instalado aqui — pertence à fase 14, que é isolável
  - **Traces:** Tech Stack (project-description.md)

- [ ] **Task:** Configurar `app.json` com a identidade Flux e as permissões Android de localização
  - **Acceptance criteria:**
    - `name`, `slug` e `scheme` passam de `mobile` para `flux`; `android.package` definido
    - `orientation: "portrait"` e `userInterfaceStyle: "automatic"`
    - Config plugin de `expo-location` declarado com `isAndroidBackgroundLocationEnabled: true` e `isAndroidForegroundServiceEnabled: true`
    - `android.permissions` inclui `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE` e `FOREGROUND_SERVICE_LOCATION`
    - Nenhuma configuração de iOS é adicionada — o MVP é Android apenas
  - **Traces:** US-6.1, workflow 8 (project-description.md)

- [ ] **Task:** Gerar e documentar o development build Android
  - **Acceptance criteria:**
    - `npx expo prebuild` gera o projeto nativo sem erro e o build instala em device físico
    - O `README.md` de `apps/mobile/` documenta o comando de build e registra explicitamente que **Expo Go não é suportado** (localização em background não funciona nele)
    - O app abre no development build com o menu de dev acessível
  - **Traces:** Development Build (project-description.md), US-6.1

- [x] **Task:** TypeScript em modo `strict` com alias `@/*` → `./src/*`
  - **Acceptance criteria:**
    - `tsconfig.json` estende `expo/tsconfig.base` com `strict: true`
    - `paths` mapeia `@/*` para `./src/*` e `@/assets/*` para `./assets/*`
    - Já satisfeito pelo template; nenhuma alteração necessária
  - **Traces:** Tech Stack (project-description.md)

- [x] **Task:** `expo-router` com typed routes e React Compiler habilitados
  - **Acceptance criteria:**
    - `expo-router` é o `main` do pacote e `experiments.typedRoutes` e `experiments.reactCompiler` estão `true` em `app.json`
    - Já satisfeito pelo template; nenhuma alteração necessária
  - **Traces:** Tech Stack (project-description.md)

### Phase 1.2: Identidade visual e limpeza do template

- [ ] **Task:** Aplicar os assets de marca ao ícone, adaptive icon e splash
  - **Acceptance criteria:**
    - `app.json` aponta o ícone para o asset derivado de `brand/flux-icon.png` no lugar do `icon.png` do template
    - `android.adaptiveIcon` usa o símbolo Flux com fundo na paleta Solar, não o `#E6F4FE` do template
    - O splash usa o símbolo da marca sobre `#15100F`, substituindo o `#208AEF` do template
    - O ícone instalado no launcher é reconhecidamente o do Flux
  - **Design ref:** .spec/init/design/README.md (seção Brand), .spec/init/design/brand/flux-icon.png
  - **Traces:** design/README.md (Brand — "o ícone ainda não está ligado ao app")

- [ ] **Task:** Carregar as fontes Barlow e JetBrains Mono
  - **Acceptance criteria:**
    - As duas famílias são carregadas via `expo-font` antes de esconder o splash
    - Barlow disponível ao menos nos pesos usados nos design refs (incluindo 600 do lockup)
    - JetBrains Mono disponível para rótulos e métricas tabulares
    - Nenhuma tela renderiza com fonte de fallback do sistema após o carregamento
  - **Design ref:** .spec/init/design/README.md (Convenções visuais — Tipografia)
  - **Traces:** design/README.md (Convenções visuais)

- [ ] **Task:** Remover o scaffolding do template do `create-expo-app`
  - **Acceptance criteria:**
    - `src/app/explore.tsx`, `src/components/app-tabs.tsx`, `animated-icon.*`, `web-badge.tsx`, `hint-row.tsx`, `external-link.tsx` e `ui/collapsible.tsx` são removidos ou substituídos
    - Assets do tutorial (`react-logo*`, `expo-badge*`, `expo-logo`, `tutorial-web`, `logo-glow`) removidos de `assets/images/`
    - `scripts/reset-project.js` removido e o script `reset-project` retirado de `package.json`
    - `src/app/index.tsx` fica reduzido a um ponto de entrada limpo, sem conteúdo do template
    - `npx tsc --noEmit` passa sem erro após a remoção
  - **Traces:** Tech Stack (project-description.md — "template padrão, ainda sem código do Flux")

### Phase 1.3: Tooling de testes e qualidade

- [ ] **Task:** Instalar e configurar `jest-expo` como runner de testes
  - **Acceptance criteria:**
    - `jest-expo`, `jest` e `@types/jest` instalados como devDependencies
    - Preset `jest-expo` configurado com `transformIgnorePatterns` cobrindo os pacotes `expo-*` e `react-native`
    - `moduleNameMapper` resolve o alias `@/*`
    - Um teste smoke roda e passa com `pnpm test`
  - **Traces:** Tech Stack (project-description.md — "nenhum runner configurado hoje")

- [ ] **Task:** Criar os scripts de teste e o mock base dos módulos nativos
  - **Acceptance criteria:**
    - Scripts `test` e `test:watch` existem em `package.json`
    - Mocks base para `expo-location`, `expo-task-manager`, `expo-speech` e `expo-haptics` permitem testar a lógica de domínio sem device
    - `expo-sqlite` roda em memória nos testes, sem mock, para que os testes de repositório exercitem SQL real
  - **Traces:** US-3.1, US-4.1 (ambas exigem cobertura por testes automatizados)

- [ ] **Task:** Configurar lint e formatação
  - **Acceptance criteria:**
    - `pnpm lint` roda `expo lint` sem erro no código remanescente após a limpeza
    - Regras de import ordenado e uso do alias `@/*` aplicadas
  - **Traces:** Tech Stack (project-description.md)

---

## Phase 2: Fundação de dados — schema SQLite, migrações e seeds

**Goal:** Materializar o schema inteiro em SQLite, com runner de migrações versionado, índices, cascatas e as cinco tabelas lookup semeadas. · **Depends on:** Phase 1 · **Covers:** todas as 13 tabelas do database-schema.md

### Phase 2.1: Infraestrutura de banco

- [ ] **Task:** Criar o módulo de acesso ao SQLite
  - **Acceptance criteria:**
    - Abre o banco com `openDatabaseAsync` e expõe uma instância única para o app
    - `PRAGMA foreign_keys = ON` é aplicado em toda conexão — sem isso as cascatas do schema não valem
    - `PRAGMA journal_mode = WAL` habilitado para suportar escrita frequente durante a corrida
    - O módulo é utilizável em ambiente de teste com banco em memória
  - **Feature tests:** `foreign keys estão ativas na conexão` → asserta que uma inserção com FK inválida falha; `journal_mode retorna WAL`
  - **Traces:** Notes & Conventions (database-schema.md), US-6.2

- [ ] **Task:** Implementar o runner de migrações versionado por `PRAGMA user_version`
  - **Acceptance criteria:**
    - Migrações são uma lista ordenada de funções, cada uma com número de versão
    - Ao abrir o app, todas as migrações com versão maior que `user_version` são aplicadas em ordem, dentro de uma transação por migração
    - `user_version` é atualizado ao fim de cada migração aplicada
    - Rodar o runner duas vezes seguidas não aplica nada na segunda vez
    - Falha em uma migração faz rollback dela e interrompe as seguintes, sem deixar o banco em estado parcial
  - **Feature tests:** `migração é idempotente` → executa o runner duas vezes e verifica que o schema resultante é idêntico; `migração falha faz rollback` → injeta SQL inválido e asserta que `user_version` não avançou
  - **Traces:** Notes & Conventions (database-schema.md)

- [ ] **Task:** Definir o mapeamento de tipos DBML → SQLite em um único lugar
  - **Acceptance criteria:**
    - `bigint` → `INTEGER`, `boolean` → `INTEGER` (0/1), `decimal` → `REAL`, `timestamp` → `TEXT` ISO-8601 UTC
    - Helpers de leitura e escrita convertem `boolean` e `timestamp` nas duas direções
    - Nenhuma tabela usa tipo fora desse mapeamento
  - **Feature tests:** `boolean roundtrip` → grava `true`/`false` e lê de volta com o mesmo valor; `timestamp roundtrip preserva UTC` → grava uma data e lê sem deslocamento de fuso
  - **Traces:** Notes & Conventions (database-schema.md — "Tipos DBML × SQLite")

### Phase 2.2: Migração inicial — tabelas lookup

- [ ] **Task:** Criar as cinco tabelas lookup
  - **Acceptance criteria:**
    - `step_types`, `activity_types`, `activity_statuses`, `step_execution_statuses` e `gps_rejection_reasons` são criadas com as colunas do schema: `id`, `name`, `slug` (único), `description`, `is_active` (default 1), `created_at`, `updated_at`
    - `slug` tem índice único em todas as cinco
    - Nenhuma coluna enum existe em nenhuma tabela do banco
  - **Feature tests:** `slug duplicado é rejeitado` → asserta violação de unicidade em cada lookup
  - **Traces:** database-schema.md (Lookup tables)

- [ ] **Task:** Semear as cinco tabelas lookup com os valores exatos do schema
  - **Acceptance criteria:**
    - `step_types`: `warmup`/Aquecimento, `run`/Corrida, `walk`/Caminhada, `recovery`/Recuperação, `cooldown`/Desaquecimento
    - `activity_types`: `free_run`/Corrida livre, `structured`/Treino estruturado
    - `activity_statuses`: `in_progress`/Em andamento, `paused`/Pausada, `finished`/Finalizada
    - `step_execution_statuses`: `completed`/Concluída, `skipped`/Pulada, `not_performed`/Não realizada
    - `gps_rejection_reasons`: `low_accuracy`, `implausible_speed`, `position_jump`, `stale_sample` com os nomes do schema
    - O seed é idempotente (upsert por `slug`) e roda a cada abertura sem duplicar linhas
  - **Feature tests:** `seed é idempotente` → roda duas vezes e asserta a contagem exata de linhas em cada lookup; `todos os slugs esperados existem` → asserta os 19 slugs
  - **Traces:** database-schema.md (Lookup Table Seeds)

### Phase 2.3: Migração inicial — tabelas de domínio

- [ ] **Task:** Criar a tabela `users` e o bootstrap do usuário local
  - **Acceptance criteria:**
    - `users` criada com `id`, `name` (nullable), `created_at`, `updated_at`
    - Na primeira execução uma única linha é criada e seu `id` fica disponível para o app
    - Reaberturas não criam linha adicional
    - Nenhuma tela de autenticação ou cadastro existe — o MVP é de usuário único
  - **Feature tests:** `usuário local é criado uma vez só` → abre o app duas vezes e asserta que `users` tem exatamente 1 linha
  - **Traces:** database-schema.md (Domain — usuário local)

- [ ] **Task:** Criar as tabelas de planejamento `training_sessions`, `training_blocks` e `training_steps`
  - **Acceptance criteria:**
    - `training_sessions` com `user_id` (FK not null), `name`, `estimated_duration_seconds` (default 0), `created_at`, `updated_at`, `deleted_at` nullable
    - `training_blocks` com `training_session_id` (FK not null), `position`, `repeat_count` (default 1) e índice único `(training_session_id, position)`
    - `training_steps` com `training_block_id` (FK not null), `step_type_id` (FK not null), `position`, `duration_seconds` (not null), `distance_meters` nullable, `target_rpe` nullable, `instructions` nullable e índice único `(training_block_id, position)`
    - Apagar um `training_block` apaga seus `training_steps` em cascata
    - Não existe caminho para gravar `training_steps` sem `training_block_id`
  - **Feature tests:** `position duplicada no mesmo bloco é rejeitada`; `position duplicada no mesmo treino é rejeitada`; `apagar bloco apaga suas etapas`
  - **Traces:** US-1.1, US-1.2, database-schema.md (Domain — planejamento)

- [ ] **Task:** Criar a tabela `activities`
  - **Acceptance criteria:**
    - Colunas conforme o schema: `user_id`, `activity_type_id`, `activity_status_id` (FKs not null), `training_session_id` e `training_session_name` nullable, `started_at` not null, `finished_at` nullable
    - Métricas `elapsed_duration_seconds`, `moving_duration_seconds`, `distance_meters` com default 0; `average_pace_seconds_per_km` e `best_pace_seconds_per_km` nullable
    - `rpe` e `notes` nullable
    - Índices `(user_id, started_at)` e `activity_status_id` criados
    - A FK `training_session_id` é nullable e não impede a exclusão do treino de origem
  - **Feature tests:** `atividade sem treino é válida` → insere corrida livre com `training_session_id` nulo; `atividade sobrevive à exclusão do treino` → soft delete do treino e asserta que a atividade permanece legível
  - **Traces:** US-2.1, US-2.2, US-7.1, database-schema.md (Domain — execução)

- [ ] **Task:** Criar as tabelas filhas `activity_points`, `activity_splits` e `activity_steps` com exclusão em cascata
  - **Acceptance criteria:**
    - `activity_points` com `latitude`/`longitude` (not null), `altitude`, `accuracy`, `speed` nullable, `recorded_at` not null, `is_valid` default 1, `rejection_reason_id` FK nullable, e índices `(activity_id, recorded_at)` e `(activity_id, is_valid)`
    - `activity_splits` com `kilometer`, `duration_seconds`, `pace_seconds_per_km` not null e índice único `(activity_id, kilometer)`
    - `activity_steps` com `training_step_id` nullable, `step_type_id` e `step_execution_status_id` not null, `position`, `repetition_index` default 1, `planned_duration_seconds`, `instructions`, `actual_duration_seconds` default 0, `distance_meters` default 0, `started_at`/`finished_at` nullable e índice único `(activity_id, position)`
    - As três tabelas declaram `ON DELETE CASCADE` sobre `activities`
    - Apagar uma `activity` remove todos os seus pontos, splits e etapas
  - **Feature tests:** `cascata apaga pontos, splits e etapas` → cria uma atividade completa, apaga e asserta zero linhas nas três tabelas; `split duplicado no mesmo km é rejeitado`; `posição duplicada de etapa na mesma atividade é rejeitada`
  - **Traces:** US-2.5, US-7.4, US-8.4, database-schema.md (Exclusão em cascata)

- [ ] **Task:** Criar e semear a tabela `app_preferences`
  - **Acceptance criteria:**
    - `app_preferences` criada com `id`, `key` (único, not null), `value` (text, not null), `created_at` e `updated_at`
    - A tabela não tem `user_id` nem nenhuma chave estrangeira — é configuração do aparelho, conforme o schema
    - O seed insere `audio_cues_enabled` e `haptic_cues_enabled` com o valor JSON `true`, o estado padrão da tela 14
    - O seed é **insert-if-absent**: uma chave já existente **nunca** é sobrescrita, para que a preferência alterada pelo usuário sobreviva a toda reabertura do app — diferente das lookups, que são upsert
    - `value` guarda escalar codificado em JSON, não texto cru
  - **Feature tests:** `o seed cria as duas chaves na primeira execução`; `o seed não sobrescreve preferência já alterada` → grava `false`, roda o seed de novo e asserta que continua `false`; `key duplicada é rejeitada`
  - **Traces:** US-5.1, database-schema.md (`app_preferences`)

### Phase 2.4: Tipos e utilitários de data

- [ ] **Task:** Declarar os tipos TypeScript espelhando cada tabela
  - **Acceptance criteria:**
    - Um tipo por tabela, com nullability idêntica à do schema
    - Slugs das lookups tipados como união literal (`'warmup' | 'run' | ...`) para dar erro de compilação em valor inválido
    - Nenhuma consulta do app retorna `any`
  - **Traces:** database-schema.md (Schema DBML)

- [ ] **Task:** Criar os helpers de data ISO-8601 UTC
  - **Acceptance criteria:**
    - Toda escrita de `timestamp` usa o helper e grava em UTC no formato ISO-8601
    - Toda leitura converte para o objeto de data da aplicação
    - Diferenças entre dois timestamps são calculadas em segundos inteiros, sem drift de fuso ou horário de verão
  - **Feature tests:** `diferença entre timestamps é imune a fuso` → calcula a diferença entre duas datas gravadas em fusos distintos e asserta o valor em segundos
  - **Traces:** US-2.3 (cronômetro por timestamps), database-schema.md (Notes & Conventions)

---

## Phase 3: Camada de dados — repositórios e relacionamentos

**Goal:** Expor todo o schema à aplicação por repositórios com os relacionamentos já resolvidos, incluindo a leitura da árvore de treino e a exclusão em cascata de atividade. · **Depends on:** Phase 2 · **Covers:** todos os relacionamentos do database-schema.md

### Phase 3.1: Infraestrutura de repositório

- [ ] **Task:** Criar o helper de transação
  - **Acceptance criteria:**
    - Executa um bloco de operações em transação única, com commit ao fim e rollback em qualquer exceção
    - Transações aninhadas usam savepoint em vez de falhar
    - Toda escrita composta (salvar treino, descartar atividade) usa o helper
  - **Feature tests:** `exceção no meio da transação não deixa escrita parcial` → insere duas linhas com falha na segunda e asserta zero linhas gravadas
  - **Traces:** US-1.1, US-7.4, US-8.4

- [ ] **Task:** Criar o repositório de lookups com cache em memória
  - **Acceptance criteria:**
    - Resolve `slug → id` e `id → registro` para `step_types`, `activity_types`, `activity_statuses`, `step_execution_statuses` e `gps_rejection_reasons`
    - As cinco lookups são carregadas uma vez na abertura e servidas de memória — nenhuma consulta por slug durante a corrida
    - Slug inexistente lança erro explícito em vez de retornar `undefined` silencioso
  - **Feature tests:** `slug desconhecido lança erro`; `resolução de slug não consulta o banco após o carregamento inicial`
  - **Traces:** database-schema.md (Lookup tables)

- [ ] **Task:** Criar o repositório de `app_preferences`
  - **Acceptance criteria:**
    - `ler(chave)` e `gravar(chave, valor)` operam por `key`, codificando e decodificando o `value` em JSON
    - Booleanos fazem roundtrip com o tipo preservado — `false` lido de volta é o booleano `false`, nunca a string `"false"`
    - `gravar` de uma chave existente atualiza `value` e `updated_at`; de uma chave nova, insere
    - Chave desconhecida na leitura devolve o default declarado pelo chamador em vez de lançar, para que uma preferência introduzida depois não quebre um banco antigo
    - As preferências são servidas de cache em memória durante a atividade, sem consultar o banco a cada aviso emitido
  - **Feature tests:** `boolean faz roundtrip com o tipo preservado`; `false não vira a string "false"`; `gravar chave existente atualiza em vez de duplicar`; `chave ausente devolve o default do chamador`
  - **Traces:** US-5.1, database-schema.md (`app_preferences`)

### Phase 3.2: Repositórios de planejamento

- [ ] **Task:** Criar o repositório de `training_sessions` com leitura da árvore completa
  - **Acceptance criteria:**
    - `listar()` retorna apenas treinos com `deleted_at IS NULL`, ordenados por atualização mais recente
    - `buscarPorId()` retorna o treino com `training_blocks` ordenados por `position`, cada um com seus `training_steps` ordenados por `position` e o `step_type` resolvido
    - `salvar()` grava treino, blocos e etapas em transação única e materializa `estimated_duration_seconds`
    - `excluir()` faz soft delete gravando `deleted_at`, sem tocar em nenhuma atividade
    - Um treino com soft delete continua legível por `id` para o histórico
  - **Feature tests:** `listagem oculta treinos com deleted_at`; `árvore volta na ordem de position`; `soft delete preserva as atividades originadas do treino`
  - **Traces:** US-1.1, US-1.3, US-1.4, US-8.1

- [ ] **Task:** Criar as operações de `training_blocks`
  - **Acceptance criteria:**
    - Criar, atualizar `repeat_count`, reordenar e remover blocos de um treino
    - Reordenar reescreve `position` de forma contígua a partir de 0, sem violar o índice único
    - Remover um bloco remove suas `training_steps` em cascata
    - `repeat_count` mínimo aceito é 1 (etapa solta); a regra de mínimo 2 para blocos agrupados é da aplicação, não do repositório
  - **Feature tests:** `reordenação mantém positions contíguas e únicas`; `remover bloco remove suas etapas`
  - **Traces:** US-1.2, US-1.3

- [ ] **Task:** Criar as operações de `training_steps`
  - **Acceptance criteria:**
    - Criar, atualizar (tipo, `duration_seconds`, `instructions`), reordenar dentro do bloco e remover etapas
    - Nenhuma operação permite gravar uma etapa sem `training_block_id`
    - `duration_seconds` menor ou igual a zero é rejeitado
    - Reordenação é local ao bloco e mantém `position` contígua
  - **Feature tests:** `duração zero é rejeitada`; `etapa sem bloco é rejeitada`; `reordenação dentro do bloco não afeta outros blocos`
  - **Traces:** US-1.1, US-1.3

### Phase 3.3: Repositórios de execução

- [ ] **Task:** Criar o repositório de `activities`
  - **Acceptance criteria:**
    - `criar()` grava `started_at`, `user_id`, `activity_type_id` e `activity_status_id` (`in_progress`), com `training_session_id` e `training_session_name` quando houver
    - `buscarEmAndamento()` retorna a atividade com `finished_at IS NULL`, se existir
    - `listarFinalizadas()` retorna apenas `finished_at IS NOT NULL`, ordenadas por `started_at DESC`
    - `atualizarMetricas()` grava as métricas consolidadas; `atualizarAvaliacao()` grava `rpe` e `notes` isoladamente
    - Nenhum método permite alterar `started_at`, `distance_meters` ou qualquer métrica objetiva depois de finalizada
  - **Feature tests:** `listagem exclui atividade em andamento`; `ordem é estritamente decrescente por started_at`; `atualização de avaliação não altera métricas objetivas`
  - **Traces:** US-2.1, US-7.3, US-8.1, US-8.3

- [ ] **Task:** Criar o repositório de `activity_points` com inserção em lote
  - **Acceptance criteria:**
    - Insere pontos válidos e rejeitados, gravando `is_valid` e `rejection_reason_id` (preenchido só quando `is_valid = false`)
    - Inserção em lote em transação única, para não pagar uma transação por amostra durante a corrida
    - `listarValidos(activityId)` retorna apenas `is_valid = 1` ordenado por `recorded_at`, usando o índice `(activity_id, is_valid)`
    - `contarPorMotivo(activityId)` agrega os rejeitados por `gps_rejection_reasons`, servindo à calibração da fase 20
  - **Feature tests:** `ponto rejeitado exige motivo`; `ponto válido não tem motivo`; `listagem de válidos ignora os rejeitados`
  - **Traces:** US-3.1, US-6.2, database-schema.md (activity_points)

- [ ] **Task:** Criar o repositório de `activity_splits`
  - **Acceptance criteria:**
    - `registrar()` grava um split imediatamente, com `kilometer`, `duration_seconds` e `pace_seconds_per_km`
    - Tentar gravar o mesmo `kilometer` duas vezes na mesma atividade é rejeitado
    - `listar(activityId)` retorna os splits ordenados por `kilometer`
    - `melhorPace(activityId)` retorna o menor `pace_seconds_per_km`, ou nulo quando não há split
  - **Feature tests:** `split duplicado é rejeitado`; `melhor pace é o menor valor`; `melhor pace de atividade sem split é nulo`
  - **Traces:** US-2.5, US-7.1

- [ ] **Task:** Criar o repositório de `activity_steps`
  - **Acceptance criteria:**
    - `criarSnapshot()` grava a sequência executável completa com `step_type_id`, `instructions`, `planned_duration_seconds`, `position` e `repetition_index` copiados no momento da execução
    - `training_step_id` é gravado como referência opcional e a linha permanece íntegra se o `training_step` de origem for removido
    - `concluir()` grava `actual_duration_seconds`, `distance_meters`, `finished_at` e o `step_execution_status_id` correspondente
    - `contarPorStatus(activityId)` agrega concluídas, puladas e não realizadas
    - Editar o treino de origem depois não altera nenhuma linha já gravada
  - **Feature tests:** `snapshot sobrevive à edição do treino` → altera a etapa de origem e asserta que a linha executada mantém os valores antigos; `snapshot sobrevive à exclusão do treino`; `contagem por status bate com o total de etapas`
  - **Traces:** US-1.3, US-4.1, US-4.3, US-4.4, US-7.1

- [ ] **Task:** Implementar a exclusão em cascata de atividade em transação única
  - **Acceptance criteria:**
    - `excluir(activityId)` remove a `activity` e, em cascata, seus `activity_points`, `activity_splits` e `activity_steps`
    - É hard delete — nenhuma coluna `deleted_at` é usada em atividades
    - A operação inteira roda em transação; falha parcial não deixa linha órfã
    - O `training_session` de origem não é afetado
  - **Feature tests:** `exclusão remove todas as linhas relacionadas`; `exclusão não afeta o treino de origem`; `falha no meio da exclusão faz rollback completo`
  - **Traces:** US-7.4, US-8.4

---

## Phase 4: Fundação de UI — tema, tipografia e formatadores

**Goal:** Estabelecer os tokens visuais nas duas paletas e os formatadores de domínio que toda tela consome. · **Depends on:** Phase 1 · **Covers:** convenções visuais dos design refs, formatação de dados

### Phase 4.1: Tokens de tema

- [ ] **Task:** Definir os tokens de cor da paleta Solar em tema escuro e claro
  - **Acceptance criteria:**
    - Tema escuro: fundo `#15100F`, superfícies `#211814` e `#2A2019`, bordas `#382A20`, texto `#FAF3E6`, secundário `#A89684`
    - Semântica: coral `#FF5E3A` exclusivo de ação, ouro `#FFC857` para dado em destaque, sálvia `#9BC7A8` para confirmação passiva, vermelho `#FF4D4D` para destrutivo e sem sinal
    - Tema claro com os equivalentes dos design refs: fundo `#FBF7F2`, superfícies `#FFFFFF`, borda `#EADFD2`, texto `#1A120E`, secundário `#6B5B4C`, ação `#D6431A`, aviso `#9A6B00`, destrutivo `#C0392B`
    - Nenhuma cor literal aparece fora do módulo de tokens
    - Trocar o tema do sistema troca a paleta sem remontar a navegação
  - **Design ref:** .spec/init/design/README.md (Convenções visuais)
  - **Traces:** design/README.md, decisão de escopo (escuro + claro desde a fundação)

- [ ] **Task:** Definir os tokens de tipografia
  - **Acceptance criteria:**
    - Barlow para números e títulos; JetBrains Mono para rótulos, métricas tabulares e dados
    - Escala cobre os tamanhos dominantes dos design refs, incluindo tempo 208 px @1080, distância 192 px @1080 e tempo restante da etapa 184 px @1080, expressos em dp
    - Métricas usam variante tabular para não dançar a cada atualização de dígito
  - **Design ref:** .spec/init/design/05-activity-free-run.png, .spec/init/design/06-activity-structured.png
  - **Traces:** US-2.3, design/README.md (Tipografia)

- [ ] **Task:** Definir os tokens de espaçamento, raio, sombra e alvo de toque
  - **Acceptance criteria:**
    - Alvo de toque nunca abaixo de ~44 dp; na tela de atividade o botão principal tem ~132 dp de altura
    - Botão primário em pílula com gradiente vertical e sombra colorida `0 14px 34px rgba(255,94,58,0.26)`
    - Superfícies têm hairline interna clara `inset 0 1px 0 rgba(255,255,255,0.045)`
    - Lavagem quente no topo das telas: gradiente do coral a 10% até transparente em 40% da altura
  - **Design ref:** .spec/init/design/README.md (Convenções visuais — Acabamento)
  - **Traces:** design/README.md, US-2.3

- [ ] **Task:** Definir as cores por tipo de etapa
  - **Acceptance criteria:**
    - Aquecimento `#A89684`, corrida `#FF5E3A`, caminhada `#FFC857`, recuperação `#9BC7A8`, desaquecimento `#C79BB0`
    - As cores são resolvidas a partir do `slug` de `step_types`, não de um índice posicional
    - As mesmas cores são usadas no editor, na biblioteca, na tela de atividade e no resultado
  - **Design ref:** .spec/init/design/03-training-editor.md (Notas de implementação)
  - **Traces:** US-1.1, US-4.2, design/README.md

- [ ] **Task:** Criar o hook de tema
  - **Acceptance criteria:**
    - Expõe os tokens já resolvidos para o esquema de cor corrente
    - Segue o esquema do sistema (`userInterfaceStyle: automatic`)
    - Nenhum componente lê `Colors.light`/`Colors.dark` diretamente
  - **Traces:** design/README.md (Convenções visuais)

### Phase 4.2: Formatadores de domínio

- [ ] **Task:** Implementar `formatDistance`
  - **Acceptance criteria:**
    - Recebe metros e devolve quilômetros com vírgula decimal e duas casas (`3180` → `3,18 km`)
    - Zero metros devolve `0,00 km`, nunca vazio ou traço
    - Arredondamento é meia-para-cima e não acumula erro entre chamadas
  - **Feature tests:** `3180 m vira 3,18 km`; `0 m vira 0,00 km`; `999 m vira 1,00 km` (arredondamento); `usa vírgula e não ponto decimal`
  - **Traces:** US-7.1, US-8.1

- [ ] **Task:** Implementar `formatDuration`
  - **Acceptance criteria:**
    - Até 59:59 devolve `mm:ss`; a partir de 1 hora devolve `hh:mm:ss`
    - Segundos e minutos são sempre zero-padded a dois dígitos
    - Duração zero devolve `00:00`
    - Duração negativa é rejeitada em vez de produzir texto inválido
  - **Feature tests:** `1782 s vira 29:42`; `3600 s vira 01:00:00`; `0 s vira 00:00`; `duração negativa lança erro`
  - **Traces:** US-7.1, US-2.3

- [ ] **Task:** Implementar `formatPace` e o cálculo de pace
  - **Acceptance criteria:**
    - Converte segundos por quilômetro em `mm:ss/km` (`560` → `9:20/km`)
    - Pace é calculado a partir de duração e distância em metros; distância zero devolve nulo, exibido como `—`
    - Pace acima de um teto plausível (por exemplo, caminhada muito lenta) ainda é formatado, sem estourar o layout
  - **Feature tests:** `560 s/km vira 9:20/km`; `distância zero devolve nulo`; `pace é derivado de moving_duration e não de elapsed_duration para o pace médio`
  - **Traces:** US-2.3, US-7.1

- [ ] **Task:** Implementar `formatDateTime` em pt-BR
  - **Acceptance criteria:**
    - Formato curto `30 ago · 07:42` para a lista do histórico e `30 ago, 07:42` para os cabeçalhos de detalhe
    - O ano só aparece quando diferente do ano corrente
    - Meses abreviados em português, minúsculos
  - **Feature tests:** `data do ano corrente omite o ano`; `data de outro ano inclui o ano`; `mês sai abreviado em pt-BR`
  - **Traces:** US-8.1, US-8.2

- [ ] **Task:** Implementar a âncora textual do RPE
  - **Acceptance criteria:**
    - 1 a 3 devolve `Fácil`, 4 a 6 devolve `Controlado`, 7 a 10 devolve `Difícil`
    - Valor nulo devolve nulo, exibido como `—/10`
    - Valor fora de 1..10 é rejeitado
  - **Feature tests:** `cada faixa devolve a âncora correta nas bordas (3, 4, 6, 7)`; `nulo devolve nulo`; `0 e 11 são rejeitados`
  - **Traces:** US-7.3, US-8.2

---

## Phase 5: Fundação de UI — componentes compartilhados, navegação e tela inicial

**Goal:** Construir a biblioteca de componentes que todas as telas reusam e o shell de navegação, entregando a tela de Início. · **Depends on:** Phase 3, Phase 4 · **Covers:** design refs 01, componentes compartilhados de 02 a 15

### Phase 5.1: Componentes compartilhados

- [ ] **Task:** Componente `Screen`
  - **Acceptance criteria:**
    - Aplica fundo do tema, safe area e a lavagem quente no topo
    - Aceita cabeçalho opcional com título e ação de voltar
    - Suporta conteúdo rolável e conteúdo fixo ao pé
  - **Design ref:** .spec/init/design/01-home.png
  - **Traces:** design/README.md (Acabamento)

- [ ] **Task:** Componente `Surface` / `Card`
  - **Acceptance criteria:**
    - Superfície com raio, borda e hairline interna clara conforme os tokens
    - Variante tocável com feedback de toque e alvo mínimo respeitado
  - **Design ref:** .spec/init/design/02-training-library.png
  - **Traces:** design/README.md

- [ ] **Task:** Componentes de botão — primário, secundário e destrutivo
  - **Acceptance criteria:**
    - Primário em pílula com gradiente vertical e sombra coral; secundário em contorno; destrutivo em vermelho
    - Estado desabilitado visualmente distinto e não tocável
    - Altura mínima 48 dp; variante de atividade com ~132 dp
  - **Design ref:** .spec/init/design/01-home.png, .spec/init/design/05-activity-free-run.png
  - **Traces:** US-2.1, US-2.4, design/README.md

- [ ] **Task:** Componente `Chip`
  - **Acceptance criteria:**
    - Renderiza rótulos curtos como `5 min caminhada` e `6× 2 min corrida + 2 min caminhada`
    - Quebra em múltiplas linhas sem cortar texto
    - Aceita cor de tipo de etapa
  - **Design ref:** .spec/init/design/02-training-library.png
  - **Traces:** US-1.2, US-8.1

- [ ] **Task:** Componentes `MetricTile` e `MetricGrid`
  - **Acceptance criteria:**
    - Rótulo em JetBrains Mono maiúsculo e valor em Barlow, alinhados conforme os design refs
    - Valor ausente renderiza `—` sem quebrar o alinhamento da grade
    - A grade acomoda 2 e 4 células
  - **Design ref:** .spec/init/design/08-activity-result.png
  - **Traces:** US-7.1, US-8.2

- [ ] **Task:** Componente `SectionHeader`
  - **Acceptance criteria:**
    - Título em maiúsculas com contagem opcional (`ETAPAS EXECUTADAS · 14`) e ação opcional à direita (`Ver todas`)
  - **Design ref:** .spec/init/design/12-history-detail.png
  - **Traces:** US-7.1, US-8.2

- [ ] **Task:** Componente `BottomSheet`
  - **Acceptance criteria:**
    - Sheet sobre a tela corrente com véu `rgba(0,0,0,0.4)` e dispensa por toque fora, configurável
    - Suporta conteúdo rolável e ações fixas ao pé
    - Respeita a safe area inferior
  - **Design ref:** .spec/init/design/03-training-editor.png, .spec/init/design/14-audio-cues.png
  - **Traces:** US-1.1, US-5.1

- [ ] **Task:** Componente `ConfirmDialog`
  - **Acceptance criteria:**
    - Modal com título, texto, resumo opcional e duas ações, uma delas podendo ser destrutiva
    - Variante não dispensável (sem toque fora, sem voltar do sistema) para a recuperação de atividade
    - Cancelar sempre fecha sem efeito colateral
  - **Design ref:** .spec/init/design/10-activity-discard.png, .spec/init/design/13-activity-recovery.png
  - **Traces:** US-1.4, US-6.3, US-7.4, US-8.4

- [ ] **Task:** Componente `EmptyState`
  - **Acceptance criteria:**
    - Título, texto explicativo e ação opcional
    - Usado pela biblioteca vazia, pelo histórico vazio e pela lista de etapas vazia do editor
  - **Design ref:** .spec/init/design/11-history-list.png
  - **Traces:** US-1.1, US-8.1

- [ ] **Task:** Componente `SwitchRow`
  - **Acceptance criteria:**
    - Linha com rótulo, legenda secundária e interruptor
    - Interruptor ativo usa coral de ação; alvo de toque cobre a linha inteira
  - **Design ref:** .spec/init/design/14-audio-cues.png
  - **Traces:** US-5.1

- [ ] **Task:** Componente `GpsStatusPill`
  - **Acceptance criteria:**
    - Três estados visuais: `GPS: boa precisão` (sálvia), `GPS: precisão degradada` (ouro, em faixa própria), `GPS: sem sinal` (vermelho, com texto explicativo)
    - Aceita também o estado `GPS: sem precisão aceitável` usado antes de iniciar
    - O componente só consome o estado; não calcula nada
  - **Design ref:** .spec/init/design/05-activity-free-run.md (Estados)
  - **Traces:** US-3.2, US-2.1

### Phase 5.2: Navegação e tela de Início

- [ ] **Task:** Montar o shell de navegação com `expo-router`
  - **Acceptance criteria:**
    - Stack com as rotas do MVP: início, biblioteca, editor de treino, pré-início, atividade, resultado, RPE, histórico, detalhe da atividade
    - Sem abas — a navegação parte da tela de Início, conforme o design ref 01
    - Typed routes compila sem erro e nenhuma navegação usa string literal solta
    - A rota de atividade não permite voltar por gesto durante a corrida
  - **Design ref:** .spec/init/design/01-home.png
  - **Traces:** US-2.1, US-8.1

- [ ] **Task:** Implementar a tela de Início (tela 01)
  - **Acceptance criteria:**
    - Título `Flux`, cartão `CORRIDA LIVRE` com a descrição exata do design ref e botão `Iniciar corrida livre` com altura mínima ~48 dp
    - Linha `Biblioteca de treinos` com contagem real (`Nenhum treino` / `1 treino` / `N treinos`), lida dos treinos não excluídos
    - Linha `Histórico` com resumo da última atividade no formato `Última: 3,18 km · 29:41`, ou `Nenhuma atividade` quando vazio
    - Ambas as linhas com chevron `›` e navegação para as telas 02 e 11
    - Nenhum logotipo ou ilustração — a marca é apenas o wordmark textual
    - O botão de corrida livre navega para o fluxo de início, cujo comportamento de permissão e GPS é implementado na fase 8
  - **Design ref:** .spec/init/design/01-home.png
  - **Traces:** US-2.1, US-8.1

---

## Phase 6: Filtro de GPS e serviço de localização

**Goal:** Entregar o componente apontado na descrição como o mais crítico do produto — validação de amostras, acúmulo de distância confiável e leitura da qualidade do sinal. · **Depends on:** Phase 2 · **Covers:** workflow 4, `gps_rejection_reasons`

### Phase 6.1: Configuração de limiares

- [ ] **Task:** Criar o módulo único de limiares do filtro de GPS com defaults provisórios
  - **Acceptance criteria:**
    - Um único módulo exporta `maxAccuracyMeters`, `maxPlausibleSpeedMetersPerSecond`, `maxPositionJumpMeters`, `maxSampleIntervalSeconds` e `minSampleIntervalSeconds`
    - Cada valor traz comentário com a justificativa e a marca explícita de **provisório, a calibrar em campo (fase 20)**
    - Os defaults respeitam a ordem de grandeza da descrição: `accuracy = 5 m` aceitável, `accuracy = 60 m` rejeitada
    - Nenhum limiar aparece hardcoded em qualquer outro arquivo
    - Os testes do filtro importam os limiares deste módulo em vez de repetir números
  - **Feature tests:** `nenhum limiar está hardcoded fora do módulo` → varredura estática; `accuracy de 5 m é aceita e de 60 m é rejeitada com os defaults`
  - **Traces:** US-3.1, Open Questions (project-description.md — limiares do filtro)

### Phase 6.2: Regras de validação e distância

- [ ] **Task:** Implementar o cálculo de distância entre coordenadas
  - **Acceptance criteria:**
    - Distância haversine entre dois pares de latitude/longitude, em metros
    - Precisão suficiente para distâncias curtas (dezenas de metros) sem erro de arredondamento acumulado
    - Distância entre um ponto e ele mesmo é exatamente zero
  - **Feature tests:** `distância conhecida entre dois pontos bate com a referência dentro de 0,5 %`; `ponto contra si mesmo devolve zero`; `soma de segmentos curtos não acumula erro perceptível em 1000 pontos`
  - **Traces:** US-2.3, US-3.1

- [ ] **Task:** Implementar a regra de precisão máxima (`low_accuracy`)
  - **Acceptance criteria:**
    - Amostra com `accuracy` acima de `maxAccuracyMeters` é rejeitada com motivo `low_accuracy`
    - Amostra sem `accuracy` informada é tratada como suspeita e rejeitada com o mesmo motivo
    - A amostra rejeitada não vira ponto do percurso e não soma distância
  - **Feature tests:** `accuracy acima do limiar é rejeitada com low_accuracy`; `accuracy ausente é rejeitada`; `accuracy no limiar exato é aceita`
  - **Traces:** US-3.1

- [ ] **Task:** Implementar a regra de velocidade implausível (`implausible_speed`)
  - **Acceptance criteria:**
    - Velocidade derivada da distância e do intervalo desde o último ponto **aceito** é comparada a `maxPlausibleSpeedMetersPerSecond`
    - Acima do limiar, a amostra é rejeitada com motivo `implausible_speed`
    - A regra usa o último ponto aceito, nunca o último ponto recebido — senão uma amostra ruim contamina a seguinte
  - **Feature tests:** `deslocamento de 500 m em 2 s é rejeitado`; `velocidade de corrida normal é aceita`; `após uma rejeição, a próxima amostra é comparada contra o último ponto aceito`
  - **Traces:** US-3.1

- [ ] **Task:** Implementar a regra de salto abrupto de posição (`position_jump`)
  - **Acceptance criteria:**
    - Deslocamento acima de `maxPositionJumpMeters` em relação ao último ponto aceito é rejeitado com motivo `position_jump`
    - A regra é avaliada independentemente da velocidade, para pegar saltos com intervalo longo que passariam no teste de velocidade
  - **Feature tests:** `salto de 300 m é rejeitado mesmo com intervalo longo`; `deslocamento normal entre amostras consecutivas é aceito`
  - **Traces:** US-3.1

- [ ] **Task:** Implementar a regra de intervalo entre medições (`stale_sample`)
  - **Acceptance criteria:**
    - Amostra com `recorded_at` fora da janela `[minSampleIntervalSeconds, maxSampleIntervalSeconds]` em relação ao último ponto aceito é rejeitada com motivo `stale_sample`
    - Amostra com `recorded_at` anterior ao último ponto aceito é rejeitada (chegada fora de ordem)
    - Amostra duplicada (mesmo `recorded_at`) é rejeitada
  - **Feature tests:** `amostra fora de ordem é rejeitada`; `amostra duplicada é rejeitada`; `intervalo muito longo é rejeitado como stale_sample`
  - **Traces:** US-3.1

- [ ] **Task:** Implementar o orquestrador do filtro
  - **Acceptance criteria:**
    - Recebe uma amostra e o estado do filtro e devolve `{ aceito: true, distanciaIncremental }` ou `{ aceito: false, motivo }`
    - As regras são avaliadas em ordem determinística e o motivo devolvido é o da primeira regra violada
    - A primeira amostra da atividade é aceita se passar na regra de precisão, sem incrementar distância
    - O estado do filtro é serializável, para sobreviver à recuperação de atividade interrompida
    - A função é pura: não escreve no banco e não depende de relógio global
  - **Feature tests:** `série sintética com pontos de accuracy 60 m produz a mesma distância que a série sem eles` (resultado esperado da US-3.1); `primeira amostra não soma distância`; `motivo devolvido é o da primeira regra violada`; `estado serializado e restaurado produz a mesma decisão`
  - **Traces:** US-3.1

- [ ] **Task:** Implementar o tratamento de lacuna de sinal
  - **Acceptance criteria:**
    - Um intervalo sem amostras válidas acima de `maxSampleIntervalSeconds` é marcado como lacuna
    - A primeira amostra válida após a lacuna **não** soma a distância em linha reta desde antes da lacuna
    - O percurso registra a descontinuidade, para que o mapa não ligue os dois lados com um segmento reto
    - A distância não avança durante a lacuna
  - **Feature tests:** `dois minutos sem sinal não geram distância`; `retomada após lacuna não soma o salto`; `lacuna é marcada no percurso e não vira segmento reto`
  - **Traces:** US-3.3, US-7.2

### Phase 6.3: Serviço de localização

- [ ] **Task:** Implementar o wrapper de permissões de localização
  - **Acceptance criteria:**
    - Foreground e background são verificados e solicitados em **chamadas separadas**, nessa ordem
    - O wrapper devolve os dois estados individualmente: concedida, negada, negada permanentemente
    - Quando a permissão foi negada permanentemente, expõe o atalho para as configurações do app no sistema
    - Nenhuma coleta é iniciada sem a permissão de foreground concedida
  - **Feature tests:** `background só é solicitado após foreground concedido`; `negativa permanente é distinguida de negativa simples`
  - **Traces:** US-2.1, US-6.1

- [ ] **Task:** Implementar a aquisição do fix inicial de GPS
  - **Acceptance criteria:**
    - Antes de iniciar, o app tenta obter uma posição com `accuracy` dentro de `maxAccuracyMeters`
    - Expõe o estado da tentativa em tempo real, para a UI da tela 07 atualizar o indicador enquanto aguarda
    - Não bloqueia o início: a decisão de iniciar sem fix é do usuário
    - A tentativa é cancelável ao sair da tela
  - **Feature tests:** `fix dentro do limiar libera o estado boa precisão`; `ausência de fix mantém o estado sem precisão aceitável sem bloquear`
  - **Traces:** US-2.1, US-2.2

- [ ] **Task:** Implementar a assinatura de atualizações de localização com `expo-task-manager`
  - **Acceptance criteria:**
    - A task é registrada com `TaskManager.defineTask()` **no topo do módulo**, fora de qualquer componente
    - A assinatura usa `startLocationUpdatesAsync` com a frequência de coleta definida em um único ponto de configuração
    - As amostras recebidas são entregues ao orquestrador do filtro, não consumidas direto pela UI
    - Parar a atividade encerra a assinatura e libera o recurso
  - **Feature tests:** `task registrada no topo do módulo é encontrada pelo TaskManager`; `parar a atividade encerra a assinatura`
  - **Traces:** US-6.1, US-6.2

- [ ] **Task:** Implementar o avaliador de qualidade do sinal
  - **Acceptance criteria:**
    - Deriva o estado da `accuracy` **média das amostras recentes**, nunca de uma leitura isolada
    - Distingue exatamente três estados: boa precisão, precisão degradada e sem sinal
    - Ausência de amostra válida por um intervalo configurado leva ao estado sem sinal
    - A transição entre estados tem histerese suficiente para não piscar entre duas leituras adjacentes
  - **Feature tests:** `uma leitura ruim isolada não muda o estado`; `janela consistentemente ruim muda para precisão degradada`; `ausência de amostras leva a sem sinal`; `retorno do sinal volta a boa precisão`
  - **Traces:** US-3.2, US-3.3

---

## Phase 7: Núcleo da atividade — máquina de estados, cronômetro e persistência

**Goal:** Construir o motor da atividade: estados, cronômetro por timestamps, distância, paces, persistência incremental e consolidação final. · **Depends on:** Phase 3, Phase 6 · **Covers:** workflows 2, 3, 9, 10

- [ ] **Task:** Implementar a máquina de estados da atividade
  - **Acceptance criteria:**
    - Estados `in_progress`, `paused` e `finished`, espelhados em `activity_statuses` a cada transição
    - Transições válidas: início → `in_progress`; `in_progress` ↔ `paused`; ambos → `finished`
    - Transição inválida é rejeitada em vez de mudar o estado silenciosamente
    - `finished` é terminal — nenhuma transição sai dele
  - **Feature tests:** `retomar sem estar pausada é rejeitado`; `finalizar de qualquer estado é permitido`; `nenhuma transição sai de finished`; `o status persistido acompanha o estado em memória`
  - **Traces:** US-2.1, US-2.4, US-4.4

- [ ] **Task:** Implementar o cronômetro por timestamps
  - **Acceptance criteria:**
    - `elapsed` é sempre derivado de `started_at` e do instante corrente, nunca de contagem de ticks
    - O tick de UI só dispara re-render; o valor exibido é recalculado a cada render a partir dos timestamps
    - Ao voltar do background, o tempo exibido está correto sem defasagem acumulada
    - A mudança de relógio do sistema durante a atividade não produz tempo negativo
  - **Feature tests:** `elapsed após simular 30 min em background bate com o tempo de parede`; `elapsed não depende do número de ticks executados`; `relógio recuado não produz elapsed negativo`
  - **Traces:** US-2.3, US-6.1

- [ ] **Task:** Implementar o registro de intervalos de pausa
  - **Acceptance criteria:**
    - Cada pausa grava o instante de início e, ao retomar, o de fim
    - `elapsed` inclui o tempo pausado; `moving_duration` não
    - O estado de pausa é persistido, sobrevivendo ao app ir para background e a um encerramento
    - Durante a pausa nenhuma amostra de GPS é incorporada ao percurso
  - **Feature tests:** `tempo pausado conta para elapsed e não para moving`; `pontos recebidos durante a pausa não entram no percurso`; `estado de pausa sobrevive ao background`
  - **Traces:** US-2.4, US-6.1

- [ ] **Task:** Implementar o critério de movimento e o acúmulo de `moving_duration`
  - **Acceptance criteria:**
    - Um critério explícito e configurável separa "parado" de "em movimento" — limiar de velocidade e/ou deslocamento mínimo entre amostras aceitas
    - O critério vive no mesmo módulo de configuração dos limiares de GPS, marcado como provisório e a calibrar na fase 20
    - `moving_duration` acumula apenas os intervalos em movimento entre amostras aceitas
    - Não há auto-pause: o estado da atividade não muda por causa desse critério — ele só afeta a métrica
  - **Feature tests:** `parada sem pausa manual não avança moving_duration`; `moving_duration nunca excede elapsed`; `o critério não altera o status da atividade`
  - **Traces:** US-2.4, US-7.1, Open Questions (project-description.md — detecção de movimento)

- [ ] **Task:** Implementar a criação da atividade no início
  - **Acceptance criteria:**
    - A linha em `activities` é criada com `started_at` **antes** de qualquer ponto ser coletado
    - `activity_type_id` recebe `free_run` na corrida livre
    - `activity_status_id` recebe `in_progress`
    - `user_id` vem do usuário local criado no bootstrap
    - Se a criação falhar, a atividade não inicia e o usuário é avisado — nunca se corre sem registro
  - **Feature tests:** `a atividade existe no banco antes do primeiro ponto`; `falha na criação impede o início`
  - **Traces:** US-2.1, US-6.2

- [ ] **Task:** Implementar a ingestão de amostras e a persistência dos pontos
  - **Acceptance criteria:**
    - Cada amostra passa pelo orquestrador do filtro antes de qualquer efeito
    - Amostras aceitas são gravadas em `activity_points` com `is_valid = 1`; rejeitadas com `is_valid = 0` e o `rejection_reason_id` correspondente
    - A gravação é feita em lotes, em cadência configurável, para não pagar uma transação por amostra
    - Um lote pendente é descarregado ao pausar, ao finalizar e ao ir para background
  - **Feature tests:** `amostra rejeitada é persistida com motivo e não soma distância`; `lote pendente é descarregado ao pausar`; `nenhuma amostra é perdida entre lotes`
  - **Traces:** US-3.1, US-6.2

- [ ] **Task:** Implementar o acúmulo de distância
  - **Acceptance criteria:**
    - `distance_meters` só avança com pontos aceitos pelo filtro
    - Lacunas de sinal não somam distância
    - A distância acumulada em memória e a derivável dos pontos persistidos são consistentes ao fim da atividade
  - **Feature tests:** `distância acumulada bate com a soma dos segmentos entre pontos válidos`; `pontos rejeitados não alteram a distância`
  - **Traces:** US-2.3, US-3.1, US-3.3

- [ ] **Task:** Implementar o cálculo de pace atual e pace médio
  - **Acceptance criteria:**
    - Pace atual usa uma janela recente de amostras válidas, com tamanho de janela configurável
    - Pace médio usa `distance_meters` e `moving_duration_seconds` acumulados
    - Sem base suficiente, ambos devolvem nulo — exibido como `—`
    - Durante a pausa e no estado sem sinal, o pace atual devolve nulo
  - **Feature tests:** `pace atual é nulo nos primeiros segundos`; `pace atual é nulo em pausa e sem sinal`; `pace médio usa moving e não elapsed`
  - **Traces:** US-2.3, US-3.2

- [ ] **Task:** Implementar a gravação periódica do estado da atividade
  - **Acceptance criteria:**
    - As métricas correntes (`elapsed`, `moving`, `distance`) são gravadas em `activities` em cadência configurável durante a execução, não só ao finalizar
    - A cadência é definida em um único ponto e documentada como decisão provisória
    - A gravação periódica não bloqueia a UI nem a ingestão de amostras
    - Um encerramento forçado preserva no banco tudo que havia sido percorrido até a última gravação
  - **Feature tests:** `estado é gravado sem finalizar a atividade`; `encerramento forçado preserva as métricas da última gravação`
  - **Traces:** US-6.2, Open Questions (database-schema.md — cadência de gravação)

- [ ] **Task:** Implementar a consolidação de métricas na finalização
  - **Acceptance criteria:**
    - `finished_at`, `elapsed_duration_seconds`, `moving_duration_seconds`, `distance_meters`, `average_pace_seconds_per_km` e `best_pace_seconds_per_km` são gravados em uma transação
    - `activity_status_id` passa a `finished`
    - `best_pace_seconds_per_km` é o menor pace entre os `activity_splits`; nulo quando não há split
    - `average_pace_seconds_per_km` é nulo quando a distância é zero
    - Após a consolidação nenhuma métrica objetiva é alterável
  - **Feature tests:** `atividade sem split tem best_pace nulo`; `atividade sem distância tem average_pace nulo`; `consolidação é atômica`; `métricas objetivas não mudam após finished_at`
  - **Traces:** US-7.1, US-8.3

- [ ] **Task:** Expor o estado da atividade à camada de UI
  - **Acceptance criteria:**
    - Um contexto/hook único expõe estado, métricas, qualidade do sinal e ações (pausar, retomar, finalizar)
    - A UI não acessa repositórios nem o serviço de localização diretamente
    - O hook sobrevive à navegação entre a tela de atividade e outras telas sem perder o estado
  - **Traces:** US-2.3, US-2.4

---

## Phase 8: Telas da atividade em andamento — corrida livre e bloqueios de início

**Goal:** Entregar o fluxo visível da corrida livre: verificação de permissão e sinal, e a tela de atividade nos quatro estados. · **Depends on:** Phase 5, Phase 7 · **Covers:** design refs 05, 07 e o acionamento da tela 01

### Phase 8.1: Fluxo de início e bloqueios

- [ ] **Task:** Ligar o botão `Iniciar corrida livre` ao fluxo de início
  - **Acceptance criteria:**
    - O toque verifica permissão de foreground e de background e, se ausentes, as solicita
    - Com permissão concedida e fix aceitável, cria a atividade e navega para a tela 05
    - Com permissão negada, navega para a variante bloqueante da tela 07 e **não** cria atividade
    - Sem fix aceitável, abre o sheet de aviso da tela 07 sem criar atividade
    - Havendo atividade pendente de resolução, o início é bloqueado (comportamento completo na fase 11)
  - **Design ref:** .spec/init/design/01-home.md (Interações)
  - **Traces:** US-2.1, US-6.3

- [ ] **Task:** Implementar a tela 07 na variante permissão negada
  - **Acceptance criteria:**
    - Marca de alerta `!` em vermelho, título e texto exatos do design ref
    - Quadro de status com duas linhas — `Localização em uso` e `Localização em segundo plano` — refletindo o estado real de cada permissão
    - Quando só o background está negado, a primeira linha mostra `Concedida` e o texto acrescenta a frase sobre a gravação parar quando a tela apaga
    - Ações `Abrir configurações` (abre as configurações do app no sistema) e `Voltar ao início`
    - Não existe nenhum caminho para iniciar a atividade nesta variante
  - **Design ref:** .spec/init/design/07-activity-blocked.png
  - **Traces:** US-2.1, US-6.1

- [ ] **Task:** Implementar a tela 07 na variante GPS sem fix
  - **Acceptance criteria:**
    - Sheet sobre a tela de origem, com indicador ouro `GPS: sem precisão aceitável`, título e texto exatos do design ref
    - Ações `Iniciar assim mesmo` e `Aguardar sinal` (primária)
    - `Iniciar assim mesmo` cria a atividade normalmente e abre a tela de atividade já no estado degradado ou sem sinal
    - `Aguardar sinal` mantém o sheet monitorando a `accuracy`; quando o fix chega, o indicador vira verde e a ação primária passa a `Iniciar`
    - O sheet não bloqueia: sair dele volta à tela de origem sem criar atividade
  - **Design ref:** .spec/init/design/07-activity-blocked.png
  - **Traces:** US-2.1, US-2.2, US-3.2

### Phase 8.2: Tela de atividade — corrida livre

- [ ] **Task:** Implementar o layout base da tela 05
  - **Acceptance criteria:**
    - Rótulo de contexto `CORRIDA LIVRE`, tempo decorrido dominante com rótulo `TEMPO`, distância com rótulo `DISTÂNCIA`
    - `Pace atual` e `Pace médio` como informação secundária, no formato `mm:ss /km`
    - Botão `PAUSAR` de largura cheia e ~132 dp de altura
    - Indicador de GPS ao pé
    - Hierarquia tipográfica conforme os tokens: tempo e distância legíveis de relance em movimento
  - **Design ref:** .spec/init/design/05-activity-free-run.png
  - **Traces:** US-2.3

- [ ] **Task:** Implementar o estado rodando com boa precisão
  - **Acceptance criteria:**
    - Indicador sálvia `GPS: boa precisão`
    - Tempo, distância e paces atualizam continuamente a partir do hook de atividade
    - Nenhum valor pisca ou muda de largura entre atualizações (numerais tabulares)
  - **Design ref:** .spec/init/design/05-activity-free-run.md (Estados)
  - **Traces:** US-2.3, US-3.2

- [ ] **Task:** Implementar o estado de precisão degradada
  - **Acceptance criteria:**
    - Indicador ouro `GPS: precisão degradada` dentro de faixa `#2A1F0C` (equivalente claro nos tokens)
    - As métricas continuam sendo atualizadas normalmente
  - **Design ref:** .spec/init/design/05-activity-free-run.md (Estados)
  - **Traces:** US-3.2

- [ ] **Task:** Implementar o estado sem sinal
  - **Acceptance criteria:**
    - Indicador vermelho `GPS: sem sinal` com o texto `O tempo continua contando. A distância volta a avançar quando o sinal retornar.`
    - A distância fica cinza e o rótulo passa a `DISTÂNCIA · SEM AVANÇAR`
    - `Pace atual` exibe `—`
    - O cronômetro continua avançando
  - **Design ref:** .spec/init/design/05-activity-free-run.md (Estados)
  - **Traces:** US-3.2, US-3.3

- [ ] **Task:** Implementar o estado pausada
  - **Acceptance criteria:**
    - Selo `PAUSADA` ao lado do rótulo de contexto; tempo em ouro com rótulo `TEMPO · PARADO`
    - `Pace atual` exibe `—`
    - `PAUSAR` é substituído por `RETOMAR` (primário) e `FINALIZAR` (contorno, vermelho)
    - A tela reflete o estado real da máquina de estados, inclusive ao voltar do background já pausada
  - **Design ref:** .spec/init/design/05-activity-free-run.md (Estados)
  - **Traces:** US-2.4

- [ ] **Task:** Ligar as ações pausar, retomar e finalizar
  - **Acceptance criteria:**
    - `PAUSAR` para o cronômetro e interrompe a incorporação de pontos ao percurso
    - `RETOMAR` continua de onde parou, com distância, tempo e splits consistentes
    - `FINALIZAR` consolida as métricas e navega para a tela 08
    - A ação em curso é debounced — dois toques rápidos não geram duas transições
  - **Design ref:** .spec/init/design/05-activity-free-run.md (Interações)
  - **Traces:** US-2.4, US-7.1

- [ ] **Task:** Ligar o indicador de GPS ao avaliador de qualidade do sinal
  - **Acceptance criteria:**
    - O componente consome exclusivamente o estado calculado na fase 6, sem recalcular nada
    - A mudança de estado é visivelmente perceptível sem o usuário interpretar números
    - Os três estados são alcançáveis em teste manual forçando as condições
  - **Design ref:** .spec/init/design/05-activity-free-run.md (Estados)
  - **Traces:** US-3.2

- [ ] **Task:** Impedir a saída acidental da tela de atividade
  - **Acceptance criteria:**
    - O gesto e o botão de voltar do sistema não descartam a atividade em andamento
    - Sair para a tela de Início mantém a atividade rodando e oferece caminho de volta
  - **Design ref:** .spec/init/design/05-activity-free-run.md
  - **Traces:** US-2.4, US-6.2

---

## Phase 9: Splits por quilômetro

**Goal:** Fechar e persistir um split a cada quilômetro completo, sobrevivente a encerramento inesperado. · **Depends on:** Phase 7 · **Covers:** workflow 7, `activity_splits`

- [ ] **Task:** Implementar o detector de quilômetro completo
  - **Acceptance criteria:**
    - O cruzamento de cada múltiplo de 1000 m de distância acumulada dispara o fechamento de um split
    - O detector usa a distância acumulada por pontos válidos, não a distância bruta das amostras
    - Um único segmento longo que cruza mais de um quilômetro fecha todos os splits correspondentes, em ordem
  - **Feature tests:** `cruzar 1000 m fecha o split 1`; `um segmento de 2500 m a partir de 0 fecha os splits 1 e 2`; `distância que não cruza o múltiplo não fecha split`
  - **Traces:** US-2.5

- [ ] **Task:** Implementar o cálculo de duração e pace do split
  - **Acceptance criteria:**
    - `duration_seconds` do split é o tempo em movimento decorrido desde o fechamento do split anterior (ou desde o início, para o primeiro)
    - `pace_seconds_per_km` é derivado dessa duração para exatamente 1 km
    - O tempo pausado não entra na duração do split
  - **Feature tests:** `pace do split bate com a duração do quilômetro`; `pausa no meio do quilômetro não infla o pace do split`
  - **Traces:** US-2.5, US-7.1

- [ ] **Task:** Persistir o split no momento em que fecha
  - **Acceptance criteria:**
    - A linha em `activity_splits` é gravada imediatamente no fechamento, não ao final da atividade
    - Um encerramento forçado logo após o fechamento preserva o split no banco
    - Gravar o mesmo quilômetro duas vezes é impedido pelo índice único e tratado sem quebrar a atividade
  - **Feature tests:** `split existe no banco antes de a atividade terminar`; `uma corrida de 3,18 km produz exatamente 3 splits persistidos` (resultado esperado da US-2.5); `tentativa de split duplicado não interrompe a atividade`
  - **Traces:** US-2.5, US-6.2

- [ ] **Task:** Garantir que a distância parcial não gera split
  - **Acceptance criteria:**
    - Os metros após o último quilômetro completo não produzem linha em `activity_splits`
    - A distância parcial continua contando para `distance_meters` da atividade
    - A tela de resultado exibe `Nenhum quilômetro completo.` quando não há split
  - **Feature tests:** `corrida de 800 m não gera split`; `corrida de 3,18 km não gera um quarto split`
  - **Traces:** US-2.5, US-7.1

- [ ] **Task:** Recalcular `best_pace_seconds_per_km` a cada split fechado
  - **Acceptance criteria:**
    - O melhor pace da atividade é atualizado no fechamento de cada split
    - Atividade sem split mantém `best_pace_seconds_per_km` nulo
    - O valor final coincide com o menor `pace_seconds_per_km` dos splits persistidos
  - **Feature tests:** `melhor pace acompanha o menor split`; `atividade sem split mantém best_pace nulo`
  - **Traces:** US-7.1

- [ ] **Task:** Preservar a continuidade do quilômetro parcial na retomada
  - **Acceptance criteria:**
    - Ao retomar de uma pausa, o quilômetro em curso continua acumulando a partir de onde parou
    - Ao recuperar uma atividade interrompida, o progresso do quilômetro parcial é reconstruído a partir dos pontos e splits persistidos
    - Nenhum split é reemitido na retomada
  - **Feature tests:** `retomada não reemite split já fechado`; `progresso parcial do quilômetro é reconstruído a partir do banco`
  - **Traces:** US-2.4, US-2.5, US-6.3

- [ ] **Task:** Expor os splits à camada de UI
  - **Acceptance criteria:**
    - Os splits ficam disponíveis para a tela de resultado e para o detalhe do histórico, ordenados por quilômetro
    - O melhor split é identificável para o destaque em ouro
  - **Design ref:** .spec/init/design/08-activity-result.png
  - **Traces:** US-2.5, US-7.1, US-8.2

---

## Phase 10: Execução em background — foreground service e notificação persistente

**Goal:** Garantir o requisito não-negociável: bloquear o celular não degrada a atividade. · **Depends on:** Phase 7, Phase 9 · **Covers:** workflow 8, design ref 15

### Phase 10.1: Foreground service e coleta em background

- [ ] **Task:** Configurar o foreground service Android da coleta de localização
  - **Acceptance criteria:**
    - `startLocationUpdatesAsync` é chamado com as opções de foreground service, subindo o serviço ao iniciar a atividade
    - O serviço sobe junto com a criação da atividade e é encerrado na finalização
    - O app solicita `ACCESS_BACKGROUND_LOCATION` quando ainda não concedida, antes de subir o serviço
    - Sem a permissão de background, o app avisa que a gravação para quando a tela apaga, em vez de falhar em silêncio
  - **Feature tests:** `serviço sobe ao iniciar e cai ao finalizar`; `ausência de permissão de background produz aviso explícito`
  - **Traces:** US-6.1, US-2.1

- [ ] **Task:** Garantir a continuidade da coleta e da persistência em background
  - **Acceptance criteria:**
    - As amostras continuam chegando à task com a tela bloqueada e passam pelo mesmo filtro
    - Pontos e splits continuam sendo persistidos em background
    - A gravação periódica do estado continua ocorrendo em background
    - Nenhum caminho de código de coleta depende de um componente React montado
  - **Feature tests:** `ingestão em background usa o mesmo filtro do foreground`; `split fecha e é persistido com a tela bloqueada`
  - **Traces:** US-6.1, US-6.2

- [ ] **Task:** Garantir a correção do cronômetro e do estado ao voltar do background
  - **Acceptance criteria:**
    - Ao desbloquear, o tempo exibido está correto, sem defasagem acumulada
    - O estado de pausa, a distância e o número de splits refletem o que aconteceu enquanto a tela estava apagada
    - Uma corrida de 30 minutos com a tela bloqueada em 25 deles produz os mesmos dados que uma com a tela sempre acesa
  - **Feature tests:** `elapsed após 25 min em background bate com o tempo de parede`; `contagem de splits em background bate com a esperada`
  - **Traces:** US-6.1, US-2.3

### Phase 10.2: Notificação persistente

- [ ] **Task:** Implementar o conteúdo da notificação persistente
  - **Acceptance criteria:**
    - Identificação `Flux`, título `Atividade em andamento`, linha de métricas `2,31 km · 00:18:42`
    - Linha de contexto `Corrida · 3 de 6 · faltam 01:12` quando há treino estruturado
    - O tempo exibido deriva de timestamps, como na tela de atividade
    - O conteúdo é atualizado em intervalo fixo e barato, sem acordar o app inteiro a cada segundo
  - **Design ref:** .spec/init/design/15-background-notification.png
  - **Traces:** US-6.1

- [ ] **Task:** Implementar os estados da notificação
  - **Acceptance criteria:**
    - Corrida livre omite a linha de contexto, mantendo distância e tempo
    - Pausada: título passa a `Atividade pausada`, a ação `PAUSAR` passa a `RETOMAR` e as métricas ficam congeladas
    - Sem sinal: a linha de contexto ganha o sufixo `· sem sinal` e o tempo continua avançando
  - **Design ref:** .spec/init/design/15-background-notification.md (Estados)
  - **Traces:** US-6.1, US-3.3

- [ ] **Task:** Implementar as ações da notificação
  - **Acceptance criteria:**
    - `PAUSAR`/`RETOMAR` e `FINALIZAR` produzem exatamente o mesmo efeito dos botões da tela de atividade, sem desbloquear o aparelho
    - `FINALIZAR` encerra a coleta e deixa a atividade pronta para a tela de resultado na próxima abertura
    - Tocar no corpo da notificação abre a tela de atividade correspondente
  - **Design ref:** .spec/init/design/15-background-notification.md (Interações)
  - **Traces:** US-6.1, US-2.4

- [ ] **Task:** Tornar a notificação não dispensável enquanto a atividade existir
  - **Acceptance criteria:**
    - A notificação é `ongoing` e não pode ser deslizada para fora
    - Ela desaparece somente quando a atividade é finalizada ou descartada
    - Ela sobrevive às otimizações de bateria dos fabricantes testados, ou o desvio é documentado
  - **Design ref:** .spec/init/design/15-background-notification.md (Notas de implementação)
  - **Traces:** US-6.1

---

## Phase 11: Recuperação de atividade interrompida

**Goal:** Garantir que nenhuma corrida seja perdida por encerramento inesperado do app. · **Depends on:** Phase 9, Phase 10 · **Covers:** workflow 9, design ref 13

- [ ] **Task:** Detectar a atividade pendente na abertura do app
  - **Acceptance criteria:**
    - Na abertura, o app consulta `activities` por `finished_at IS NULL`
    - Existindo uma, a tela 13 é apresentada sobre a tela 01 antes de qualquer outra interação
    - A detecção acontece após a execução das migrações e antes de a navegação liberar outras rotas
  - **Feature tests:** `atividade sem finished_at é detectada na abertura`; `nenhuma atividade pendente não apresenta o diálogo`
  - **Traces:** US-6.3

- [ ] **Task:** Bloquear o início de nova atividade enquanto houver pendência
  - **Acceptance criteria:**
    - Nem o botão de corrida livre nem a tela de pré-início criam atividade enquanto existir uma pendente
    - O bloqueio vale também para o caminho pela biblioteca de treinos
    - Resolvida a pendência, os dois caminhos voltam a funcionar sem reiniciar o app
  - **Feature tests:** `iniciar corrida livre com pendência é bloqueado`; `iniciar treino com pendência é bloqueado`; `após resolver, o início é liberado`
  - **Traces:** US-6.3, US-2.1, US-2.2

- [ ] **Task:** Implementar o diálogo da tela 13
  - **Acceptance criteria:**
    - Selo `ATIVIDADE NÃO FINALIZADA`, título `Você tem uma corrida interrompida` e o texto exato do design ref
    - Quadro com `Iniciada`, `Distância`, `Tempo` e `Etapa` lidos do banco; a linha `Etapa` é omitida em corrida livre
    - Sem pontos gravados, `Distância` exibe `0,00 km` e as duas ações continuam disponíveis
    - O diálogo não é dispensável: sem toque fora, sem botão fechar, e o voltar do sistema não o encerra
  - **Design ref:** .spec/init/design/13-activity-recovery.png
  - **Traces:** US-6.3

- [ ] **Task:** Implementar a retomada da atividade
  - **Acceptance criteria:**
    - Cronômetro, distância, splits e etapa corrente continuam de onde pararam, reconstruídos do banco
    - O foreground service sobe novamente e a coleta é retomada
    - O intervalo entre o encerramento e a reabertura conta para `elapsed` e **não** para `moving`
    - Nenhum ponto ou distância é inventado para o intervalo em que o app esteve fora do ar
    - A navegação vai para a tela 05 ou 06 conforme o tipo da atividade
  - **Feature tests:** `retomada reconstrói distância e splits do banco`; `intervalo offline conta para elapsed e não para moving`; `nenhum activity_point é criado para o intervalo offline`
  - **Traces:** US-6.3, US-2.4

- [ ] **Task:** Implementar a finalização com o que foi gravado
  - **Acceptance criteria:**
    - As métricas existentes são consolidadas e `finished_at` é gravado
    - Em treino estruturado, as etapas não executadas passam a `not_performed`
    - A navegação segue para a tela 08 com os dados existentes
    - Nenhum dado é descartado nesse caminho
  - **Feature tests:** `finalizar preserva pontos e splits gravados`; `etapas restantes viram not_performed`; `a atividade passa a aparecer no histórico`
  - **Traces:** US-6.3, US-4.4, US-7.1

---

## Phase 12: Resultado da atividade — métricas, RPE e descarte

**Goal:** Entregar o retrato completo da atividade recém-terminada, a captura da percepção de esforço e o descarte com confirmação. · **Depends on:** Phase 9, Phase 11 · **Covers:** design refs 08, 09, 10

### Phase 12.1: Tela de resultado

- [ ] **Task:** Implementar o layout e os destaques da tela 08
  - **Acceptance criteria:**
    - Título `Atividade concluída` e subtítulo `<origem> · 30 ago, 07:42`, onde a origem é o nome do treino ou `Corrida livre`, e a data vem de `started_at` formatada em pt-BR
    - Destaques `DISTÂNCIA` e `TEMPO TOTAL` com a hierarquia do design ref
    - Ações `Avaliar esforço` (primária) e `Descartar atividade` (destrutiva)
    - O voltar do sistema salva sem avaliação e vai para o histórico, equivalendo a `Salvar sem avaliar`
  - **Design ref:** .spec/init/design/08-activity-result.png
  - **Traces:** US-7.1, US-7.3

- [ ] **Task:** Implementar a grade de métricas do resultado
  - **Acceptance criteria:**
    - `PACE MÉDIO`, `MELHOR KM`, `TEMPO CORRENDO` e `TEMPO CAMINHANDO` exibidos com os formatadores da fase 4
    - `MELHOR KM` vem de `best_pace_seconds_per_km`
    - `TEMPO CORRENDO` corresponde a `moving_duration_seconds` e `TEMPO CAMINHANDO` ao complemento em relação a `elapsed_duration_seconds`
    - Valores nulos exibem `—` sem quebrar a grade
  - **Design ref:** .spec/init/design/08-activity-result.png
  - **Traces:** US-7.1

- [ ] **Task:** Implementar a seção `SPLITS`
  - **Acceptance criteria:**
    - Uma linha por split com `KM n` e a duração, mais barra proporcional
    - O melhor split é destacado em ouro
    - Sem nenhum split, a seção exibe `Nenhum quilômetro completo.`
  - **Design ref:** .spec/init/design/08-activity-result.png
  - **Traces:** US-2.5, US-7.1

- [ ] **Task:** Implementar a seção `ETAPAS EXECUTADAS`
  - **Acceptance criteria:**
    - Cabeçalho com a contagem total (`ETAPAS EXECUTADAS · 14`) e a ação `Ver todas`
    - Uma linha por etapa com status `Concluída` (sálvia), `Pulada` (ouro, com duração real sobre planejada, ex. `01:12/02:00`) e `Não realizada` (cinza, esmaecida)
    - A seção é omitida por completo em corrida livre, e os splits ganham linhas cheias
    - Os dados vêm de `activity_steps`; a tela não recalcula status
  - **Design ref:** .spec/init/design/08-activity-result.md (Estados)
  - **Traces:** US-7.1, US-4.3, US-4.4

- [ ] **Task:** Implementar os estados degradados do resultado
  - **Acceptance criteria:**
    - Sem pontos válidos: aviso `SEM PERCURSO PARA EXIBIR` com o texto do design ref, distância `0,00 km`, `PACE MÉDIO` e `MELHOR KM` em `—` e splits com `Nenhum quilômetro completo.`
    - Menos de 1 km percorrido: seção de splits com `Nenhum quilômetro completo.` e a distância parcial preservada
    - Nenhum desses estados quebra o layout ou impede as ações
  - **Design ref:** .spec/init/design/08-activity-result.md (Estados)
  - **Traces:** US-7.1, US-7.2, US-2.5

### Phase 12.2: Captura de RPE

- [ ] **Task:** Implementar a tela 09 de captura de RPE
  - **Acceptance criteria:**
    - Título `Como foi o treino?` e o texto sobre opcionalidade, exatos do design ref
    - Grade com os dez valores inteiros de 1 a 10, alvos de ~84 dp de altura
    - Âncoras `1–3 Fácil`, `4–6 Controlado`, `7–10 Difícil`, com a faixa correspondente realçada na seleção
    - Leitura do valor à direita: `—/10` sem seleção, `6/10 · Controlado` com seleção
    - Seção `OBSERVAÇÕES · OPCIONAL` com campo multilinha e o placeholder do design ref
    - Tocar no mesmo número desmarca a seleção
  - **Design ref:** .spec/init/design/09-rpe-capture.png
  - **Traces:** US-7.3

- [ ] **Task:** Implementar as ações de salvamento da avaliação
  - **Acceptance criteria:**
    - Sem seleção: `Salvar avaliação` desabilitada e `Salvar sem avaliar` como ação primária
    - Com RPE selecionado: `Salvar avaliação` passa a primária e `Salvar sem avaliar` fica em contorno
    - Só observações, sem RPE: `Salvar avaliação` habilitada, grava `notes` com `rpe` nulo e a atividade continua pendente de avaliação
    - Ambos os caminhos navegam para o histórico
    - O voltar do sistema equivale a `Salvar sem avaliar` e nunca descarta a atividade
  - **Design ref:** .spec/init/design/09-rpe-capture.md (Estados)
  - **Traces:** US-7.3, US-8.1

- [ ] **Task:** Implementar a validação e a persistência do RPE
  - **Acceptance criteria:**
    - `rpe` é inteiro de 1 a 10, validado na aplicação; o banco aceita nulo
    - A tela faz `UPDATE` na atividade existente, nunca `INSERT` — a atividade existe desde o início
    - `rpe` e `notes` são gravados na mesma operação
    - Valor fora da faixa é rejeitado antes de chegar ao repositório
  - **Feature tests:** `rpe 0 e 11 são rejeitados`; `rpe nulo é aceito e mantém a atividade pendente`; `a operação é update e não cria nova atividade`
  - **Traces:** US-7.3, US-8.3

### Phase 12.3: Descarte da atividade

- [ ] **Task:** Implementar o diálogo de descarte (tela 10)
  - **Acceptance criteria:**
    - Modal sobre a tela 08 com véu escuro, título `Descartar esta atividade?` e o texto exato do design ref
    - Resumo do que será perdido: distância, tempo e contagem de splits; sem splits, a contagem é omitida
    - Ações `Descartar` (destrutiva) e `Cancelar`; toque fora equivale a `Cancelar`
    - Cancelar mantém o usuário na tela 08 sem perder nada
  - **Design ref:** .spec/init/design/10-activity-discard.png
  - **Traces:** US-7.4

- [ ] **Task:** Implementar a execução do descarte
  - **Acceptance criteria:**
    - Confirmar apaga a `activity`, seus `activity_points`, `activity_splits` e `activity_steps` em transação única
    - É hard delete — nenhuma linha resta referenciando a atividade
    - O treino de origem não é afetado
    - Após o descarte a navegação volta para a tela 01 e a atividade não aparece no histórico
  - **Feature tests:** `descarte remove todas as linhas relacionadas`; `descarte não afeta o treino de origem`; `histórico consultado imediatamente depois não contém a atividade`
  - **Traces:** US-7.4, US-8.1

---

## Phase 13: Histórico — lista, detalhe, avaliação posterior e exclusão

**Goal:** Entregar a consulta do histórico completo e a edição da avaliação subjetiva depois do fato. · **Depends on:** Phase 12 · **Covers:** design refs 11, 12

### Phase 13.1: Lista do histórico

- [ ] **Task:** Implementar a tela 11 com a lista de atividades
  - **Acceptance criteria:**
    - Consulta `activities` com `finished_at IS NOT NULL`, ordenada estritamente por `started_at DESC`
    - Atividade em andamento não aparece na lista — ela é tratada pela tela 13
    - Cabeçalho `Histórico` com voltar
    - A lista rola sem travar com centenas de atividades
  - **Design ref:** .spec/init/design/11-history-list.png
  - **Traces:** US-8.1

- [ ] **Task:** Implementar o cartão de atividade da lista
  - **Acceptance criteria:**
    - Data e hora (`30 ago · 07:42`), origem, distância, tempo total e `Pace médio 9:20/km`
    - A origem usa `training_session_name` (snapshot), permanecendo correta depois que o treino é excluído da biblioteca
    - `RPE 6` quando preenchido; selo ouro `Pendente de avaliação` quando `rpe IS NULL`
    - O ano só aparece quando diferente do ano corrente
    - Toque no cartão navega para a tela 12
  - **Design ref:** .spec/init/design/11-history-list.png
  - **Traces:** US-8.1, US-7.3

- [ ] **Task:** Implementar o estado vazio e a operação offline do histórico
  - **Acceptance criteria:**
    - Sem atividades: título `Nenhuma atividade registrada`, o texto do design ref e o botão `Iniciar corrida livre` ao pé, que aciona o mesmo fluxo da tela 01
    - A lista lê apenas SQLite local e não exibe nenhum indicador de rede
    - Com o aparelho em modo avião, a tela é idêntica à do estado normal
  - **Design ref:** .spec/init/design/11-history-list.md (Estados)
  - **Traces:** US-8.1, US-2.1

### Phase 13.2: Detalhe da atividade

- [ ] **Task:** Implementar a tela 12 com o detalhe da atividade
  - **Acceptance criteria:**
    - Cabeçalho com data e hora e a ação `Excluir`; origem exibida abaixo
    - Destaques e grade de métricas idênticos aos da tela 08
    - Seção `SPLITS`; em corrida livre pode terminar com a célula `0,31 km · sem split` indicando a distância parcial
    - Funciona offline; nenhum dado além dos tiles do mapa depende de rede
  - **Design ref:** .spec/init/design/12-history-detail.png
  - **Traces:** US-8.2, US-2.5

- [ ] **Task:** Implementar a seção resumida de etapas executadas
  - **Acceptance criteria:**
    - Cabeçalho `ETAPAS EXECUTADAS · 14` com as contagens `11 concluídas`, `2 puladas`, `1 não realizada`, agregadas de `activity_steps` por `step_execution_status_id`
    - A ação `Ver todas` abre a lista completa com status e duração real
    - A soma das contagens é igual ao total exibido no cabeçalho
    - A seção é omitida em corrida livre
  - **Design ref:** .spec/init/design/12-history-detail.png
  - **Traces:** US-8.2, US-4.3, US-4.4

- [ ] **Task:** Implementar a seção de esforço percebido nos dois estados
  - **Acceptance criteria:**
    - Avaliada: `ESFORÇO PERCEBIDO` com valor `6/10`, rótulo da faixa, observações e ação `Editar`
    - Pendente: faixa ouro `PENDENTE DE AVALIAÇÃO` com o texto do design ref e botão `Avaliar esforço`
    - Após o preenchimento, a atividade deixa de ser pendente aqui e na tela 11, sem recarregar o app
  - **Design ref:** .spec/init/design/12-history-detail.md (Estados)
  - **Traces:** US-8.3, US-7.3

- [ ] **Task:** Implementar a edição posterior de RPE e observações
  - **Acceptance criteria:**
    - `Editar` e `Avaliar esforço` abrem a tela 09 em modo de edição, pré-preenchida quando houver valor
    - Salvar grava `rpe` e `notes` na atividade existente e retorna ao detalhe atualizado
    - Nenhuma métrica objetiva é editável em qualquer estado da tela
    - Uma atividade salva sem avaliação pode ser preenchida a qualquer momento depois
  - **Feature tests:** `preencher rpe remove a marcação de pendente`; `edição não altera distância, tempos nem paces`; `edição de observações sem rpe mantém a atividade pendente`
  - **Traces:** US-8.3, US-7.3

- [ ] **Task:** Implementar a exclusão da atividade a partir do detalhe
  - **Acceptance criteria:**
    - `Excluir` abre o diálogo `Excluir esta atividade?` com o texto do design ref e ações `Excluir` / `Cancelar`
    - Confirmar apaga a atividade, seus `activity_points` e seus `activity_splits` em cascata, em transação única
    - A atividade some da lista do histórico imediatamente, sem recarregar o app
    - O treino da biblioteca que originou a atividade não é afetado
  - **Feature tests:** `exclusão remove pontos e splits`; `exclusão não afeta o training_session de origem`; `a lista reflete a exclusão sem remontagem`
  - **Traces:** US-8.4, US-1.4

---

## Phase 14: Mapa do percurso

**Goal:** Desenhar o traçado da corrida sobre um mapa estático, isolado numa fase própria pelo risco do `expo-maps` em alpha. · **Depends on:** Phase 12, Phase 13 · **Covers:** design refs 08 e 12 (mapa), workflow 10

- [ ] **Task:** Instalar e configurar `expo-maps` com a chave do Google Maps
  - **Acceptance criteria:**
    - `expo-maps` instalado na versão compatível com o SDK 57 e a versão exata fixada
    - `android.config.googleMaps.apiKey` configurado, com a chave fora do versionamento
    - O development build é regerado e o mapa renderiza em device
    - Ausência de chave produz o estado degradado, nunca um crash
  - **Traces:** US-7.2, Open Questions (project-description.md — chave do Google Maps)

- [ ] **Task:** Encapsular a renderização do mapa em um componente único
  - **Acceptance criteria:**
    - Um único componente concentra toda a dependência de `expo-maps`; nenhuma tela importa a biblioteca diretamente
    - A interface do componente recebe apenas a lista de coordenadas e não expõe tipos da biblioteca
    - Trocar a biblioteca por outra exige alterar só esse arquivo
  - **Design ref:** .spec/init/design/08-activity-result.md (Notas de implementação)
  - **Traces:** US-7.2, Open Questions (project-description.md — expo-maps em alpha)

- [ ] **Task:** Desenhar a polyline apenas com pontos válidos
  - **Acceptance criteria:**
    - O traçado usa exclusivamente `activity_points` com `is_valid = 1`, ordenados por `recorded_at`
    - Lacunas de sinal não são ligadas por segmento reto — o traçado é interrompido e retomado
    - Um traçado com zigue-zague permanece visível, porque ele é a evidência visual de falha do filtro de GPS
  - **Feature tests:** `pontos rejeitados não entram na polyline`; `lacuna gera segmentos separados e não uma reta`
  - **Traces:** US-7.2, US-3.1, US-3.3

- [ ] **Task:** Implementar o enquadramento automático do percurso
  - **Acceptance criteria:**
    - O mapa ajusta a região para enquadrar o percurso inteiro, com margem
    - Percurso muito curto não resulta em zoom máximo ilegível
    - O enquadramento é calculado uma vez, na montagem — o mapa é estático
  - **Design ref:** .spec/init/design/08-activity-result.png
  - **Traces:** US-7.2

- [ ] **Task:** Implementar a degradação do mapa
  - **Acceptance criteria:**
    - Sem pontos válidos, o mapa é omitido e substituído pelo aviso `SEM PERCURSO PARA EXIBIR` com o texto do design ref
    - Falha de carregamento da biblioteca ou dos tiles cai no mesmo aviso, sem quebrar o layout nem a tela
    - As demais seções da tela continuam funcionando normalmente
  - **Design ref:** .spec/init/design/08-activity-result.md (Estados — Sem pontos válidos)
  - **Traces:** US-7.2

- [ ] **Task:** Integrar o mapa às telas 08 e 12
  - **Acceptance criteria:**
    - O mapa aparece na tela de resultado e no detalhe do histórico, com a densidade reduzida especificada (mapa menor, mais respiro entre seções)
    - Em corrida livre, sem a seção de etapas, o mapa fica maior conforme o design ref
    - O mapa **não** é exibido durante a atividade, em nenhuma tela
  - **Design ref:** .spec/init/design/08-activity-result.png, .spec/init/design/12-history-detail.png
  - **Traces:** US-7.2, US-8.2

---

## Phase 15: Biblioteca de treinos — listagem e ciclo de vida

**Goal:** Entregar a biblioteca onde os treinos vivem: listar, abrir, editar e excluir. · **Depends on:** Phase 5, Phase 3 · **Covers:** design ref 02

- [ ] **Task:** Implementar a tela 02 com a lista de treinos
  - **Acceptance criteria:**
    - Cabeçalho `Biblioteca de treinos` com voltar e botão primário fixo `Novo treino`
    - Lista ordenada por atualização mais recente, exibindo apenas `training_sessions` com `deleted_at IS NULL`
    - Cada cartão é tocável e navega para a tela 04 de pré-início
    - A lista funciona offline
  - **Design ref:** .spec/init/design/02-training-library.png
  - **Traces:** US-1.1, US-1.3

- [ ] **Task:** Implementar o cartão de treino
  - **Acceptance criteria:**
    - Nome do treino, linha de metadados `4 etapas · 34 min estimados` e menu `⋮`
    - A contagem de etapas é o número de linhas de `training_steps` do treino, **não** a sequência executável expandida
    - A duração usa `estimated_duration_seconds` já materializado, exibida em minutos inteiros quando múltipla de 60
  - **Design ref:** .spec/init/design/02-training-library.png
  - **Traces:** US-1.1, US-1.2

- [ ] **Task:** Implementar o resumo compacto das etapas em chips
  - **Acceptance criteria:**
    - Os chips seguem a ordem dos `training_blocks` por `position`
    - Bloco com `repeat_count > 1` renderiza `N× <etapas separadas por " + ">` (ex.: `6× 2 min corrida + 2 min caminhada`)
    - Bloco com `repeat_count = 1` renderiza apenas a etapa (ex.: `5 min caminhada`)
    - As durações dos chips vêm de `duration_seconds` formatadas em minutos
  - **Feature tests:** `bloco de repetição vira um único chip com o prefixo N×`; `bloco simples vira um chip sem prefixo`; `a ordem dos chips segue position`
  - **Traces:** US-1.2, US-1.1

- [ ] **Task:** Implementar o estado vazio da biblioteca
  - **Acceptance criteria:**
    - Título `Nenhum treino salvo` e o texto exato do design ref
    - O botão `Novo treino` permanece visível e funcional
  - **Design ref:** .spec/init/design/02-training-library.md (Estados)
  - **Traces:** US-1.1

- [ ] **Task:** Implementar o menu `⋮` com editar e excluir
  - **Acceptance criteria:**
    - `Editar` abre a tela 03 com o treino carregado
    - `Excluir` abre o diálogo de confirmação
    - O menu não interfere no toque do cartão, que continua indo para o pré-início
  - **Design ref:** .spec/init/design/02-training-library.md (Interações)
  - **Traces:** US-1.3, US-1.4

- [ ] **Task:** Implementar a exclusão de treino com confirmação
  - **Acceptance criteria:**
    - Diálogo com título `Excluir este treino?` e o texto `As atividades já realizadas com ele continuam no histórico.`
    - Confirmar faz soft delete gravando `deleted_at`; o treino deixa de aparecer na biblioteca imediatamente
    - As atividades já executadas a partir dele permanecem no histórico com dados completos, exibindo a origem por `training_session_name`
    - Cancelar não altera nada
  - **Feature tests:** `exclusão é soft delete e preserva as atividades`; `treino excluído some da listagem`; `o histórico continua exibindo o nome do treino após a exclusão`
  - **Traces:** US-1.4, US-8.1

- [ ] **Task:** Implementar o estado `Em execução`
  - **Acceptance criteria:**
    - Havendo atividade em andamento vinculada a um treino, o cartão desse treino exibe o rótulo `Em execução`
    - As ações `Editar` e `Excluir` ficam desabilitadas nesse cartão
    - Os demais treinos permanecem editáveis e excluíveis
    - O estado desaparece assim que a atividade é finalizada ou descartada
  - **Feature tests:** `treino em execução não pode ser editado`; `treino em execução não pode ser excluído`; `outros treinos continuam editáveis`
  - **Traces:** US-1.3, US-1.4

- [ ] **Task:** Ligar a contagem de treinos da tela de Início
  - **Acceptance criteria:**
    - A linha `Biblioteca de treinos` da tela 01 reflete a contagem real de treinos não excluídos
    - A contagem atualiza ao voltar da biblioteca após criar ou excluir um treino
    - Zero treinos exibe `Nenhum treino`; um treino exibe `1 treino`; demais exibem `N treinos`
  - **Design ref:** .spec/init/design/01-home.md (Elementos obrigatórios)
  - **Traces:** US-1.1, US-1.4

---

## Phase 16: Editor de treino — etapas e blocos de repetição

**Goal:** Permitir montar e alterar um treino: etapas ordenadas, blocos de repetição e duração estimada recalculada a cada mudança. · **Depends on:** Phase 15 · **Covers:** design ref 03

### Phase 16.1: Estrutura do editor

- [ ] **Task:** Implementar o layout da tela 03
  - **Acceptance criteria:**
    - Cabeçalho `Novo treino` ou `Editar treino` com voltar e ação `Salvar`
    - Campo `NOME`, seção `ETAPAS` e botão `+ Adicionar etapa`
    - Barra inferior fixa com `DURAÇÃO ESTIMADA` e o valor formatado
    - Sair sem salvar não persiste nada e avisa sobre alterações pendentes
  - **Design ref:** .spec/init/design/03-training-editor.png
  - **Traces:** US-1.1, US-1.3

- [ ] **Task:** Implementar a linha de etapa
  - **Acceptance criteria:**
    - Alça de arraste `≡`, barra colorida do tipo, nome do tipo, duração em `mm:ss` e remover `✕`
    - A cor da barra vem da cor por tipo de etapa definida na fase 4
    - `✕` remove a etapa e recalcula a duração estimada imediatamente
  - **Design ref:** .spec/init/design/03-training-editor.png
  - **Traces:** US-1.1

- [ ] **Task:** Implementar o sheet `Nova etapa`
  - **Acceptance criteria:**
    - Seção `TIPO` listando exatamente `Aquecimento`, `Corrida`, `Caminhada`, `Recuperação`, `Desaquecimento`, lidos de `step_types` ativos
    - Seção `DURAÇÃO` com seletor de minutos e segundos, e botão `Adicionar`
    - `Adicionar` insere a etapa ao fim da lista, ou ao fim do bloco quando um bloco está em foco
    - Campo de instrução opcional disponível na criação da etapa
  - **Design ref:** .spec/init/design/03-training-editor.png
  - **Traces:** US-1.1

- [ ] **Task:** Implementar a reordenação de etapas por arraste
  - **Acceptance criteria:**
    - Arrastar `≡` reordena as etapas e atualiza `position` de forma contígua
    - Dentro de um bloco, a reordenação é local ao bloco e não move a etapa para fora dele
    - A duração estimada não muda com a reordenação
  - **Design ref:** .spec/init/design/03-training-editor.md (Interações)
  - **Traces:** US-1.1, US-1.3

### Phase 16.2: Blocos de repetição e validações

- [ ] **Task:** Implementar o agrupamento de etapas em bloco
  - **Acceptance criteria:**
    - Selecionar duas ou mais etapas **consecutivas** revela a ação `Agrupar em bloco` e o campo de repetições
    - O número de repetições tem mínimo 2; valor 1 ou menor bloqueia a confirmação com a mensagem `O bloco precisa repetir ao menos 2 vezes`
    - O bloco é armazenado como estrutura: um `training_block` com `repeat_count` e as etapas filhas, **sem duplicar linhas**
    - O bloco aparece na lista com cabeçalho `6× repetições` e as etapas filhas recuadas
  - **Feature tests:** `agrupar 2 etapas em 6 repetições grava 1 bloco e 2 etapas`; `repeat_count 1 é rejeitado no agrupamento`; `etapas não consecutivas não podem ser agrupadas`
  - **Traces:** US-1.2

- [ ] **Task:** Implementar o desagrupamento
  - **Acceptance criteria:**
    - `Desagrupar` devolve as etapas filhas à sequência linear, na mesma posição relativa
    - Cada etapa volta a ser um bloco de `repeat_count = 1` — nenhuma `training_step` fica sem bloco
    - A duração estimada é recalculada imediatamente
  - **Feature tests:** `desagrupar preserva a ordem das etapas`; `cada etapa desagrupada vira um bloco de repeat_count 1`; `a duração estimada cai para a soma simples`
  - **Traces:** US-1.2

- [ ] **Task:** Implementar o cálculo da duração estimada
  - **Acceptance criteria:**
    - Duração estimada = soma de `duration_seconds` de cada bloco multiplicada pelo seu `repeat_count`
    - O exemplo canônico rende 2040 s: `300 + 6×(120+120) + 300` → `34:00`
    - O valor é recalculado no cliente a cada alteração de etapa, tipo, duração, ordem ou repetições
    - Ao salvar, o valor é materializado em `training_sessions.estimated_duration_seconds`
  - **Feature tests:** `o treino canônico soma 2040 s`; `alterar repeat_count altera a duração estimada`; `remover etapa recalcula imediatamente`; `o valor materializado bate com o calculado`
  - **Traces:** US-1.1, US-1.2, US-1.3

- [ ] **Task:** Implementar as validações de salvamento
  - **Acceptance criteria:**
    - Treino sem nenhuma etapa não pode ser salvo; a lista exibe `Adicione a primeira etapa` e `Salvar` fica desabilitado
    - Nome vazio desabilita `Salvar`, com borda de erro e a mensagem `Informe um nome para o treino`
    - Duração `00:00` bloqueia a adição da etapa com a mensagem `A duração precisa ser maior que zero`
    - Nenhuma validação é feita só no banco — todas têm feedback na UI
  - **Feature tests:** `treino sem etapas não é salvo`; `nome vazio não é salvo`; `etapa com duração zero não é adicionada`
  - **Traces:** US-1.1, US-1.3

- [ ] **Task:** Implementar a persistência do treino ao salvar
  - **Acceptance criteria:**
    - Treino, blocos e etapas são gravados em transação única, com `position` contígua em ambos os níveis
    - Na edição, blocos e etapas removidos na UI são removidos do banco na mesma transação
    - Salvar volta para a tela 02 com a lista já atualizada
    - Nenhuma `training_step` é gravada fora de um `training_block`
  - **Feature tests:** `salvar grava a árvore completa em uma transação`; `etapa removida na UI é removida do banco`; `falha na gravação não deixa treino parcial`
  - **Traces:** US-1.1, US-1.3

- [ ] **Task:** Garantir que a edição não reescreve o histórico
  - **Acceptance criteria:**
    - Editar um treino não altera nenhuma linha de `activity_steps` de atividades passadas
    - As atividades executadas com a versão anterior mantêm tipo, instrução e duração planejada de então
    - O treino atualizado passa a valer apenas para as próximas execuções
  - **Feature tests:** `alterar a duração de uma etapa não altera o activity_step já gravado`; `alterar o nome do treino não altera training_session_name de atividades passadas`
  - **Traces:** US-1.3

- [ ] **Task:** Bloquear a edição de treino em execução
  - **Acceptance criteria:**
    - Não é possível abrir o editor de um treino vinculado a uma atividade em andamento
    - A tentativa exibe explicação em vez de falhar em silêncio
    - Finalizada a atividade, a edição volta a ser permitida
  - **Feature tests:** `abrir editor de treino em execução é bloqueado`; `após finalizar a atividade a edição é liberada`
  - **Traces:** US-1.3, US-1.4

---

## Phase 17: Motor de treino — expansão de blocos e transições automáticas

**Goal:** Construir o componente que percorre as etapas durante a atividade, transiciona sozinho e registra o que foi realmente executado. · **Depends on:** Phase 7, Phase 16 · **Covers:** workflow 5, `activity_steps`

- [ ] **Task:** Implementar a expansão dos blocos em sequência executável
  - **Acceptance criteria:**
    - A árvore de `training_blocks` e `training_steps` é expandida numa lista linear ordenada
    - Cada item carrega `position` global e `repetition_index` de 1 a `repeat_count` do bloco de origem
    - O treino canônico (`5 min caminhada + 6×[2 min corrida + 2 min caminhada] + 5 min caminhada`) expande em exatamente **14 etapas executáveis** a partir de 4 entradas
    - A expansão é pura e acontece uma vez, no início da atividade
  - **Feature tests:** `o treino canônico expande em 14 etapas`; `repetition_index vai de 1 a 6 nas etapas do bloco`; `a ordem da expansão segue position de bloco e de etapa`
  - **Traces:** US-2.2, US-4.1, US-4.2

- [ ] **Task:** Criar o snapshot das etapas executáveis no início da atividade
  - **Acceptance criteria:**
    - Uma linha de `activity_steps` por etapa executável, criada na abertura da atividade
    - Cada linha copia `step_type_id`, `instructions` e `planned_duration_seconds` do momento da execução, e guarda `training_step_id` como referência opcional
    - Todas começam com `step_execution_status_id` = `not_performed` e são promovidas conforme a execução avança
    - A criação é transacional junto com a criação da atividade
  - **Feature tests:** `14 linhas de activity_steps são criadas no início`; `o snapshot copia instrução e duração planejada`; `todas começam como not_performed`
  - **Traces:** US-2.2, US-4.4, US-7.1

- [ ] **Task:** Implementar o avanço automático entre etapas
  - **Acceptance criteria:**
    - A primeira etapa inicia assim que a atividade começa
    - Ao completar `planned_duration_seconds`, o motor avança automaticamente para a próxima etapa
    - O avanço é decidido por timestamps, não por contagem de ticks, e por isso está correto após a tela ficar bloqueada
    - Uma transição não pode ser pulada mesmo que o app fique minutos sem executar código de UI — ao voltar, todas as transições devidas são aplicadas em ordem
  - **Feature tests:** `etapa avança ao completar a duração`; `um treino de 14 etapas avança pelas 14 sem intervenção`; `retornar do background aplica todas as transições devidas em ordem`; `nenhuma etapa é pulada ou duplicada na recuperação`
  - **Traces:** US-4.1, US-6.1

- [ ] **Task:** Persistir a etapa concluída no momento da transição
  - **Acceptance criteria:**
    - Na transição, a etapa que termina recebe `actual_duration_seconds`, `distance_meters`, `finished_at` e status `completed`
    - A gravação acontece no momento da transição, não ao final da atividade
    - A etapa que inicia recebe `started_at`
    - Um encerramento forçado preserva as etapas já concluídas
  - **Feature tests:** `etapa concluída é persistida na transição`; `duração real é gravada mesmo quando difere da planejada`; `encerramento forçado preserva as etapas já concluídas`
  - **Traces:** US-4.1, US-6.2, US-7.1

- [ ] **Task:** Implementar o pulo de etapa
  - **Acceptance criteria:**
    - Um comando avança para a próxima etapa a qualquer momento
    - A etapa pulada é registrada com status `skipped` e a `actual_duration_seconds` efetivamente executada
    - O motor segue normalmente a partir da etapa seguinte, com o cronômetro dela zerado
    - A distância e o tempo já acumulados na atividade não são perdidos
  - **Feature tests:** `etapa pulada é gravada como skipped com a duração executada`; `o motor continua na etapa seguinte`; `distância acumulada da atividade não muda ao pular`
  - **Traces:** US-4.3

- [ ] **Task:** Implementar o encerramento do treino antes do fim
  - **Acceptance criteria:**
    - Encerrar a atividade a qualquer momento é permitido
    - A etapa corrente é gravada com a duração executada e status `skipped`
    - As etapas ainda não iniciadas permanecem como `not_performed`
    - Todas as métricas acumuladas até o encerramento são preservadas e o fluxo segue para a tela de resultado
  - **Feature tests:** `encerrar no meio grava a etapa corrente como skipped`; `etapas não iniciadas ficam not_performed`; `a atividade encerrada no meio é válida no histórico com percurso e splits`
  - **Traces:** US-4.4, US-7.1

- [ ] **Task:** Congelar o motor durante a pausa
  - **Acceptance criteria:**
    - Em pausa, o motor não avança etapas e o tempo restante da etapa fica congelado
    - Ao retomar, a etapa continua de onde parou, sem descontar o tempo pausado
    - O tempo pausado não entra em `actual_duration_seconds` da etapa
  - **Feature tests:** `pausa não avança a etapa`; `retomada continua o tempo restante de onde parou`; `tempo pausado não conta para a duração real da etapa`
  - **Traces:** US-2.4, US-4.1

- [ ] **Task:** Implementar a sinalização de fim do treino
  - **Acceptance criteria:**
    - Ao concluir a última etapa, o motor emite um evento de fim de treino
    - O evento é consumido pela UI (fase 18) e pela camada de orientações (fase 19)
    - O fim do treino não finaliza a atividade automaticamente sem consolidar as métricas
  - **Feature tests:** `o evento de fim é emitido uma única vez`; `a última etapa é gravada como completed antes do evento`
  - **Traces:** US-4.1, US-7.1

- [ ] **Task:** Registrar a distância e a duração reais por etapa
  - **Acceptance criteria:**
    - `distance_meters` de cada `activity_step` acumula apenas a distância dos pontos válidos ocorridos durante a etapa
    - A soma das distâncias das etapas é consistente com a distância total da atividade, dentro do erro de arredondamento
    - `actual_duration_seconds` reflete o tempo em movimento e parado da etapa, excluindo pausas manuais
  - **Feature tests:** `a soma das distâncias das etapas bate com a distância da atividade`; `duração real da etapa exclui o tempo pausado`
  - **Traces:** US-4.1, US-7.1

- [ ] **Task:** Tornar o estado do motor recuperável
  - **Acceptance criteria:**
    - O estado do motor (etapa corrente, `repetition_index`, tempo decorrido na etapa) é derivável de `activity_steps` persistidos, sem depender de memória
    - Ao recuperar uma atividade interrompida, o motor retoma na etapa correta
    - Nenhuma etapa é reexecutada nem perdida na recuperação
  - **Feature tests:** `motor reconstrói a etapa corrente a partir do banco`; `recuperação não reexecuta etapa já concluída`
  - **Traces:** US-6.3, US-4.1

---

## Phase 18: Execução de treino estruturado — pré-início e tela de atividade

**Goal:** Entregar as telas do treino guiado: confirmação antes de iniciar e a tela de atividade com etapa atual, próxima e repetição corrente. · **Depends on:** Phase 8, Phase 17 · **Covers:** design refs 04 e 06

### Phase 18.1: Pré-início do treino

- [ ] **Task:** Implementar a tela 04 de pré-início
  - **Acceptance criteria:**
    - Cabeçalho com o nome do treino e métricas de topo `DURAÇÃO ESTIMADA` e `ETAPAS`
    - `ETAPAS` exibe a contagem da **sequência executável expandida** (14 no exemplo canônico), diferente das 4 entradas da biblioteca
    - Lista das etapas na ordem planejada, com bloco de repetição exibido como `6× repetições` e etapas filhas recuadas
    - Indicador de GPS acima do botão e botão primário `Iniciar treino`
    - Voltar retorna à biblioteca sem criar atividade
  - **Design ref:** .spec/init/design/04-training-preview.png
  - **Traces:** US-2.2, US-1.2

- [ ] **Task:** Implementar os bloqueios de início no pré-início
  - **Acceptance criteria:**
    - GPS sem precisão aceitável exibe o indicador em ouro e o toque em `Iniciar treino` abre o sheet da tela 07
    - Permissão ausente dispara a solicitação; negada, leva à variante bloqueante da tela 07
    - Havendo atividade pendente de resolução, o início é bloqueado
  - **Design ref:** .spec/init/design/04-training-preview.md (Estados)
  - **Traces:** US-2.2, US-2.1, US-6.3

- [ ] **Task:** Implementar a criação da atividade estruturada
  - **Acceptance criteria:**
    - A atividade é criada com `activity_type_id` = `structured`, `training_session_id` e `training_session_name` (snapshot do nome)
    - O motor expande os blocos e cria os `activity_steps` na mesma transação da criação da atividade
    - A navegação vai para a tela 06 já na primeira etapa, com a instrução correspondente exibida
    - `started_at` é gravado antes de qualquer ponto coletado, como na corrida livre
  - **Feature tests:** `atividade estruturada grava training_session_id e o snapshot do nome`; `os activity_steps existem antes do primeiro ponto`; `a atividade abre na primeira etapa`
  - **Traces:** US-2.2, US-4.1

### Phase 18.2: Tela de atividade estruturada

- [ ] **Task:** Implementar o layout da tela 06
  - **Acceptance criteria:**
    - Nome do treino em rótulo maiúsculo e repetição corrente ao lado
    - Cartão da etapa atual dominante, cartão `PRÓXIMA` abaixo, métricas gerais e dois botões lado a lado
    - Indicador de GPS ao pé
    - Hierarquia tipográfica conforme os tokens, com o tempo restante da etapa como valor dominante
  - **Design ref:** .spec/init/design/06-activity-structured.png
  - **Traces:** US-4.2

- [ ] **Task:** Implementar o cartão da etapa atual
  - **Acceptance criteria:**
    - Exibe o tipo da etapa, o rótulo `ETAPA ATUAL`, o tempo restante e a legenda `restam nesta etapa`
    - Barra de progresso da etapa proporcional a `actual_duration_seconds / planned_duration_seconds`
    - A cor do cartão segue a cor do tipo de etapa
    - A instrução da etapa é exibida quando existir
  - **Design ref:** .spec/init/design/06-activity-structured.png
  - **Traces:** US-4.2, US-4.1

- [ ] **Task:** Implementar o cartão `PRÓXIMA` e o estado de última etapa
  - **Acceptance criteria:**
    - `PRÓXIMA` exibe o tipo e a duração da etapa seguinte
    - Na última etapa, o cartão é substituído por `Última etapa do treino`
    - Ao concluir a última etapa, o app anuncia o fim e navega para a tela 08
  - **Design ref:** .spec/init/design/06-activity-structured.md (Estados)
  - **Traces:** US-4.2, US-4.1

- [ ] **Task:** Implementar o indicador de repetição corrente
  - **Acceptance criteria:**
    - Exibe `3 de 6` a partir de `repetition_index` da etapa corrente sobre o `repeat_count` do bloco de origem
    - O indicador só aparece quando a etapa corrente pertence a um bloco com `repeat_count > 1`
    - O valor avança corretamente a cada repetição, inclusive após retorno do background
  - **Feature tests:** `repetição corrente reflete repetition_index`; `o indicador é omitido em bloco de repeat_count 1`; `a repetição avança corretamente ao longo das 6 voltas`
  - **Traces:** US-4.2, US-1.2

- [ ] **Task:** Implementar as métricas gerais na tela estruturada
  - **Acceptance criteria:**
    - `TEMPO TOTAL`, `DISTÂNCIA` e `PACE MÉDIO` exibidos com os mesmos formatadores e a mesma fonte de dados da tela 05
    - As métricas continuam atualizando durante todas as transições de etapa
  - **Design ref:** .spec/init/design/06-activity-structured.png
  - **Traces:** US-2.3, US-4.2

- [ ] **Task:** Implementar os estados da tela 06
  - **Acceptance criteria:**
    - Precisão degradada: indicador ouro em faixa própria; resto inalterado
    - Sem sinal: indicador vermelho com o mesmo texto da tela 05, distância deixa de avançar e o motor continua avançando as etapas (depende de tempo, não de GPS)
    - Pausada: selo `PAUSADA`, cartão da etapa em ouro com rótulo `ETAPA CONGELADA` e a legenda `o motor de treino não avança em pausa`; ações passam a `RETOMAR` e `FINALIZAR TREINO`
  - **Design ref:** .spec/init/design/06-activity-structured.md (Estados)
  - **Traces:** US-3.2, US-3.3, US-2.4

- [ ] **Task:** Ligar as ações `PULAR ETAPA`, `PAUSAR` e `FINALIZAR TREINO`
  - **Acceptance criteria:**
    - `PULAR ETAPA` registra a etapa atual como `skipped` com a duração executada e inicia a próxima
    - `PAUSAR`/`RETOMAR` congelam e retomam cronômetro, coleta e motor de treino simultaneamente
    - `FINALIZAR TREINO` marca as etapas restantes como `not_performed` e vai para a tela 08
    - Toques repetidos não geram duas transições
  - **Design ref:** .spec/init/design/06-activity-structured.md (Interações)
  - **Traces:** US-4.3, US-4.4, US-2.4

---

## Phase 19: Orientações por áudio e vibração

**Goal:** Fazer o app conduzir a sessão sem que o usuário olhe a tela — locução em pt-BR, vibração e as preferências que os design refs exigem. · **Depends on:** Phase 9, Phase 17 · **Covers:** workflow 6, design ref 14

### Phase 19.1: Camada de locução e vibração

- [ ] **Task:** Implementar o serviço de TTS em pt-BR
  - **Acceptance criteria:**
    - `expo-speech` configurado com locale `pt-BR`
    - A fala funciona com a tela bloqueada e com o app em background
    - Falas em sequência são enfileiradas, não sobrepostas
    - A ausência de voz pt-BR instalada no aparelho degrada sem quebrar a atividade
  - **Feature tests:** `falas concorrentes são enfileiradas e não sobrepostas`; `ausência de voz pt-BR não interrompe a atividade`
  - **Traces:** US-5.1, US-6.1

- [ ] **Task:** Implementar a verbalização de números por extenso
  - **Acceptance criteria:**
    - Distância é falada por extenso (`Dois quilômetros`), nunca como numeral cru
    - Pace é falado como `nove minutos e cinco segundos`, nunca como `9:05`
    - Durações de etapa são faladas por extenso (`Caminhe por dois minutos`)
    - Singular e plural corretos (`Um quilômetro`, `Dois quilômetros`; `um minuto`, `dois minutos`)
  - **Feature tests:** `2000 m vira "Dois quilômetros"`; `545 s/km vira "nove minutos e cinco segundos"`; `1 km usa o singular`; `pace com zero segundos omite a parte dos segundos`
  - **Traces:** US-5.3, US-5.1

- [ ] **Task:** Implementar o serviço de vibração
  - **Acceptance criteria:**
    - `expo-haptics` dispara o padrão de vibração em cada gatilho de orientação
    - A vibração funciona com a tela bloqueada
    - A vibração é independente da locução: desligar uma não desliga a outra
  - **Feature tests:** `vibração dispara mesmo com locução desativada`; `locução dispara mesmo com vibração desativada`
  - **Traces:** US-5.1, US-5.2

### Phase 19.2: Gatilhos de orientação

- [ ] **Task:** Implementar o aviso de início de etapa
  - **Acceptance criteria:**
    - Ao iniciar cada etapa, o app fala a instrução correspondente (ex.: `Comece a correr`, `Caminhe por dois minutos`)
    - Quando a etapa não tem instrução própria, a locução é derivada do tipo e da duração
    - O aviso é acompanhado de vibração e funciona com a tela bloqueada
    - O aviso é disparado pelo mesmo motor que faz a transição, não por um timer paralelo
  - **Feature tests:** `cada transição de etapa dispara exatamente um aviso`; `etapa sem instrução usa a locução derivada do tipo`; `nenhum aviso é perdido quando várias transições são aplicadas ao voltar do background`
  - **Traces:** US-5.1, US-4.1

- [ ] **Task:** Implementar o aviso de fim de etapa iminente
  - **Acceptance criteria:**
    - Um aviso é emitido faltando exatamente 30 segundos para o fim da etapa
    - O aviso é falado (`Faltam trinta segundos`) e acompanhado de vibração
    - Etapas com duração igual ou inferior a 30 segundos **não** disparam esse aviso
    - O aviso não é reemitido se a etapa for pausada e retomada dentro dos últimos 30 segundos
  - **Feature tests:** `etapa de 120 s dispara o aviso aos 90 s`; `etapa de 30 s não dispara o aviso`; `etapa de 25 s não dispara o aviso`; `pausa e retomada nos últimos 30 s não reemitem o aviso`
  - **Traces:** US-5.2

- [ ] **Task:** Implementar o anúncio de quilômetro concluído
  - **Acceptance criteria:**
    - A cada quilômetro completo, o app anuncia a distância e o pace do split (`Dois quilômetros. Pace nove minutos e cinco segundos.`)
    - O anúncio é acompanhado de vibração
    - Funciona tanto em corrida livre quanto em treino estruturado
    - O anúncio usa o pace do split recém-fechado, não o pace médio da atividade
  - **Feature tests:** `o anúncio usa o pace do split e não o pace médio`; `o anúncio dispara em corrida livre`; `um segmento que fecha dois quilômetros anuncia ambos, em ordem`
  - **Traces:** US-5.3, US-2.5

- [ ] **Task:** Garantir o funcionamento dos avisos com a tela bloqueada
  - **Acceptance criteria:**
    - Os três gatilhos são emitidos com a tela bloqueada e o app em background
    - Nenhum gatilho depende de um componente React montado
    - Avisos devidos durante um período sem execução de código são aplicados em ordem ao retomar, sem duplicar
  - **Feature tests:** `os três gatilhos disparam com o app em background`; `avisos atrasados não são duplicados ao retomar`
  - **Traces:** US-5.1, US-5.2, US-5.3, US-6.1

### Phase 19.3: Preferências de orientação

- [ ] **Task:** Implementar a tela 14 de orientações
  - **Acceptance criteria:**
    - Sheet sobre a tela de atividade com título `Orientações`, aberto por ícone no cabeçalho da tela de atividade
    - Linha `Locução` com legenda `voz em pt-BR` e interruptor; linha `Vibração` com legenda `continua com a locução desligada` e interruptor
    - Seção `QUANDO O APP AVISA` com os três gatilhos numerados e a caixa de exemplos de locução, com os textos exatos do design ref
    - Em corrida livre, o gatilho 1 é omitido e o gatilho 3 permanece
    - Com a locução desativada, a seção de gatilhos permanece com a nota `Os avisos continuam apenas por vibração.`
    - `Fechar` volta à tela de atividade com a atividade intacta
  - **Design ref:** .spec/init/design/14-audio-cues.png
  - **Traces:** US-5.1, US-5.2, US-5.3

- [ ] **Task:** Implementar a persistência das preferências de orientação
  - **Acceptance criteria:**
    - As preferências são lidas e gravadas em `app_preferences`, pelas chaves `audio_cues_enabled` e `haptic_cues_enabled`
    - Elas persistem entre atividades e entre aberturas do app, e sobrevivem ao seed que roda a cada abertura
    - Alternar um interruptor tem efeito imediato na atividade em curso, sem reiniciar nada
    - Os dois controles são independentes: desligar a locução mantém a vibração e vice-versa
    - Nenhum outro mecanismo de persistência é introduzido — o app usa apenas `expo-sqlite`
  - **Feature tests:** `preferência sobrevive ao fechamento do app`; `preferência alterada sobrevive ao seed da próxima abertura`; `desligar locução não desliga vibração`; `a mudança tem efeito na atividade em curso`
  - **Traces:** US-5.1, database-schema.md (`app_preferences`)

---

## Phase 20: Calibração do filtro de GPS em campo

**Goal:** Substituir os defaults provisórios por limiares medidos contra corridas reais, fechando a maior incerteza técnica do produto. · **Depends on:** Phase 6, Phase 14 · **Covers:** Open Questions sobre limiares, `gps_rejection_reasons`

- [ ] **Task:** Criar a ferramenta de inspeção dos pontos rejeitados
  - **Acceptance criteria:**
    - Uma tela ou comando de desenvolvimento lista, por atividade, a contagem de `activity_points` rejeitados agrupada por `gps_rejection_reasons`
    - Permite visualizar o percurso com e sem os pontos rejeitados, para comparação visual
    - A ferramenta é acessível apenas em build de desenvolvimento
  - **Traces:** US-3.1, database-schema.md (pontos rejeitados são persistidos)

- [ ] **Task:** Executar o protocolo de coleta em campo
  - **Acceptance criteria:**
    - Ao menos uma corrida em céu aberto, uma em área urbana densa e uma com perda deliberada de sinal (túnel ou interior)
    - Cada corrida registra distância medida por referência externa, para comparação com a calculada
    - Os dados coletados ficam disponíveis para a análise da tarefa seguinte
  - **Traces:** US-3.1, US-3.3, Open Questions (project-description.md)

- [ ] **Task:** Ajustar os limiares e revalidar
  - **Acceptance criteria:**
    - `maxAccuracyMeters`, `maxPlausibleSpeedMetersPerSecond`, `maxPositionJumpMeters` e os limites de intervalo recebem valores definitivos, com a justificativa registrada no módulo
    - O critério de movimento para `moving_duration` recebe o mesmo tratamento
    - Todos os testes do filtro continuam verdes com os novos valores — eles asseveram comportamento contra os limiares configurados, não contra números fixos
    - A distância calculada nas corridas de referência fica dentro da margem acordada em relação à medida externa
  - **Feature tests:** `os testes do filtro passam com os limiares calibrados`; `a série sintética de accuracy 60 m continua sendo rejeitada`; `nenhum teste depende de um número literal em vez do limiar configurado`
  - **Traces:** US-3.1, US-3.2, US-3.3, US-2.4

- [ ] **Task:** Decidir a política de expurgo dos pontos rejeitados
  - **Acceptance criteria:**
    - Fica registrada a decisão sobre manter ou expurgar `activity_points` com `is_valid = 0` após a calibração
    - Se houver expurgo, ele é implementado com confirmação e não toca em nenhum ponto válido
    - A decisão é refletida nas Open Questions dos artefatos de spec
  - **Feature tests:** `o expurgo remove apenas pontos com is_valid = 0`; `o expurgo não altera a distância da atividade`
  - **Traces:** US-3.1, US-8.4, Open Questions (database-schema.md — política de expurgo)

---

## Phase 21: Fechamento do MVP — verificação end-to-end e release

**Goal:** Confirmar que os 11 workflows da descrição funcionam de ponta a ponta em device real e produzir o build do primeiro release. · **Depends on:** Phase 1 a Phase 20 · **Covers:** todos os workflows e todas as user stories

- [ ] **Task:** Verificar os 11 workflows da descrição em device real
  - **Acceptance criteria:**
    - Cada workflow da descrição é executado de ponta a ponta e o resultado registrado: criar treino, iniciar atividade, rastrear em tempo real, filtrar GPS, executar treino estruturado, orientar por áudio, registrar splits, manter em background, persistir e recuperar, finalizar com RPE, consultar histórico
    - Cada divergência encontrada vira correção ou item explícito de pendência
    - A verificação usa o development build no aparelho alvo, não emulador
  - **Traces:** US-1.1, US-1.2, US-2.1, US-2.2, US-2.3, US-2.5, US-4.1, US-5.1, US-5.3, US-7.1, US-8.1

- [ ] **Task:** Executar o teste de campo longo com a tela bloqueada
  - **Acceptance criteria:**
    - Uma corrida de ao menos 30 minutos com a tela bloqueada em pelo menos 25 deles
    - Cronômetro, distância, splits, transições de etapa e avisos permanecem corretos
    - A notificação persistente sobrevive ao período inteiro
    - O consumo de bateria é medido e registrado
  - **Traces:** US-6.1, US-4.1, US-5.2, US-2.5

- [ ] **Task:** Verificar a operação totalmente offline
  - **Acceptance criteria:**
    - Com o aparelho em modo avião, criar treino, executar atividade, finalizar, avaliar e consultar o histórico funcionam sem degradação
    - A única funcionalidade afetada é o carregamento de tiles do mapa, que degrada sem quebrar o layout
    - Nenhuma chamada de rede é feita fora do mapa
  - **Traces:** US-6.2, US-8.1, US-8.2, US-7.2

- [ ] **Task:** Verificar a resiliência a encerramento inesperado
  - **Acceptance criteria:**
    - Encerrar o app à força no meio de uma corrida preserva no banco tudo que havia sido percorrido
    - A reabertura apresenta o diálogo de recuperação com os dados corretos
    - Retomar e finalizar produzem, cada um, uma atividade válida no histórico
  - **Traces:** US-6.2, US-6.3

- [ ] **Task:** Verificar permissões e comportamento em fabricantes com otimização agressiva de bateria
  - **Acceptance criteria:**
    - O fluxo de permissão (foreground, depois background) é testado em concessão, negação e negação permanente
    - O foreground service e a notificação sobrevivem à otimização de bateria em ao menos um aparelho de fabricante conhecido por restrições agressivas
    - Qualquer limitação encontrada é documentada no README com a orientação ao usuário
  - **Traces:** US-2.1, US-6.1

- [ ] **Task:** Produzir o build de release Android
  - **Acceptance criteria:**
    - Build assinado gerado a partir do estado verificado, com ícone e nome Flux corretos
    - `app.json` com versão de release e todas as permissões declaradas
    - O build instala e roda em aparelho limpo, sem estado prévio, criando o banco do zero na primeira abertura
    - As migrações rodam do zero sem erro no primeiro start
  - **Traces:** US-2.1, US-6.1, Development Build (project-description.md)

---

## Open Questions

- **Limiares do filtro de GPS.** Os valores entram como defaults provisórios na fase 6.1 e só são fixados na fase 20. Enquanto isso, a distância medida pelo app não é confiável para comparação com outros aparelhos.
- **Frequência de coleta do GPS e cadência de gravação em SQLite.** Ambas entram com um valor configurável único, mas o trade-off entre precisão e bateria (coleta) e entre resiliência e volume de escrita (gravação) só pode ser resolvido com a medição da fase 21.
- **`expo-maps` em alpha.** A fase 14 isola o risco, mas a decisão de trocar por `react-native-maps` continua em aberto e deve ser reavaliada antes de a fase começar.
- **Retenção de coordenadas.** Não há política automática. A exclusão manual (US-8.4) e o descarte (US-7.4) atendem ao caso pontual; uma regra por tempo ou por volume segue indefinida.
- **Exportação de atividades.** Fora do MVP por decisão do desenvolvedor, apesar de a descrição citá-la no princípio de privacidade. Nenhuma fase a cobre.
- **`users.name` sem uso no MVP.** A tabela `users` existe para carregar o `user_id` local e preparar a sincronização futura; se ela não vier, a coluna e possivelmente a tabela podem ser removidas.
