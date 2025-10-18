import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from './_core/logger';
import { getDb } from './db';
import { automationRoutines, monitoredFiles } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { processQProfFile } from './qprof-automation';

// Calcular hash MD5 de um arquivo
async function calculateFileHash(filepath: string): Promise<string> {
  const fileBuffer = await fs.promises.readFile(filepath);
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

// Calcular próxima execução baseado na frequência
export function calculateNextRun(frequency: 'hourly' | 'daily' | 'weekly', dailyRunTime?: string | null): Date {
  const now = new Date();
  switch (frequency) {
    case 'hourly':
      return new Date(now.getTime() + 60 * 60 * 1000); // +1 hora
    case 'daily':
      const nextDailyRun = new Date(now);
      if (dailyRunTime) {
        const [hours, minutes] = dailyRunTime.split(':').map(Number);
        nextDailyRun.setHours(hours, minutes, 0, 0);
      }
      
      // Se o horário de execução já passou para hoje, agendar para amanhã
      if (nextDailyRun <= now) {
        nextDailyRun.setDate(nextDailyRun.getDate() + 1);
      }
      return nextDailyRun;
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +1 semana
  }
}

// Listar arquivos .RET de uma pasta
export async function listRetFiles(folderPath: string): Promise<string[]> {
  try {
    if (!await fs.access(folderPath, fsSync.constants.F_OK).then(() => true).catch(() => false)) {
      logger.info(`Pasta não existe: ${folderPath}. Criando...`);
      await fs.mkdir(folderPath, { recursive: true });
      logger.info(`Pasta ${folderPath} criada com sucesso.`);
    }

    try {
      await fs.access(folderPath, fsSync.constants.R_OK | fsSync.constants.W_OK);
      logger.info(`Permissões de leitura/escrita OK para a pasta: ${folderPath}`);
    } catch (err) {
      logger.error({ error: err }, `Sem permissões de leitura/escrita para a pasta: ${folderPath}. Erro: ${err.message}`);
      return [];
    }
    
    const files = await fs.readdir(folderPath);
    return files
      .filter(f => f.toUpperCase().endsWith('.RET'))
      .map(f => path.join(folderPath, f));
  } catch (error: any) {
    logger.error({ error }, `Erro ao listar arquivos: ${error.message}`);
    return [];
  }
}

// Verificar se arquivo já foi importado
async function isFileImported(routineId: number, filepath: string, fileHash: string): Promise<boolean> {
  const existing = await (await getDb())
    .select()
    .from(monitoredFiles)
    .where(
      and(
        eq(monitoredFiles.routineId, routineId),
        eq(monitoredFiles.filepath, filepath),
        eq(monitoredFiles.fileHash, fileHash),
        eq(monitoredFiles.status, 'completed')
      )
    )
    .limit(1);
  
  return existing.length > 0;
}

// Registrar arquivo monitorado
async function registerMonitoredFile(
  routineId: number,
  filename: string,
  filepath: string,
  fileHash: string
): Promise<number> {
  const result = await (await getDb()).insert(monitoredFiles).values({
    routineId,
    filename,
    filepath,
    fileHash,
    status: 'pending',
  });
  
  return Number(result.insertId);
}

// Atualizar status do arquivo monitorado
async function updateMonitoredFileStatus(
  id: number,
  status: 'pending' | 'processing' | 'completed' | 'error',
  qprofNumber?: string | null,
  error?: string
) {
  await (await getDb()).update(monitoredFiles)
    .set({
      status,
      qprofNumber: qprofNumber || undefined,
      error: error || undefined,
      importedAt: status === 'completed' ? new Date() : undefined,
    })
    .where(eq(monitoredFiles.id, id));
}

// Executar rotina de importação
export async function executeRoutine(routineId: number): Promise<{
  success: boolean;
  filesProcessed: number;
  errors: number;
}> {
  logger.info(`[Rotina ${routineId}] Iniciando execução...`);
  
  try {
    // Buscar configuração da rotina
    const routine = await (await getDb())
      .select()
      .from(automationRoutines)
      .where(eq(automationRoutines.id, routineId))
      .limit(1);
    
    if (routine.length === 0) {
      logger.warn(`[Rotina ${routineId}] Rotina não encontrada`);
      return { success: false, filesProcessed: 0, errors: 1 };
    }
    
    const config = routine[0];
    
    if (config.status !== 'active') {
      logger.warn(`[Rotina ${routineId}] Rotina não está ativa (status: ${config.status})`);
      return { success: false, filesProcessed: 0, errors: 0 };
    }
    
    logger.info(`[Rotina ${routineId}] Configuração:`);
    logger.info(`  Nome: ${config.name}`);
    logger.info(`  Empresa: ${config.company}`);
    logger.info(`  Pasta: ${config.folderPath}`);
    logger.info(`  Frequência: ${config.frequency}`);
    
    // Listar arquivos da pasta
    const files = await listRetFiles(config.folderPath);
    logger.info(`[Rotina ${routineId}] Encontrados ${files.length} arquivos .RET`);
    
    let filesProcessed = 0;
    let errors = 0;
    
    // Processar cada arquivo
    for (const filepath of files) {
      const filename = path.basename(filepath);
      const fileHash = await calculateFileHash(filepath);
      
      logger.info(`[Rotina ${routineId}] Verificando arquivo: ${filename}`);
      
      // Verificar se já foi importado
      const alreadyImported = await isFileImported(routineId, filepath, fileHash);
      
      if (alreadyImported) {
        logger.info(`[Rotina ${routineId}] Arquivo já importado: ${filename}`);
        continue;
      }
      
      logger.info(`[Rotina ${routineId}] Novo arquivo detectado: ${filename}`);
      
      // Registrar arquivo
      const monitoredId = await registerMonitoredFile(routineId, filename, filepath, fileHash);
      
      // Atualizar status para processing
      await updateMonitoredFileStatus(monitoredId, 'processing');
      
      try {
        logger.info(`[Rotina ${routineId}] Processando arquivo: ${filename}`);
        
        // Processar no QPROF
        const result = await processQProfFile(
          monitoredId.toString(),
          filename,
          filepath,
          config.company
        );
        
        if (result.success) {
          logger.info(`[Rotina ${routineId}] ✅ Arquivo processado com sucesso: ${filename}`);
          await updateMonitoredFileStatus(monitoredId, 'completed', result.qprofNumber);
          filesProcessed++;
        } else {
          logger.error(`[Rotina ${routineId}] ❌ Erro ao processar: ${filename} - ${result.error}`);
          await updateMonitoredFileStatus(monitoredId, 'error', null, result.error);
          errors++;
        }
      } catch (error: any) {
        logger.error({ error }, `[Rotina ${routineId}] ❌ Exceção ao processar: ${filename} - ${error.message}`);
        await updateMonitoredFileStatus(monitoredId, 'error', null, error.message);
        errors++;
      }
    }
    
    // Atualizar rotina
    const nextRun = calculateNextRun(config.frequency, config.dailyRunTime);
    await (await getDb()).update(automationRoutines)
      .set({
        lastRun: new Date(),
        nextRun,
        status: errors > 0 && filesProcessed === 0 ? 'error' : 'active',
      })
      .where(eq(automationRoutines.id, routineId));
    
    logger.info(`[Rotina ${routineId}] Execução concluída:`);
    logger.info(`  Arquivos processados: ${filesProcessed}`);
    logger.info(`  Erros: ${errors}`);
    logger.info(`  Próxima execução: ${nextRun.toLocaleString('pt-BR')}`);
    
    return { success: true, filesProcessed, errors };
  } catch (error: any) {
    logger.fatal({ error }, `[Rotina ${routineId}] Erro fatal: ${error.message}`);
    
    // Marcar rotina como erro
    await (await getDb()).update(automationRoutines)
      .set({ status: 'error' })
      .where(eq(automationRoutines.id, routineId));
    
    return { success: false, filesProcessed: 0, errors: 1 };
  }
}

// Verificar e executar rotinas pendentes
export async function checkAndExecuteRoutines() {
  logger.info('[Scheduler] Verificando rotinas pendentes...');
  
  const now = new Date();
  
  // Buscar rotinas ativas que devem ser executadas
  const routines = await (await getDb())
    .select()
    .from(automationRoutines)
    .where(eq(automationRoutines.status, 'active'));
  
  logger.info(`[Scheduler] Encontradas ${routines.length} rotinas ativas`);
  
  for (const routine of routines) {
    // Verificar se deve executar
    if (!routine.nextRun || routine.nextRun <= now) {
      logger.info(`[Scheduler] Executando rotina: ${routine.name} (ID: ${routine.id})`);
      await executeRoutine(routine.id);
    } else {
      const timeUntilNext = Math.round((routine.nextRun.getTime() - now.getTime()) / 1000 / 60);
      logger.info(`[Scheduler] Rotina "${routine.name}" será executada em ${timeUntilNext} minutos`);
    }
  }
}

// Iniciar scheduler (verificar a cada 5 minutos)
let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler() {
  if (schedulerInterval) {
    logger.warn('[Scheduler] Scheduler já está rodando');
    return;
  }
  
  logger.info('[Scheduler] Iniciando scheduler...');
  
  // Executar imediatamente
  checkAndExecuteRoutines();
  
  // Executar a cada 5 minutos
  schedulerInterval = setInterval(() => {
    checkAndExecuteRoutines();
  }, 5 * 60 * 1000);
  
  logger.info('[Scheduler] Scheduler iniciado (verificação a cada 5 minutos)');
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('[Scheduler] Scheduler parado');
  }
}

