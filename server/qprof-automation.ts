import puppeteer, { Browser, Page } from 'puppeteer';
import { addLog, updateCnabFileStatus } from './db';
import { QPROF_CONFIG } from './qprof-config';
import path from 'path';
import fs from 'fs';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function takeScreenshot(page: Page, fileId: number, step: number, name: string) {
  try {
    const screenshotDir = path.join(process.cwd(), 'public', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    const filename = `screenshot_${fileId}_${step}_${name}.png`;
    const filepath = path.join(screenshotDir, filename);
    
    await page.screenshot({ path: filepath, fullPage: true });
    await addLog(fileId, `Screenshot capturado: ${name}`);
  } catch (error: any) {
    await addLog(fileId, `Erro ao capturar screenshot: ${error.message}`);
  }
}

async function changeCompany(page: Page, fileId: number, companyName: string): Promise<boolean> {
  try {
    await addLog(fileId, `Trocando para empresa: ${companyName}`);
    
    // Clicar no menu de empresas no canto superior direito
    await addLog(fileId, 'Procurando menu de empresas');
    
    const companyMenuClicked = await page.evaluate(() => {
      // Procurar por link ou elemento que contenha o nome da empresa atual
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = link.textContent || '';
        // Menu de empresa geralmente tem formato "EMPRESA - NOME COMPLETO"
        if (text.includes('FIDC') || text.includes('FLOWINVEST') || text.includes('BRASCOB')) {
          link.click();
          return true;
        }
      }
      return false;
    });
    
    if (!companyMenuClicked) {
      await addLog(fileId, 'Erro: Menu de empresas não encontrado');
      await takeScreenshot(page, fileId, 4, '05_erro_menu_empresa');
      return false;
    }
    
    await addLog(fileId, 'Menu de empresas clicado, aguardando lista');
    await delay(2000);
    await takeScreenshot(page, fileId, 5, '06_lista_empresas');
    
    // Procurar e clicar na empresa desejada
    await addLog(fileId, `Procurando empresa: ${companyName}`);
    
    const companyClicked = await page.evaluate((targetCompany) => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = (link.textContent || '').trim();
        // Procurar pela empresa exata (case insensitive)
        if (text.toUpperCase().includes(targetCompany.toUpperCase())) {
          // Verificar se não está em negrito (empresa atual)
          const style = window.getComputedStyle(link);
          if (style.fontWeight !== 'bold' && style.fontWeight !== '700') {
            link.click();
            return true;
          }
        }
      }
      return false;
    }, companyName);
    
    if (!companyClicked) {
      await addLog(fileId, `Aviso: Empresa "${companyName}" não encontrada ou já está selecionada`);
      await takeScreenshot(page, fileId, 6, '07_empresa_nao_encontrada');
      return true; // Retornar true pois pode já estar na empresa correta
    }
    
    await addLog(fileId, `Empresa "${companyName}" selecionada, aguardando carregamento`);
    await delay(5000);
    await takeScreenshot(page, fileId, 7, '08_empresa_trocada');
    
    return true;
  } catch (error: any) {
    await addLog(fileId, `Erro ao trocar empresa: ${error.message}`);
    return false;
  }
}

async function loginQProf(page: Page, fileId: number): Promise<boolean> {
  try {
    await addLog(fileId, 'Acessando sistema QPROF');
    await page.goto(QPROF_CONFIG.baseUrl, { waitUntil: 'networkidle2' });
    await delay(2000);
    
    await takeScreenshot(page, fileId, 0, '01_pagina_login');
    
    // Preencher credenciais
    await addLog(fileId, 'Preenchendo credenciais - user: OK');
    await page.type('input[placeholder="Usuário"]', QPROF_CONFIG.username);
    await page.type('input[placeholder="Senha"]', QPROF_CONFIG.password);
    
    await takeScreenshot(page, fileId, 1, '02_credenciais_preenchidas');
    
    // Clicar em Entrar
    await addLog(fileId, 'Clicando em Entrar');
    await page.click('input[type="button"][value="Entrar"], input[type="submit"][value="Entrar"]');
    await delay(3000);
    
    await takeScreenshot(page, fileId, 2, '03_apos_clicar_entrar');
    
    // Verificar se precisa confirmar desconexão
    const currentUrl = page.url();
    await addLog(fileId, `URL atual após login: ${currentUrl}`);
    
    if (currentUrl.includes('Login.aspx')) {
      await addLog(fileId, 'Confirmando desconexão de outro local');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"]'));
        for (const btn of buttons) {
          const value = (btn as HTMLInputElement).value || '';
          if (value === 'Sim') {
            (btn as HTMLElement).click();
            break;
          }
        }
      });
      await delay(3000);
    }
    
    await takeScreenshot(page, fileId, 3, '04_apos_confirmar');
    await addLog(fileId, 'Login realizado com sucesso');
    
    return true;
  } catch (error: any) {
    await addLog(fileId, `Erro no login: ${error.message}`);
    return false;
  }
}

async function navigateToCobranca(page: Page, fileId: number): Promise<boolean> {
  try {
    await addLog(fileId, 'Procurando menu COBRANÇA no lateral');
    
    // Clicar no menu COBRANÇA
    const cobrancaClicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (link.textContent?.trim() === 'COBRANÇA') {
          link.click();
          return true;
        }
      }
      return false;
    });
    
    if (!cobrancaClicked) {
      await addLog(fileId, 'Erro: Menu COBRANÇA não encontrado');
      return false;
    }
    
    await addLog(fileId, 'Menu COBRANÇA clicado, aguardando submenu');
    await delay(2000);
    
    // Procurar FCO001 - Cobrança no submenu
    await addLog(fileId, 'Procurando FCO001 - Cobrança no submenu');
    
    const fco001Clicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = link.textContent?.trim() || '';
        if (text.includes('FCO001') && text.includes('Cobrança')) {
          link.click();
          return true;
        }
      }
      return false;
    });
    
    if (!fco001Clicked) {
      await addLog(fileId, 'Erro: FCO001 - Cobrança não encontrado no submenu');
      await takeScreenshot(page, fileId, 5, '06_erro_fco001');
      return false;
    }
    
    await addLog(fileId, 'FCO001 clicado, aguardando página carregar');
    await delay(5000);
    
    await takeScreenshot(page, fileId, 5, '06_submenu_cobranca');
    await takeScreenshot(page, fileId, 7, '08_pagina_fco001');
    
    return true;
  } catch (error: any) {
    await addLog(fileId, `Erro na navegação: ${error.message}`);
    return false;
  }
}

async function accessRetBancario(page: Page, fileId: number): Promise<boolean> {
  try {
    await addLog(fileId, 'Procurando aba Ret. Bancário');
    
    // Procurar pela aba "Ret. Bancário"
    const tabResult = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = (link.textContent || '').trim();
        if (text === 'Ret. Bancário') {
          return { success: true, method: 'exact_match', text };
        }
      }
      return { success: false, method: 'not_found', text: '' };
    });
    
    await addLog(fileId, `Resultado da busca: ${JSON.stringify(tabResult)}`);
    
    if (!tabResult.success) {
      await addLog(fileId, 'Erro: Aba Ret. Bancário não encontrada');
      await takeScreenshot(page, fileId, 8, '09_erro_aba');
      return false;
    }
    
    // Clicar na aba
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = (link.textContent || '').trim();
        if (text === 'Ret. Bancário') {
          (link as HTMLElement).click();
          break;
        }
      }
    });
    
    await addLog(fileId, `Aba Ret. Bancário clicada (método: ${tabResult.method})`);
    await delay(3000);
    
    await takeScreenshot(page, fileId, 9, '10_ret_bancario');
    
    // Verificar se o conteúdo carregou
    const contentLoaded = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('Arquivo de Retorno') || text.includes('Banco') || text.includes('Selecionar');
    });
    
    await addLog(fileId, `Conteúdo de Ret. Bancário detectado: ${contentLoaded}`);
    
    if (!contentLoaded) {
      await addLog(fileId, 'Aviso: Conteúdo de Ret. Bancário pode não ter carregado completamente');
    }
    
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
    
    // Aguardar um pouco para garantir que o arquivo foi carregado
    await delay(2000);
    
    // Agora clicar no botão verde "Importar" no topo para processar o arquivo
    await addLog(fileId, 'Procurando botão verde Importar no topo da página');
    
    let importClicked = false;
    
    // Procurar em todos os frames
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      try {
        const clicked = await frame.evaluate(() => {
          // Procurar especificamente pelo botão verde Importar no topo
          const buttons = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button, a'));
          for (const btn of buttons) {
            const value = (btn as HTMLInputElement).value || '';
            const text = (btn.textContent || '').trim();
            
            // Botão Importar no topo (geralmente tem cor verde)
            if (value === 'Importar' || text === 'Importar') {
              // Verificar se é visível e não está dentro de modal
              const rect = btn.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                (btn as HTMLElement).click();
                return true;
              }
            }
          }
          return false;
        });
        
        if (clicked) {
          await addLog(fileId, `Botão Importar (verde) encontrado e clicado no frame ${i}`);
          importClicked = true;
          break;
        }
      } catch (e) {
        // Frame pode não estar acessível
      }
    }
    
    if (!importClicked) {
      await addLog(fileId, 'Aviso: Botão Importar verde não encontrado, arquivo pode já estar processado');
      await takeScreenshot(page, fileId, 15, '16_sem_botao_importar');
    } else {
      await addLog(fileId, 'Botão Importar clicado, aguardando processamento...');
      await delay(8000); // Aguardar mais tempo para processamento
      await takeScreenshot(page, fileId, 16, '17_apos_importar');
    }
    
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

export async function processQProfFile(fileId: string, filename: string, filePath: string, company?: string) {
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
    
    // 2. Trocar empresa (se especificado)
    if (company) {
      const companySuccess = await changeCompany(page, numericId, company);
      if (!companySuccess) {
        await updateCnabFileStatus(numericId, 'error');
        return { success: false, error: 'Troca de empresa falhou' };
      }
    }
    
    // 3. Navegar para Cobrança via busca FCO001
    const navSuccess = await navigateToCobranca(page, numericId);
    if (!navSuccess) {
      await updateCnabFileStatus(numericId, 'error');
      return { success: false, error: 'Navegação para Cobrança falhou' };
    }
    
    // 4. Acessar aba Ret. Bancário
    const retSuccess = await accessRetBancario(page, numericId);
    if (!retSuccess) {
      await updateCnabFileStatus(numericId, 'error');
      return { success: false, error: 'Acesso a Ret. Bancário falhou' };
    }
    
    // 5. Importar arquivo
    const importSuccess = await importFile(page, numericId, filePath);
    if (!importSuccess) {
      await updateCnabFileStatus(numericId, 'error');
      return { success: false, error: 'Importação falhou' };
    }
    
    // 6. Verificar importação
    const qprofNumber = await verifyImport(page, numericId, filename);
    
    await addLog(numericId, 'Processamento concluído com sucesso');
    await updateCnabFileStatus(numericId, 'completed');
    
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

