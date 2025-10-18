import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, FileText, Activity, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import { useRoute, useLocation } from "wouter";
import { useEffect } from "react";

export default function FileDetails() {
  const [, params] = useRoute("/file/:id");
  const [, setLocation] = useLocation();
  const fileId = params?.id;

  const { data: files = [] } = trpc.cnab.listFiles.useQuery();
  const { data: logs = [], refetch: refetchLogs } = trpc.cnab.getFileLogs.useQuery(
    { fileId: parseInt(fileId!) },
    { enabled: !!fileId, refetchInterval: 2000 }
  );
  const { data: screenshots = [] } = trpc.cnab.getScreenshots.useQuery(
    { fileId: parseInt(fileId!) },
    { enabled: !!fileId, refetchInterval: 5000 }
  );

  const file = files.find(f => f.id === parseInt(fileId!));

  useEffect(() => {
    if (file?.status === "processing") {
      const interval = setInterval(() => {
        refetchLogs();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [file?.status, refetchLogs]);

  if (!file) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Arquivo não encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")}>Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case "success": return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "error": return <XCircle className="h-4 w-4 text-red-600" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      default: return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getLogBadgeClass = (level: string) => {
    switch (level) {
      case "success": return "bg-green-100 text-green-700 border-green-300";
      case "error": return "bg-red-100 text-red-700 border-red-300";
      case "warning": return "bg-orange-100 text-orange-700 border-orange-300";
      default: return "bg-blue-100 text-blue-700 border-blue-300";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[#2c5282] text-white shadow-md">
        <div className="container mx-auto py-4 px-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{file.fileName}</h1>
              <p className="text-sm text-blue-100">Detalhes do Processamento</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto py-8 px-6">
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Tamanho</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{file.fileSize}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className={getLogBadgeClass(file.status === "completed" ? "success" : file.status)}>
                {file.status}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">QPROF</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">{file.qprofNumber || "-"}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm">
                {new Date(file.uploadedAt!).toLocaleString("pt-BR")}
              </div>
            </CardContent>
          </Card>
        </div>

        {screenshots.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Screenshots do Processamento</CardTitle>
              <CardDescription>Visualize o que o Puppeteer fez durante o processamento</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {screenshots.map((screenshot, idx) => (
                  <div key={idx} className="border rounded-lg overflow-hidden hover:shadow-lg transition">
                    <img 
                      src={screenshot.path} 
                      alt={screenshot.name}
                      className="w-full h-auto cursor-pointer hover:opacity-80 transition"
                      onClick={() => window.open(screenshot.path, '_blank')}
                    />
                    <div className="p-2 bg-gray-50 text-xs text-center font-mono">
                      {screenshot.name}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Logs de Processamento</CardTitle>
                <CardDescription>Acompanhe em tempo real o processamento do arquivo</CardDescription>
              </div>
              {file.status === "processing" && (
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 gap-2">
                  <Activity className="h-3 w-3 animate-spin" />
                  Processando
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum log disponível ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getLogIcon(log.level || 'info')}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`text-xs ${getLogBadgeClass(log.level || 'info')}`}>
                          {(log.level || 'info').toUpperCase()}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(log.timestamp!).toLocaleTimeString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900">{log.message}</p>
                      {log.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-600 cursor-pointer">Ver detalhes</summary>
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {log.details}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

