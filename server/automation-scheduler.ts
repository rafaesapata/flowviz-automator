import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from './_core/logger';
import { getDb } from './db';
import { automationRoutines, monitoredFiles } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { processQProfFile } from './qprof-automation';

// Calcular hash MD5 de um arquivo
function calculateFileHash(filepath: string): string {
  const fileBuffer = fs.readFileSync(filepath);
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

// Calcular próxima execução baseado na frequência
function calculateNextRun(frequency: 'hourly' | 'daily' | 'weekly'): Date {
  const now = new Date();
  switch (frequency) {
    case 'hourly':
      return new Date(now.getTime() + 60 * 60 * 1000); // +1 hora
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000); // +1 dia
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +1 semana
  }
}

// Listar arquivos .RET de uma pasta
function listRetFiles(folderPath: string): string[] {
  try {
    if (!fs.existsSync(folderPath)) {
      logger.warn(`Pasta não existe: ${folderPath}`);
      return [];
    }
    
    const files = fs.readdirSync(folderPath);
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
    const files = listRetFiles(config.folderPath);
    logger.info(`[Rotina ${routineId}] Encontrados ${files.length} arquivos .RET`);
    
    let filesProcessed = 0;
    let errors = 0;
    
    // Processar cada arquivo
    for (const filepath of files) {
      const filename = path.basename(filepath);
      const fileHash = calculateFileHash(filepath);
      
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
    const nextRun = calculateNextRun(config.frequency);
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

