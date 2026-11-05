O Projeto easy.ticket orchestrator é uma das partes do projeto easy.ticket
Vamos utilizar uma arquitetura distribuida, e ela vai ser orquestrada e esse
é o papel do orchestrator

Vamos fazer por partes e vamos planejar cada etapa para poder ficar facil
para eu validar tbm.

Adicione testes e bata nos testes antes e depois faca a impl pra ver se passou

vamos criar uma maquina de estado para organizar
entao esse sera os possiveis estados

1 - O Cliente insere um novo ticket no sistema

2 - O Ticket é distribuido para o proximo especialista disponivel

3 - O Ticket é enviado para o dispositivo do especialista

4 - O Especialista recebe o ticket do chamado e trabalha no problema

5 - O Especialista finaliza o reparo e marca como concluido

6 - Uma pesquisa é enviada ao cliente.

Detalhes

Start :

Começa com o client inserindo um novo ticket, depois que o ticket é inserido na table de ticket no banco de dados, o estado da saga transcional muda para CREATED

CREATED :

Atribuido a um especialista SYSOPS, se nenhum especialista estiver disponivel para atender o ticket ele sera mantido em estado de espera ate que um especialista esteja disponivel, depois que um especialista é atribuido, o estado da saga passa para o estado de ASSIGNED, o Ticket é mantido no estado de CREATED ate que ele seja atribuido

ASSIGNED :

Depois que um ticket é atribuido a um especialista, o unico resultado possivel é encaminhar o ticket para o especialista.

Presume-se que duranto o algoritimo de atribuição, o especialista foi localizado e esta disponivel. Se o ticket não puder ser roteado porque o especialista não foi localizado ou não esta disponivel, a saga fica nesse estado ate que possa ser roteada.

Assim que foi encaminhado para o especialista ele deve confirmar que o ticket foi recebido.

Assim que isso acontecer o estado muda para ACCEPTED.

ACCEPETED:

Existe 2 cenarios disponiveis depois que foi aceito

COMPLETED ou REASSIGN

Assim que ele termindou o reparo o ticket pode ser marcado como concluido, passando o estado para COMPLETED, no entanto por algum motivo foi atribuido incorretamente ou especialista nao consegue concluir o reparo, notificamos ao sistem e o estado passa para REASSIGN

REASSIGN:

Se um especialista nao tiver disponivel a sata trancional permanecera no estado REASSIGN ate que um especialista seja designado.

Assim que um novo especialista é encontrado o ticket é movido novamente, O estado passa a ser ASSIGNED esperando para ser aceito por outro especialista

COMPLETED:

Os dois estados possiveis para esse cenario são CLOSED ou NO_SURVEY

Quando o ticket esta nesse estado, uma pesquisa é enviada ao cliente para avaliar o especialista e o serviço, e o estad da saga para CLOSED, no entanto se o servico de epsquisa estiver indisponivel ou correr um erro durante o envio da pesquisa o estado muda para NO_SURVEY, indicando que o chamado foi completo mas nao pesquisa enviada para o cliente

NO_SURVEY

No estado de condição de erro, o sistema continua tentando enviar a pesquisa ao cliente. uMA vez enviado com sucesso oestado passa para CLOSE, marcando o fim da saga trancional.

Regra de negocio, quero que os estados e a desc sejam salvos na tabela pra eu manter
eles em algum lugar.

quero algo bem parecido com o que existe no /Volumes/ssd-mac/dev/nest/fast-ticket/fast-ticket-order-orchestrator o state-machine
obvio adaptando pro nosso cenario.

Entao vamos quebrar em etapas planejar juntos, me faca pergunta em caso de duvidas
