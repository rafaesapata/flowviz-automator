import { QProfAutomation } from './server/qprof-automation';

async function testAutomation() {
  console.log('🚀 Iniciando teste de automação QPROF...\n');
  
  const automation = new QProfAutomation();
  const testFileId = 'test_' + Date.now();
  const testFileName = 'TESTERET.RET';
  const testFilePath = '/home/ubuntu/automacao-cnab/uploads/cnab_1760729915274_ztz1ew5om_TESTERET.RET';

  try {
    console.log('📦 Arquivo de teste:', testFilePath);
    console.log('🔧 Iniciando processamento...\n');

    const result = await automation.processFile(testFileId, testFileName, testFilePath);

    console.log('\n✅ Resultado do processamento:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n🎉 Sucesso! Número QPROF:', result.qprofNumber || 'Não capturado');
    } else {
      console.log('\n❌ Erro:', result.error);
    }
  } catch (error: any) {
    console.error('\n💥 Erro fatal:', error.message);
    console.error(error.stack);
  }
}

testAutomation();

