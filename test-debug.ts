import puppeteer from 'puppeteer';
import { QPROF_CONFIG } from './server/qprof-config';

async function debugAutomation() {
  console.log('🔍 Iniciando debug da automação...\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // 1. Login
    console.log('1️⃣ Acessando QPROF...');
    await page.goto(QPROF_CONFIG.baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.screenshot({ path: '/home/ubuntu/debug-1-login.png', fullPage: true });
    
    await page.type('input[type="text"]', QPROF_CONFIG.credentials.username);
    await page.type('input[type="password"]', QPROF_CONFIG.credentials.password);
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const enterButton = buttons.find(btn => btn.textContent?.includes('Entrar'));
      if (enterButton) enterButton.click();
    });
    
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verificar confirmação
    const hasConfirmation = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(btn => btn.textContent?.includes('Sim'));
    });
    
    if (hasConfirmation) {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const yesButton = buttons.find(btn => btn.textContent?.includes('Sim'));
        if (yesButton) yesButton.click();
      });
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    await page.screenshot({ path: '/home/ubuntu/debug-2-logged-in.png', fullPage: true });
    console.log('✅ Login realizado');

    // 2. Navegar para billing
    console.log('2️⃣ Navegando para billing...');
    await page.goto(QPROF_CONFIG.billingUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: '/home/ubuntu/debug-3-billing.png', fullPage: true });
    console.log('✅ Página de billing carregada');

    // 3. Clicar em Ret. Bancário
    console.log('3️⃣ Clicando em Ret. Bancário...');
    const tabs = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(l => ({ text: l.textContent?.trim(), href: l.getAttribute('href') }));
    });
    console.log('Abas encontradas:', tabs);
    
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const retBancarioLink = links.find(link => 
        link.textContent?.includes('Ret. Bancário') || 
        link.textContent?.includes('Ret. Banc') ||
        link.textContent?.includes('Retorno')
      );
      if (retBancarioLink) retBancarioLink.click();
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: '/home/ubuntu/debug-4-ret-bancario.png', fullPage: true });
    console.log('✅ Aba Ret. Bancário clicada');

    // 4. Procurar elementos
    console.log('4️⃣ Procurando elementos...');
    const elements = await page.evaluate(() => {
      const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
      const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
      
      return {
        fileInputs: fileInputs.length,
        buttons: buttons.map(b => ({
          type: b.tagName,
          value: b.getAttribute('value'),
          text: b.textContent?.trim()
        }))
      };
    });
    
    console.log('Elementos encontrados:', JSON.stringify(elements, null, 2));
    
    // 5. Tentar clicar em Importar
    console.log('5️⃣ Tentando clicar em Importar...');
    const clicked = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"]'));
      const buttons = Array.from(document.querySelectorAll('button'));
      const allElements = [...inputs, ...buttons];
      const importBtn = allElements.find(el => 
        el.getAttribute('value')?.includes('Importar') || 
        el.textContent?.includes('Importar')
      );
      if (importBtn && importBtn instanceof HTMLElement) {
        importBtn.click();
        return true;
      }
      return false;
    });
    
    console.log('Botão Importar clicado:', clicked);
    
    if (clicked) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await page.screenshot({ path: '/home/ubuntu/debug-5-after-import-click.png', fullPage: true });
      
      const elementsAfter = await page.evaluate(() => {
        const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
        return { fileInputs: fileInputs.length };
      });
      console.log('Elementos após clicar:', elementsAfter);
    }

    console.log('\n✅ Debug concluído! Verifique os screenshots em /home/ubuntu/debug-*.png');
    
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    await page.screenshot({ path: '/home/ubuntu/debug-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

debugAutomation();

