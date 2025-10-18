# Guia para Resolver o Problema do Botão "Importar"

## Problema

O botão "Importar" na página Ret. Bancário do QPROF não está sendo encontrado pelo código de automação.

## Diagnóstico Manual Necessário

### Passo 1: Acessar a página manualmente

1. Abrir Chrome/Chromium
2. Acessar https://qprof.flowinvest.capital
3. Fazer login com:
   - Usuário: `pedro.zago`
   - Senha: `Qprof*ea2c253e`
4. Confirmar desconexão
5. Navegar para: COBRANÇA > FCO001 - Cobrança > Ret. Bancário

### Passo 2: Inspecionar o botão "Importar"

1. Clicar com botão direito no botão "Importar" (verde claro)
2. Selecionar "Inspecionar elemento"
3. Anotar:
   - Tag HTML (input, button, a?)
   - Atributos (id, class, value, onclick)
   - Se está dentro de um iframe

### Passo 3: Verificar iframes

No console do DevTools, executar:

```javascript
// Listar todos os iframes
document.querySelectorAll('iframe').forEach((iframe, i) => {
  console.log(`Frame ${i}:`, iframe.src || iframe.name || 'sem src/name');
});

// Procurar botão Importar em cada iframe
document.querySelectorAll('iframe').forEach((iframe, i) => {
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const buttons = doc.querySelectorAll('input, button, a');
    buttons.forEach(btn => {
      const text = btn.textContent || btn.value || '';
      if (text.toLowerCase().includes('importar')) {
        console.log(`Frame ${i} - Botão encontrado:`, btn);
      }
    });
  } catch (e) {
    console.log(`Frame ${i} - Não acessível (cross-origin)`);
  }
});
```

### Passo 4: Testar seletor

Após identificar o seletor correto, testar no console:

```javascript
// Exemplo 1: Por ID
document.querySelector('#ID_DO_BOTAO').click();

// Exemplo 2: Por value
document.querySelector('input[value="Importar"]').click();

// Exemplo 3: Dentro de iframe
const iframe = document.querySelector('iframe[name="NOME_DO_IFRAME"]');
const doc = iframe.contentDocument;
doc.querySelector('#ID_DO_BOTAO').click();
```

## Soluções Possíveis

### Solução 1: Botão em iframe específico

Se o botão estiver em um iframe, atualizar `importFile()`:

```typescript
// Encontrar iframe específico
const frames = page.frames();
const targetFrame = frames.find(f => f.url().includes('PARTE_DA_URL'));

if (targetFrame) {
  await targetFrame.click('input[value="Importar"]');
}
```

### Solução 2: Aguardar carregamento dinâmico

Se o botão for carregado dinamicamente:

```typescript
// Aguardar botão aparecer
await page.waitForSelector('input[value="Importar"]', { timeout: 10000 });
await page.click('input[value="Importar"]');
```

### Solução 3: Usar coordenadas (menos recomendado)

Como último recurso:

```typescript
// Clicar em coordenadas específicas
await page.mouse.click(X, Y);
```

## Atualização do Código

Após identificar o seletor correto, atualizar em:

**Arquivo**: `server/qprof-automation.ts`  
**Função**: `importFile()`  
**Linha**: ~208

Exemplo de atualização:

```typescript
async function importFile(page: Page, fileId: number, filePath: string): Promise<boolean> {
  try {
    await addLog(fileId, 'Aguardando botão Importar');
    
    // OPÇÃO 1: Se estiver na página principal
    await page.waitForSelector('SELETOR_CORRETO', { timeout: 10000 });
    await page.click('SELETOR_CORRETO');
    
    // OPÇÃO 2: Se estiver em iframe
    const frames = page.frames();
    const targetFrame = frames.find(f => f.url().includes('IDENTIFICADOR'));
    if (targetFrame) {
      await targetFrame.waitForSelector('SELETOR_CORRETO');
      await targetFrame.click('SELETOR_CORRETO');
    }
    
    await addLog(fileId, 'Botão Importar clicado');
    await delay(3000);
    
    // Continuar com upload do arquivo...
  }
}
```

## Teste Após Correção

```bash
cd /home/ubuntu
npx tsx test-full-flow.ts
```

Verificar se passou da etapa "Clicando no botão Importar" sem erro.

## Informações Úteis

### Seletores já testados (não funcionaram):
- `#ctl00_cphContext_FSI001_Control_PV6_UC0_FSI001_Control_PV0_UC0_btnImportFile`
- `input[value="Importar"]`
- Busca em 1 frame encontrado

### Screenshots disponíveis:
- `screenshot_60001_10_ret_bancario.png` - Mostra o botão visualmente
- `screenshot_60001_11_erro_importar.png` - Estado quando não encontra

### Logs relevantes:
```
Clicando no botão Importar
Botão não encontrado na página principal, procurando em iframes
Total de frames encontrados: 1
Erro: Botão Importar não encontrado
```

## Contato para Dúvidas

Se precisar de ajuda adicional, fornecer:
1. HTML do botão (copiar do DevTools)
2. Estrutura de iframes (se houver)
3. Qualquer erro no console do navegador

