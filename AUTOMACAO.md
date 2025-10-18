# Sistema de Automação de Importação CNAB

## Visão Geral

Sistema completo de automação para importação de arquivos CNAB no QPROF. Permite criar rotinas que monitoram pastas específicas e importam automaticamente novos arquivos em horários agendados.

## Funcionalidades

### 1. Gerenciamento de Rotinas

- **Criar rotinas** com configurações personalizadas
- **Pausar/Ativar** rotinas conforme necessário
- **Executar manualmente** rotinas a qualquer momento
- **Excluir** rotinas não utilizadas
- **Visualizar histórico** de execuções

### 2. Configurações por Rotina

Cada rotina possui:
- **Nome**: identificação da rotina
- **Empresa**: empresa no QPROF onde os arquivos serão importados
- **Pasta**: caminho absoluto da pasta monitorada
- **Frequência**: horária, diária ou semanal

### 3. Detecção Inteligente de Arquivos

- **Hash MD5**: cada arquivo é identificado por seu hash
- **Evita reimportação**: arquivos já processados são ignorados
- **Detecta alterações**: se o arquivo mudar, será reprocessado
- **Suporta múltiplas rotinas**: mesma pasta pode ter rotinas diferentes

### 4. Processamento Automático

Quando uma rotina é executada:
1. Lista todos os arquivos .RET da pasta
2. Calcula hash MD5 de cada arquivo
3. Verifica se já foi importado
4. Processa arquivos novos no QPROF
5. Registra resultado (sucesso/erro)
6. Agenda próxima execução

### 5. Scheduler Automático

- **Verifica rotinas a cada 5 minutos**
- **Executa automaticamente** rotinas pendentes
- **Inicia com o servidor** - não requer configuração manual
- **Logs detalhados** de cada verificação

## Como Usar

### Criar Nova Rotina

1. Acesse a página **Automação** no menu superior
2. Clique em **Nova Rotina**
3. Preencha os campos:
   - **Nome**: Ex: "Importação Diária BRASCOB"
   - **Empresa**: Selecione da lista (ex: BRASCOB)
   - **Pasta**: Ex: `/home/ubuntu/cnab-files`
   - **Frequência**: Escolha entre horária, diária ou semanal
4. Clique em **Criar Rotina**

### Gerenciar Rotinas

Na página de Automação, você pode:

- **▶️ Executar Agora**: processa imediatamente
- **⏸️ Pausar**: interrompe execuções automáticas
- **▶️ Ativar**: retoma execuções automáticas
- **🗑️ Excluir**: remove a rotina permanentemente

### Visualizar Execuções

Cada rotina mostra:
- **Status**: Ativa, Pausada ou Erro
- **Última execução**: data/hora da última vez que rodou
- **Próxima execução**: quando será executada novamente

## Estrutura Técnica

### Tabelas do Banco de Dados

#### `automationRoutines`
```sql
- id: int (PK)
- name: varchar(255)
- company: varchar(255)
- folderPath: varchar(500)
- frequency: enum('hourly', 'daily', 'weekly')
- status: enum('active', 'paused', 'error')
- lastRun: timestamp
- nextRun: timestamp
- createdAt: timestamp
```

#### `monitoredFiles`
```sql
- id: int (PK)
- routineId: int (FK)
- filename: varchar(255)
- filepath: varchar(500)
- fileHash: varchar(64) -- MD5
- status: enum('pending', 'processing', 'completed', 'error')
- qprofNumber: varchar(64)
- importedAt: timestamp
- error: text
- createdAt: timestamp
```

### Módulos

#### `server/automation-scheduler.ts`
- `executeRoutine(routineId)`: executa uma rotina específica
- `checkAndExecuteRoutines()`: verifica todas as rotinas pendentes
- `startScheduler()`: inicia o scheduler automático
- `stopScheduler()`: para o scheduler

#### `server/db.ts`
Funções de banco de dados:
- `createAutomationRoutine(data)`
- `listAutomationRoutines()`
- `getAutomationRoutine(id)`
- `updateAutomationRoutine(id, data)`
- `deleteAutomationRoutine(id)`
- `getMonitoredFiles(routineId)`

#### `server/routers.ts`
API tRPC:
- `automation.createRoutine`
- `automation.listRoutines`
- `automation.getRoutine`
- `automation.updateRoutine`
- `automation.deleteRoutine`
- `automation.getRoutineFiles`
- `automation.executeRoutine`

#### `client/src/pages/Automation.tsx`
Interface web completa para gerenciar rotinas

## Fluxo de Execução

```
┌─────────────────────────────────────────────────────────┐
│ Scheduler (a cada 5 minutos)                            │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Verificar rotinas ativas com nextRun <= agora          │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Para cada rotina pendente:                              │
│  1. Listar arquivos .RET da pasta                       │
│  2. Calcular hash MD5 de cada arquivo                   │
│  3. Verificar se já foi importado                       │
│  4. Processar arquivos novos                            │
│  5. Registrar resultado                                 │
│  6. Atualizar lastRun e nextRun                         │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│ Aguardar próxima verificação (5 minutos)                │
└─────────────────────────────────────────────────────────┘
```

## Exemplos de Uso

### Exemplo 1: Importação Diária

```
Nome: Importação Diária BRASCOB
Empresa: BRASCOB
Pasta: /home/ubuntu/cnab-brascob
Frequência: Diariamente

Resultado:
- Primeira execução: agora
- Próxima execução: daqui a 24 horas
- Arquivos processados: todos os .RET novos da pasta
```

### Exemplo 2: Importação Horária

```
Nome: Importação Horária FLOWINVEST
Empresa: FLOWINVEST FIDC
Pasta: /home/ubuntu/cnab-flowinvest
Frequência: A cada hora

Resultado:
- Primeira execução: agora
- Próxima execução: daqui a 1 hora
- Arquivos processados: todos os .RET novos da pasta
```

### Exemplo 3: Múltiplas Empresas

```
Rotina 1:
- Nome: BRASCOB - Diário
- Empresa: BRASCOB
- Pasta: /home/ubuntu/cnab-files
- Frequência: Diariamente

Rotina 2:
- Nome: FLOWINVEST - Diário
- Empresa: FLOWINVEST FIDC
- Pasta: /home/ubuntu/cnab-files
- Frequência: Diariamente

Resultado:
- Mesma pasta, empresas diferentes
- Cada arquivo é importado em ambas as empresas
- Registros separados por rotina
```

## Logs e Monitoramento

### Logs do Scheduler

```
[Scheduler] Verificando rotinas pendentes...
[Scheduler] Encontradas 3 rotinas ativas
[Rotina 1] Iniciando execução...
[Rotina 1] Configuração:
  Nome: Importação Diária BRASCOB
  Empresa: BRASCOB
  Pasta: /home/ubuntu/cnab-files
  Frequência: daily
[Rotina 1] Encontrados 2 arquivos .RET
[Rotina 1] Verificando arquivo: CB1710011.RET
[Rotina 1] Novo arquivo detectado: CB1710011.RET
[Rotina 1] Processando arquivo: CB1710011.RET
[Rotina 1] ✅ Arquivo processado com sucesso: CB1710011.RET
[Rotina 1] Execução concluída:
  Arquivos processados: 1
  Erros: 0
  Próxima execução: 19/10/2025 08:00:00
```

### Visualização na Interface

- **Dashboard**: estatísticas de rotinas ativas/pausadas
- **Lista de rotinas**: status, última execução, próxima execução
- **Arquivos monitorados**: histórico completo por rotina

## Segurança e Boas Práticas

### Permissões de Pasta

Certifique-se de que o servidor tem permissão de leitura na pasta:
```bash
chmod 755 /home/ubuntu/cnab-files
```

### Organização de Pastas

Recomendações:
- Use pastas separadas por empresa
- Mantenha backup dos arquivos originais
- Arquive arquivos processados periodicamente

### Monitoramento

- Verifique logs regularmente
- Configure alertas para rotinas com erro
- Teste rotinas manualmente antes de ativar

## Troubleshooting

### Rotina não está executando

1. Verifique se o status é "Ativa"
2. Confirme que nextRun está no passado
3. Verifique logs do servidor
4. Execute manualmente para testar

### Arquivos não são detectados

1. Verifique se a pasta existe
2. Confirme permissões de leitura
3. Verifique extensão do arquivo (.RET)
4. Teste com execução manual

### Erro ao processar arquivo

1. Verifique logs da rotina
2. Confirme credenciais QPROF
3. Teste arquivo manualmente
4. Verifique formato do arquivo

## Próximas Melhorias

- [ ] Notificações por email/webhook
- [ ] Filtros por nome de arquivo
- [ ] Agendamento por horário específico
- [ ] Dashboard com gráficos de execução
- [ ] Retry automático em caso de erro
- [ ] Arquivamento automático de arquivos processados

