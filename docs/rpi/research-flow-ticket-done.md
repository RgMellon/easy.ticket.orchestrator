1. O especialista do Sysops Squad marca o ticket como concluído usando um aplicativo em seu dispositivo móvel, que é recebido de forma síncrona pelo
   Serviço de Orquestrador de Tickets
2. O Serviço de Orquestrador de Tickets envia uma solicitação síncrona ao
   Serviço de Ticket para alterar o estado do ticket de "em andamento" para
   "concluído."
3. O Serviço de Ticket atualiza o número do ticket para "completo" na tabela do
   banco de dados e confirma a atualização.
4. Como parte do processo de conclusão do ticket, o Serviço de Ticket envia informações de ticket de forma assíncrona (como tempo de reparo do ticket, tempo de espera do ticket, duração, e assim por diante) para uma fila a ser coletada pelo Serviço de análise. Depois de enviado, o Serviço de Ticket envia uma confirmação ao Serviço de Orquestrador de Tickets informando que a atualização foi concluída.
5. Mais ou menos ao mesmo tempo, o Serviço de Análise recebe de forma assíncrona a análise atualizada do ticket e começa a processar as informações do ticket.
6. O Serviço de Orquestrador de Tickets, então, envia uma solicitação síncrona ao Serviço de Pesquisa para preparar e enviar a pesquisa do cliente ao cliente.

7. O Serviço de Pesquisa insere os dados em uma tabela com as informações da pesquisa (cliente, informações do ticket e carimbo de data/hora) e confirma a inserção.
8. O Serviço de Pesquisa então envia a pesquisa ao cliente por e-mail e retorna uma confirmação ao Serviço de Orquestrador de Tickets informando que o
   processamento da pesquisa foi concluído.
9. Por fim, o Serviço de Orquestrador de Tickets envia uma resposta de volta ao dispositivo móvel do especialista do Sysops Squad informando que o processamento da conclusão do ticket foi concluído. Quando isso acontecer, o especialista pode selecionar o próximo ticket de problema atribuído a ele.
