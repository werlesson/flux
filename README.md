# Flux

Aplicativo de acompanhamento e treinamento de corrida que usa apenas o **GPS e os sensores do smartphone** — sem depender de relógio esportivo dedicado.

O objetivo não é ser um cronômetro com GPS, e sim cobrir o ciclo completo do corredor:

```text
Planejar → Executar → Registrar → Analisar → Evoluir
```

Feito para o **corredor iniciante ou em retomada** — quem ainda alterna corrida e caminhada, não tem cinta cardíaca e não domina conceitos como pace e splits. Caminhada é tratada como parte legítima do treino, e a percepção de esforço (RPE) substitui a frequência cardíaca.

## Status

> **Pré-código.** O app em `apps/mobile/` é ainda o template padrão do `create-expo-app` — nenhuma funcionalidade do Flux foi implementada.
>
> O trabalho atual está na cadeia de especificação (`.spec/`). O primeiro artefato, `project-description.md`, está pronto.

## Escopo do MVP

**Entra:** corrida livre e treinos estruturados, treinos criados pelo usuário numa biblioteca, motor de etapas com transição automática, orientação por áudio (TTS) e vibração, splits por quilômetro, mapa estático do percurso no resultado, RPE + observações, histórico — tudo **offline**, funcionando **em background**, em **Android**.

**Fica fora:** auto-pause automático, iOS, backend/sincronização, autenticação, mapa ao vivo, gráficos, recordes, calendário de planos e integrações com sensores ou plataformas externas.

A fronteira completa, os conceitos de domínio e os fluxos estão em [`.spec/init/project-description.md`](.spec/init/project-description.md).

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Expo SDK `~57.0.18`, React Native `0.86.3`, React `19.2.3` |
| Linguagem | TypeScript `~6.0.3` (`strict`) |
| Navegação | `expo-router` `~57.0.17` (typed routes, React Compiler) |
| Plataforma | Android (iOS adiado) |
| Persistência | `expo-sqlite` — offline-first, sem backend |
| GPS / background | `expo-location` + `expo-task-manager` |
| Mapas | `expo-maps` ⚠️ em alpha |
| Áudio / vibração | `expo-speech` (pt-BR) + `expo-haptics` |
| Testes | `jest-expo` |
| Pacotes | pnpm |

Os pacotes de GPS, SQLite, mapas, áudio e testes são **decisões da spec, ainda não instalados**.

## Estrutura

```text
flux/
├── apps/
│   └── mobile/          # app Expo (React Native)
│       └── src/
│           ├── app/         # rotas (expo-router, file-based)
│           ├── components/
│           ├── constants/
│           └── hooks/
├── docs/                # documento de contexto do produto
└── .spec/               # artefatos de spec-driven development
    └── init/
```

## Rodando o app

```bash
cd apps/mobile
pnpm install
pnpm start
```

Enquanto o app for só o template, **Expo Go funciona**. A partir do momento em que o rastreamento em background entrar, será obrigatório um **development build** — localização em background não é suportada no Expo Go, e o Android ainda exige foreground service e a permissão `ACCESS_BACKGROUND_LOCATION`.

Outros scripts disponíveis em `apps/mobile/`:

```bash
pnpm android      # abre no Android
pnpm lint         # expo lint
```

## Desenvolvimento orientado a spec

O projeto usa o harness [`bc-harness`](https://github.com/beerandcodeteam/beer-and-code-harness). A cadeia de artefatos em `.spec/init/` é gerada em ordem, cada um alimentando o próximo:

| # | Artefato | Status |
|---|---|---|
| 1 | `project-description.md` | ✅ pronto |
| 2 | `user-stories.md` | pendente |
| 3 | `database-schema.md` | pendente |
| 4 | `project-phases.md` | pendente |

Para avançar a cadeia:

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
