import puppeteer, { Browser, Page } from 'puppeteer';
import { addLog, updateCnabFileStatus, addScreenshot } from './db';
import { QPROF_CONFIG } from './qprof-config';
import path from 'path';
import fs from 'fs';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Armazenar o último screenshot para visualização em tempo real
let liveScreenshotPath: string | null = null;
let screenshotIntervalId: NodeJS.Timeout | null = null;

export function getLiveScreenshotPath(): string | null {
  return liveScreenshotPath;
}

async function startLiveScreenshotCapture(page: Page, fileId: number, intervalMs: number = 3000) {
  const screenshotDir = path.join(process.cwd(), 'public', 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  
  const liveFilename = `live_${fileId}.png`;
  const liveFilepath = path.join(screenshotDir, liveFilename);
  liveScreenshotPath = `/screenshots/${liveFilename}`;
  
  // Capturar screenshot inicial
  try {
    await page.screenshot({ path: liveFilepath, fullPage: false });
  } catch (error) {
    console.error('Erro ao capturar screenshot inicial:', error);
  }
  
  // Iniciar captura em intervalo
  screenshotIntervalId = setInterval(async () => {
    try {
      await page.screenshot({ path: liveFilepath, fullPage: false });
    } catch (error) {
      // Ignorar erros (pode acontecer se a página estiver navegando)
    }
  }, intervalMs);
  
  await addLog(fileId, `Captura de screenshots em tempo real iniciada (intervalo: ${intervalMs}ms)`);
}

function stopLiveScreenshotCapture(fileId: number) {
  if (screenshotIntervalId) {
    clearInterval(screenshotIntervalId);
    screenshotIntervalId = null;
    liveScreenshotPath = null;
    addLog(fileId, 'Captura de screenshots em tempo real finalizada');
  }
}

async function takeScreenshot(page: Page, fileId: number, step: number, name: string) {
  try {
    const screenshotDir = path.join(process.cwd(), 'public', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    const filename = `screenshot_${fileId}_${step}_${name}.png`;
    const filepath = path.join(screenshotDir, filename);
    
    await page.screenshot({ path: filepath, fullPage: true });
    
    // Salvar screenshot no banco de dados
    const relativePath = `/screenshots/${filename}`;
    await addScreenshot({
      fileId,
      step,
      name,
      path: relativePath
    });
    
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
    console.log(`[QPROF AUTOMATION] Verificando QPROF_CONFIG.baseUrl: ${QPROF_CONFIG.baseUrl}`);
    await addLog(fileId, `Tentando navegar para: ${QPROF_CONFIG.baseUrl}`);
    try {
      await page.goto(QPROF_CONFIG.baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await addLog(fileId, `Navegação bem-sucedida para: ${page.url()}`);
    } catch (navError: any) {
      await addLog(fileId, `Erro durante a navegação para ${QPROF_CONFIG.baseUrl}: ${navError.message}`);
      await takeScreenshot(page, fileId, 0, '00_erro_navegacao');
      return false;
    }
    await delay(2000);
    
    // Tirar screenshot da página de login antes de preencher as credenciais
    await takeScreenshot(page, fileId, 0, '01_pagina_login_antes_preencher');

    // Verificar se os campos de usuário e senha estão presentes
    const usernameField = await page.$('input[placeholder="Usuário"]');
    const passwordField = await page.$('input[placeholder="Senha"]');

    if (!usernameField) {
      await addLog(fileId, 'Erro: Campo de usuário não encontrado na página de login do QPROF.');
      await takeScreenshot(page, fileId, 1, '02_erro_campo_usuario_nao_encontrado');
      return false;
    }
    if (!passwordField) {
      await addLog(fileId, 'Erro: Campo de senha não encontrado na página de login do QPROF.');
      await takeScreenshot(page, fileId, 1, '02_erro_campo_senha_nao_encontrado');
      return false;
    }
    await addLog(fileId, 'Campos de usuário e senha encontrados.');

    // Preencher credenciais
    await addLog(fileId, `Preenchendo usuário: ${QPROF_CONFIG.credentials.username}`);
    await page.type("input[placeholder=\"Usuário\"]", QPROF_CONFIG.credentials.username);
    await addLog(fileId, `Preenchendo senha.`);
    await page.type("input[placeholder=\"Senha\"]", QPROF_CONFIG.credentials.password); 
    await takeScreenshot(page, fileId, 1, '02_credenciais_preenchidas');
    
    // Verificar se o botão de login está presente
    const loginButton = await page.$('input[type="button"][value="Entrar"], input[type="submit"][value="Entrar"]');
    if (!loginButton) {
      await addLog(fileId, 'Erro: Botão de login "Entrar" não encontrado na página de login do QPROF.');
      await takeScreenshot(page, fileId, 2, '03_erro_botao_login_nao_encontrado');
      return false;
    }
    await addLog(fileId, 'Botão de login "Entrar" encontrado.');

    // Clicar em Entrar
    await addLog(fileId, 'Clicando em Entrar');
    await loginButton.click();
    await delay(3000);
    await addLog(fileId, `URL após clicar em Entrar: ${page.url()}`);
    await takeScreenshot(page, fileId, 2, '03_apos_clicar_entrar');
    
    // Adicionar um log para verificar se a página ainda é a de login após o clique
    const currentUrlAfterClick = page.url();
    if (currentUrlAfterClick.includes('Login.aspx')) {
      await addLog(fileId, 'Ainda na página de login após o clique. Login pode ter falhado ou requer confirmação.');
    } else {
      await addLog(fileId, 'Redirecionado para fora da página de login após o clique.');
    }
    
    // Verificar se precisa confirmar desconexão
    if (currentUrlAfterClick.includes('Login.aspx')) { // Apenas se ainda estiver na página de login
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
    await addLog(fileId, `Erro no login QPROF: ${error.message}. Stack: ${error.stack}, FileID: ${fileId}`);
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
    await addLog(fileId, `Erro na navegação: ${error.message}. Stack: ${error.stack}, FileID: ${fileId}`);
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
    
    if (!contentLoaded) {
      await addLog(fileId, 'Aviso: Conteúdo de Ret. Bancário pode não ter carregado completamente');
    }
    
    return true;
  } catch (error: any) {
    await addLog(fileId, `Erro ao acessar Ret. Bancário: ${error.message}. Stack: ${error.stack}, FileID: ${fileId}`);
    return false;
  }
}

async function selectFirstAvailableDate(page: Page, fileId: number): Promise<boolean> {
  try {
    await addLog(fileId, 'Procurando por tela de seleção de data');
    
    // Procurar em todos os frames
    const frames = page.frames();
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      try {
        // Verificar se existe um campo de data ou lista de datas
        const dateFound = await frame.evaluate(() => {
          // Procurar por inputs de data, selects com datas, ou links/botões com datas
          const dateInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="date"], select, a, button'));
          
          for (const element of dateInputs) {
            const text = (element.textContent || '').trim();
            const value = (element as HTMLInputElement).value || '';
            const placeholder = (element as HTMLInputElement).placeholder || '';
            
            // Verificar se é um campo/elemento relacionado a data
            const isDateRelated = 
              text.match(/\d{2}\/\d{2}\/\d{4}/) || 
              value.match(/\d{2}\/\d{2}\/\d{4}/) ||
              placeholder.toLowerCase().includes('data') ||
              text.toLowerCase().includes('data');
            
            if (isDateRelated) {
              return true;
            }
          }
          return false;
        });
        
        if (dateFound) {
          await addLog(fileId, `Tela de seleção de data encontrada no frame ${i}`);
          
          // Tentar selecionar a primeira data disponível
          const dateSelected = await frame.evaluate(() => {
            // Procurar por select com opções de data
            const selects = Array.from(document.querySelectorAll('select'));
            for (const select of selects) {
              const options = Array.from(select.options);
              // Verificar se tem opções com formato de data
              const hasDateOptions = options.some(opt => 
                opt.text.match(/\d{2}\/\d{2}\/\d{4}/) || opt.value.match(/\d{2}\/\d{2}\/\d{4}/)
              );
              
              if (hasDateOptions && options.length > 1) {
                // Selecionar a primeira opção (ignorando a opção vazia se houver)
                const firstValidOption = options.find(opt => opt.value && opt.value !== '');
                if (firstValidOption) {
                  (select as HTMLSelectElement).value = firstValidOption.value;
                  select.dispatchEvent(new Event('change', { bubbles: true }));
                  return { type: 'select', value: firstValidOption.text };
                }
              }
            }
            
            // Se não encontrou select, procurar por links/botões com datas
            const dateElements = Array.from(document.querySelectorAll('a, button'));
            for (const element of dateElements) {
              const text = (element.textContent || '').trim();
              if (text.match(/\d{2}\/\d{2}\/\d{4}/)) {
                (element as HTMLElement).click();
                return { type: 'click', value: text };
              }
            }
            
            return null;
          });
          
          if (dateSelected) {
            await addLog(fileId, `Data selecionada: ${dateSelected.value} (tipo: ${dateSelected.type})`);
            await delay(2000);
            
            // Procurar e clicar no botão de confirmação (OK, Confirmar, Concluir, etc.)
            const confirmClicked = await frame.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('input[type="button"], input[type="submit"], button, a'));
              for (const btn of buttons) {
                const value = (btn as HTMLInputElement).value || '';
                const text = (btn.textContent || '').trim().toLowerCase();
                
                if (
                  value.toLowerCase() === 'ok' || 
                  value.toLowerCase() === 'confirmar' ||
                  value.toLowerCase() === 'concluir' ||
                  text === 'ok' || 
                  text === 'confirmar' ||
                  text === 'concluir'
                ) {
                  (btn as HTMLElement).click();
                  return true;
                }
              }
              return false;
            });
            
            if (confirmClicked) {
              await addLog(fileId, 'Botão de confirmação clicado');
            } else {
              await addLog(fileId, 'Botão de confirmação não encontrado');
            }
            
            return true;
          }
        }
      } catch (e) {
        // Frame pode não estar acessível
      }
    }
    
    return false;
  } catch (error: any) {
    await addLog(fileId, `Erro ao selecionar data: ${error.message}`);
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
      
      // Após clicar em Importar, pode aparecer uma tela de seleção de data
      await addLog(fileId, 'Verificando se apareceu tela de seleção de data');
      await delay(2000);
      
      const dateSelected = await selectFirstAvailableDate(page, fileId);
      if (dateSelected) {
        await addLog(fileId, 'Data selecionada com sucesso');
        await delay(3000);
        await takeScreenshot(page, fileId, 17, '18_data_selecionada');
      } else {
        await addLog(fileId, 'Nenhuma tela de seleção de data encontrada ou não foi necessário selecionar');
      }
    }
    
    return true;
  } catch (error: any) {
    await addLog(fileId, `Erro ao importar arquivo: ${error.message}. Stack: ${error.stack}, FileID: ${fileId}`);
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
    await addLog(fileId, `Erro ao verificar importação: ${error.message}. Stack: ${error.stack}, FileID: ${fileId}`);
    return null;
  }
}

export async function processQProfFile(fileId: number, filePath: string, company: string = 'FLOWINVEST'): Promise<{ success: boolean; error?: string; qprofNumber?: string }> {
  console.log(`[QPROF AUTOMATION] Iniciando processQProfFile para fileId: ${fileId}`);
  console.log(`[QPROF AUTOMATION] QPROF_CONFIG.baseUrl no início de processQProfFile: ${QPROF_CONFIG.baseUrl}`);
  console.log(`[QPROF AUTOMATION] process.env.QPROF_COMPANY: ${process.env.QPROF_COMPANY}`);
  console.log(`[QPROF AUTOMATION] Company no início de processQProfFile: ${company}`);

  let browser: Browser | null = null;
  const numericId = parseInt(fileId.toString()); // Ensure fileId is a number
  
  if (isNaN(numericId)) {
    await addLog(parseInt(fileId.toString()) || 0, `Erro fatal: Invalid fileId: ${fileId}`);
    return { success: false, error: 'Invalid fileId' };
  }
  
  try {
    await addLog(numericId, `Iniciando importação do arquivo. FilePath: ${filePath}, Company: ${company}, FileID: ${fileId}`);
    console.log(`[QPROF AUTOMATION] Tentando processar arquivo: ${filePath}`);
    await updateCnabFileStatus(numericId, 'processing');
    console.log(`[QPROF AUTOMATION] Status do arquivo ${numericId} atualizado para 'processing'.`);
    
    console.log(`[QPROF AUTOMATION] Puppeteer launch options: headless=${true}, devtools=${false}`);
    browser = await puppeteer.launch({
      headless: true,
      devtools: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--no-zygote', '--disable-gpu']
    });
    const page = await browser.newPage();
    
    // Configurar o tamanho da viewport para garantir que todos os elementos estejam visíveis
    await page.setViewport({ width: 1366, height: 768 });
    
    // Iniciar captura de screenshots em tempo real (a cada 3 segundos)
    await startLiveScreenshotCapture(page, numericId, 3000);

    // 1. Login no QPROF
    const loggedIn = await loginQProf(page, numericId);
    if (!loggedIn) {
      await addLog(numericId, 'Falha no login do QPROF.');
      return { success: false, error: 'Login falhou' };
    }
    
    // 2. Trocar de empresa (se necessário)
    if (company && company.trim() !== '') {
      const companyChanged = await changeCompany(page, numericId, company);
      if (!companyChanged) {
        await addLog(numericId, 'Falha ao trocar de empresa.');
        return { success: false, error: 'Falha ao trocar de empresa' };
      }
    } else {
      await addLog(numericId, 'Nenhuma empresa especificada, usando empresa padrão do login.');
    }

    // 3. Navegar para o menu Cobrança -> FCO001
    const navigatedToCobranca = await navigateToCobranca(page, numericId);
    if (!navigatedToCobranca) {
      await addLog(numericId, 'Falha ao navegar para o menu Cobrança.');
      return { success: false, error: 'Falha ao navegar para Cobrança' };
    }

    // 4. Acessar aba Ret. Bancário
    const accessedRetBancario = await accessRetBancario(page, numericId);
    if (!accessedRetBancario) {
      await addLog(numericId, 'Falha ao acessar aba Ret. Bancário.');
      return { success: false, error: 'Falha ao acessar Ret. Bancário' };
    }

    // 5. Importar arquivo
    const importedFile = await importFile(page, numericId, filePath);
    if (!importedFile) {
      await addLog(numericId, 'Falha ao importar arquivo.');
      return { success: false, error: 'Falha ao importar arquivo' };
    }

    // 6. Verificar importação
    const qprofNumber = await verifyImport(page, numericId, path.basename(filePath));
    if (!qprofNumber) {
      await addLog(numericId, 'Falha ao verificar importação.');
      return { success: false, error: 'Falha ao verificar importação' };
    }

    await addLog(numericId, 'Arquivo processado com sucesso no QPROF.');
    return { success: true, qprofNumber };

  } catch (error: any) {
    await addLog(numericId, `Erro ao processar arquivo: ${error.message}. Stack: ${error.stack}, FileID: ${numericId}`);
    console.error(`[QPROF AUTOMATION] Erro detectado: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    // Parar captura de screenshots em tempo real
    stopLiveScreenshotCapture(numericId);
    
    if (browser) {
      await browser.close();
    }
  }
}

