# Flux — app mobile

App React Native (Expo) do Flux. Para o contexto do produto, o escopo do MVP e a cadeia de especificação, veja o [README da raiz](../../README.md).

> **Estado atual:** ainda é o template do `create-expo-app`. Nenhuma funcionalidade do Flux foi implementada.

## Rodando

O projeto usa **pnpm**:

```bash
pnpm install
pnpm start
```

| Script | O que faz |
|---|---|
| `pnpm start` | `expo start` |
| `pnpm android` | abre no Android |
| `pnpm ios` | abre no iOS (fora do escopo do MVP) |
| `pnpm web` | abre no navegador |
| `pnpm lint` | `expo lint` |

## Development build

Enquanto o app for só o template, **Expo Go funciona**.

A partir do momento em que o rastreamento em background entrar, um **development build passa a ser obrigatório** — `expo-location` não suporta localização em background no Expo Go. No Android será necessário ainda:

- config plugin com `isAndroidBackgroundLocationEnabled` e `isAndroidForegroundServiceEnabled`
- permissão `ACCESS_BACKGROUND_LOCATION`
- foreground service com notificação persistente

## Estrutura

```text
src/
├── app/          # rotas — expo-router, file-based routing
├── components/   # componentes de UI
├── constants/    # tema e constantes
└── hooks/
```

Convenções do template já configuradas:

- **TypeScript `strict`**, com alias `@/*` → `./src/*` e `@/assets/*` → `./assets/*`
- **Typed routes** e **React Compiler** habilitados em `app.json` (`experiments`)
- Variantes `.web.tsx` para componentes com implementação específica de web

## Antes de escrever código

O Expo mudou bastante entre versões. Consulte a **documentação exata da v57** antes de implementar:

<https://docs.expo.dev/versions/v57.0.0/>

Essa regra também está em [`AGENTS.md`](./AGENTS.md), que é o contexto carregado pelos agentes.

## `pnpm reset-project`

Script herdado do template: move `src/` e `scripts/` para `example/` e cria um `src/app` em branco.

⚠️ Só faz sentido enquanto o app ainda for o template. Depois que houver código do Flux, **não rode** — e o script pode ser removido do `package.json` junto com `scripts/reset-project.js`.
