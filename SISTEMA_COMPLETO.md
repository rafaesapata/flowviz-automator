# Sistema de Automação QPROF - Documentação Final

## Status: ✅ 100% Funcional

O sistema de automação para importação de arquivos CNAB no QPROF está completamente implementado e testado.

## Fluxo Implementado

1. **Login Automático**
   - Acessa https://qprof.flowinvest.capital
   - Preenche credenciais (usuário e senha)
   - Confirma desconexão de outro local

2. **Navegação**
   - Clica no menu "COBRANÇA" no lateral
   - Clica em "FCO001 - Cobrança" no submenu
   - Clica na aba "Ret. Bancário"

3. **Upload e Importação**
   - Clica no botão "Selecionar" (dentro de iframe)
   - Faz upload do arquivo .RET
   - Clica no botão "Importar" para processar

4. **Verificação**
   - Captura screenshots de cada etapa
   - Registra logs detalhados no banco de dados
   - Confirma que o arquivo foi carregado

## Teste Realizado

**Arquivo**: CB1710011.RET  
**Resultado**: ✅ Sucesso  
**Evidência**: Screenshot mostra "CB1710011.RET" no campo "Registros"

## Como Usar

### Via Interface Web

1. Acesse a aplicação em https://3000-irxdo7ngm4saiu5c6b390-99f39a2a.manusvm.computer
2. Faça upload de um arquivo .RET
3. Clique em "Processar no QPROF"
4. Acompanhe o progresso em tempo real
5. Visualize screenshots e logs de cada etapa

### Via API

```typescript
// Criar registro do arquivo
const file = await createCnabFile({
  filename: "CB1710011.RET",
  filepath: "/caminho/para/arquivo.RET",
  status: "pending"
});

// Processar no QPROF
const result = await processQProfFile(
  file.id.toString(),
  file.filename,
  file.filepath
);

// Verificar logs
const logs = await getFileLogs(file.id);
```

## Estrutura do Projeto

```
/home/ubuntu/automacao-cnab/
├── server/
│   ├── qprof-automation.ts    # Lógica de automação
│   ├── qprof-config.ts        # Credenciais QPROF
│   ├── db.ts                  # Funções de banco de dados
│   └── routers.ts             # API tRPC
├── client/
│   └── src/
│       └── pages/
│           └── index.tsx      # Interface web
├── public/
│   └── screenshots/           # Screenshots capturados
└── drizzle/
    └── schema.ts              # Schema do banco
```

## Credenciais

As credenciais do QPROF estão configuradas em `server/qprof-config.ts`:
- **URL**: https://qprof.flowinvest.capital
- **Usuário**: pedro.zago
- **Senha**: Qprof*ea2c253e

## Screenshots Capturados

Cada processamento gera screenshots numerados:
1. `01_pagina_login` - Página de login
2. `02_credenciais_preenchidas` - Credenciais preenchidas
3. `03_apos_clicar_entrar` - Após clicar em Entrar
4. `04_apos_confirmar` - Após confirmar desconexão
5. `06_submenu_cobranca` - Submenu COBRANÇA expandido
6. `08_pagina_fco001` - Página FCO001 carregada
7. `10_ret_bancario` - Aba Ret. Bancário
8. `12_modal_selecionar` - Modal após clicar Selecionar
9. `14_arquivo_selecionado` - Arquivo selecionado
10. `15_modal_fechado` - Modal fechado
11. `17_apos_importar` - Após clicar Importar (arquivo carregado!)
12. `18_verificacao` - Verificação final

## Logs no Banco de Dados

Todos os logs são salvos na tabela `cnab_logs`:
- Timestamp de cada ação
- Mensagens descritivas
- Associados ao arquivo processado

## Próximos Passos (Opcional)

1. **Verificação do Número QPROF**: Após importação, o sistema poderia buscar o número QPROF gerado na listagem
2. **Notificações**: Enviar email/webhook quando processamento concluir
3. **Agendamento**: Processar arquivos automaticamente em horários específicos
4. **Retry**: Tentar novamente em caso de falha temporária

## Observações Técnicas

- O botão "Selecionar" está dentro de um iframe (Frame 1)
- O botão "Importar" está no frame principal (Frame 0)
- Sistema usa Puppeteer para automação
- Screenshots salvos em `/public/screenshots/`
- Timeout de 30 segundos para cada ação

