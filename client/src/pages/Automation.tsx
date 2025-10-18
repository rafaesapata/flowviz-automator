import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, Trash2, Clock, Folder, Building2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function Automation() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRoutine, setNewRoutine] = useState({
    name: '',
    company: '',
    folderPath: '',
    frequency: 'daily' as 'hourly' | 'daily' | 'weekly',
  });

  const { data: routines = [], refetch } = trpc.automation.listRoutines.useQuery();

  const createMutation = trpc.automation.createRoutine.useMutation({
    onSuccess: () => {
      refetch();
      setIsCreateDialogOpen(false);
      setNewRoutine({ name: '', company: '', folderPath: '', frequency: 'daily' });
      toast.success('Rotina criada com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const updateMutation = trpc.automation.updateRoutine.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Rotina atualizada!');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const deleteMutation = trpc.automation.deleteRoutine.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Rotina excluída!');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const executeMutation = trpc.automation.executeRoutine.useMutation({
    onSuccess: (result) => {
      refetch();
      toast.success(`Rotina executada! ${result.filesProcessed} arquivos processados, ${result.errors} erros.`);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const handleCreate = () => {
    if (!newRoutine.name || !newRoutine.company || !newRoutine.folderPath) {
      toast.error('Preencha todos os campos');
      return;
    }
    createMutation.mutate(newRoutine);
  };

  const handleToggleStatus = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    updateMutation.mutate({ id, status: newStatus });
  };

  const handleDelete = (id: number, name: string) => {
    if (confirm(`Tem certeza que deseja excluir a rotina "${name}"?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const handleExecuteNow = (id: number) => {
    if (confirm('Executar esta rotina agora?')) {
      executeMutation.mutate({ id });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500"><Clock className="w-3 h-3 mr-1" />Ativa</Badge>;
      case 'paused':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700"><Pause className="w-3 h-3 mr-1" />Pausada</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'hourly':
        return 'A cada hora';
      case 'daily':
        return 'Diariamente';
      case 'weekly':
        return 'Semanalmente';
      default:
        return frequency;
    }
  };

  const companies = [
    '30E FIDC',
    'BRASCOB',
    'BRAVANO FIDC',
    'FLOW CARD FUNDO DE INVESTIMENTO EM DIREITO CREDITORIO',
    'FLOW GESTORA DE CRÉDITOS LTDA',
    'FLOWINVEST FIDC',
    'FLOWINVEST INCORPORADORA',
    'FLOWINVEST SECURITIZADORA',
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Automação de Importação</h1>
          <p className="text-gray-600 mt-2">Gerencie rotinas automáticas de importação de arquivos CNAB</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#2c5282] hover:bg-[#1e3a5f]">
              <Plus className="w-4 h-4 mr-2" />
              Nova Rotina
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar Nova Rotina</DialogTitle>
              <DialogDescription>
                Configure uma rotina automática para importar arquivos de uma pasta específica
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome da Rotina</label>
                <input
                  type="text"
                  value={newRoutine.name}
                  onChange={(e) => setNewRoutine({ ...newRoutine, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Importação Diária BRASCOB"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Empresa</label>
                <select
                  value={newRoutine.company}
                  onChange={(e) => setNewRoutine({ ...newRoutine, company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione uma empresa</option>
                  {companies.map((company) => (
                    <option key={company} value={company}>{company}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Pasta de Monitoramento</label>
                <input
                  type="text"
                  value={newRoutine.folderPath}
                  onChange={(e) => setNewRoutine({ ...newRoutine, folderPath: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="/home/ubuntu/cnab-files"
                />
                <p className="text-xs text-gray-500 mt-1">Caminho absoluto da pasta com arquivos .RET</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Frequência</label>
                <select
                  value={newRoutine.frequency}
                  onChange={(e) => setNewRoutine({ ...newRoutine, frequency: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="hourly">A cada hora</option>
                  <option value="daily">Diariamente</option>
                  <option value="weekly">Semanalmente</option>
                </select>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="flex-1 bg-[#2c5282] hover:bg-[#1e3a5f]"
                >
                  {createMutation.isPending ? 'Criando...' : 'Criar Rotina'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total de Rotinas</CardDescription>
            <CardTitle className="text-3xl">{routines.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-1 bg-blue-500 rounded"></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Rotinas Ativas</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {routines.filter(r => r.status === 'active').length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-1 bg-green-500 rounded"></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Rotinas Pausadas</CardDescription>
            <CardTitle className="text-3xl text-gray-600">
              {routines.filter(r => r.status === 'paused').length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-1 bg-gray-500 rounded"></div>
          </CardContent>
        </Card>
      </div>

      {/* Routines List */}
      <div className="grid grid-cols-1 gap-4">
        {routines.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma rotina configurada ainda.</p>
              <p className="text-sm mt-2">Clique em "Nova Rotina" para começar.</p>
            </CardContent>
          </Card>
        ) : (
          routines.map((routine) => (
            <Card key={routine.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle>{routine.name}</CardTitle>
                      {getStatusBadge(routine.status)}
                    </div>
                    <CardDescription className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        <span>{routine.company}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4" />
                        <span className="font-mono text-xs">{routine.folderPath}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{getFrequencyLabel(routine.frequency)}</span>
                      </div>
                      {routine.lastRun && (
                        <div className="text-xs text-gray-500 mt-2">
                          Última execução: {new Date(routine.lastRun).toLocaleString('pt-BR')}
                        </div>
                      )}
                      {routine.nextRun && (
                        <div className="text-xs text-gray-500">
                          Próxima execução: {new Date(routine.nextRun).toLocaleString('pt-BR')}
                        </div>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExecuteNow(routine.id)}
                      disabled={executeMutation.isPending}
                      title="Executar agora"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleStatus(routine.id, routine.status)}
                      disabled={updateMutation.isPending}
                      title={routine.status === 'active' ? 'Pausar' : 'Ativar'}
                    >
                      {routine.status === 'active' ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(routine.id, routine.name)}
                      disabled={deleteMutation.isPending}
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

