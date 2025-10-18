import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_TITLE } from "@/const";
import { Upload, FileText, Activity, CheckCircle, XCircle, Clock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const token = localStorage.getItem('auth_token');
  const meQuery = trpc.auth.me.useQuery({ token: token || undefined }, { enabled: !!token });

  useEffect(() => {
    if (!token) {
      setLocation('/login');
      return;
    }
    if (meQuery.data) {
      setUser(meQuery.data);
    } else if (meQuery.isError) {
      localStorage.removeItem('auth_token');
      setLocation('/login');
    }
  }, [token, meQuery.data, meQuery.isError, setLocation]);

  const { data: files = [], refetch } = trpc.cnab.listFiles.useQuery(undefined, {
    enabled: !!user,
  });
  
  const uploadMutation = trpc.cnab.uploadFile.useMutation({
    onSuccess: () => {
      refetch();
      setSelectedFile(null);
      toast.success('Arquivo enviado com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao enviar: ${error.message}`);
    },
  });

  const processMutation = trpc.cnab.processFile.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Processamento iniciado!');
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setLocation('/login');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result?.toString().split(',')[1];
      if (!base64) return;

      uploadMutation.mutate({
        filename: selectedFile.name,
        content: base64,
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleProcess = (fileId: number) => {
    processMutation.mutate({ fileId });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
      case 'processing':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Activity className="w-3 h-3 mr-1" />Processando</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Concluído</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Erro</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const stats = {
    total: files.length,
    pending: files.filter(f => f.status === 'pending').length,
    completed: files.filter(f => f.status === 'completed').length,
    errors: files.filter(f => f.status === 'error').length,
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#2c5282] text-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">{APP_TITLE}</h1>
              <p className="text-sm text-blue-100">Sistema de Processamento CNAB</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-blue-200">{user.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="bg-transparent border-white text-white hover:bg-white/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total de Arquivos</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-1 bg-blue-500 rounded"></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Pendentes</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{stats.pending}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-1 bg-yellow-500 rounded"></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Concluídos</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.completed}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-1 bg-green-500 rounded"></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Erros</CardDescription>
              <CardTitle className="text-3xl text-red-600">{stats.errors}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-1 bg-red-500 rounded"></div>
            </CardContent>
          </Card>
        </div>

        {/* Upload */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload de Arquivo CNAB
            </CardTitle>
            <CardDescription>Selecione um arquivo .RET para processar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <input
                type="file"
                accept=".RET,.ret"
                onChange={handleFileSelect}
                className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
                className="bg-[#2c5282] hover:bg-[#1e3a5f]"
              >
                {uploadMutation.isPending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Files Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Arquivos Processados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-sm">Arquivo</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Data</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Número QPROF</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file: any) => (
                    <tr key={file.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">{file.filename}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(file.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(file.status)}</td>
                      <td className="py-3 px-4 text-sm">{file.qprofNumber || '-'}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLocation(`/file/${file.id}`)}
                            className="text-xs"
                          >
                            Ver Detalhes
                          </Button>
                          {file.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => handleProcess(file.id)}
                              disabled={processMutation.isPending}
                              className="bg-[#2c5282] hover:bg-[#1e3a5f]"
                            >
                              Processar
                            </Button>
                          )}
                          {file.status === 'processing' && (
                            <span className="text-sm text-gray-500">Processando...</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {files.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        Nenhum arquivo encontrado. Faça upload de um arquivo CNAB para começar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

