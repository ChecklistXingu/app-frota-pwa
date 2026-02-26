import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { Download, FileText, ArrowLeft, ExternalLink } from "lucide-react";

type AttachmentLinkData = {
  slug: string;
  url: string;
  maintenanceId: string;
  attachmentName: string;
  vehiclePlate?: string;
  updatedAt: any;
  createdBy?: string;
};

export default function AttachmentPreview() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AttachmentLinkData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Link inválido");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const docRef = doc(db, "attachmentLinks", slug);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setError("Link não encontrado ou expirado");
          setLoading(false);
          return;
        }

        const linkData = docSnap.data() as AttachmentLinkData;
        setData(linkData);
        setLoading(false);
      } catch (err) {
        console.error("Erro ao buscar anexo:", err);
        setError("Erro ao carregar anexo");
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  const handleDownload = () => {
    if (data?.url) {
      window.open(data.url, "_blank");
    }
  };

  const handleDirectRedirect = () => {
    if (data?.url) {
      window.location.href = data.url;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0d2d6c] mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando anexo...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="text-red-600" size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Anexo não encontrado</h2>
          <p className="text-gray-600 mb-6">{error || "Este link pode ter expirado ou sido removido."}</p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 bg-[#0d2d6c] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1a3d7c] transition-colors"
          >
            <ArrowLeft size={20} />
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  const isPDF = data.attachmentName?.toLowerCase().endsWith(".pdf");
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(data.attachmentName || "");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="text-[#0d2d6c]" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Orçamento de Manutenção</h1>
                {data.vehiclePlate && (
                  <p className="text-sm text-gray-600">Veículo: {data.vehiclePlate}</p>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
        </div>

        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600">Nome do arquivo:</span>
              <span className="text-sm text-gray-800">{data.attachmentName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-600">ID da manutenção:</span>
              <span className="text-sm text-gray-800 font-mono">{data.maintenanceId}</span>
            </div>
            {data.updatedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">Data de upload:</span>
                <span className="text-sm text-gray-800">
                  {new Date(data.updatedAt.seconds * 1000).toLocaleString("pt-BR")}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleDownload}
            className="w-full bg-[#0d2d6c] text-white px-6 py-4 rounded-xl font-semibold hover:bg-[#1a3d7c] transition-colors flex items-center justify-center gap-3 shadow-lg"
          >
            <Download size={24} />
            Baixar Orçamento
          </button>

          {(isPDF || isImage) && (
            <button
              onClick={handleDirectRedirect}
              className="w-full bg-white border-2 border-[#0d2d6c] text-[#0d2d6c] px-6 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-3"
            >
              <ExternalLink size={24} />
              Visualizar no Navegador
            </button>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            App Frota - Sistema de Gestão de Manutenção
          </p>
        </div>
      </div>
    </div>
  );
}
