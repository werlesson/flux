# Aplicativo de Acompanhamento e Treinamento de Corrida

## 1. Visão Geral

O projeto consiste no desenvolvimento de um aplicativo mobile voltado ao acompanhamento de corridas, inicialmente para uso pessoal, capaz de registrar uma atividade utilizando os sensores e o GPS do smartphone.

A proposta inicial é substituir as principais funcionalidades de rastreamento de corrida normalmente oferecidas por relógios esportivos, como Garmin, sem depender da aquisição de um dispositivo dedicado.

Entretanto, o produto não deve ser pensado apenas como um cronômetro com GPS. A visão é evoluí-lo para um **assistente de treinamento de corrida**, capaz de executar treinos estruturados, registrar dados objetivos e subjetivos de cada atividade, acompanhar a evolução do corredor e futuramente auxiliar na adaptação do plano de treinamento.

O aplicativo deve ser especialmente adequado para corredores iniciantes, incluindo pessoas que ainda precisam alternar períodos de corrida e caminhada.

O nome da aplicação é Flux

---

# 2. Problema

Para acompanhar adequadamente a evolução na corrida é necessário registrar informações como:

- distância percorrida;
- duração;
- tempo efetivamente em movimento;
- ritmo médio;
- ritmo por quilômetro;
- percurso;
- períodos de corrida e caminhada;
- percepção de esforço;
- histórico de atividades.

Relógios esportivos oferecem grande parte dessas funcionalidades, porém representam um custo adicional e nem sempre são necessários para corredores iniciantes.

Smartphones modernos já possuem GPS, sensores, processamento, armazenamento, áudio e conectividade suficientes para fornecer uma experiência inicial de acompanhamento de corrida.

O projeto busca aproveitar esses recursos.

---

# 3. Objetivo do Produto

Criar um aplicativo mobile que permita ao usuário:

1. visualizar o treino planejado;
2. iniciar uma atividade;
3. registrar o percurso utilizando GPS;
4. acompanhar tempo, distância e ritmo durante a atividade;
5. executar treinos estruturados de corrida e caminhada;
6. receber orientações durante o treino;
7. registrar automaticamente os quilômetros percorridos;
8. visualizar os resultados ao finalizar;
9. informar sua percepção de esforço e observações;
10. consultar o histórico;
11. acompanhar sua evolução ao longo do tempo.

A visão de longo prazo é transformar esses dados em um sistema de acompanhamento de treinamento, e não apenas em um tracker GPS.

---

# 4. Público Inicial

O público inicial são corredores iniciantes ou pessoas retomando a prática de corrida.

O aplicativo deve considerar que o usuário pode:

- ainda não conseguir correr continuamente;
- alternar corrida e caminhada;
- utilizar percepção de esforço em vez de frequência cardíaca;
- possuir pouca familiaridade com conceitos como pace, splits e zonas de treinamento;
- precisar de orientações simples durante o exercício;
- querer melhorar progressivamente resistência, distância e ritmo.

O produto deve evitar assumir que todo usuário possui relógio esportivo ou sensor de frequência cardíaca.

---

# 5. Princípio do Produto

O aplicativo não deve tentar inicialmente reproduzir todo o ecossistema de Garmin, Strava ou outras plataformas esportivas.

O primeiro objetivo é resolver muito bem o fluxo:

**Planejar → Executar → Registrar → Analisar → Evoluir**

Fluxo conceitual:

```text
Plano de treinamento
        ↓
Treino de hoje
        ↓
Iniciar treino
        ↓
GPS + cronômetro
        ↓
Execução das etapas
        ↓
Finalizar treino
        ↓
Resultado
        ↓
RPE + observações
        ↓
Histórico
        ↓
Análise da evolução
        ↓
Próximo treino
```

---

# 6. MVP

O MVP deverá priorizar poucas funcionalidades executadas com confiabilidade.

## 6.1 Rastreamento da atividade

Durante uma atividade, registrar:

- horário de início;
- duração total;
- tempo em movimento;
- distância;
- latitude;
- longitude;
- altitude, quando disponível;
- precisão do GPS;
- velocidade estimada;
- horário de cada amostra de localização.

O aplicativo deverá calcular:

- distância total;
- pace atual;
- pace médio;
- splits por quilômetro;
- tempo total;
- tempo em movimento.

---

# 7. Tela Principal da Corrida

Durante uma atividade, a interface deverá priorizar legibilidade e apresentar poucas informações.

Exemplo conceitual:

```text
CORRIDA

00:18:42

2,31 km

Pace atual       8:06 /km
Pace médio       8:11 /km

[ PAUSAR ]

GPS: boa precisão
```

Os dados principais precisam possuir tamanho suficiente para serem consultados rapidamente durante a corrida.

---

# 8. Treinos Estruturados

O aplicativo deverá permitir representar treinos compostos por etapas.

Exemplo:

```text
5 min caminhada

6x:
    2 min corrida
    2 min caminhada

5 min caminhada
```

Cada etapa poderá possuir:

- tipo;
- duração;
- distância, futuramente;
- intensidade esperada;
- quantidade de repetições;
- instrução apresentada ao usuário.

Tipos iniciais:

- aquecimento;
- corrida;
- caminhada;
- recuperação;
- desaquecimento.

O motor de treino deverá controlar automaticamente a transição entre as etapas.

---

# 9. Orientações Durante o Treino

O usuário não deve precisar consultar constantemente a tela.

O aplicativo deverá ser capaz de utilizar:

- áudio;
- vibração;
- notificações visuais;

para informar mudanças no treino.

Exemplos:

```text
Comece a correr.

Caminhe por dois minutos.

Faltam trinta segundos.

Um quilômetro concluído.
```

O recurso deverá funcionar, quando permitido pelo sistema operacional, mesmo com a tela bloqueada.

---

# 10. Splits

A cada quilômetro completo, o sistema deverá registrar um split.

Exemplo:

```text
KM 1    9:42
KM 2    9:15
KM 3    8:56
```

Ao completar um quilômetro, o aplicativo poderá fornecer feedback por áudio, por exemplo:

```text
"Dois quilômetros. Pace nove minutos e cinco segundos."
```

Os splits serão utilizados posteriormente na análise da evolução do corredor.

---

# 11. Corrida e Caminhada

O sistema deverá tratar corrida e caminhada como componentes legítimos do treinamento.

Quando possível, deverá ser possível saber:

- tempo correndo;
- tempo caminhando;
- distância percorrida;
- duração de cada etapa;
- ritmo associado às etapas.

Exemplo de resultado:

```text
Distância           3,18 km
Tempo total         29:41
Tempo correndo      17:22
Tempo caminhando    12:19
Pace médio          9:20/km
Melhor km           8:47/km
```

Isso é particularmente importante para corredores iniciantes.

---

# 12. Auto-pause

O aplicativo deverá futuramente ser capaz de identificar períodos nos quais o usuário parou involuntariamente durante a atividade, por exemplo:

- semáforos;
- trânsito;
- pausas rápidas;
- parada para água.

Deverão existir conceitos distintos de:

```text
elapsed_time
moving_time
```

O pace poderá utilizar o tempo apropriado dependendo da métrica apresentada.

A heurística de auto-pause deverá ser especificada e testada antes de ser considerada confiável.

---

# 13. Tratamento de Erros do GPS

Não é suficiente simplesmente somar todos os pontos fornecidos pelo GPS.

Localizações imprecisas podem gerar distâncias inexistentes.

Cada amostra deverá possuir, quando disponível:

```text
latitude
longitude
altitude
accuracy
speed
timestamp
```

O sistema deverá possuir uma camada responsável por validar os pontos antes de incorporá-los ao percurso.

Possíveis critérios:

- precisão máxima aceitável;
- distância entre pontos;
- intervalo entre medições;
- velocidade fisicamente plausível;
- saltos abruptos de localização;
- ausência temporária de sinal.

Exemplo:

```text
accuracy = 5 m
→ provavelmente aceitável

accuracy = 60 m
→ provavelmente rejeitar
```

Os valores exatos desses filtros deverão ser definidos por experimentação e especificações posteriores.

A qualidade do algoritmo de processamento GPS será um dos componentes técnicos mais importantes do produto.

---

# 14. Funcionamento em Background

O rastreamento não pode depender da tela permanecer ligada.

Fluxo esperado:

```text
atividade iniciada
        ↓
usuário bloqueia o celular
        ↓
GPS continua sendo coletado
        ↓
cronômetro continua
        ↓
motor do treino continua
        ↓
áudio/vibração continuam
        ↓
atividade permanece consistente
```

Esse requisito deverá considerar separadamente Android e iOS devido às diferenças de execução em background.

No Android deverão ser avaliados recursos como localização em background/foreground services e as permissões necessárias.

No iOS deverão ser consideradas as APIs e permissões específicas para background location.

---

# 15. Offline-first

O registro de uma corrida não deverá depender de conexão com a internet.

O fluxo principal deverá funcionar offline:

```text
Aplicativo
   │
   ├── GPS
   ├── cronômetro
   ├── motor do treino
   ├── SQLite
   ├── histórico local
   └── estatísticas
```

Caso posteriormente exista backend, os dados poderão ser sincronizados quando houver conectividade.

Uma corrida nunca deverá ser perdida simplesmente porque a conexão com a internet ficou indisponível.

---

# 16. Arquitetura Inicial

A primeira versão poderá utilizar:

### Mobile

React Native + Expo.

### Persistência local

SQLite.

### GPS

APIs de localização disponíveis no ecossistema React Native/Expo, avaliando posteriormente se será necessário código nativo adicional para maior confiabilidade.

### Mapas

Mapbox, Google Maps ou outra solução deverá ser avaliada posteriormente.

Inicialmente, mapas não devem bloquear o desenvolvimento do mecanismo principal de rastreamento.

---

# 17. Backend

O MVP pessoal não necessita obrigatoriamente de backend.

Arquitetura inicial:

```text
React Native / Expo
        │
        ├── GPS
        ├── SQLite
        ├── histórico
        └── estatísticas
```

Uma evolução posterior poderá introduzir:

```text
Mobile
   ↓
Laravel API
   ↓
PostgreSQL
```

O backend poderá posteriormente assumir responsabilidades como:

- autenticação;
- sincronização;
- backup;
- planos de treinamento;
- histórico multi-dispositivo;
- análises;
- compartilhamento;
- recursos sociais;
- processamento de dados.

A decisão é deliberadamente postergar essa complexidade até validar o funcionamento do aplicativo local.

---

# 18. Modelo Conceitual Inicial

## Workout

Representa uma atividade realizada.

Possíveis atributos:

```text
id
user_id
started_at
finished_at
elapsed_duration
moving_duration
distance
average_pace
best_pace
rpe
notes
created_at
updated_at
```

---

## WorkoutPoint

Representa uma amostra válida de localização durante uma atividade.

```text
id
workout_id
latitude
longitude
altitude
accuracy
speed
recorded_at
```

É importante avaliar o volume de dados produzido e uma estratégia adequada de armazenamento.

---

## WorkoutSplit

Representa um segmento da atividade.

Inicialmente:

```text
id
workout_id
kilometer
duration
pace
```

No futuro poderá suportar outros tipos de divisão.

---

## TrainingSession

Representa um treino planejado.

Exemplo:

```text
Treino A

5 min caminhada
6 × {
    2 min corrida
    2 min caminhada
}
5 min caminhada
```

---

## TrainingStep

Representa uma etapa executável do treino.

Possíveis atributos:

```text
id
training_session_id
type
order
duration
distance
target_rpe
instructions
```

O modelo definitivo deverá considerar repetições sem necessariamente duplicar dados.

---

# 19. Percepção de Esforço

Ao finalizar o treino, o aplicativo deverá solicitar uma avaliação subjetiva.

Inicialmente poderá ser utilizada a escala RPE.

Exemplo:

```text
Como foi o treino?

RPE: 6/10

[ Fácil ]
[ Controlado ]
[ Difícil ]
```

Também deverá existir um campo opcional para observações.

Exemplo:

```text
"Fiquei cansado no último intervalo,
mas consegui completar."
```

Essas informações serão importantes para analisar evolução e futuramente ajustar os treinos.

---

# 20. Resultado da Atividade

Ao finalizar uma atividade, apresentar pelo menos:

```text
3,18 km

29:41

Pace médio
9:20/km

Tempo correndo
17:22

Tempo caminhando
12:19

Splits

1 km     9:42
2 km     9:15
3 km     8:56
```

Posteriormente poderão ser adicionados:

- mapa;
- elevação;
- gráficos;
- velocidade;
- cadência;
- frequência cardíaca;
- comparação com atividades anteriores.

---

# 21. Telas do Primeiro MVP

A primeira versão deverá tentar limitar-se a quatro fluxos principais.

### Treino de hoje

Apresenta:

- objetivo;
- etapas;
- duração estimada;
- botão para iniciar.

### Atividade

Apresenta:

- cronômetro;
- distância;
- pace;
- etapa atual;
- próxima etapa;
- controles de pausa/finalização.

### Resultado

Apresenta:

- métricas;
- splits;
- execução das etapas;
- RPE;
- observações.

### Histórico

Apresenta as atividades realizadas e permite consultar os detalhes de cada uma.

---

# 22. Evolução do Produto

Depois que o MVP estiver confiável, poderão ser considerados:

### Fase 2

- mapas do percurso;
- gráficos;
- recordes pessoais;
- metas;
- estatísticas semanais;
- comparação de treinos;
- calendário;
- sincronização na nuvem;
- backup;
- autenticação.

### Fase 3

- planos de treinamento;
- progressão automática;
- adaptação do próximo treino;
- análise de tendências;
- metas de 5 km e 10 km;
- estimativas de desempenho;
- integração com sensores Bluetooth.

### Fase 4

Possíveis integrações:

- frequência cardíaca;
- cinta cardíaca Bluetooth;
- smartwatches;
- Google Health Connect;
- Apple Health;
- Strava;
- Garmin Connect, caso APIs e condições de integração permitam.

---

# 23. Limitações em Relação a um Garmin

O objetivo inicial não é afirmar equivalência completa com um relógio esportivo dedicado.

Um Garmin pode oferecer recursos que o smartphone isoladamente não consegue reproduzir com a mesma qualidade, como:

- frequência cardíaca no pulso;
- GPS dedicado ao exercício;
- métricas fisiológicas;
- VO₂max;
- recuperação;
- carga de treinamento;
- Body Battery e métricas proprietárias;
- cadência obtida por sensores dedicados;
- experiência de consulta diretamente no pulso.

O produto pretende inicialmente substituir principalmente:

- cronômetro;
- GPS;
- distância;
- pace;
- splits;
- acompanhamento do percurso;
- execução de treinos estruturados;
- histórico.

---

# 24. Diferencial Potencial

O diferencial não deverá ser apenas:

> "Um Garmin usando o celular."

A oportunidade é construir um produto centrado no ciclo completo de evolução do corredor:

```text
Treino prescrito
       ↓
Execução guiada
       ↓
Dados objetivos
       +
Dados subjetivos
       ↓
Análise
       ↓
Adaptação
       ↓
Próximo treino
```

Isso permitiria que o aplicativo evoluísse de um tracker para um **treinador digital de corrida**.

---

# 25. Princípios Técnicos

O desenvolvimento deverá priorizar:

1. **Offline-first** — nenhuma atividade deve depender da internet.
2. **Confiabilidade** — não perder uma corrida em andamento.
3. **Precisão** — filtrar adequadamente dados de localização.
4. **Simplicidade** — poucas informações durante a corrida.
5. **Battery awareness** — evitar consumo desnecessário de bateria.
6. **Background execution** — continuar funcionando com a tela bloqueada.
7. **Resiliência** — recuperar uma atividade após interrupções quando tecnicamente possível.
8. **Privacidade** — localização e histórico de percurso são dados sensíveis.
9. **Testabilidade** — cálculos de distância, pace, splits e transições de treino devem possuir testes automatizados.
10. **Evolução incremental** — backend e funcionalidades avançadas somente quando necessários.

---

# 26. Questões que o SDD deverá detalhar

As especificações posteriores deverão responder, entre outras, às seguintes questões:

### Rastreamento

- Qual frequência de coleta GPS?
- Qual precisão mínima será aceita?
- Como filtrar GPS drift?
- Como calcular distância?
- Como detectar movimento?
- Como funciona auto-pause?
- Como tratar perda temporária de GPS?

### Cronometragem

- Como garantir que o cronômetro permaneça correto após background?
- O cálculo será baseado em ticks ou timestamps?
- Como tratar pause/resume?

### Treinos

- Como representar repetições?
- Como controlar transições?
- Como reagir quando o aplicativo entra em background?
- Como emitir áudio e vibração?

### Persistência

- Com qual frequência salvar o estado da atividade?
- Como recuperar uma corrida após encerramento inesperado?
- Como armazenar milhares de pontos GPS eficientemente?

### Plataforma

- Quais diferenças existirão entre Android e iOS?
- Expo Managed Workflow será suficiente?
- Será necessário Development Build ou código nativo?

### Energia

- Qual impacto do GPS contínuo na bateria?
- Qual frequência oferece melhor equilíbrio entre precisão e consumo?

### Privacidade

- Por quanto tempo armazenar coordenadas?
- Como exportar/excluir atividades?
- Como proteger dados de localização caso exista sincronização em nuvem?

---

# 27. Primeira Meta Técnica

Antes de construir funcionalidades avançadas, deverá ser criado um protótipo técnico capaz de provar o seguinte cenário:

```text
Abrir aplicativo
       ↓
Iniciar atividade
       ↓
Caminhar/correr por alguns quilômetros
       ↓
Bloquear a tela durante parte do percurso
       ↓
Desbloquear
       ↓
Finalizar atividade
       ↓
Obter distância coerente
       ↓
Obter duração correta
       ↓
Visualizar percurso
       ↓
Visualizar splits
```

Esse experimento deverá validar principalmente:

- confiabilidade do GPS;
- funcionamento em background;
- consumo de bateria;
- precisão da distância;
- comportamento com tela bloqueada;
- persistência durante a atividade.

Somente após essa fundação estar confiável deverão ser priorizados recursos avançados.

---

# 28. Direção para o SDD

Este documento deve funcionar como **descrição e contexto do produto**, e não como especificação definitiva.

A partir dele, o processo de Spec-Driven Development deverá decompor o projeto em especificações menores e verificáveis.

Uma possível sequência é:

```text
00 — Product Overview
01 — Architecture
02 — Activity Tracking
03 — GPS Processing
04 — Workout Timer
05 — Background Execution
06 — Structured Training
07 — Audio & Haptic Guidance
08 — Splits
09 — Workout Persistence & Recovery
10 — Workout Results
11 — RPE & Feedback
12 — History
13 — Maps
14 — Statistics & Progress
15 — Cloud Sync
16 — Adaptive Training
17 — Health/Sensor Integrations
```

Cada especificação deverá definir claramente:

- problema;
- objetivos;
- requisitos funcionais;
- requisitos não funcionais;
- regras de negócio;
- estados;
- fluxos;
- casos extremos;
- critérios de aceitação;
- estratégia de testes;
- decisões técnicas;
- itens explicitamente fora de escopo.

A prioridade inicial deve ser construir uma fundação extremamente confiável para **registrar uma corrida real utilizando somente o smartphone**, antes de evoluir para funcionalidades de treinamento inteligente.