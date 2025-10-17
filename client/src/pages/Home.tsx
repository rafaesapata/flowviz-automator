import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Upload, FileText, Activity, CheckCircle, XCircle, Clock, TrendingUp, DollarSign } from "lucide-react";
import { useState } from "react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const { data: files = [], refetch } = trpc.cnab.listFiles.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  
  const uploadMutation = trpc.cnab.uploadFile.useMutation({
    onSuccess: () => {
      refetch();
      setSelectedFile(null);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate({
        fileName: selectedFile.name,
        fileSize: `${(selectedFile.size / 1024).toFixed(2)} KB`,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string, icon: any, label: string }> = {
      pending: { className: "bg-gray-100 text-gray-700 border-gray-300", icon: Clock, label: "Pendente" },
      processing: { className: "bg-blue-100 text-blue-700 border-blue-300", icon: Activity, label: "Processando" },
      completed: { className: "bg-green-100 text-green-700 border-green-300", icon: CheckCircle, label: "Concluído" },
      error: { className: "bg-red-100 text-red-700 border-red-300", icon: XCircle, label: "Erro" },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Activity className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">{APP_TITLE}</CardTitle>
            <CardDescription className="text-base">Sistema de automação para processamento de arquivos CNAB</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <Button asChild size="lg" className="w-full">
              <a href={getLoginUrl()}>Fazer Login</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-[#2c5282] text-white shadow-md">
        <div className="container mx-auto py-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{APP_TITLE}</h1>
              <p className="text-sm text-blue-100">Sistema de Monitoramento de Integração</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">Bem-vindo, <strong>{user?.name}</strong></span>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-8 px-6">
        {/* Cards de Estatísticas */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total de Arquivos</CardTitle>
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{files.length}</div>
              <p className="text-xs text-gray-500 mt-1">Arquivos CNAB processados</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Processados</CardTitle>
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {files.filter(f => f.status === "completed").length}
              </div>
              <p className="text-xs text-gray-500 mt-1">Concluídos com sucesso</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Em Processamento</CardTitle>
              <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                <Activity className="h-5 w-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">
                {files.filter(f => f.status === "processing" || f.status === "pending").length}
              </div>
              <p className="text-xs text-gray-500 mt-1">Aguardando conclusão</p>
            </CardContent>
          </Card>
        </div>

        {/* Card de Upload */}
        <Card className="mb-8 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Enviar Arquivo CNAB</CardTitle>
            <CardDescription>Selecione um arquivo .RET para processar no sistema QPROF</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <input
                  type="file"
                  accept=".RET,.ret"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
                />
                {selectedFile && (
                  <p className="mt-2 text-sm text-gray-600 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
              </div>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
                className="gap-2 bg-[#2c5282] hover:bg-[#1e3a5f]"
              >
                <Upload className="h-4 w-4" />
                {uploadMutation.isPending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Histórico */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Histórico de Arquivos</CardTitle>
                <CardDescription>Arquivos CNAB processados e em processamento</CardDescription>
              </div>
              <Badge variant="secondary" className="text-sm">
                {files.length} {files.length === 1 ? "registro" : "registros"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-base font-medium">Nenhum arquivo enviado ainda</p>
                <p className="text-sm mt-1">Faça o upload do primeiro arquivo CNAB para começar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Arquivo</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Data de Envio</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Tamanho</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">QPROF</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, idx) => (
                      <tr
                        key={file.id}
                        className={`border-b hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 text-blue-600" />
                            </div>
                            <span className="font-medium text-gray-900 text-sm">{file.fileName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(file.uploadedAt!).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{file.fileSize}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {file.qprofNumber ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {file.qprofNumber}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(file.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

