import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import { addLog, updateCnabFileStatus, addScreenshot } from './db';
import { QPROF_CONFIG } from './qprof-config';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function takeScreenshot(page: Page, fileId: number, step: number, name: string) {
  try {
    const screenshotPath = path.join(
      '/home/ubuntu/automacao-cnab',
      'public',
      'screenshots',
      `screenshot_${fileId}_${step}_${name}.png`
    );
    
    await page.screenshot({ path: screenshotPath, fullPage: false });
    
    // Salvar no banco
    await addScreenshot({
      fileId,
      step,
      name,
      path: `/screenshots/screenshot_${fileId}_${step}_${name}.png`
    });
    
    await addLog(fileId, `Screenshot capturado: ${name}`);
  } catch (error) {
    console.error(`Erro ao capturar screenshot ${name}:`, error);
  }
}

async function loginQProf(page: Page, fileId: number): Promise<boolean> {
  try {
    await addLog(fileId, 'Acessando sistema QPROF');
    await page.goto(QPROF_CONFIG.baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await delay(2000);
    
    await takeScreenshot(page, fileId, 0, '01_pagina_login');
    
    // Preencher credenciais
    await addLog(fileId, `Preenchendo credenciais - user: ${QPROF_CONFIG.credentials.username ? 'OK' : 'VAZIO'}`);
    if (!QPROF_CONFIG.credentials.username || !QPROF_CONFIG.credentials.password) {
      await addLog(fileId, 'Erro: Credenciais não configuradas');
      return false;
    }
    await page.type('#txbUser', QPROF_CONFIG.credentials.username);
    await page.type('#txbPassword', QPROF_CONFIG.credentials.password);
    
    await takeScreenshot(page, fileId, 1, '02_credenciais_preenchidas');
    
    // Clicar em Entrar
    await addLog(fileId, 'Clicando em Entrar');
    await page.click('#btnLogin');
    await delay(5000);
    
    await takeScreenshot(page, fileId, 2, '03_apos_clicar_entrar');
    
    // Verificar se precisa confirmar desconexão
    const currentUrl = page.url();
    await addLog(fileId, `URL atual após login: ${currentUrl}`);
    
    if (currentUrl.includes('Login.aspx')) {
      // Ainda está na página de login, pode ter modal de confirmação
      try {
        const confirmButton = await page.$('input[value="Sim"]');
        if (confirmButton) {
          await addLog(fileId, 'Confirmando desconexão de outro local');
          await confirmButton.click();
          await delay(3000);
          await takeScreenshot(page, fileId, 3, '04_apos_confirmar');
        }
      } catch (e) {
        // Sem modal de confirmação
      }
    }
    
    // Verificar se login foi bem-sucedido
    const finalUrl = page.url();
    if (finalUrl.includes('Login.aspx')) {
      await addLog(fileId, 'Erro fatal: Login falhou - ainda na página de login');
      return false;
    }
    
    await addLog(fileId, 'Login realizado com sucesso');
    return true;
  } catch (error: any) {
    await addLog(fileId, `Erro fatal: ${error.message}`);
    return false;
  }
}

async function navigateToCobranca(page: Page, fileId: number): Promise<boolean> {
  try {
    await addLog(fileId, 'Procurando menu COBRANÇA no lateral');
    await delay(2000);
    
    // Clicar no menu COBRANÇA no lateral esquerdo
    const menuClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, div, span'));
      for (const el of elements) {
        const text = String(el.textContent || '').trim();
        if (text === 'COBRANÇA') {
          (el as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
    
    if (!menuClicked) {
      await addLog(fileId, 'Erro: Menu COBRANÇA não encontrado');
      await takeScreenshot(page, fileId, 4, '05_erro_menu');
      return false;
    }
    
    await addLog(fileId, 'Menu COBRANÇA clicado, aguardando submenu');
    await delay(2000);
    
    await takeScreenshot(page, fileId, 5, '06_submenu_cobranca');
    
    // Agora procurar por FCO001 - Cobrança no submenu
    await addLog(fileId, 'Procurando FCO001 - Cobrança no submenu');
    
    const fcoClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, div, span'));
      for (const el of elements) {
        const text = String(el.textContent || '').trim();
        if (text === 'FCO001 - Cobrança') {
          (el as HTMLElement).click();
          return true;
        }
      }
      // Se não encontrar exato, procurar que contenha FCO001
      for (const el of elements) {
        const text = String(el.textContent || '').trim();
        if (text.startsWith('FCO001')) {
          (el as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
    
    if (!fcoClicked) {
      await addLog(fileId, 'Erro: FCO001 não encontrado no submenu');
      await takeScreenshot(page, fileId, 6, '07_erro_fco001');
      return false;
    }
    
    await addLog(fileId, 'FCO001 clicado, aguardando página carregar');
    await delay(3000);
    
    await takeScreenshot(page, fileId, 7, '08_pagina_fco001');
    
    return true;
  } catch (error: any) {
    await addLog(fileId, `Erro ao navegar para cobrança: ${error.message}`);
    return false;
  }
}

async function accessRetBancario(page: Page, fileId: number): Promise<boolean> {
  try {
    await addLog(fileId, 'Procurando aba Ret. Bancário');
    await delay(3000);
    
    // Procurar pela aba "Ret. Bancário" com seletor mais específico
    // A aba está no topo da página, provavelmente um link <a>
    const tabClicked = await page.evaluate(() => {
      // Primeiro tentar encontrar link exato com texto "Ret. Bancário"
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = String(link.textContent || '').trim();
        if (text === 'Ret. Bancário') {
          link.click();
          return { success: true, method: 'exact_match', text };
        }
      }
      
      // Se não encontrar exato, procurar que contenha ambas as palavras
      for (const link of links) {
        const text = String(link.textContent || '').trim();
        if (text.includes('Ret.') && text.includes('Bancário')) {
          link.click();
          return { success: true, method: 'partial_match', text };
        }
      }
      
      return { success: false, method: 'not_found' };
    });
    
    await addLog(fileId, `Resultado da busca: ${JSON.stringify(tabClicked)}`);
    
    if (!tabClicked.success) {
      await addLog(fileId, 'Erro: Aba Ret. Bancário não encontrada');
      
      // Listar todas as abas disponíveis para debug
      const availableTabs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .map(a => a.textContent?.trim())
          .filter(t => t && t.length > 0 && t.length < 50)
          .slice(0, 20);
      });
      await addLog(fileId, `Abas disponíveis: ${availableTabs.join(' | ')}`);
      
      await takeScreenshot(page, fileId, 8, '09_erro_aba');
      return false;
    }
    
    await addLog(fileId, `Aba Ret. Bancário clicada (método: ${tabClicked.method})`);
    
    // Aguardar mais tempo para a página carregar completamente
    await delay(7000);
    
    await takeScreenshot(page, fileId, 9, '10_ret_bancario');
    
    // Verificar se realmente mudou de conteúdo
    const hasRetBancarioContent = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('Arquivo de Retorno') || 
             text.includes('Data Retorno') || 
             text.includes('Número Retorno') ||
             document.querySelector('input[value="Importar"]') !== null;
    });
    
    await addLog(fileId, `Conteúdo de Ret. Bancário detectado: ${hasRetBancarioContent}`);
    
    return true;
  } catch (error: any) {
    await addLog(fileId, `Erro ao acessar Ret. Bancário: ${error.message}`);
    return false;
  }
}

async function importFile(page: Page, fileId: number, filePath: string): Promise<boolean> {
  try {
    await addLog(fileId, 'Procurando botão Selecionar para escolher arquivo');
    
    // Procurar em iframes
    const frames = page.frames();
    await addLog(fileId, `Total de frames: ${frames.length}`);
    
    let selectClicked = false;
    let targetFrame = null;
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      try {
        const clicked = await frame.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
          for (const btn of buttons) {
            const value = (btn as HTMLInputElement).value || '';
            if (value === 'Selecionar') {
              (btn as HTMLElement).click();
              return true;
            }
          }
          return false;
        });
        
        if (clicked) {
          await addLog(fileId, `Botão Selecionar encontrado e clicado no frame ${i}`);
          selectClicked = true;
          targetFrame = frame;
          break;
        }
      } catch (e) {
        // Frame pode não estar acessível
      }
    }
    
    if (!selectClicked) {
      await addLog(fileId, 'Erro: Botão Selecionar não encontrado em nenhum frame');
      await takeScreenshot(page, fileId, 10, '11_erro_selecionar');
      return false;
    }
    
    await addLog(fileId, 'Aguardando modal de upload');
    await delay(3000);
    
    await takeScreenshot(page, fileId, 11, '12_modal_selecionar');
    
    // Procurar input de arquivo no frame
    await addLog(fileId, 'Procurando input de arquivo');
    let fileInput = null;
    
    if (targetFrame) {
      fileInput = await targetFrame.$('input[type="file"]');
    }
    
    // Se não encontrou no frame, procurar na página principal
    if (!fileInput) {
      fileInput = await page.$('input[type="file"]');
    }
    
    if (!fileInput) {
      await addLog(fileId, 'Erro: Input de arquivo não encontrado');
      await takeScreenshot(page, fileId, 12, '13_erro_input');
      return false;
    }
    
    await addLog(fileId, `Fazendo upload do arquivo: ${filePath}`);
    await fileInput.uploadFile(filePath);
    await delay(2000);
    
    await takeScreenshot(page, fileId, 13, '14_arquivo_selecionado');
    
    // Fechar modal clicando em OK/Confirmar se existir
    await addLog(fileId, 'Procurando botão de confirmação do modal');
    
    if (targetFrame) {
      const confirmClicked = await targetFrame.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
        for (const btn of buttons) {
          const text = String(btn.textContent || '').trim();
          const value = (btn as HTMLInputElement).value || '';
          if (text === 'OK' || value === 'OK' || text === 'Confirmar' || value === 'Confirmar') {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });
      
      if (confirmClicked) {
        await addLog(fileId, 'Botão de confirmação do modal clicado');
        await delay(2000);
      }
    }
    
    await takeScreenshot(page, fileId, 14, '15_modal_fechado');
    
    // Agora clicar no botão "Importar" para processar o arquivo
    await addLog(fileId, 'Procurando botão Importar para processar arquivo');
    
    let importClicked = false;
    
    // Procurar em todos os frames novamente
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      try {
        const clicked = await frame.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button'));
          for (const btn of buttons) {
            const value = (btn as HTMLInputElement).value || '';
            if (value === 'Importar') {
              (btn as HTMLElement).click();
              return true;
            }
          }
          return false;
        });
        
        if (clicked) {
          await addLog(fileId, `Botão Importar encontrado e clicado no frame ${i}`);
          importClicked = true;
          break;
        }
      } catch (e) {
        // Frame pode não estar acessível
      }
    }
    
    if (!importClicked) {
      await addLog(fileId, 'Erro: Botão Importar não encontrado');
      await takeScreenshot(page, fileId, 15, '16_erro_importar');
      return false;
    }
    
    await addLog(fileId, 'Botão Importar clicado, aguardando processamento');
    await delay(5000);
    await takeScreenshot(page, fileId, 16, '17_apos_importar');
    
    return true;
  } catch (error: any) {
    await addLog(fileId, `Erro ao importar arquivo: ${error.message}`);
    return false;
  }
}

async function verifyImport(page: Page, fileId: number, filename: string): Promise<string | null> {
  try {
    await addLog(fileId, 'Recarregando página para verificar importação');
    await page.reload({ waitUntil: 'networkidle2' });
    await delay(3000);
    
    await takeScreenshot(page, fileId, 17, '18_verificacao');
    
    // Procurar pelo arquivo na tabela
    const qprofNumber = await page.evaluate((fname) => {
      const rows = Array.from(document.querySelectorAll('tr'));
      for (const row of rows) {
        const text = String(row.textContent || '');
        if (text.includes(fname)) {
          // Procurar pelo número QPROF na linha
          const cells = row.querySelectorAll('td');
          if (cells.length > 1) {
            return cells[1].textContent?.trim() || null;
          }
        }
      }
      return null;
    }, filename);
    
    if (qprofNumber) {
      await addLog(fileId, `Arquivo importado com sucesso! Número QPROF: ${qprofNumber}`);
      return qprofNumber;
    } else {
      await addLog(fileId, 'Aviso: Arquivo não encontrado na listagem após importação');
      return null;
    }
  } catch (error: any) {
    await addLog(fileId, `Erro ao verificar importação: ${error.message}`);
    return null;
  }
}

export async function processQProfFile(fileId: string, filename: string, filePath: string) {
  let browser: Browser | null = null;
  const numericId = parseInt(fileId);
  
  if (isNaN(numericId)) {
    await addLog(parseInt(fileId) || 0, `Erro fatal: Invalid fileId: ${fileId}`);
    return { success: false, error: 'Invalid fileId' };
  }
  
  try {
    await addLog(numericId, 'Iniciando importação do arquivo');
    await updateCnabFileStatus(numericId, 'processing');
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 1. Login
    const loginSuccess = await loginQProf(page, numericId);
    if (!loginSuccess) {
      await updateCnabFileStatus(numericId, 'error');
      return { success: false, error: 'Login falhou' };
    }
    
    // 2. Navegar para Cobrança via busca FCO001
    const navSuccess = await navigateToCobranca(page, numericId);
    if (!navSuccess) {
      await updateCnabFileStatus(numericId, 'error');
      return { success: false, error: 'Navegação para Cobrança falhou' };
    }
    
    // 3. Acessar aba Ret. Bancário
    const retSuccess = await accessRetBancario(page, numericId);
    if (!retSuccess) {
      await updateCnabFileStatus(numericId, 'error');
      return { success: false, error: 'Acesso a Ret. Bancário falhou' };
    }
    
    // 4. Importar arquivo
    const importSuccess = await importFile(page, numericId, filePath);
    if (!importSuccess) {
      await updateCnabFileStatus(numericId, 'error');
      return { success: false, error: 'Importação falhou' };
    }
    
    // 5. Verificar importação
    const qprofNumber = await verifyImport(page, numericId, filename);
    
    await updateCnabFileStatus(numericId, 'completed', qprofNumber || undefined);
    await addLog(numericId, 'Processamento concluído com sucesso');
    
    return { success: true, qprofNumber };
  } catch (error: any) {
    await addLog(numericId, `Erro fatal: ${error.message}`);
    await updateCnabFileStatus(numericId, 'error');
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
