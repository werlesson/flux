# Flux

Aplicativo de acompanhamento e treinamento de corrida que usa apenas o **GPS e os sensores do smartphone** — sem depender de relógio esportivo dedicado.

O objetivo não é ser um cronômetro com GPS, e sim cobrir o ciclo completo do corredor:

```text
Planejar → Executar → Registrar → Analisar → Evoluir
```

Feito para o **corredor iniciante ou em retomada** — quem ainda alterna corrida e caminhada, não tem cinta cardíaca e não domina conceitos como pace e splits. Caminhada é tratada como parte legítima do treino, e a percepção de esforço (RPE) substitui a frequência cardíaca.

## Status

> **MVP em implementação — 20 das 22 fases construídas.** Toda a cadeia de spec está pronta, e o app em `apps/mobile/` implementa o fluxo completo: corrida livre, treinos estruturados, motor de etapas, orientação por áudio, splits, mapa do percurso e histórico.
>
> **A fase 21 está bloqueada e depende de trabalho de campo.** Os limiares do filtro de GPS em `src/gps/thresholds.ts` continuam provisórios — a calibração exige três corridas reais (céu aberto, urbano denso e perda deliberada de sinal) com distância medida por referência externa. Nenhum agente pode produzir esses dados. O protocolo e o formulário de coleta estão em [`.phases/phase-21.md`](.phases/phase-21.md).
>
> A fase 22 (verificação end-to-end em device e build de release) depende da 21.

| Verificação | Estado |
|---|---|
| `tsc --noEmit` | limpo |
| `jest` | 264 testes, 22 suítes |
| `expo lint` | 0 erros, 10 warnings |
| `expo-doctor` | 21/21 |

## Escopo do MVP

**Entra:** corrida livre e treinos estruturados, treinos criados pelo usuário numa biblioteca, motor de etapas com transição automática, orientação por áudio (TTS) e vibração, splits por quilômetro, mapa estático do percurso no resultado, RPE + observações, histórico — tudo **offline**, funcionando **em background**, em **Android**.

**Fica fora:** auto-pause automático, iOS, backend/sincronização, autenticação, mapa ao vivo, gráficos, recordes, calendário de planos e integrações com sensores ou plataformas externas.

A fronteira completa, os conceitos de domínio e os fluxos estão em [`.spec/init/project-description.md`](.spec/init/project-description.md).

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Expo SDK `~57.0.27`, React Native `0.86.3`, React `19.2.3` |
| Linguagem | TypeScript `~6.0.3` (`strict`) |
| Navegação | `expo-router` `~57.0.25` (typed routes, React Compiler) |
| Plataforma | Android (iOS adiado) |
| Persistência | `expo-sqlite` — offline-first, sem backend |
| GPS / background | `expo-location` + `expo-task-manager` |
| Mapas | `expo-maps` ⚠️ em alpha |
| Áudio / vibração | `expo-speech` (pt-BR) + `expo-haptics` |
| Testes | `jest-expo` |
| Pacotes | pnpm |

Todos instalados. O `expo-doctor` passa em 21/21 — para conferir a aderência dos pacotes ao SDK, rode `npx expo install --check`.

## Estrutura

```text
flux/
├── apps/
│   └── mobile/          # app Expo (React Native)
│       └── src/
│           ├── app/         # rotas (expo-router, file-based)
│           ├── activity/    # máquina de estados, cronômetro, splits, motor de treino
│           ├── components/
│           ├── constants/   # tema, tipografia
│           ├── database/    # schema, migrações, seeds e repositórios
│           ├── gps/         # filtro, distância, qualidade de sinal e limiares
│           ├── history/
│           ├── home/
│           ├── hooks/
│           ├── location/    # permissões, fix inicial e coleta em background
│           ├── navigation/
│           ├── training/    # editor e apresentação de treinos
│           ├── utils/       # formatadores
│           └── __tests__/
├── docs/                # documento de contexto do produto
├── .spec/               # artefatos de spec-driven development
│   └── init/
└── .phases/             # fases de implementação e estado de execução
```

## Rodando o app

```bash
cd apps/mobile
pnpm install
pnpm start
```

**Expo Go não serve mais.** O rastreamento em background exige um **development build**: localização em background não é suportada no Expo Go, e o Android precisa de foreground service e da permissão `ACCESS_BACKGROUND_LOCATION`.

Outros scripts disponíveis em `apps/mobile/`:

```bash
pnpm android      # compila e abre no Android (development build)
pnpm lint         # expo lint
pnpm test         # jest --runInBand
```

O mapa do percurso precisa de uma chave da API do Google Maps em `apps/mobile/.env` (veja `.env.example`), restrita no Google Cloud ao par *package name* + SHA-1 do certificado de assinatura. Sem ela o app funciona e o mapa degrada para "SEM PERCURSO PARA EXIBIR".

### Build de release

No Windows, o `assembleRelease` precisa de um init script que manda o staging do CMake para uma raiz curta — sem ele o ninja estoura o `MAX_PATH` e falha com `manifest 'build.ninja' still dirty after 100 tries`:

```bash
cd apps/mobile/android
./gradlew assembleRelease --init-script ../flux-short-cxx.init.gradle
```

> ⚠️ O buildType `release` ainda assina com o **keystore de debug** (default do template). O APK gerado serve para teste, mas **não é distribuível**. Produzir um release de verdade — tarefa 6 da fase 22 — exige gerar um keystore próprio e **re-restringir a chave do Google Maps ao novo SHA-1**, senão o mapa para de funcionar silenciosamente.

## Desenvolvimento orientado a spec

O projeto usa o harness [`bc-harness`](https://github.com/beerandcodeteam/beer-and-code-harness). A cadeia de artefatos em `.spec/init/` é gerada em ordem, cada um alimentando o próximo:

| # | Artefato | Status |
|---|---|---|
| 1 | `project-description.md` | ✅ pronto |
| 2 | `user-stories.md` | ✅ pronto |
| 3 | `database-schema.md` | ✅ pronto |
| 4 | `project-phases.md` | ✅ pronto |

A cadeia está completa. O `project-phases.md` foi decomposto em `.phases/phase-01.md` … `phase-22.md`, e o estado de execução de cada fase e tarefa fica em `.phases/state/run.tsv`.

Para reinspecionar a cadeia:

```text
/bc-harness:init
```

O comando inspeciona o estado dos artefatos, reporta o que está ausente ou desatualizado, e invoca o próximo passo.

## Princípios técnicos

1. **Offline-first** — nenhuma atividade depende da internet.
2. **Confiabilidade** — não perder uma corrida em andamento.
3. **Precisão** — filtrar adequadamente os dados de localização.
4. **Simplicidade** — poucas informações durante a corrida.
5. **Battery awareness** — evitar consumo desnecessário.
6. **Background execution** — continuar funcionando com a tela bloqueada.
7. **Resiliência** — recuperar uma atividade após interrupções.
8. **Privacidade** — localização e percurso são dados sensíveis.
9. **Testabilidade** — distância, pace, splits e transições de treino com testes automatizados.
10. **Evolução incremental** — backend e recursos avançados só quando necessários.

## Documentos

- [`docs/spec-initial-projetc.md`](docs/spec-initial-projetc.md) — documento de contexto original do produto
- [`.spec/init/project-description.md`](.spec/init/project-description.md) — descrição estruturada, conceitos e fluxos
- [`.spec/init/user-stories.md`](.spec/init/user-stories.md) — histórias de usuário testáveis
- [`.spec/init/database-schema.md`](.spec/init/database-schema.md) — schema em DBML
- [`.spec/init/project-phases.md`](.spec/init/project-phases.md) — as 22 fases com critérios de aceite
- [`.phases/phase-21.md`](.phases/phase-21.md) — protocolo da calibração de campo (**bloqueador atual**)
