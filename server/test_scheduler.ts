import { listRetFiles, calculateNextRun } from './automation-scheduler';
import * as fs from 'fs';
import * as path from 'path';

// Mock do logger para capturar saídas
const mockLogs: string[] = [];
const logger = {
  info: (message: string) => mockLogs.push(`INFO: ${message}`),
  warn: (message: string) => mockLogs.push(`WARN: ${message}`),
  error: (error: any, message: string) => mockLogs.push(`ERROR: ${message} - ${error.message}`),
  fatal: (error: any, message: string) => mockLogs.push(`FATAL: ${message} - ${error.message}`),
};

// Sobrescrever o logger globalmente para o teste
// @ts-ignore
global.logger = logger;

async function runTest() {
  console.log('Iniciando teste de verificação de pasta e agendamento...');

  // --- Teste da função listRetFiles (Criação e Permissões de Pasta) ---
  const testFolderPath = '/tmp/test_ret_files_flowviz';
  mockLogs.length = 0; // Limpa logs anteriores

  console.log(`Testando listRetFiles para pasta inexistente: ${testFolderPath}`);
  const files1 = listRetFiles(testFolderPath);
  console.log('Arquivos encontrados (esperado vazio):', files1);
  console.log('Logs para listRetFiles (criação de pasta):', mockLogs);

  // Verificar se a pasta foi criada
  if (fs.existsSync(testFolderPath)) {
    console.log(`✅ Pasta ${testFolderPath} foi criada.`);
    // Tentar criar um arquivo para verificar permissões de escrita
    try {
      fs.writeFileSync(path.join(testFolderPath, 'test.txt'), 'conteúdo');
      console.log(`✅ Permissões de escrita OK na pasta ${testFolderPath}.`);
    } catch (err: any) {
      console.error(`❌ Erro de escrita na pasta ${testFolderPath}: ${err.message}`);
    }
    // Limpar o arquivo de teste
    fs.unlinkSync(path.join(testFolderPath, 'test.txt'));
  } else {
    console.error(`❌ Pasta ${testFolderPath} NÃO foi criada.`);
  }

  // Adicionar arquivos .RET para testar a listagem
  if (!fs.existsSync(testFolderPath)) {
    fs.mkdirSync(testFolderPath, { recursive: true });
  }
  fs.writeFileSync(path.join(testFolderPath, 'ARQUIVO1.RET'), 'conteúdo ret 1');
  fs.writeFileSync(path.join(testFolderPath, 'arquivo2.ret'), 'conteúdo ret 2');
  fs.writeFileSync(path.join(testFolderPath, 'nao_ret.txt'), 'conteúdo nao ret');

  mockLogs.length = 0; // Limpa logs anteriores
  console.log(`Testando listRetFiles para pasta existente com arquivos .RET: ${testFolderPath}`);
  const files2 = listRetFiles(testFolderPath);
  console.log('Arquivos encontrados (esperado 2 .RET):', files2);
  if (files2.length === 2 && files2.some(f => f.includes('ARQUIVO1.RET')) && files2.some(f => f.includes('arquivo2.ret'))) {
    console.log('✅ listRetFiles listou corretamente os arquivos .RET.');
  } else {
    console.error('❌ listRetFiles não listou corretamente os arquivos .RET.');
  }
  console.log('Logs para listRetFiles (listagem):', mockLogs);

  // Limpar pasta de teste
  fs.rmdirSync(testFolderPath, { recursive: true });
  console.log(`Pasta ${testFolderPath} removida.`);

  // --- Teste da função calculateNextRun (Agendamento Diário) ---
  console.log('\nTestando calculateNextRun para agendamento diário...');

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Caso 1: Horário no futuro hoje
  const futureHour = (currentHour + 1) % 24;
  const futureMinute = currentMinute;
  const futureTime = `${String(futureHour).padStart(2, '0')}:${String(futureMinute).padStart(2, '0')}`;
  let nextRunFuture = calculateNextRun('daily', futureTime);
  console.log(`Horário atual: ${currentHour}:${currentMinute}, Horário agendado: ${futureTime}`);
  console.log('Próxima execução (esperado hoje no futuro):', nextRunFuture.toLocaleString());
  if (nextRunFuture.getHours() === futureHour && nextRunFuture.getMinutes() === futureMinute && nextRunFuture.getDate() === now.getDate()) {
    console.log('✅ calculateNextRun (futuro hoje) correto.');
  } else {
    console.error('❌ calculateNextRun (futuro hoje) incorreto.');
  }

  // Caso 2: Horário no passado hoje (deve agendar para amanhã)
  const pastHour = (currentHour - 1 + 24) % 24;
  const pastMinute = currentMinute;
  const pastTime = `${String(pastHour).padStart(2, '0')}:${String(pastMinute).padStart(2, '0')}`;
  let nextRunPast = calculateNextRun('daily', pastTime);
  console.log(`Horário atual: ${currentHour}:${currentMinute}, Horário agendado: ${pastTime}`);
  console.log('Próxima execução (esperado amanhã):', nextRunPast.toLocaleString());
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (nextRunPast.getHours() === pastHour && nextRunPast.getMinutes() === pastMinute && nextRunPast.getDate() === tomorrow.getDate()) {
    console.log('✅ calculateNextRun (passado hoje) correto.');
  } else {
    console.error('❌ calculateNextRun (passado hoje) incorreto.');
  }

  console.log('\nTeste concluído.');
}

runTest().catch(console.error);

