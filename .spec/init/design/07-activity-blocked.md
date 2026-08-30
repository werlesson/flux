# 07 — Bloqueios ao iniciar

**US cobertas:** US-2.1
**Imagem:** ./07-activity-blocked.png

## Propósito
Tratar os dois impedimentos de início: permissão de localização negada, que bloqueia, e GPS sem precisão aceitável, que apenas avisa.

## Elementos obrigatórios (permissão negada)
- Marca de alerta `!` em vermelho
- Título `Sem permissão de localização, não é possível gravar a corrida`
- Texto `O Flux usa o GPS para medir distância, pace e percurso. A permissão precisa incluir o acesso em segundo plano para a atividade continuar com a tela bloqueada.`
- Quadro de status com `Localização em uso` → `Negada` e `Localização em segundo plano` → `Negada`
- Botão primário `Abrir configurações` e secundário `Voltar ao início`
- **Não** existe caminho para iniciar a atividade nesta variante

## Elementos obrigatórios (GPS sem fix)
- Sheet sobre a tela inicial, com indicador ouro `GPS: sem precisão aceitável`
- Título `Iniciar agora pode registrar os primeiros metros com erro`
- Texto `O aparelho ainda está buscando sinal. Esperar alguns segundos a céu aberto melhora a precisão da distância e do percurso. A decisão é sua.`
- Ações `Iniciar assim mesmo` e `Aguardar sinal` (primária)

## Estados
### Permissão negada
Bloqueia. Se apenas a permissão de segundo plano estiver negada, o quadro mostra `Concedida` na primeira linha e o texto acrescenta `Sem o acesso em segundo plano a gravação para quando a tela apaga.`
### GPS sem fix
Não bloqueia. `Iniciar assim mesmo` cria a atividade normalmente; a tela 05/06 abre já com o indicador em `precisão degradada` ou `sem sinal`.
### Aguardando sinal
Após `Aguardar sinal` o sheet permanece com o indicador atualizado; quando o fix chega, o indicador vira verde `GPS: boa precisão` e a ação primária passa a `Iniciar`.

## Interações
- `Abrir configurações` → abre as configurações do app no sistema
- `Voltar ao início` → tela 01
- `Iniciar assim mesmo` → cria a atividade e segue para 05 ou 06
- `Aguardar sinal` → mantém o sheet, continuando a monitorar a `accuracy`

## Notas de implementação
- Verificar foreground e background em chamadas separadas; `ACCESS_BACKGROUND_LOCATION` costuma exigir uma segunda solicitação.
- O limiar de "precisão aceitável" está em aberto na especificação (será calibrado em campo); a UI só consome o resultado booleano do filtro.
- Se o usuário negou permanentemente, o sistema não reabre o diálogo — daí o atalho para as configurações ser o único caminho.
- Tema claro: alerta `#C0392B` sobre `#FDECEA`; aviso `#9A6B00` sobre `#FDF3E0`.
