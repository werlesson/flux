# Flux — app mobile

Aplicativo Android de acompanhamento e treinamento de corrida, construído com Expo SDK 57 e React Native.

## Instalação

```bash
pnpm install
```

## Development build Android

O Flux **não suporta Expo Go**. A localização em background depende de código nativo, permissões Android e um foreground service que não estão disponíveis no Expo Go.

Gere o projeto Android e instale o development build em um aparelho físico conectado por USB:

```bash
npx expo prebuild --platform android
npx expo run:android --device
```

Depois do primeiro build, inicie o bundler para desenvolvimento:

```bash
pnpm start --dev-client
```

Com o app aberto, agite o aparelho ou pressione `m` no terminal do bundler para acessar o menu de desenvolvimento.

## Qualidade

```bash
pnpm test
pnpm test:watch
pnpm lint
npx tsc --noEmit
```

Os testes usam mocks base para localização, tarefas em background, fala e vibração. `expo-sqlite` não é mockado no setup; o teste de integração abre um banco `:memory:` diretamente pela API do pacote.
