# Flux — User Stories

<!-- inputs: project-description.md@sha256:95865153b13f -->

## Overview

Flux é um aplicativo mobile de acompanhamento e treinamento de corrida que usa apenas o GPS e os sensores do smartphone. Cobre o ciclo **Planejar → Executar → Registrar → Analisar → Evoluir** para o corredor iniciante — quem ainda alterna corrida e caminhada, não tem cinta cardíaca e não domina conceitos como pace e splits.

O MVP é **offline, Android e de usuário único**: não há autenticação, papéis nem backend. Por isso existe uma única persona, que exerce todas as capacidades do sistema. As stories abaixo cobrem os 11 workflows da descrição do projeto.

**User Types:**
- **Corredor** - único usuário do sistema. Corredor iniciante ou em retomada, que planeja seus próprios treinos, executa as atividades e consulta o próprio histórico. Não há distinção de papéis ou permissões no MVP.

---

## 1. Biblioteca de treinos

### US-1.1: Criar um treino estruturado
**As a** Corredor
**I want to** montar um treino com etapas ordenadas de corrida e caminhada
**So that** eu possa executá-lo depois sem precisar lembrar o plano de cabeça

**Acceptance Criteria:**
- [ ] Consigo criar um treino informando um nome
- [ ] Consigo adicionar etapas ordenadas, cada uma com tipo, duração e instrução opcional
- [ ] Os tipos disponíveis são exatamente: aquecimento, corrida, caminhada, recuperação, desaquecimento
- [ ] A duração de cada etapa é informada em minutos e segundos e precisa ser maior que zero
- [ ] O app exibe a duração estimada total do treino, recalculada a cada alteração de etapa
- [ ] Consigo reordenar e remover etapas antes de salvar
- [ ] Um treino sem nenhuma etapa não pode ser salvo
- [ ] O treino salvo persiste em SQLite e continua disponível após fechar o app

**Expected Result:** O treino aparece na biblioteca com nome, número de etapas e duração estimada, pronto para ser executado.

---

### US-1.2: Agrupar etapas em blocos de repetição
**As a** Corredor
**I want to** repetir um conjunto de etapas N vezes sem cadastrá-las uma a uma
**So that** eu monte treinos intervalados como `6× [2min corrida + 2min caminhada]` rapidamente

**Acceptance Criteria:**
- [ ] Consigo agrupar etapas consecutivas em um bloco e definir o número de repetições
- [ ] O número de repetições precisa ser no mínimo 2
- [ ] O bloco é armazenado como estrutura, sem duplicar as etapas no banco
- [ ] A duração estimada do treino considera o bloco multiplicado pelas repetições
- [ ] A biblioteca exibe o bloco de forma compacta (ex.: `6× 2min corrida + 2min caminhada`)
- [ ] Consigo desfazer o agrupamento, devolvendo as etapas à sequência linear

**Expected Result:** Um treino como `5min caminhada + 6×[2min corrida + 2min caminhada] + 5min caminhada` é criado com 4 entradas, não com 14.

---

### US-1.3: Editar um treino existente
**As a** Corredor
**I want to** alterar as etapas de um treino que já criei
**So that** eu ajuste a progressão conforme minha condição evolui

**Acceptance Criteria:**
- [ ] Consigo abrir um treino da biblioteca em modo de edição
- [ ] Consigo alterar nome, etapas, durações, tipos, instruções e blocos de repetição
- [ ] A duração estimada é recalculada ao salvar
- [ ] Atividades já executadas com a versão anterior do treino **não são alteradas** — elas mantêm o registro do que foi de fato executado
- [ ] Não consigo editar um treino enquanto ele está sendo executado em uma atividade em andamento

**Expected Result:** O treino atualizado passa a valer para as próximas execuções, e o histórico anterior permanece intacto.

---

### US-1.4: Excluir um treino
**As a** Corredor
**I want to** remover um treino que não uso mais
**So that** minha biblioteca reflita apenas o que faz parte da minha rotina

**Acceptance Criteria:**
- [ ] A exclusão exige confirmação explícita
- [ ] O treino deixa de aparecer na biblioteca após a exclusão
- [ ] Atividades já executadas a partir desse treino permanecem no histórico com seus dados completos
- [ ] Não consigo excluir um treino que está sendo executado em uma atividade em andamento

**Expected Result:** O treino some da biblioteca sem apagar nenhuma corrida já registrada.

---

## 2. Execução da atividade

### US-2.1: Iniciar uma corrida livre
**As a** Corredor
**I want to** começar a gravar uma corrida sem seguir nenhum treino planejado
**So that** eu registre uma atividade espontânea

**Acceptance Criteria:**
- [ ] Consigo iniciar uma corrida livre a partir da tela inicial, sem selecionar treino
- [ ] Se a permissão de localização não foi concedida, o app a solicita antes de iniciar
- [ ] Se a permissão for **negada**, a atividade não inicia; o app explica o motivo e oferece atalho para as configurações do sistema
- [ ] Se o GPS ainda não atingiu precisão aceitável, o app exibe aviso mas **permite** iniciar por decisão minha
- [ ] Ao iniciar, a atividade é gravada em SQLite com `started_at` antes de qualquer ponto ser coletado
- [ ] O foreground service do Android sobe ao iniciar, com notificação persistente

**Expected Result:** A tela de atividade abre com cronômetro rodando e coleta de GPS ativa, e existe um registro da atividade no banco desde o primeiro segundo.

---

### US-2.2: Iniciar uma atividade a partir de um treino
**As a** Corredor
**I want to** escolher um treino da biblioteca e executá-lo
**So that** o app conduza a sessão em vez de eu controlar os tempos manualmente

**Acceptance Criteria:**
- [ ] Consigo ver a lista de treinos da biblioteca antes de iniciar
- [ ] Ao selecionar um treino, vejo suas etapas e a duração estimada antes de confirmar
- [ ] As mesmas regras de permissão e precisão de GPS da US-2.1 se aplicam
- [ ] Ao iniciar, o motor de treino expande os blocos de repetição na sequência linear de etapas executáveis
- [ ] A atividade fica vinculada ao treino de origem para posterior comparação planejado × executado

**Expected Result:** A atividade inicia já na primeira etapa do treino, com a instrução correspondente exibida.

---

### US-2.3: Acompanhar métricas em tempo real
**As a** Corredor
**I want to** ver tempo, distância e pace enquanto corro
**So that** eu ajuste meu esforço durante a atividade

**Acceptance Criteria:**
- [ ] A tela exibe tempo decorrido, distância percorrida, pace atual e pace médio
- [ ] Tempo e distância usam tipografia grande, legível de relance em movimento
- [ ] O pace é exibido no formato `mm:ss/km`
- [ ] O cronômetro é calculado a partir de **timestamps**, nunca por contagem de ticks
- [ ] Após o app passar por background, o tempo exibido continua correto
- [ ] Em atividade com treino estruturado, a tela exibe também etapa atual e próxima etapa
- [ ] A tela exibe um indicador de qualidade do sinal de GPS

**Expected Result:** Consigo conferir meu estado atual em menos de um segundo de olhar, sem parar de correr.

---

### US-2.4: Pausar e retomar a atividade
**As a** Corredor
**I want to** pausar manualmente a gravação e retomá-la depois
**So that** paradas intencionais não distorçam meu pace

**Acceptance Criteria:**
- [ ] Consigo pausar a atividade a qualquer momento pela tela
- [ ] Durante a pausa, o cronômetro para e nenhum ponto de GPS é incorporado ao percurso
- [ ] Durante a pausa, o motor de treino também para de avançar as etapas
- [ ] Consigo retomar, e a contagem continua de onde parou
- [ ] O tempo pausado **não** conta para `elapsed_time` nem para `moving_time` — o número exibido congela na pausa e retoma do mesmo ponto
- [ ] O tempo de parede puro, incluindo as pausas, continua derivável de `finished_at - started_at`
- [ ] O estado de pausa sobrevive ao app ir para background

**Expected Result:** A atividade retomada mantém distância, tempo e etapa consistentes com o momento da pausa.

---

### US-2.5: Registrar splits por quilômetro
**As a** Corredor
**I want to** que cada quilômetro completo seja registrado com sua duração e pace
**So that** eu compare meu ritmo ao longo da corrida

**Acceptance Criteria:**
- [ ] Um split é fechado automaticamente a cada 1 km completo
- [ ] Cada split registra o número do quilômetro, sua duração e seu pace
- [ ] O split é persistido no momento em que fecha, não apenas ao final da atividade
- [ ] A distância parcial após o último km completo não gera split
- [ ] Os splits ficam disponíveis na tela de resultado e no histórico

**Expected Result:** Uma corrida de 3,18 km produz exatamente 3 splits persistidos, sobreviventes a um encerramento inesperado.

---

## 3. Qualidade do sinal de GPS

### US-3.1: Descartar amostras de GPS imprecisas
**As a** Corredor
**I want to** que o app ignore leituras ruins de GPS
**So that** minha distância não seja inflada por erro de sinal

**Acceptance Criteria:**
- [ ] Cada amostra recebida é avaliada antes de ser incorporada ao percurso
- [ ] Amostra com `accuracy` acima do limiar configurado é descartada e não soma distância
- [ ] Amostra que implicaria velocidade fisicamente implausível para corrida é descartada
- [ ] Amostra que representa salto abrupto de posição em relação ao ponto anterior aceito é descartada
- [ ] Amostras descartadas **não** viram `WorkoutPoint` e não aparecem no percurso
- [ ] A lógica de filtragem é coberta por testes automatizados com séries de pontos sintéticas

**Expected Result:** Uma sequência com pontos de `accuracy = 60 m` produz a mesma distância que a sequência sem eles.

---

### US-3.2: Ver a qualidade do sinal durante a corrida
**As a** Corredor
**I want to** saber se o GPS está com boa recepção
**So that** eu entenda quando os números podem estar imprecisos

**Acceptance Criteria:**
- [ ] A tela de atividade exibe um indicador de qualidade do sinal
- [ ] O indicador reflete a `accuracy` das amostras recentes, não de uma única leitura
- [ ] O indicador distingue ao menos três estados: boa precisão, precisão degradada e sem sinal
- [ ] O estado muda visivelmente quando o sinal se degrada

**Expected Result:** Ao entrar num túnel, o indicador muda de "boa precisão" para "sem sinal" sem eu precisar interpretar números.

---

### US-3.3: Tratar perda temporária de sinal
**As a** Corredor
**I want to** que uma queda de sinal não invente distância
**So that** meu percurso reflita o caminho real

**Acceptance Criteria:**
- [ ] Um intervalo sem amostras válidas é tratado como lacuna, não como deslocamento em linha reta
- [ ] A distância não avança durante a lacuna
- [ ] A atividade continua gravando normalmente quando o sinal retorna
- [ ] O cronômetro continua contando durante a perda de sinal

**Expected Result:** Uma corrida com 2 minutos sem sinal termina com distância coerente com o trajeto percorrido, sem um segmento reto artificial no percurso.

---

## 4. Execução de treino estruturado

### US-4.1: Avançar automaticamente entre etapas
**As a** Corredor
**I want to** que o app controle sozinho a transição entre as etapas do treino
**So that** eu não precise cronometrar nada manualmente

**Acceptance Criteria:**
- [ ] O motor inicia a primeira etapa assim que a atividade começa
- [ ] Ao completar a duração da etapa, o motor avança automaticamente para a próxima
- [ ] A transição ocorre corretamente mesmo com o app em background e a tela bloqueada
- [ ] Cada etapa executada registra sua duração e ritmo reais
- [ ] Ao completar a última etapa, o app sinaliza o fim do treino
- [ ] As transições são cobertas por testes automatizados

**Expected Result:** Um treino de 14 etapas executáveis avança pelas 14 sem intervenção minha, mesmo com o celular no bolso.

---

### US-4.2: Ver etapa atual e próxima etapa
**As a** Corredor
**I want to** saber o que estou fazendo agora e o que vem a seguir
**So that** eu me prepare para a mudança de ritmo

**Acceptance Criteria:**
- [ ] A tela exibe o tipo e a instrução da etapa atual
- [ ] A tela exibe o tempo restante da etapa atual
- [ ] A tela exibe qual é a próxima etapa
- [ ] Em bloco de repetição, a tela indica a repetição corrente (ex.: `3 de 6`)

**Expected Result:** Sei a qualquer momento em que ponto do treino estou, sem precisar lembrar o plano.

---

### US-4.3: Pular uma etapa
**As a** Corredor
**I want to** avançar para a próxima etapa antes de completar a atual
**So that** eu não trave o treino quando não consigo sustentar o esforço

**Acceptance Criteria:**
- [ ] Existe um controle para avançar para a próxima etapa a qualquer momento
- [ ] A etapa pulada é registrada como **incompleta**, com a duração efetivamente executada
- [ ] O motor segue normalmente a partir da etapa seguinte
- [ ] A distância e o tempo já acumulados não são perdidos
- [ ] O resultado da atividade indica quais etapas foram concluídas e quais foram puladas

**Expected Result:** Consigo terminar o treino mesmo sem completar todas as etapas, e o registro mostra honestamente o que foi feito.

---

### US-4.4: Encerrar o treino antes do fim
**As a** Corredor
**I want to** finalizar a atividade sem executar as etapas restantes
**So that** eu pare quando precisar sem perder o que já corri

**Acceptance Criteria:**
- [ ] Consigo encerrar a atividade a qualquer momento durante o treino
- [ ] As etapas não executadas são registradas como não realizadas
- [ ] Todas as métricas acumuladas até o encerramento são preservadas
- [ ] O fluxo segue normalmente para a tela de resultado

**Expected Result:** Encerrar no meio do treino produz uma atividade válida no histórico, com o percurso e os splits do que foi percorrido.

---

## 5. Orientação por áudio e vibração

### US-5.1: Receber aviso na transição de etapa
**As a** Corredor
**I want to** ser avisado por áudio e vibração quando a etapa mudar
**So that** eu não precise olhar a tela durante o exercício

**Acceptance Criteria:**
- [ ] Ao iniciar cada etapa, o app fala a instrução correspondente (ex.: "Comece a correr", "Caminhe por dois minutos")
- [ ] A locução é acompanhada de vibração
- [ ] O aviso funciona com a tela bloqueada
- [ ] O áudio usa TTS em `pt-BR`
- [ ] Consigo desativar o áudio e manter apenas a vibração

**Expected Result:** Executo o treino inteiro com o celular no bolso, guiado só pelos avisos.

---

### US-5.2: Receber aviso de fim de etapa iminente
**As a** Corredor
**I want to** ser avisado pouco antes da etapa acabar
**So that** eu me prepare para a mudança em vez de ser pego de surpresa

**Acceptance Criteria:**
- [ ] Um aviso é emitido faltando **30 segundos** para o fim da etapa
- [ ] O aviso é falado (ex.: "Faltam trinta segundos") e acompanhado de vibração
- [ ] Etapas com duração igual ou inferior a 30 segundos não disparam esse aviso
- [ ] O aviso funciona com a tela bloqueada

**Expected Result:** Sempre tenho meia dose de antecedência antes de mudar de ritmo.

---

### US-5.3: Receber anúncio de quilômetro concluído
**As a** Corredor
**I want to** ouvir a cada quilômetro o pace daquele trecho
**So that** eu acompanhe meu ritmo sem olhar a tela

**Acceptance Criteria:**
- [ ] A cada 1 km completo, o app anuncia a distância e o pace do split
- [ ] O anúncio verbaliza os números por extenso (ex.: "Dois quilômetros. Pace nove minutos e cinco segundos")
- [ ] O anúncio é acompanhado de vibração
- [ ] Funciona tanto em corrida livre quanto em treino estruturado
- [ ] Funciona com a tela bloqueada

**Expected Result:** Ao cruzar cada quilômetro recebo a informação sem tirar o celular do bolso.

---

## 6. Execução em background e resiliência

### US-6.1: Manter o rastreamento com a tela bloqueada
**As a** Corredor
**I want to** bloquear o celular sem interromper a gravação
**So that** eu corra com o aparelho no bolso e poupe bateria

**Acceptance Criteria:**
- [ ] A coleta de GPS continua com a tela bloqueada
- [ ] O cronômetro permanece correto ao desbloquear, sem defasagem acumulada
- [ ] O motor de treino continua avançando as etapas
- [ ] Áudio e vibração continuam sendo emitidos
- [ ] Uma notificação persistente indica que a atividade está em andamento
- [ ] O app solicita a permissão `ACCESS_BACKGROUND_LOCATION` quando necessário

**Expected Result:** Uma corrida de 30 minutos com a tela bloqueada em 25 deles produz os mesmos dados que uma corrida com a tela sempre acesa.

---

### US-6.2: Persistir a atividade durante a execução
**As a** Corredor
**I want to** que os dados sejam salvos ao longo da corrida
**So that** eu não perca a atividade se o app for encerrado

**Acceptance Criteria:**
- [ ] O estado da atividade é gravado periodicamente durante a execução, não só ao finalizar
- [ ] Pontos de GPS validados são persistidos conforme chegam
- [ ] Splits são persistidos no momento em que fecham
- [ ] Etapas executadas são persistidas conforme são concluídas
- [ ] Todo o fluxo funciona sem conexão com a internet

**Expected Result:** Encerrar o app à força no meio da corrida preserva no banco tudo que havia sido percorrido até ali.

---

### US-6.3: Recuperar uma atividade interrompida
**As a** Corredor
**I want to** retomar ou fechar uma corrida que foi interrompida
**So that** um crash não me faça perder o registro

**Acceptance Criteria:**
- [ ] Ao abrir o app, ele detecta atividade sem `finished_at`
- [ ] O app oferece duas opções: **retomar** a atividade ou **finalizar** com o que foi gravado
- [ ] Ao retomar, cronômetro, distância, splits e etapa corrente continuam de onde pararam
- [ ] Ao finalizar, a atividade segue para a tela de resultado com os dados existentes
- [ ] Não é possível iniciar uma nova atividade enquanto houver uma pendente de resolução

**Expected Result:** Nenhuma corrida é perdida por encerramento inesperado do app.

---

## 7. Resultado e percepção de esforço

### US-7.1: Ver o resumo da atividade
**As a** Corredor
**I want to** ver as métricas consolidadas ao terminar
**So that** eu saiba como foi a corrida

**Acceptance Criteria:**
- [ ] A tela exibe distância total, tempo total (`elapsed`), tempo em movimento (`moving`), pace médio e melhor quilômetro
- [ ] O tempo total exibido é o mesmo tempo de atividade que vi durante a corrida — pausas manuais não aparecem nele
- [ ] A decomposição fecha: tempo em movimento + tempo parado sem pausa = tempo total
- [ ] A tela exibe a lista de splits com quilômetro, duração e pace
- [ ] Em atividade com treino estruturado, a tela exibe as etapas executadas, indicando as concluídas, puladas e não realizadas
- [ ] Distâncias são exibidas em quilômetros com duas casas decimais
- [ ] Durações são exibidas no formato `mm:ss` ou `hh:mm:ss` conforme a magnitude

**Expected Result:** Ao final vejo, numa tela só, o retrato completo da atividade que acabei de fazer.

---

### US-7.2: Ver o percurso no mapa
**As a** Corredor
**I want to** ver o traçado da corrida sobre um mapa
**So that** eu confira o caminho percorrido e a qualidade do rastreamento

**Acceptance Criteria:**
- [ ] A tela de resultado exibe um mapa estático com o percurso desenhado
- [ ] O traçado usa apenas os pontos de GPS validados
- [ ] O mapa se ajusta automaticamente para enquadrar o percurso inteiro
- [ ] Uma atividade sem pontos válidos não quebra a tela — o mapa é omitido com aviso
- [ ] O mapa não é exibido durante a atividade, apenas no resultado

**Expected Result:** Reconheço visualmente o trajeto que fiz, e um traçado com zigue-zague denuncia falha do filtro de GPS.

---

### US-7.3: Registrar percepção de esforço e observações
**As a** Corredor
**I want to** avaliar como o treino foi para mim
**So that** eu tenha o dado subjetivo junto dos números

**Acceptance Criteria:**
- [ ] Após finalizar, o app solicita o RPE numa escala de **1 a 10**
- [ ] Existe um campo de texto livre e opcional para observações
- [ ] O RPE é **opcional** — consigo salvar a atividade sem preenchê-lo
- [ ] A atividade salva sem RPE fica identificável no histórico como pendente de avaliação
- [ ] RPE e observações são persistidos junto da atividade

**Expected Result:** A atividade é salva com ou sem avaliação, e o dado subjetivo pode ser completado depois.

---

### US-7.4: Descartar a atividade
**As a** Corredor
**I want to** jogar fora uma atividade que não deveria ter sido gravada
**So that** meu histórico não acumule registros acidentais

**Acceptance Criteria:**
- [ ] A tela de resultado oferece a opção de descartar a atividade
- [ ] O descarte exige confirmação explícita
- [ ] Ao confirmar, a atividade, seus pontos de GPS e seus splits são removidos do banco
- [ ] Ao cancelar a confirmação, permaneço na tela de resultado sem perder nada
- [ ] A atividade descartada não aparece no histórico

**Expected Result:** Uma corrida iniciada por engano some completamente, sem deixar resíduo no banco.

---

## 8. Histórico

### US-8.1: Consultar a lista de atividades
**As a** Corredor
**I want to** ver todas as corridas que já registrei
**So that** eu acompanhe minha evolução ao longo do tempo

**Acceptance Criteria:**
- [ ] A lista exibe as atividades ordenadas da mais recente para a mais antiga
- [ ] Cada item mostra data, distância, tempo total e pace médio
- [ ] Atividades pendentes de RPE são identificáveis na lista
- [ ] Atividades originadas de um treino indicam o nome do treino
- [ ] A lista funciona offline
- [ ] Quando não há nenhuma atividade, a tela exibe um estado vazio explicativo

**Expected Result:** Abro o histórico e vejo minha progressão sem precisar de conexão.

---

### US-8.2: Ver o detalhe de uma atividade
**As a** Corredor
**I want to** abrir uma corrida antiga e ver tudo que foi registrado
**So that** eu compare com as corridas atuais

**Acceptance Criteria:**
- [ ] O detalhe exibe as mesmas métricas da tela de resultado
- [ ] O detalhe exibe os splits, o percurso no mapa e as etapas executadas
- [ ] O detalhe exibe o RPE e as observações, quando preenchidos
- [ ] O detalhe funciona offline

**Expected Result:** Consigo revisitar qualquer corrida com o mesmo nível de informação do dia em que ela foi feita.

---

### US-8.3: Preencher ou corrigir RPE e observações depois
**As a** Corredor
**I want to** editar a avaliação subjetiva de uma atividade já salva
**So that** eu complete o registro quando não pude responder na hora

**Acceptance Criteria:**
- [ ] Consigo editar RPE e observações a partir do detalhe da atividade
- [ ] Consigo preencher o RPE de uma atividade salva sem avaliação
- [ ] Após o preenchimento, a atividade deixa de ser marcada como pendente de avaliação
- [ ] As métricas objetivas da atividade **não** são editáveis

**Expected Result:** Nenhuma atividade fica permanentemente sem dado subjetivo só porque terminei a corrida sem condições de responder.

---

### US-8.4: Excluir uma atividade
**As a** Corredor
**I want to** apagar uma corrida do histórico
**So that** eu controle quais dados de localização ficam guardados

**Acceptance Criteria:**
- [ ] Consigo excluir uma atividade a partir do seu detalhe
- [ ] A exclusão exige confirmação explícita
- [ ] A exclusão remove também os pontos de GPS e os splits da atividade
- [ ] A atividade some da lista do histórico imediatamente
- [ ] A exclusão não afeta o treino da biblioteca que originou a atividade

**Expected Result:** Consigo remover permanentemente o rastro de localização de uma corrida específica.

---

## Open Questions

- **Prioridade não diferenciada.** Na entrevista nenhum item foi marcado como Medium, então todo o escopo do MVP foi classificado como High. Vale revisar se algo pode escorregar — o mapa (US-7.2) é o candidato natural, por depender do `expo-maps` em alpha e de chave do Google Maps ainda não provisionada.
- **Limiares do filtro de GPS** (US-3.1): precisão máxima aceitável, velocidade plausível e regra de salto abrupto seguem indefinidos, a serem determinados por experimentação em campo. Os critérios de aceitação foram escritos contra "o limiar configurado" justamente para não fixar números ainda não decididos.
- **Critério de precisão para liberar o início** (US-2.1): o aviso de "GPS sem precisão aceitável" depende do mesmo limiar acima.
- **Detecção de movimento para `moving_time`** (US-2.4): o critério que separa "parado" de "em movimento" sem auto-pause ainda não está definido.
- **Exportação de atividades** ficou fora do MVP por decisão do desenvolvedor, apesar de a descrição citá-la no princípio de privacidade. Fica para uma fase posterior.
- **Retenção de coordenadas**: por quanto tempo guardar os pontos de GPS segue sem política definida. A exclusão manual (US-8.4) atende ao caso pontual, mas não a uma regra automática.

## Appendix: User Story Status

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| US-2.1 | Iniciar uma corrida livre | High | Pending |
| US-2.3 | Acompanhar métricas em tempo real | High | Pending |
| US-3.1 | Descartar amostras de GPS imprecisas | High | Pending |
| US-6.1 | Manter o rastreamento com a tela bloqueada | High | Pending |
| US-6.2 | Persistir a atividade durante a execução | High | Pending |
| US-6.3 | Recuperar uma atividade interrompida | High | Pending |
| US-2.5 | Registrar splits por quilômetro | High | Pending |
| US-7.1 | Ver o resumo da atividade | High | Pending |
| US-7.3 | Registrar percepção de esforço e observações | High | Pending |
| US-8.1 | Consultar a lista de atividades | High | Pending |
| US-8.2 | Ver o detalhe de uma atividade | High | Pending |
| US-1.1 | Criar um treino estruturado | High | Pending |
| US-1.2 | Agrupar etapas em blocos de repetição | High | Pending |
| US-2.2 | Iniciar uma atividade a partir de um treino | High | Pending |
| US-4.1 | Avançar automaticamente entre etapas | High | Pending |
| US-4.2 | Ver etapa atual e próxima etapa | High | Pending |
| US-5.1 | Receber aviso na transição de etapa | High | Pending |
| US-5.3 | Receber anúncio de quilômetro concluído | High | Pending |
| US-2.4 | Pausar e retomar a atividade | High | Pending |
| US-3.2 | Ver a qualidade do sinal durante a corrida | High | Pending |
| US-3.3 | Tratar perda temporária de sinal | High | Pending |
| US-4.3 | Pular uma etapa | High | Pending |
| US-4.4 | Encerrar o treino antes do fim | High | Pending |
| US-5.2 | Receber aviso de fim de etapa iminente | High | Pending |
| US-7.2 | Ver o percurso no mapa | High | Pending |
| US-7.4 | Descartar a atividade | High | Pending |
| US-1.3 | Editar um treino existente | High | Pending |
| US-1.4 | Excluir um treino | High | Pending |
| US-8.3 | Preencher ou corrigir RPE e observações depois | High | Pending |
| US-8.4 | Excluir uma atividade | High | Pending |
