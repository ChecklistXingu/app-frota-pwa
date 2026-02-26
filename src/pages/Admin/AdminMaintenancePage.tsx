import { useEffect, useMemo, useRef, useState } from "react";
import { listenMaintenances, updateMaintenanceStatus, type DirectorApproval, type DirectorApprovalAttachment, type Maintenance, type MaintenanceStatus } from "../../services/maintenanceService";
import { listenAllVehicles, type Vehicle } from "../../services/vehiclesService";
import { listenUsers, type AppUser } from "../../services/usersService";
import { ChevronDown, Loader2, Paperclip, Trash2, Wrench } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import DateTimePicker from "../../components/DateTimePicker";
import { uploadApprovalAttachment, deleteApprovalAttachment } from "../../services/approvalAttachmentService";
import { openEmailClient } from "../../utils/emailHelper";
import { db } from "../../services/firebase";
import { doc, setDoc } from "firebase/firestore";

const statusOptions: MaintenanceStatus[] = ["pending", "in_review", "scheduled", "done"];

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  in_review: "Em análise",
  scheduled: "Agendado",
  done: "Finalizado",
  all: "Todas",
};

const MAX_APPROVAL_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB
const ATTACHMENT_ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
];
const ATTACHMENT_ACCEPT_ATTRIBUTE = ".pdf,.doc,.docx,image/*";

const emailRecipients = {
  to: "amauri@xingumaquinas.com",
  cc: ["silvana.bacca@xingumaquinas.com", "gleidione.resende@xingumaquinas.com"],
};

const formatBytes = (bytes: number) => {
  if (!bytes || Number.isNaN(bytes)) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(value > 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const createAttachmentSlugBase = (plate: string, maintenanceId: string) => {
  const sanitizedPlate = slugify(plate || "");
  if (sanitizedPlate) return `orcamento${sanitizedPlate}`;
  const fallback = slugify(maintenanceId).slice(-6) || "file";
  return `orcamento${fallback}`;
};

const mapExistingApprovalAttachments = (attachments?: DirectorApprovalAttachment[]): ApprovalAttachmentItem[] => {
  if (!attachments?.length) return [];
  return attachments.map((attachment, index) => ({
    id: attachment.storagePath || attachment.url || `existing-${index}`,
    status: "existing" as const,
    name: attachment.name || `Anexo ${index + 1}`,
    size: typeof attachment.size === "number" ? attachment.size : 0,
    contentType: attachment.contentType,
    url: attachment.url,
    storagePath: attachment.storagePath,
    uploadedAt: attachment.uploadedAt,
    uploadedBy: attachment.uploadedBy,
    shortUrl: attachment.shortUrl,
    slug: attachment.slug,
  }));
};

const sanitizeAttachment = (attachment: Partial<DirectorApprovalAttachment>): DirectorApprovalAttachment => {
  const sanitized: DirectorApprovalAttachment = {
    name: attachment.name || "Anexo",
    url: attachment.url || "",
  };

  if (typeof attachment.size === "number") {
    sanitized.size = attachment.size;
  }
  if (attachment.contentType) {
    sanitized.contentType = attachment.contentType;
  }
  if (attachment.storagePath) {
    sanitized.storagePath = attachment.storagePath;
  }
  if (attachment.uploadedAt) {
    sanitized.uploadedAt = attachment.uploadedAt;
  }
  if (attachment.uploadedBy) {
    sanitized.uploadedBy = attachment.uploadedBy;
  }
  if (attachment.shortUrl) {
    sanitized.shortUrl = attachment.shortUrl;
  }
  if (attachment.slug) {
    sanitized.slug = attachment.slug;
  }

  return sanitized;
};

const buildEmailSubject = (vehicle: string, driver: string, requestTitle: string, total?: number) => {
  const driverSegment = driver ? ` - ${driver}` : "";
  const amount = typeof total === "number" ? ` - ${formatCurrency(total)}` : "";
  return `[Orçamento] ${vehicle}${driverSegment} - ${requestTitle}${amount}`;
};

type ApprovalFormItem = {
  id: string;
  name: string;
  quantity: string;
  unitCost: string;
};

type ApprovalFormState = {
  vendor: string;
  workshopLocation: string;
  laborCost: string;
  phone: string;
  note: string;
  items: ApprovalFormItem[];
};

type ApprovalAttachmentItem = {
  id: string;
  status: "existing" | "new";
  name: string;
  size: number;
  contentType?: string;
  file?: File;
  url?: string;
  storagePath?: string;
  uploadedAt?: any;
  uploadedBy?: string;
  shortUrl?: string;
  slug?: string;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const formatCurrency = (value: number) => currencyFormatter.format(value || 0);

const getDirectorHighlightClass = (approval?: DirectorApproval) => {
  if (!approval) return "";
  if (approval.status === "approved") return "bg-emerald-50";
  if (approval.status === "rejected") return "bg-red-50";
  return "";
};

const createRandomId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
};

const createEmptyApprovalItem = (name = ""): ApprovalFormItem => ({
  id: createRandomId(),
  name,
  quantity: "1",
  unitCost: "",
});

const createInitialApprovalForm = (): ApprovalFormState => ({
  vendor: "",
  workshopLocation: "",
  laborCost: "",
  phone: "",
  note: "",
  items: [createEmptyApprovalItem()],
});

const parseNumberInput = (value: string) => {
  if (!value) return 0;

  const sanitized = value.replace(/[^0-9.,-]/g, "");
  if (!sanitized) return 0;

  const lastComma = sanitized.lastIndexOf(",");
  const lastDot = sanitized.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);

  let normalized = sanitized;

  if (decimalIndex > -1) {
    const integerPart = sanitized.slice(0, decimalIndex).replace(/[.,]/g, "");
    const decimalPart = sanitized.slice(decimalIndex + 1).replace(/[^0-9]/g, "");
    normalized = `${integerPart}.${decimalPart}`;
  } else {
    normalized = sanitized.replace(/[^0-9-]/g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseCurrencyInput = (value: string) => parseNumberInput(value);
const parseQuantityInput = (value: string) => parseNumberInput(value || "0");

const computeItemValues = (item: ApprovalFormItem) => {
  const quantity = parseQuantityInput(item.quantity);
  const unitCost = parseCurrencyInput(item.unitCost);
  return {
    quantity,
    unitCost,
    total: quantity * unitCost,
  };
};

const formatQuantity = (value: number) => {
  return value.toString().replace(".", ",");
};

const AdminMaintenancePage = () => {
  const [items, setItems] = useState<Maintenance[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filter, setFilter] = useState<MaintenanceStatus | "all">("all");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const { profile } = useAuth();

  const [approvalModal, setApprovalModal] = useState<{ open: boolean; maintenance: Maintenance | null }>({
    open: false,
    maintenance: null,
  });
  const [approvalForm, setApprovalForm] = useState<ApprovalFormState>(createInitialApprovalForm());
  const [approvalAttachments, setApprovalAttachments] = useState<ApprovalAttachmentItem[]>([]);
  const [attachmentsMarkedForDeletion, setAttachmentsMarkedForDeletion] = useState<DirectorApprovalAttachment[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [savingApproval, setSavingApproval] = useState(false);
  const [hasCopiedPreview, setHasCopiedPreview] = useState(false);

  const [ticketModal, setTicketModal] = useState<{ open: boolean; maintenance: Maintenance | null }>({
    open: false,
    maintenance: null,
  });
  const [ticketForm, setTicketForm] = useState({
    workshopName: "",
    scheduledFor: "",
    forecastedCompletion: "",
    forecastedCost: "",
    managerNote: "",
  });
  const [savingTicket, setSavingTicket] = useState(false);
  const [completionModal, setCompletionModal] = useState<{ 
    open: boolean; 
    maintenance: Maintenance | null; 
    date: string; 
    cost: string;
    laborCost: string;
    itemCosts: Record<string, string>;
    managerNote: string;
  }>({
    open: false,
    maintenance: null,
    date: "",
    cost: "",
    laborCost: "",
    itemCosts: {},
    managerNote: ""
  });
  const [completing, setCompleting] = useState(false);
  const [photoModal, setPhotoModal] = useState<{ open: boolean; photos: string[]; maintenance: Maintenance | null }>({
    open: false,
    photos: [],
    maintenance: null,
  });
  const [audioModal, setAudioModal] = useState<{ open: boolean; url: string | null; duration?: number | null; maintenance: Maintenance | null }>({
    open: false,
    url: null,
    duration: null,
    maintenance: null,
  });
  const [selectedNotes, setSelectedNotes] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<any | null>(null);

  const mapMaintenanceToApprovalForm = (maintenance: Maintenance): ApprovalFormState => {
    const director = maintenance.directorApproval;
    if (director) {
      const directorItems = (director.items || []).map((item) => {
        const quantity = typeof item.quantity === "number" ? item.quantity : 1;
        const unitCost = typeof item.unitCost === "number" ? item.unitCost : (typeof item.cost === "number" ? item.cost : 0);
        return {
          id: createRandomId(),
          name: item.name,
          quantity: quantity.toString(),
          unitCost: unitCost ? unitCost.toFixed(2) : "",
        };
      });
      return {
        vendor: director.vendor || "",
        workshopLocation: director.workshopLocation || maintenance.workshopName || "",
        laborCost: typeof director.laborCost === "number" ? director.laborCost.toFixed(2) : "",
        phone: director.targetPhone || "",
        note: director.notes || "",
        items: directorItems.length ? directorItems : [createEmptyApprovalItem()],
      };
    }

    const derivedItems = (maintenance.items || [])
      .filter((item) => item.status)
      .map((item) => ({
        id: createRandomId(),
        name: item.name,
        quantity: "1",
        unitCost: typeof item.cost === "number" ? item.cost.toFixed(2) : "",
      }));

    return {
      vendor: "",
      workshopLocation: maintenance.workshopName || "",
      laborCost: typeof maintenance.laborCost === "number" ? maintenance.laborCost.toFixed(2) : "",
      phone: "",
      note: "",
      items: derivedItems.length ? derivedItems : [createEmptyApprovalItem()],
    };
  };

  const openApprovalModal = (maintenance: Maintenance) => {
    setApprovalModal({ open: true, maintenance });
    setApprovalForm(mapMaintenanceToApprovalForm(maintenance));
    setApprovalAttachments(mapExistingApprovalAttachments(maintenance.directorApproval?.attachments));
    setAttachmentsMarkedForDeletion([]);
    setHasCopiedPreview(false);
  };

  const closeApprovalModal = () => {
    setApprovalModal({ open: false, maintenance: null });
    setApprovalForm(createInitialApprovalForm());
    setApprovalAttachments([]);
    setAttachmentsMarkedForDeletion([]);
    setSavingApproval(false);
    setHasCopiedPreview(false);
  };

  const handleApprovalFieldChange = <K extends keyof ApprovalFormState>(field: K, value: ApprovalFormState[K]) => {
    setApprovalForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleApprovalItemChange = (itemId: string, field: keyof ApprovalFormItem, value: string) => {
    setApprovalForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    }));
  };

  const handleAddApprovalItem = () => {
    setApprovalForm((prev) => ({ ...prev, items: [...prev.items, createEmptyApprovalItem()] }));
  };

  const handleRemoveApprovalItem = (itemId: string) => {
    setApprovalForm((prev) => {
      if (prev.items.length === 1) return prev;
      return { ...prev, items: prev.items.filter((item) => item.id !== itemId) };
    });
  };

  const approvalItemsTotal = useMemo(() => {
    return approvalForm.items.reduce((sum, item) => {
      const { total } = computeItemValues(item);
      return sum + total;
    }, 0);
  }, [approvalForm.items]);

  const approvalLaborCost = useMemo(() => parseCurrencyInput(approvalForm.laborCost), [approvalForm.laborCost]);
  const approvalGrandTotal = useMemo(() => approvalItemsTotal + approvalLaborCost, [approvalItemsTotal, approvalLaborCost]);

  const approvalAttachmentsTotalSize = useMemo(() => {
    return approvalAttachments.reduce((sum, att) => sum + (att.size || 0), 0);
  }, [approvalAttachments]);

  const handleAttachmentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remainingSlots = MAX_APPROVAL_ATTACHMENTS - approvalAttachments.length;
    if (remainingSlots <= 0) {
      alert(`Você já anexou o máximo de ${MAX_APPROVAL_ATTACHMENTS} arquivos.`);
      return;
    }

    const filesToAdd = files.slice(0, remainingSlots);
    const invalidFiles = filesToAdd.filter(
      (file) => !ATTACHMENT_ALLOWED_TYPES.includes(file.type)
    );

    if (invalidFiles.length > 0) {
      alert(
        `Alguns arquivos não são permitidos. Tipos aceitos: PDF, DOC, DOCX e imagens.`
      );
      return;
    }

    const newItems: ApprovalAttachmentItem[] = filesToAdd.map((file) => ({
      id: createRandomId(),
      status: "new" as const,
      name: file.name,
      size: file.size,
      contentType: file.type,
      file,
    }));

    const projectedTotal = approvalAttachmentsTotalSize + newItems.reduce((sum, item) => sum + item.size, 0);
    if (projectedTotal > MAX_ATTACHMENT_BYTES) {
      alert(
        `O tamanho total dos anexos não pode ultrapassar ${formatBytes(MAX_ATTACHMENT_BYTES)}. Total atual: ${formatBytes(approvalAttachmentsTotalSize)}.`
      );
      return;
    }

    setApprovalAttachments((prev) => [...prev, ...newItems]);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const item = approvalAttachments.find((att) => att.id === id);
    if (!item) return;

    if (item.status === "existing" && item.storagePath) {
      const existing: DirectorApprovalAttachment = {
        name: item.name,
        url: item.url || "",
        size: item.size,
        contentType: item.contentType,
        storagePath: item.storagePath,
        uploadedAt: item.uploadedAt,
        uploadedBy: item.uploadedBy,
      };
      setAttachmentsMarkedForDeletion((prev) => [...prev, existing]);
    }

    setApprovalAttachments((prev) => prev.filter((att) => att.id !== id));
  };

  const normalizePhone = (value: string) => value.replace(/\D/g, "");

  const persistApproval = async (
    maintenance: Maintenance,
    extra?: Partial<DirectorApproval>
  ): Promise<DirectorApprovalAttachment[]> => {
    const phoneDigits = normalizePhone(approvalForm.phone);
    const vehicleLabel = getVehicleInfo(maintenance.vehicleId);
    const vehiclePlate = vehicleLabel.split("•")[0]?.trim() || maintenance.vehicleId || "";
    const slugBase = createAttachmentSlugBase(vehiclePlate, maintenance.id);

    const cleanedItems = approvalForm.items
      .filter((item) => item.name.trim() || item.unitCost.trim() || item.quantity.trim())
      .map((item) => {
        const { quantity, unitCost } = computeItemValues(item);
        return {
          name: item.name.trim() || "Item",
          quantity,
          unitCost,
          cost: quantity * unitCost,
        };
      });

    if (!cleanedItems.length) {
      throw new Error("Adicione pelo menos um item");
    }

    // 1. Upload new attachments to Firebase Storage
    const uploadedAttachments: DirectorApprovalAttachment[] = [];
    const newAttachments = approvalAttachments.filter((att) => att.status === "new" && att.file);

    for (const att of newAttachments) {
      if (!att.file) continue;
      try {
        const uploaded = await uploadApprovalAttachment(att.file, maintenance.id, {
          uploadedBy: profile?.id,
        });
        uploadedAttachments.push(uploaded);
      } catch (err) {
        console.error("Erro ao fazer upload de anexo:", err);
        throw new Error(`Erro ao enviar anexo "${att.name}". Tente novamente.`);
      }
    }

    // 2. Merge existing attachments (not marked for deletion) with newly uploaded
    const existingAttachments = approvalAttachments
      .filter((att) => att.status === "existing")
      .map((att) =>
        sanitizeAttachment({
          name: att.name,
          url: att.url,
          size: att.size,
          contentType: att.contentType,
          storagePath: att.storagePath,
          uploadedAt: att.uploadedAt,
          uploadedBy: att.uploadedBy,
        })
      );

    const sanitizedUploaded = uploadedAttachments.map((att) => sanitizeAttachment(att));
    const preliminaryAttachments = [...existingAttachments, ...sanitizedUploaded];

    const finalAttachments: DirectorApprovalAttachment[] = [];
    console.log("[Short URL] Processando anexos:", preliminaryAttachments.length);
    
    for (let index = 0; index < preliminaryAttachments.length; index += 1) {
      const attachment = preliminaryAttachments[index];
      console.log(`[Short URL] Anexo ${index + 1}:`, {
        hasUrl: !!attachment.url,
        hasShortUrl: !!attachment.shortUrl,
        hasSlug: !!attachment.slug,
        name: attachment.name
      });
      
      // Gerar short URL diretamente sem depender de Firebase Function
      if (attachment.url && (!attachment.shortUrl || !attachment.slug)) {
        const desiredSlug = `${slugBase}-${index + 1}`;
        const shortUrl = `https://app-frota-pwa.vercel.app/o/${desiredSlug}`;
        
        console.log(`[Short URL] Gerando short URL para anexo ${index + 1}:`, {
          slug: desiredSlug,
          shortUrl,
          originalUrl: attachment.url.substring(0, 100) + '...'
        });
        
        // Salvar no Firestore diretamente
        try {
          await setDoc(doc(db, 'attachmentLinks', desiredSlug), {
            slug: desiredSlug,
            url: attachment.url,
            maintenanceId: maintenance.id,
            attachmentName: attachment.name,
            vehiclePlate,
            updatedAt: new Date(),
            createdBy: profile?.id,
          });
          
          attachment.shortUrl = shortUrl;
          attachment.slug = desiredSlug;
          console.log(`[Short URL] ✅ Short URL criada com sucesso:`, shortUrl);
        } catch (error) {
          console.error("[Short URL] ❌ Falha ao registrar link curto para anexo", error);
        }
      } else {
        console.log(`[Short URL] Anexo ${index + 1} já tem short URL ou não tem URL original`);
      }
      finalAttachments.push(attachment);
    }
    
    console.log("[Short URL] Anexos finais:", finalAttachments.map(a => ({
      name: a.name,
      shortUrl: a.shortUrl,
      slug: a.slug
    })));

    const directorApprovalPayload: DirectorApproval = {
      status: "pending",
      requestedBy: profile?.id,
      requestedAt: new Date(),
      targetPhone: phoneDigits || null,
      vendor: approvalForm.vendor || undefined,
      workshopLocation: approvalForm.workshopLocation || undefined,
      laborCost: approvalLaborCost || undefined,
      items: cleanedItems,
      total: approvalGrandTotal || undefined,
      notes: approvalForm.note || undefined,
      deliveryMethod: "manual",
      ...extra,
    };

    if (finalAttachments.length) {
      directorApprovalPayload.attachments = finalAttachments;
    }

    // 3. Update Firestore with approval data
    await updateMaintenanceStatus(maintenance.id, "in_review", {
      directorApproval: directorApprovalPayload,
    });

    setApprovalAttachments(mapExistingApprovalAttachments(finalAttachments));

    // 4. Delete attachments marked for deletion from Storage
    for (const att of attachmentsMarkedForDeletion) {
      if (att.storagePath) {
        try {
          await deleteApprovalAttachment(att.storagePath);
        } catch (err) {
          console.warn("Erro ao remover anexo do storage:", err);
        }
      }
    }

    return finalAttachments;
  };

  const handleApprovalSubmit = async () => {
    if (!approvalModal.maintenance) return;

    setSavingApproval(true);
    try {
      // 1. Persist approval data and upload attachments
      const savedAttachments = await persistApproval(approvalModal.maintenance);

      // 2. Prepare email data for client launcher
      const maintenance = approvalModal.maintenance;
      const vehicleLabel = getVehicleInfo(maintenance.vehicleId);
      const driverName = getUserName(maintenance.userId);
      const requestTitle = getMaintenanceItems(maintenance);

      const previewText = approvalPreview;
      const subject = buildEmailSubject(vehicleLabel, driverName, requestTitle, approvalGrandTotal);
      const vehiclePlate = vehicleLabel.split("•")[0]?.trim() || "";
      const attachmentLines = savedAttachments.length
        ? savedAttachments
            .map((att, index) => {
              const baseLabel = vehiclePlate ? `Orçamento ${vehiclePlate}` : "Orçamento";
              const label = savedAttachments.length > 1 ? `${baseLabel} ${index + 1}` : baseLabel;
              const sizeLabel = att.size ? ` (${formatBytes(att.size)})` : "";
              const link = att.shortUrl || att.url;
              
              // Formato melhorado: nome do arquivo + tamanho + link curto
              if (link) {
                return `📄 ${label}${sizeLabel}\n   ${link}`;
              }
              return `📄 ${label}${sizeLabel}`;
            })
            .join("\n\n")
        : null;

      const emailBody = [
        "Olá diretoria 👋",
        "Segue abaixo o orçamento para análise e aprovação:",
        "",
        previewText,
        "",
        attachmentLines ? "📎 DOCUMENTOS ANEXOS:\n\n" + attachmentLines + "\n\n👆 Clique nos links acima para visualizar/baixar os orçamentos" : "",
        "",
        "Atenciosamente,",
        "Equipe App Frota 🚚",
      ]
        .filter(Boolean)
        .join("\n");

      openEmailClient({
        to: emailRecipients.to,
        cc: emailRecipients.cc,
        subject,
        body: emailBody,
      });

      closeApprovalModal();
    } catch (error: any) {
      console.error("Erro ao salvar solicitação de aprovação:", error);
      if (error?.message) {
        alert(error.message);
      } else if (error?.code === "permission-denied") {
        alert("Permissão negada para atualizar esta manutenção.");
      } else {
        alert("Erro ao salvar orçamento. Tente novamente.");
      }
    } finally {
      setSavingApproval(false);
    }
  };

  const handleCopyPreview = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setHasCopiedPreview(true);
    } catch (error) {
      console.error("Erro ao copiar mensagem:", error);
    }
  };

  useEffect(() => {
    setHasCopiedPreview(false);
  }, [approvalForm, approvalModal.open]);

  useEffect(() => {
    const unsub1 = listenMaintenances(
      filter === "all" ? {} : { status: filter },
      setItems
    );
    const unsub2 = listenUsers(setUsers);
    const unsub3 = listenAllVehicles({}, setVehicles);
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [filter]);

  const onChangeStatus = async (maintenance: Maintenance, status: MaintenanceStatus) => {
    if (status === "in_review") {
      openApprovalModal(maintenance);
      return;
    }

    if (status === "scheduled") {
      openTicketModal(maintenance);
      return;
    }
    if (status === "done") {
      const now = new Date();
      const currentDateTime = now.toISOString().slice(0, 16);
      const seedCost = typeof maintenance.finalCost === "number" ? maintenance.finalCost : maintenance.forecastedCost;
      
      // Usa a previsão de finalização se existir, senão usa a data atual
      const defaultDate = toInputDateTime(maintenance.forecastedCompletion) || currentDateTime;
      
      // Inicializar custos por item
      const itemCosts: Record<string, string> = {};
      maintenance.items?.forEach(item => {
        if (item.status && item.cost) {
          itemCosts[item.name] = item.cost.toString();
        }
      });
      
      setCompletionModal({
        open: true,
        maintenance,
        date: defaultDate,
        cost: seedCost ? seedCost.toString() : "",
        laborCost: maintenance.laborCost ? maintenance.laborCost.toString() : "",
        itemCosts,
        managerNote: maintenance.managerNote || ""
      });
      return;
    }
    // Optimistic UI update
    const previous = items;
    try {
      setItems((prev) => prev.map((it) => it.id === maintenance.id ? { ...it, status } : it));
      await updateMaintenanceStatus(maintenance.id, status, {
        managerId: profile?.id,
      });
    } catch (err: any) {
      // Revert on failure
      console.error("Erro ao atualizar status:", err);
      setItems(previous);
      // Mensagem específica para permissão negada
      if (err && err.code === 'permission-denied') {
        alert("Permissão negada: verifique se seu usuário tem role 'admin' na coleção users do Firestore.");
      } else {
        alert("Erro ao atualizar status. Verifique a conexão ou as permissões e tente novamente.");
      }
    }
  };

  const toInputDateTime = (value: any) => {
    if (!value) return "";
    const date = value?.toDate ? value.toDate() : value?.seconds ? new Date(value.seconds * 1000) : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 16);
  };

  const openTicketModal = (maintenance: Maintenance) => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    
    setTicketModal({ open: true, maintenance });
    setTicketForm({
      workshopName: maintenance.workshopName || "",
      scheduledFor: maintenance.scheduledFor || now.toISOString(),
      forecastedCompletion: maintenance.forecastedCompletion || oneHourLater.toISOString(),
      forecastedCost: maintenance.forecastedCost ? maintenance.forecastedCost.toString() : "",
      managerNote: maintenance.managerNote || "",
    });
  };

  const closeTicketModal = () => {
    setTicketModal({ open: false, maintenance: null });
    setTicketForm({ workshopName: "", scheduledFor: "", forecastedCompletion: "", forecastedCost: "", managerNote: "" });
    setSavingTicket(false);
  };

  const closeCompletionModal = () => {
    setCompletionModal({ open: false, maintenance: null, date: "", cost: "", laborCost: "", itemCosts: {}, managerNote: "" });
  };

  const handleTicketSubmit = async () => {
    if (!ticketModal.maintenance) {
      console.error('[TICKET] Nenhuma manutenção selecionada');
      return;
    }
    
    console.log('[TICKET] Iniciando salvamento do ticket');
    console.log('[TICKET] Dados do formulário:', ticketForm);
    console.log('[TICKET] Profile ID:', profile?.id);
    
    setSavingTicket(true);
    try {
      const scheduledDate = ticketForm.scheduledFor ? new Date(ticketForm.scheduledFor) : null;
      const forecastedDate = ticketForm.forecastedCompletion ? new Date(ticketForm.forecastedCompletion) : null;
      const forecastedCost = ticketForm.forecastedCost ? Number(ticketForm.forecastedCost) : null;
      
      console.log('[TICKET] Datas processadas:', { scheduledDate, forecastedDate, forecastedCost });
      
      // Constrói o payload removendo valores undefined (Firestore não aceita undefined)
      const payload: any = {
        managerId: profile?.id,
      };
      
      if (ticketForm.workshopName) payload.workshopName = ticketForm.workshopName;
      if (scheduledDate) payload.scheduledFor = scheduledDate;
      if (forecastedDate) payload.forecastedCompletion = forecastedDate;
      if (forecastedCost && !Number.isNaN(forecastedCost)) payload.forecastedCost = forecastedCost;
      if (ticketForm.managerNote) payload.managerNote = ticketForm.managerNote;
      
      console.log('[TICKET] Payload final:', payload);
      
      await updateMaintenanceStatus(ticketModal.maintenance.id, "scheduled", payload);
      
      console.log('[TICKET] Ticket salvo com sucesso!');
      closeTicketModal();
    } catch (error: any) {
      console.error("[TICKET] Erro ao salvar ticket:", error);
      console.error("[TICKET] Código do erro:", error?.code);
      console.error("[TICKET] Mensagem:", error?.message);
      
      // Mostra mensagem de erro específica para o usuário
      if (error?.code === 'permission-denied') {
        alert("❌ Permissão negada: Verifique se seu usuário tem role 'admin' no Firestore.");
      } else if (error?.code === 'unavailable') {
        alert("❌ Erro de conexão: Verifique sua internet e tente novamente.");
      } else {
        alert(`❌ Erro ao salvar ticket: ${error?.message || 'Erro desconhecido'}`);
      }
      
      setSavingTicket(false);
    }
  };

  const handleCompleteSubmit = async () => {
    if (!completionModal.maintenance) return;
    setCompleting(true);
    try {
      const completedDate = completionModal.date ? new Date(completionModal.date) : new Date();
      
      // Atualizar items com custos
      const updatedItems = completionModal.maintenance.items?.map(item => ({
        ...item,
        cost: item.status && completionModal.itemCosts[item.name] 
          ? Number(completionModal.itemCosts[item.name]) 
          : (item.cost || 0)
      }));
      
      // Calcular custos
      const laborCost = completionModal.laborCost ? Number(completionModal.laborCost) : 0;
      const partsCost = updatedItems?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
      const finalCost = laborCost + partsCost;
      
      await updateMaintenanceStatus(completionModal.maintenance.id, "done", {
        completedAt: completedDate,
        items: updatedItems,
        finalCost: finalCost > 0 ? finalCost : undefined,
        laborCost: laborCost > 0 ? laborCost : undefined,
        partsCost: partsCost > 0 ? partsCost : undefined,
        managerId: profile?.id,
        managerNote: completionModal.managerNote || undefined,
      });
      setCompletionModal({ open: false, maintenance: null, date: "", cost: "", laborCost: "", itemCosts: {}, managerNote: "" });
    } catch (error) {
      console.error("Erro ao finalizar manutenção", error);
    } finally {
      setCompleting(false);
    }
  };

  // Função para obter o nome do usuário pelo ID
  const userBranchMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((user) => {
      const normalized = (user.filial || "").trim();
      map.set(user.id, normalized || "--");
    });
    return map;
  }, [users]);

  const branchOptions = useMemo(() => {
    const unique = new Set<string>();
    users.forEach((user) => {
      const branch = (user.filial || "").trim();
      if (branch) {
        unique.add(branch);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [users]);

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || userId;
  };

  const getUserBranch = (userId: string) => {
    return userBranchMap.get(userId) || "--";
  };

  // Função para obter placa e modelo do veículo pelo ID
  const getVehicleInfo = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      return `${vehicle.plate} • ${vehicle.model}`;
    }
    return vehicleId;
  };

  // Função para formatar a data corretamente
  const formatDate = (dateField: any) => {
    if (!dateField) return "N/A";
    
    // Se for um Timestamp do Firestore (tem seconds)
    if (dateField.seconds) {
      return new Date(dateField.seconds * 1000).toLocaleString("pt-BR");
    }
    
    // Se for um objeto Date do Firestore (toDate)
    if (dateField.toDate) {
      return dateField.toDate().toLocaleString("pt-BR");
    }
    
    // Se for uma string ou Date normal
    return new Date(dateField).toLocaleString("pt-BR");
  };

  // Função para obter os itens marcados da manutenção
  const getMaintenanceItems = (m: Maintenance) => {
    // Pega os itens marcados (status: true)
    const checkedItems = m.items?.filter(item => item.status)?.map(item => item.name) || [];
    
    if (checkedItems.length > 0) {
      return checkedItems.join(", ");
    }
    
    return m.description || "Checklist de manutenção";
  };

  const getNotes = (m: Maintenance) => {
    return (m as any).notes || m.managerNote || "";
  };

  const getSortTime = (m: Maintenance) => {
    const source = m.createdAt || (m as any).date || m.updatedAt;
    if (!source) return 0;
    if ((source as any).seconds) return (source as any).seconds * 1000;
    if ((source as any).toDate) return (source as any).toDate().getTime();
    const date = new Date(source as any);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  const closeNotesModal = () => {
    setSelectedNotes(null);
    setSelectedTitle(null);
    setSelectedDate(null);
  };

  const openNotesModal = (m: Maintenance) => {
    const notes = getNotes(m);
    if (!notes) return;
    setSelectedNotes(notes);
    setSelectedTitle(getMaintenanceItems(m));
    setSelectedDate(m.createdAt || (m as any).date || null);
  };

  const formatDurationSeconds = (value?: number | null) => {
    if (value == null || Number.isNaN(value)) return "";
    const totalSeconds = Math.max(0, Math.round(value));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const filteredItems = useMemo(() => {
    return items.filter((maintenance) => {
      const branchMatches =
        branchFilter === "all" || (userBranchMap.get(maintenance.userId) || "--") === branchFilter;
      const statusMatches = filter === "all" || (maintenance.status || "pending") === filter;
      return branchMatches && statusMatches;
    });
  }, [items, branchFilter, userBranchMap, filter]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => getSortTime(b) - getSortTime(a));
  }, [filteredItems]);

  const approvalNote = approvalModal.maintenance ? getNotes(approvalModal.maintenance) : "";
  const approvalPhotos = approvalModal.maintenance?.photos || [];
  const approvalAudioUrl = approvalModal.maintenance?.audioUrl || null;
  const approvalAudioDuration = approvalModal.maintenance?.audioDurationSeconds || null;

  const approvalPreview = useMemo(() => {
    if (!approvalModal.maintenance) return "";
    const maintenance = approvalModal.maintenance;
    const driver = getUserName(maintenance.userId);
    const branch = getUserBranch(maintenance.userId);
    const vehicle = getVehicleInfo(maintenance.vehicleId);
    const requestTitle = getMaintenanceItems(maintenance);
    const itemsText = approvalForm.items
      .filter((item) => item.name.trim() || item.unitCost.trim() || item.quantity.trim())
      .map((item, index) => {
        const { quantity, unitCost, total } = computeItemValues(item);
        return `(${index + 1}) ${item.name.trim() || "Item"} • Qtde: ${formatQuantity(quantity)} • Unit: ${formatCurrency(unitCost)} • Total: ${formatCurrency(total)}`;
      })
      .join("\n");

    const lines = [
      "*Solicitação de aprovação de manutenção*",
      "",
      `Motorista: ${driver}`,
      `Filial: ${branch}`,
      `Veículo: ${vehicle}`,
      `Solicitação: ${requestTitle}`,
      approvalNote ? `Observação do motorista: ${approvalNote}` : "",
      approvalNote ? "------------------------------" : "",
      itemsText ? `*Itens do orçamento*\n${itemsText}` : "",
      `*Mão de obra:* ${formatCurrency(approvalLaborCost)}`,
      `*Total:* ${formatCurrency(approvalGrandTotal)}`,
      "",
      approvalForm.note ? `Obs gestor: ${approvalForm.note}` : "",
      approvalPhotos.length ? `Fotos anexas: ${approvalPhotos.length} arquivo(s).` : "",
      approvalAudioUrl || approvalAudioDuration
        ? `Áudio: ${approvalAudioUrl ? "disponível" : "registrado"}${
            approvalAudioDuration ? ` (${formatDurationSeconds(approvalAudioDuration)})` : ""
          }`
        : "",
      "Selecione uma opção: ✅ Aprovar | ❌ Não aprovar",
    ].filter(Boolean);

    return lines.join("\n");
  }, [
    approvalModal.maintenance,
    approvalForm.items,
    approvalForm.note,
    approvalLaborCost,
    approvalGrandTotal,
    approvalNote,
    approvalPhotos.length,
    approvalAudioUrl,
    approvalAudioDuration,
    getUserName,
    getUserBranch,
    getVehicleInfo,
  ]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-2xl font-bold">Manutenções</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="all">Todas as filiais</option>
              {branchOptions.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">Todas</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3">Solicitação</th>
                <th className="p-3">Motorista</th>
                <th className="p-3">Filial</th>
                <th className="p-3">Veículo</th>
                <th className="p-3">Status</th>
                <th className="p-3 w-40">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((m) => (
                <tr key={m.id} className={`border-t ${getDirectorHighlightClass(m.directorApproval)}`}>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-[#ffd300]/30 flex items-center justify-center text-[#0d2d6c]"><Wrench size={16} /></div>
                      <div>
                        <p className="font-medium truncate max-w-[340px]">{getMaintenanceItems(m)}</p>
                        {getNotes(m) && (
                          <p
                            className="text-gray-600 text-xs truncate max-w-[340px] cursor-pointer hover:underline"
                            onClick={() => openNotesModal(m)}
                            title="Clique para ver a observação completa"
                          >
                            Obs: {getNotes(m)}
                          </p>
                        )}
                        <p className="text-gray-400 text-xs">{formatDate(m.createdAt || (m as any).date)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{getUserName(m.userId)}</td>
                  <td className="p-3">{getUserBranch(m.userId)}</td>
                  <td className="p-3">{getVehicleInfo(m.vehicleId)}</td>
                  <td className="p-3">
                    <StatusBadge status={m.status || "pending"} />
                    {m.workshopName && (
                      <p className="text-xs text-gray-500 mt-1">Oficina: {m.workshopName}</p>
                    )}
                    {m.scheduledFor && (
                      <p className="text-xs text-gray-500">Agendado: {formatDate(m.scheduledFor)}</p>
                    )}
                    {m.forecastedCompletion && (
                      <p className="text-xs text-gray-500">Previsão: {formatDate(m.forecastedCompletion)}</p>
                    )}
                    {m.completedAt && (
                      <p className="text-xs text-gray-500">Finalizado: {formatDate(m.completedAt)}</p>
                    )}
                    {typeof m.finalCost === "number" && (
                      <p className="text-xs text-emerald-600 font-medium">Valor final: R$ {m.finalCost.toFixed(2)}</p>
                    )}
                    {typeof m.finalCost !== "number" && typeof m.forecastedCost === "number" && (
                      <p className="text-xs text-gray-500">Previsão de valor: R$ {m.forecastedCost.toFixed(2)}</p>
                    )}
                    {m.directorApproval && (
                      <div className="mt-2">
                        <DirectorApprovalBadge approval={m.directorApproval} />
                        {typeof m.directorApproval.total === "number" && (
                          <p className="text-[11px] text-gray-600 mt-1">
                            Orçamento: {formatCurrency(m.directorApproval.total)}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                      <div className="flex-shrink-0">
                        <select
                          value={m.status || "pending"}
                          onChange={(e) => onChangeStatus(m, e.target.value as MaintenanceStatus)}
                          className="w-36 h-10 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-semibold px-3"
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s}>{statusLabels[s]}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-2 flex-wrap mt-2 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => openApprovalModal(m)}
                          className="w-36 h-10 rounded-lg border border-green-600 text-green-700 text-xs font-semibold hover:bg-green-50"
                        >
                          {m.directorApproval ? "Editar orçamento" : "Solicitar aprovação"}
                        </button>
                        <button
                          type="button"
                          onClick={() => openTicketModal(m)}
                          className="w-36 h-10 rounded-lg border border-blue-600 text-blue-600 text-xs font-semibold hover:bg-blue-50"
                        >
                          {m.status === "scheduled" ? "Editar ticket" : "Abrir ticket"}
                        </button>

                        { (m as any).photos?.length ? (
                          <button
                            type="button"
                            onClick={() => setPhotoModal({ open: true, photos: (m as any).photos || [], maintenance: m })}
                            className="w-36 h-10 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50"
                          >
                            Ver fotos ({(m as any).photos.length})
                          </button>
                        ) : null}

                        {(m as any).audioUrl ? (
                          <button
                            type="button"
                            onClick={() => setAudioModal({ open: true, url: (m as any).audioUrl || null, duration: (m as any).audioDurationSeconds ?? null, maintenance: m })}
                            className="w-36 h-10 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50"
                          >
                            Ouvir áudio
                          </button>
                        ) : (m as any).audioDurationSeconds ? (
                          <div className="text-xs text-gray-500 flex items-center h-10">Áudio enviado offline</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={5}>Nenhuma solicitação encontrada</td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
            {/* Audio modal */}
            {audioModal.open && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl w-full max-w-md p-5 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-gray-800">Áudio do motorista</h3>
                    <button onClick={() => setAudioModal({ open: false, url: null, duration: null, maintenance: null })} className="p-1 text-gray-400 hover:text-gray-600"><ChevronDown size={18} /></button>
                  </div>
                  <div className="space-y-4">
                    {audioModal.url ? (
                      <div>
                        <audio controls src={audioModal.url} className="w-full" />
                        {typeof audioModal.duration === "number" && (
                          <p className="text-[12px] text-gray-500 mt-2">Duração: {formatDate(audioModal.duration)}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">Áudio ainda não disponível (pendente de sincronização).</p>
                    )}
                    <div className="flex justify-end">
                      <button onClick={() => setAudioModal({ open: false, url: null, duration: null, maintenance: null })} className="px-4 py-2 rounded bg-gray-200">Fechar</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedNotes && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedTitle || "Observação da solicitação"}
                    </h3>
                    {selectedDate && (
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(selectedDate)}
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap mb-6 max-h-72 overflow-y-auto">
                    {selectedNotes}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={closeNotesModal}
                      className="rounded-lg bg-[#0d2d6c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b2559]"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            )}

          {/* Layout mobile */}
          <div className="md:hidden divide-y border-t">
            {sortedItems.length === 0 && (
              <p className="p-6 text-center text-gray-500">Nenhuma solicitação encontrada</p>
            )}
            {sortedItems.map((m) => (
              <div key={`card-${m.id}`} className={`p-4 space-y-3 ${getDirectorHighlightClass(m.directorApproval)}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#ffd300]/30 flex items-center justify-center text-[#0d2d6c]">
                    <Wrench size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#0d2d6c] leading-tight">{getMaintenanceItems(m)}</p>
                    {getNotes(m) && (
                      <p
                        className="text-xs text-gray-600 truncate cursor-pointer hover:underline"
                        onClick={() => openNotesModal(m)}
                        title="Clique para ver a observação completa"
                      >
                        Obs: {getNotes(m)}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400">{formatDate(m.createdAt || (m as any).date)}</p>
                  </div>
                  <StatusBadge status={m.status || "pending"} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                  <div>
                    <p className="font-semibold text-gray-500">Motorista</p>
                    <p className="text-sm text-gray-800">{getUserName(m.userId)}</p>
                    <p className="text-[11px] text-gray-400">Filial: {getUserBranch(m.userId)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-500">Veículo</p>
                    <p className="text-sm text-gray-800 leading-tight">{getVehicleInfo(m.vehicleId)}</p>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-gray-600">
                  {m.workshopName && <p>Oficina: <strong>{m.workshopName}</strong></p>}
                  {m.scheduledFor && <p>Agendado: {formatDate(m.scheduledFor)}</p>}
                  {m.forecastedCompletion && <p>Previsão: {formatDate(m.forecastedCompletion)}</p>}
                  {m.completedAt && <p>Finalizado: {formatDate(m.completedAt)}</p>}
                  {(m as any).audioUrl ? (
                    <div className="mt-2">
                      <audio controls src={(m as any).audioUrl} className="w-full" preload="none" />
                      {typeof (m as any).audioDurationSeconds === "number" && (
                        <p className="text-[10px] text-gray-500">Duração: {formatDurationSeconds((m as any).audioDurationSeconds)}</p>
                      )}
                    </div>
                  ) : (m as any).audioDurationSeconds ? (
                    <p className="mt-2 text-[10px] text-gray-500">Áudio enviado offline</p>
                  ) : null}
                  {typeof m.finalCost === "number" && (
                    <p className="text-emerald-600 font-semibold">Valor final: R$ {m.finalCost.toFixed(2)}</p>
                  )}
                  {typeof m.finalCost !== "number" && typeof m.forecastedCost === "number" && (
                    <p>Previsão de valor: R$ {m.forecastedCost.toFixed(2)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <select
                      value={m.status || "pending"}
                      onChange={(e) => onChangeStatus(m, e.target.value as MaintenanceStatus)}
                      className="w-full appearance-none border rounded-lg px-3 py-2 pr-9 text-sm"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>{statusLabels[s]}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => openApprovalModal(m)}
                      className="flex-1 inline-flex items-center justify-center rounded-md border border-green-600 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50"
                    >
                      {m.directorApproval ? "Editar orçamento" : "Solicitar aprovação"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openTicketModal(m)}
                      className="flex-1 inline-flex items-center justify-center rounded-md border border-[#0d2d6c] px-3 py-2 text-xs font-semibold text-[#0d2d6c] hover:bg-[#0d2d6c]/10"
                    >
                      {m.status === "scheduled" ? "Editar ticket" : "Abrir ticket"}
                    </button>
                    {m.photos?.length ? (
                      <button
                        type="button"
                        onClick={() => setPhotoModal({ open: true, photos: m.photos || [], maintenance: m })}
                        className="flex-1 inline-flex items-center justify-center rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        Ver fotos ({m.photos.length})
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {approvalModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">Solicitar aprovação da diretoria</h3>
                {approvalModal.maintenance && (
                  <div className="text-sm text-gray-600 space-y-3">
                    <div className="space-y-1">
                      <p>
                        Motorista: <strong>{getUserName(approvalModal.maintenance.userId)}</strong> • Filial: {getUserBranch(approvalModal.maintenance.userId)} • Veículo: {getVehicleInfo(approvalModal.maintenance.vehicleId)}
                      </p>
                      {approvalNote && (
                        <p className="text-gray-700">
                          <span className="font-semibold text-gray-600">Observação do motorista:</span> {approvalNote}
                        </p>
                      )}
                    </div>
                    {(approvalPhotos.length > 0 || approvalAudioUrl) && (
                      <div className="flex flex-col gap-3">
                        {approvalPhotos.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">Fotos anexas ({approvalPhotos.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {approvalPhotos.slice(0, 4).map((url, idx) => (
                                <button
                                  type="button"
                                  key={`${url}-${idx}`}
                                  onClick={() => setPhotoModal({ open: true, photos: approvalPhotos, maintenance: approvalModal.maintenance })}
                                  className="w-16 h-16 rounded-lg border border-gray-200 overflow-hidden bg-white hover:shadow"
                                >
                                  <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                                </button>
                              ))}
                              {approvalPhotos.length > 4 && (
                                <div className="w-16 h-16 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-500">
                                  +{approvalPhotos.length - 4}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {approvalAudioUrl && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Áudio enviado</p>
                            <audio controls className="w-full max-w-sm" src={approvalAudioUrl} />
                            {typeof approvalAudioDuration === "number" && (
                              <p className="text-[11px] text-gray-500 mt-1">Duração: {formatDurationSeconds(approvalAudioDuration)}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={closeApprovalModal}
                className="rounded-md border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Fornecedor (peças)</label>
                  <input
                    type="text"
                    value={approvalForm.vendor}
                    onChange={(e) => handleApprovalFieldChange("vendor", e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2d6c]"
                    placeholder="Empresa responsável pela compra"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Local da oficina</label>
                  <input
                    type="text"
                    value={approvalForm.workshopLocation}
                    onChange={(e) => handleApprovalFieldChange("workshopLocation", e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2d6c]"
                    placeholder="Ex: Oficina Centro"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-400">Telefone do diretor (WhatsApp)</label>
                  <input
                    type="tel"
                    value={approvalForm.phone}
                    readOnly
                    disabled
                    className="mt-1 w-full rounded-lg border bg-gray-100 px-3 py-2 text-sm text-gray-500"
                    placeholder="Automação desativada no momento"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Campo usado apenas quando a automação via Z-API estiver ativa.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Mão de obra (R$)</label>
                  <div className="mt-1 flex items-center rounded-lg border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-[#0d2d6c]">
                    <span className="text-gray-400 mr-2">R$</span>
                    <input
                      type="text"
                      value={approvalForm.laborCost}
                      onChange={(e) => handleApprovalFieldChange("laborCost", e.target.value)}
                      className="w-full bg-transparent focus:outline-none"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-700">Itens do orçamento</label>
                  <button
                    type="button"
                    onClick={handleAddApprovalItem}
                    className="text-xs font-semibold text-[#0d2d6c] hover:underline"
                  >
                    + Adicionar item
                  </button>
                </div>
                <div className="mt-2 space-y-3">
                  {approvalForm.items.map((item) => {
                    const { total } = computeItemValues(item);
                    return (
                      <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-lg border p-3">
                        <div className="md:col-span-5">
                          <label className="text-[11px] font-semibold text-gray-500">Descrição</label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleApprovalItemChange(item.id, "name", e.target.value)}
                            className="mt-1 w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#0d2d6c]"
                            placeholder="Nome do item"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[11px] font-semibold text-gray-500">Qtde</label>
                          <input
                            type="text"
                            value={item.quantity}
                            onChange={(e) => handleApprovalItemChange(item.id, "quantity", e.target.value)}
                            className="mt-1 w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#0d2d6c]"
                            placeholder="1"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[11px] font-semibold text-gray-500">Unit (R$)</label>
                          <input
                            type="text"
                            value={item.unitCost}
                            onChange={(e) => handleApprovalItemChange(item.id, "unitCost", e.target.value)}
                            className="mt-1 w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#0d2d6c]"
                            placeholder="0,00"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[11px] font-semibold text-gray-500">Total (R$)</label>
                          <div className="mt-1 w-full rounded border bg-gray-50 px-2 py-1 text-sm text-gray-700 font-medium">
                            {formatCurrency(total)}
                          </div>
                        </div>
                        <div className="md:col-span-1 flex items-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveApprovalItem(item.id)}
                            className="w-full h-9 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center"
                            disabled={approvalForm.items.length === 1}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Observações para o diretor</label>
                <textarea
                  value={approvalForm.note}
                  onChange={(e) => handleApprovalFieldChange("note", e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2d6c]"
                  rows={3}
                  placeholder="Detalhes adicionais relevantes para aprovação"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">Subtotal de itens</span>
                    <span>{formatCurrency(approvalItemsTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">Mão de obra</span>
                    <span>{formatCurrency(approvalLaborCost)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-blue-200 pt-2">
                    <span>Total previsto</span>
                    <span className="text-[#0d2d6c]">{formatCurrency(approvalGrandTotal)}</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Anexos do orçamento</span>
                    <span className="text-xs text-gray-500">
                      {approvalAttachments.length}/{MAX_APPROVAL_ATTACHMENTS} • {formatBytes(approvalAttachmentsTotalSize)}/{formatBytes(MAX_ATTACHMENT_BYTES)}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {approvalAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs"
                      >
                        <Paperclip size={14} className="text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-700 truncate">{att.name}</p>
                          <p className="text-gray-500">{formatBytes(att.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="text-red-500 hover:text-red-700 flex-shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {approvalAttachments.length < MAX_APPROVAL_ATTACHMENTS && (
                    <div>
                      <input
                        ref={attachmentInputRef}
                        type="file"
                        accept={ATTACHMENT_ACCEPT_ATTRIBUTE}
                        multiple
                        onChange={handleAttachmentSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => attachmentInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 text-sm font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50"
                      >
                        <Paperclip size={16} />
                        Anexar arquivos (PDF, DOC, imagens)
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Prévia da mensagem</span>
                    <button
                      type="button"
                      onClick={() => handleCopyPreview(approvalPreview)}
                      className="text-xs font-semibold text-[#0d2d6c] hover:underline"
                    >
                      Copiar texto
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={approvalPreview}
                    className="w-full rounded-lg border px-3 py-2 text-xs text-gray-700 bg-white focus:outline-none"
                    rows={approvalPreview.split("\n").length < 8 ? 8 : undefined}
                  />
                  {hasCopiedPreview && (
                    <p className="text-[11px] text-emerald-600">Copiado! Cole no WhatsApp enquanto a automação não estiver ativa.</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-start">
                  <button
                    type="button"
                    onClick={handleApprovalSubmit}
                    className="rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-60 flex items-center gap-2"
                    disabled={savingApproval}
                  >
                    {savingApproval && <Loader2 size={16} className="animate-spin" />}
                    {savingApproval ? "Salvando e enviando..." : "Salvar orçamento"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={closeApprovalModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600"
                  disabled={savingApproval}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {ticketModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-1">{ticketModal.maintenance?.status === "scheduled" ? "Editar ticket" : "Abrir ticket"}</h3>
            <p className="text-sm text-gray-500 mb-4">Informe a oficina e a data programada para que o motorista acompanhe o processo.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">Oficina</label>
                <input
                  type="text"
                  value={ticketForm.workshopName}
                  onChange={(e) => setTicketForm((prev) => ({ ...prev, workshopName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2d6c]"
                  placeholder="Ex: Oficina Centro"
                />
              </div>

              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium">Data/Hora agendada</label>
                <DateTimePicker
                  selected={ticketForm.scheduledFor}
                  onChange={(date) => setTicketForm(prev => ({ ...prev, scheduledFor: date }))}
                  minDate={new Date()}
                />
              </div>

              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium">Previsão de finalização</label>
                <DateTimePicker
                  selected={ticketForm.forecastedCompletion}
                  onChange={(date) => setTicketForm(prev => ({ ...prev, forecastedCompletion: date }))}
                  minDate={ticketForm.scheduledFor ? new Date(ticketForm.scheduledFor) : new Date()}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Previsão de valor</label>
                <div className="mt-1 flex items-center rounded-lg border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-[#0d2d6c]">
                  <span className="text-gray-400 mr-2">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ticketForm.forecastedCost}
                    onChange={(e) => setTicketForm((prev) => ({ ...prev, forecastedCost: e.target.value }))}
                    className="w-full bg-transparent focus:outline-none"
                    placeholder="0,00"
                  />
                </div>
              </div>

            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeTicketModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600"
                disabled={savingTicket}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleTicketSubmit}
                className="rounded-lg bg-[#0d2d6c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b2559] disabled:opacity-60"
                disabled={savingTicket}
              >
                {savingTicket ? "Salvando..." : "Salvar ticket"}
              </button>
            </div>
          </div>
        </div>
      )}

      {completionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-1">Finalizar manutenção</h3>
            <p className="text-sm text-gray-500 mb-4">Informe os custos e data de finalização.</p>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium">Data/Hora da finalização</label>
                <DateTimePicker
                  selected={completionModal.date}
                  onChange={(date) => setCompletionModal(prev => ({ ...prev, date }))}
                  maxDate={new Date()}
                />
              </div>

              {/* Custos por item */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block">Custos por serviço realizado</label>
                <div className="space-y-2 bg-gray-50 p-3 rounded-lg">
                  {completionModal.maintenance?.items?.filter(item => item.status).map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span className="text-sm flex-1">{item.name}</span>
                      <div className="flex items-center rounded-lg border bg-white px-2 py-1 text-sm w-32">
                        <span className="text-gray-400 mr-1 text-xs">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={completionModal.itemCosts[item.name] || ""}
                          onChange={(e) => setCompletionModal(prev => ({
                            ...prev,
                            itemCosts: { ...prev.itemCosts, [item.name]: e.target.value }
                          }))}
                          className="w-full bg-transparent focus:outline-none text-sm"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mão de obra */}
              <div>
                <label className="text-xs font-semibold text-gray-600">Mão de obra</label>
                <div className="mt-1 flex items-center rounded-lg border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-[#0d2d6c]">
                  <span className="text-gray-400 mr-2">R$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={completionModal.laborCost}
                    onChange={(e) => setCompletionModal((prev) => ({ ...prev, laborCost: e.target.value }))}
                    className="w-full bg-transparent focus:outline-none"
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Total calculado */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Total de peças:</span>
                  <span>R$ {Object.values(completionModal.itemCosts).reduce((sum, val) => sum + (Number(val) || 0), 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="font-semibold">Mão de obra:</span>
                  <span>R$ {(Number(completionModal.laborCost) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-blue-200">
                  <span>Total final:</span>
                  <span className="text-[#0d2d6c]">
                    R$ {(
                      Object.values(completionModal.itemCosts).reduce((sum, val) => sum + (Number(val) || 0), 0) +
                      (Number(completionModal.laborCost) || 0)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-semibold text-gray-600">Observação</label>
                <textarea
                  value={completionModal.managerNote}
                  onChange={(e) => setCompletionModal(prev => ({ ...prev, managerNote: e.target.value }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d2d6c]"
                  rows={3}
                  placeholder="Informações adicionais sobre a manutenção"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCompletionModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600"
                disabled={completing}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCompleteSubmit}
                className="rounded-lg bg-[#0d2d6c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b2559] disabled:opacity-60"
                disabled={completing}
              >
                {completing ? "Finalizando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {photoModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Fotos da manutenção</h3>
                {photoModal.maintenance && (
                  <p className="text-sm text-gray-500">{getMaintenanceItems(photoModal.maintenance)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPhotoModal({ open: false, photos: [], maintenance: null })}
                className="rounded-md border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>

            {photoModal.photos.length ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photoModal.photos.map((url, idx) => (
                  <a
                    key={`${url}-${idx}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border bg-gray-50 p-2 hover:border-[#0d2d6c]"
                  >
                    <img
                      src={url}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-40 object-contain"
                    />
                    <p className="mt-2 text-xs text-gray-500 text-center">Abrir em nova aba</p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Nenhuma foto disponível.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const StatusBadge = ({ status }: { status: MaintenanceStatus }) => {
  const map: Record<MaintenanceStatus, string> = {
    pending: "bg-orange-100 text-orange-800",
    in_review: "bg-blue-100 text-blue-800",
    scheduled: "bg-purple-100 text-purple-800",
    done: "bg-emerald-100 text-emerald-800",
  };
  return <span className={`px-2 py-1 rounded-md text-xs font-medium ${map[status]}`}>{statusLabels[status]}</span>;
};

const directorStatusLabels: Record<DirectorApproval["status"], { label: string; className: string }> = {
  pending: { label: "Aguardando diretoria", className: "bg-yellow-100 text-yellow-800" },
  approved: { label: "Aprovado pela diretoria", className: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Reprovado pela diretoria", className: "bg-red-100 text-red-700" },
};

const DirectorApprovalBadge = ({ approval }: { approval: DirectorApproval }) => {
  const data = directorStatusLabels[approval.status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium ${data.className}`}>
      {data.label}
    </span>
  );
};

export default AdminMaintenancePage;
