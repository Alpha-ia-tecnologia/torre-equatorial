# Especificação de Requisitos Funcionais
## Sistema de Apuração da Torre de Investimentos

**Versão:** 1.0
**Data:** 20/07/2026
**Base de referência:** Documento *Escopo Básico do Sistema da Torre de Investimentos* e planilha *APURAÇÃO – TORRE 2025 – OUTUBRO (V3-R)*

---

## 1. Contexto e Objetivo

O sistema substitui o processo atual de apuração da Torre de Investimentos, hoje realizado integralmente em Excel, por um ambiente único onde o cadastro, o cálculo e a consolidação de desempenho ocorram de forma automática, padronizada, rastreável e confiável.

O sistema deve permitir criar do zero o cenário anual da Torre, replicar ou importar modelos de anos anteriores, reunir em um só lugar o cadastro de metas, índices, indicadores, áreas executoras e réguas de avaliação, receber os resultados enviados pelas equipes técnicas corporativas e consolidar esses valores em notas comparáveis por área, indicador, índice e meta.

Os requisitos abaixo estão organizados por módulo funcional. Cada requisito recebe um código no formato **RF-XX.n** e, quando aplicável, regras de negócio (RN) e critérios de aceite.

---

## 2. Glossário de Domínio

| Termo | Definição |
|---|---|
| Meta | Estrutura de avaliação de mais alto nível, com estrutura própria por cargo e ano. |
| Índice | Agrupador ponderado dentro de uma meta; pode conter outros índices e/ou indicadores (estrutura em árvore). |
| Indicador | Elemento medível, com valor previsto e realizado, avaliado por uma régua. |
| Régua | Regra que converte o resultado de um indicador em nota, a partir dos parâmetros Mínimo, Meta e Desafio e da polaridade. |
| Área executora | Unidade organizacional responsável pela execução/apuração de um indicador (empresa + segmento + regional). |
| Unidade organizacional | Combinação empresa (distribuidora) + segmento + regional, identificada por código composto. |
| CHAVE_INDICADOR | Chave que identifica um valor de indicador em determinada unidade organizacional e período, usada por indicadores dependentes. |
| Apurador / Responsável | Usuário responsável técnico por fornecer/validar valores de um indicador. |
| Previsto / Realizado | Valores acumulados esperado e efetivo de um indicador em um período. |
| Polaridade | Sentido de avaliação da régua: "quanto maior melhor" ou "quanto menor melhor". |

---

## 3. Requisitos Funcionais

### RF-01 — Cadastro de Metas

- **RF-01.1** O sistema deve permitir cadastrar metas informando: nome da meta, ano de vigência, cargos vinculados, áreas executoras vinculadas e os índices que compõem a nota final com seus respectivos pesos.
- **RF-01.2** O sistema deve permitir que cada meta possua estrutura de avaliação própria e independente das demais.
- **RF-01.3** O sistema deve permitir vincular um ou mais cargos a uma meta, para associar a avaliação ao desempenho individual/organizacional dos ocupantes.
- **RF-01.4** O sistema deve permitir vincular uma ou mais áreas executoras à meta.
- **RF-01.5** O sistema deve permitir definir a composição da nota final da meta como combinação ponderada dos índices vinculados.
- **RN-01.1** A soma dos pesos dos índices de uma meta deve ser validada (ex.: totalizar 100% ou fator equivalente configurável); o sistema deve alertar quando a soma divergir do esperado.
- **Critério de aceite:** É possível criar uma meta completa para um ano, com índices e pesos, sem uso de planilha externa.

### RF-02 — Cadastro de Índices dentro da Meta

- **RF-02.1** O sistema deve permitir cadastrar índices dentro de uma meta, definindo o peso de cada índice dentro da meta.
- **RF-02.2** O sistema deve permitir que um índice tenha uma lista de "filhos", que podem ser outros índices e/ou indicadores (estrutura hierárquica em árvore, com múltiplos níveis).
- **RF-02.3** O sistema deve permitir estruturas de índices diferentes por meta e por ano.
- **RN-02.1** A soma dos pesos dos filhos de um índice deve ser validável; divergências devem ser sinalizadas.
- **RN-02.2** O sistema deve impedir a criação de referências que gerem ciclos na árvore de índices.

### RF-03 — Cadastro de Indicadores dentro de cada Índice

- **RF-03.1** O sistema deve permitir cadastrar indicadores dentro de um índice, definindo o peso do indicador dentro do índice.
- **RF-03.2** O sistema deve permitir vincular cada indicador a uma régua de avaliação.
- **RF-03.3** O sistema deve permitir associar a um indicador a lista de áreas executoras envolvidas.
- **RF-03.4** O sistema deve permitir configurar a ponderação do indicador por critério financeiro ou equivalente (ex.: capitalização, valor de referência/VR).
- **RF-03.5** O sistema deve permitir que o mesmo indicador seja reutilizado em metas distintas, com pesos, réguas ou áreas diferentes em cada contexto, sem duplicar seu cadastro base.
- **RF-03.6** O sistema deve controlar, por indicador e por área/segmento, se o indicador é aplicável ("elegível") àquela combinação, conforme a matriz de preenchimento (equivalente à aba PREENCHIMENTO da planilha).
- **Critério de aceite:** Um indicador pode existir em duas metas com pesos e réguas diferentes, mantendo um único registro de origem.

### RF-04 — Indicadores Dependentes de Outros Indicadores

- **RF-04.1** O sistema deve permitir criar indicadores cujo cálculo utiliza valores de outros indicadores.
- **RF-04.2** O cálculo de um indicador dependente deve considerar a mesma unidade organizacional e o mesmo período dos indicadores de origem.
- **RF-04.3** O sistema deve localizar os valores de origem por meio da CHAVE_INDICADOR, permitindo referenciar outro indicador alterando apenas o código do indicador na chave.
- **RF-04.4** O sistema deve permitir a definição de fórmulas matemáticas customizáveis que usem variáveis provenientes de outros indicadores.
- **RF-04.5** O sistema deve garantir a ordem correta de cálculo, respeitando as dependências entre indicadores.
- **RF-04.6** O sistema deve detectar e bloquear dependências circulares, informando ao usuário o ciclo identificado.
- **RF-04.7** O sistema deve manter a rastreabilidade da origem de cada valor utilizado em um indicador dependente.
- **RF-04.8** O sistema deve permitir criar novas fórmulas sem necessidade de alterar o código-fonte do sistema (fórmulas configuráveis em tempo de uso).
- **Critério de aceite:** Ao cadastrar uma fórmula que referencie um indicador que a referencie de volta, o sistema recusa o salvamento e exibe o ciclo.

### RF-05 — Cadastro de Réguas

- **RF-05.1** O sistema deve permitir cadastrar réguas contendo: código da régua e os parâmetros Mínimo, Meta e Desafio.
- **RF-05.2** O sistema deve permitir definir a polaridade da régua ("quanto maior melhor" ou "quanto menor melhor").
- **RF-05.3** O sistema deve permitir associar uma régua a um ou mais indicadores.
- **RF-05.4** O sistema deve permitir réguas específicas por unidade organizacional (uma mesma métrica pode ter parâmetros distintos por distribuidora/área).
- **RF-05.5** O sistema deve aplicar a definição fixa de nota nos pontos de referência: resultado no Mínimo equivale à nota 1, no ponto Meta à nota 10 e no Desafio à nota 15.
- **RF-05.6** O sistema deve calcular a nota de resultados intermediários por interpolação entre os pontos de referência, respeitando a polaridade.
- **RN-05.1** Para polaridade "quanto menor melhor", o valor de Mínimo será maior que o de Desafio; o sistema deve validar a coerência dos parâmetros conforme a polaridade.
- **RN-05.2** O sistema deve tratar resultados fora dos limites (acima do Desafio ou abaixo do Mínimo) segundo regra de teto/piso configurável.

### RF-06 — Cadastro da Estrutura Organizacional

- **RF-06.1** O sistema deve permitir cadastrar unidades (ex.: empresas/distribuidoras/filiais).
- **RF-06.2** O sistema deve permitir cadastrar áreas/segmentos.
- **RF-06.3** O sistema deve permitir cadastrar regionais/subsegmentos.
- **RF-06.4** O sistema deve gerar e manter um código composto por unidade + segmento + subsegmento (regional) para cada área/subdivisão.
- **RF-06.5** O sistema deve armazenar a descrição completa de cada área/subdivisão.
- **RF-06.6** O sistema deve permitir ativar/desativar unidades, áreas e regionais, preservando o histórico de períodos anteriores.
- **RN-06.1** Registros desativados não devem ficar disponíveis para novos vínculos, mas devem permanecer visíveis nas apurações históricas em que foram utilizados.

### RF-07 — Cadastro de Pesos

- **RF-07.1** O sistema deve permitir cadastrar pesos entre áreas (segmentos) para consolidação da nota de uma unidade.
- **RF-07.2** O sistema deve permitir cadastrar pesos entre regionais dentro de uma área.
- **RF-07.3** O sistema deve permitir cadastrar pesos entre distribuidoras para consolidação global.
- **RF-07.4** O sistema deve permitir conjuntos de pesos distintos por visão/recorte (ex.: elegível, direção de engenharia, direção de obras, superintendências).
- **RF-07.5** O sistema deve permitir que os pesos variem por ano.
- **RN-07.1** O sistema deve validar a totalização dos pesos dentro de cada nível de agregação e sinalizar divergências.

### RF-08 — Regras de Cálculo das Notas

- **RF-08.1** O sistema deve calcular automaticamente a nota do indicador por área, a partir do resultado (previsto x realizado) e da régua aplicável.
- **RF-08.2** O sistema deve calcular a nota consolidada por indicador, ponderando as notas das áreas envolvidas.
- **RF-08.3** O sistema deve calcular a nota de cada índice combinando as notas de seus filhos (índices e/ou indicadores) por meio dos pesos.
- **RF-08.4** O sistema deve calcular a nota final da meta como combinação ponderada dos índices.
- **RF-08.5** O sistema deve calcular a nota consolidada por unidade organizacional (ex.: por distribuidora) e a nota global da Torre, aplicando os pesos entre áreas, regionais e distribuidoras.
- **RF-08.6** O sistema deve recalcular automaticamente todas as notas dependentes quando um valor de entrada, peso, régua ou estrutura for alterado.
- **RF-08.7** O sistema deve permitir a consulta da memória de cálculo de qualquer nota (rastreabilidade da composição: valores, pesos e réguas utilizados).
- **RF-08.8** O sistema deve tratar situações de indisponibilidade de valor (ex.: indicador não aplicável à área) sem invalidar a consolidação, seguindo regra definida (exclusão do rateio e renormalização de pesos).
- **RN-08.1** Alterações em qualquer nível devem propagar o recálculo de baixo para cima na hierarquia (indicador → índice → meta → unidade → global).

### RF-09 — Cadastro de Responsáveis e Apuradores

- **RF-09.1** O sistema deve permitir cadastrar os responsáveis técnicos por indicador.
- **RF-09.2** O sistema deve permitir definir permissões de edição, controlando quem pode alterar valores (ex.: valores previstos e realizados).
- **RF-09.3** O sistema deve permitir estabelecer o relacionamento entre apurador e indicador.
- **RF-09.4** O sistema deve restringir a entrada e a alteração de valores de um indicador aos usuários autorizados para ele.
- **RN-09.1** Toda alteração de valor deve registrar autor, data/hora e valor anterior (trilha de auditoria).

### RF-10 — Cadastro de Calendário e Deadlines

- **RF-10.1** O sistema deve permitir cadastrar, por período avaliado, as datas de entrega dos indicadores (deadline).
- **RF-10.2** O sistema deve permitir cadastrar datas de retorno/validação.
- **RF-10.3** O sistema deve permitir cadastrar datas de reunião/comitê e de lançamento de notas.
- **RF-10.4** O sistema deve permitir regras de prazo específicas por indicador.
- **RF-10.5** O sistema deve calcular automaticamente o status de cada entrega (ex.: no prazo, atrasado, pendente).
- **RF-10.6** O sistema deve vincular o calendário aos responsáveis e apuradores de cada indicador.
- **RF-10.7** O sistema deve permitir a carga inicial das curvas (valores previstos) para o período/ano.
- **RF-10.8** O sistema deve notificar responsáveis e apuradores sobre prazos próximos e vencidos (desejável).
- **Critério de aceite:** Ao ultrapassar o deadline sem lançamento, o indicador aparece automaticamente com status "atrasado".

### RF-11 — Entrada e Recebimento de Resultados

- **RF-11.1** O sistema deve permitir o lançamento dos valores previstos e realizados por indicador, unidade organizacional e período.
- **RF-11.2** O sistema deve suportar importação em lote dos resultados enviados pelas equipes técnicas (ex.: por arquivo/planilha), mapeando os dados pela CHAVE_INDICADOR/estrutura organizacional.
- **RF-11.3** O sistema deve validar os dados recebidos (formato, unidade organizacional existente, indicador aplicável, período válido) e reportar inconsistências antes de efetivar a carga.
- **RF-11.4** O sistema deve suportar valores acumulados por período, conforme a definição de Previsto/Realizado.
- **RF-11.5** O sistema deve suportar detalhamento por Projeto de Investimento (PI) quando aplicável, replicando a estrutura para cada PI.

### RF-12 — Flexibilidade Total por Ano

- **RF-12.1** O sistema deve permitir importar/replicar a estrutura completa de um ano anterior (metas, índices, indicadores, réguas, áreas e pesos) como ponto de partida de um novo ano.
- **RF-12.2** O sistema deve permitir modificar pesos, índices e indicadores do cenário do ano.
- **RF-12.3** O sistema deve permitir alterar réguas.
- **RF-12.4** O sistema deve permitir mudar as áreas executoras consideradas.
- **RF-12.5** O sistema deve permitir adaptar a estrutura a novos modelos de gestão sem reescrever/alterar o código do sistema.
- **RF-12.6** O sistema deve manter a independência entre cenários de anos diferentes, preservando o histórico de cada ano.
- **Critério de aceite:** É possível gerar o cenário de um novo ano a partir do anterior e ajustá-lo sem impactar os dados do ano de origem.

### RF-13 — Consolidação, Visualização e Saídas

- **RF-13.1** O sistema deve apresentar o painel consolidado da Torre por distribuidora, área, regional, índice e indicador, exibindo a nota e os componentes (equivalente às visões HOME e NOTAS ELEGÍVEIS da planilha).
- **RF-13.2** O sistema deve exibir o comparativo entre visões (ex.: realizado x referência/projeção) e a variação (gap) entre elas.
- **RF-13.3** O sistema deve permitir filtrar as visões por ano, período/mês, distribuidora, meta, índice, indicador e área.
- **RF-13.4** O sistema deve gerar a nota final por item avaliável (ex.: "Cumprimento Torre Investimentos Global" por distribuidora) para consumo por processos de gestão de desempenho.
- **RF-13.5** O sistema deve permitir exportar os resultados e apurações (ex.: planilha/relatório) para uso externo.
- **RF-13.6** O sistema deve disponibilizar material de apoio ao comitê (visão consolidada por período).

---

## 4. Requisitos Funcionais de Apoio (Transversais)

### RF-14 — Controle de Acesso e Perfis

- **RF-14.1** O sistema deve autenticar usuários e controlar o acesso por perfil (ex.: administrador da Torre, gestor, apurador/responsável, consulta).
- **RF-14.2** O sistema deve restringir as funções de cadastro estrutural (metas, índices, réguas, pesos) a perfis administrativos.
- **RF-14.3** O sistema deve restringir o lançamento de valores ao apurador/responsável vinculado ao indicador.

### RF-15 — Auditoria e Rastreabilidade

- **RF-15.1** O sistema deve registrar trilha de auditoria de criações, alterações e exclusões de cadastros e valores (autor, data/hora, valor anterior e novo).
- **RF-15.2** O sistema deve permitir consultar o histórico de alterações de estrutura e de valores por período.

### RF-16 — Validações e Integridade

- **RF-16.1** O sistema deve validar a consistência de pesos, réguas e estrutura antes de consolidar as notas.
- **RF-16.2** O sistema deve sinalizar divergências (ex.: uma aba/base com período diferente, indicador sem régua, área sem peso) de forma clara ao usuário, antes do fechamento do período.

---

## 5. Rastreabilidade — Escopo → Requisitos

| Item do Escopo | Requisitos |
|---|---|
| 1. Cadastro de Metas | RF-01 |
| 2. Cadastro de Índices | RF-02 |
| 3. Cadastro de Indicadores | RF-03 |
| 4. Indicadores Dependentes | RF-04 |
| 5. Cadastro de Réguas | RF-05 |
| 6. Estrutura Organizacional | RF-06 |
| 7. Regras de Cálculo das Notas | RF-08 |
| 8. Responsáveis e Apuradores | RF-09, RF-14 |
| 9. Calendário e Deadlines | RF-10 |
| 10. Flexibilidade por Ano | RF-12 |
| Pesos (planilha PESOS/ÁREAS_REGIONAIS) | RF-07 |
| Preenchimento/recebimento de resultados | RF-11 |
| Consolidação/visualização (HOME/NOTAS) | RF-13 |

---

## 6. Premissas e Pontos a Confirmar

1. **Regra de interpolação da nota** entre Mínimo/Meta/Desafio — confirmar se é linear por trecho (1↔10 e 10↔15) e como tratar valores fora dos limites (teto 15 / piso 1, ou extrapolação).
2. **Renormalização de pesos** quando um indicador não é aplicável a uma área — confirmar se os pesos dos demais são reajustados ou se a ausência conta como zero.
3. **Granularidade temporal** — confirmar se a apuração é sempre mensal acumulada e se há fechamento anual específico.
4. **Formato dos arquivos de importação** das equipes técnicas — definir layout padrão para o recebimento em lote.
5. **Integração** — confirmar se o resultado final alimenta outro sistema de gestão de desempenho (a aba NOTAS ELEGÍVEIS sugere consumo externo).
6. **Projeto de Investimento (PI)** — confirmar em quais indicadores o detalhamento por PI é obrigatório.
