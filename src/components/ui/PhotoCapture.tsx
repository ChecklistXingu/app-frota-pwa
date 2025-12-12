import { useRef, useState } from "react";
import { Camera, X, Image as ImageIcon, Loader2 } from "lucide-react";

interface PhotoCaptureProps {
  onPhotosChange: (files: File[]) => void;
  maxPhotos?: number;
  uploading?: boolean;
}

const PhotoCapture = ({ 
  onPhotosChange, 
  maxPhotos = 3,
  uploading = false 
}: PhotoCaptureProps) => {
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // Limita quantidade de fotos
    const remainingSlots = maxPhotos - files.length;
    const newFiles = selectedFiles.slice(0, remainingSlots);

    // Gera previews
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));

    const updatedFiles = [...files, ...newFiles];
    const updatedPreviews = [...previews, ...newPreviews];

    setFiles(updatedFiles);
    setPreviews(updatedPreviews);
    onPhotosChange(updatedFiles);

    // Limpa input para permitir selecionar mesmo arquivo novamente
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const removePhoto = (index: number) => {
    // Revoga URL do preview para liberar memória
    URL.revokeObjectURL(previews[index]);

    const updatedFiles = files.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);

    setFiles(updatedFiles);
    setPreviews(updatedPreviews);
    onPhotosChange(updatedFiles);
  };

  const canAddMore = files.length < maxPhotos;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Fotos do problema ({files.length}/{maxPhotos})
      </label>

      {/* Grid de previews */}
      <div className="flex flex-wrap gap-2">
        {previews.map((preview, index) => (
          <div
            key={index}
            className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200"
          >
            <img
              src={preview}
              alt={`Foto ${index + 1}`}
              className="w-full h-full object-cover"
            />
            {!uploading && (
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
              >
                <X size={12} />
              </button>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 size={20} className="text-white animate-spin" />
              </div>
            )}
          </div>
        ))}

        {/* Botão para adicionar foto */}
        {canAddMore && !uploading && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-[#0d2d6c] hover:text-[#0d2d6c] transition-colors"
          >
            <Camera size={20} />
            <span className="text-xs">Foto</span>
          </button>
        )}
      </div>

      {/* Input escondido */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment" // Abre câmera traseira no celular
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Dica */}
      {files.length === 0 && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <ImageIcon size={14} />
          Tire fotos do problema para o gerente visualizar
        </p>
      )}
    </div>
  );
};

export default PhotoCapture;
