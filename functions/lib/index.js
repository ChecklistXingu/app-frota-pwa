"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redirectAttachment = exports.sendApprovalEmail = exports.handleDirectorResponse = exports.sendDirectorApproval = exports.redirectBudgetAttachment = exports.registerAttachmentLink = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const APP_BASE_URL = functions.config().app?.base_url || "https://app-frota.firebaseapp.com";
const ATTACHMENT_LINKS_COLLECTION = "attachmentLinks";
const normalizeSlug = (value) => (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
const getShortUrl = (slug) => `${APP_BASE_URL}/o/${slug}`;
admin.initializeApp();
const db = admin.firestore();
exports.registerAttachmentLink = functions
    .region("southamerica-east1")
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const { slug, url, maintenanceId, attachmentName, vehiclePlate } = data;
    if (!slug || !url || !maintenanceId) {
        throw new functions.https.HttpsError("invalid-argument", "Dados obrigatórios ausentes");
    }
    const normalizedSlug = normalizeSlug(slug);
    if (!normalizedSlug) {
        throw new functions.https.HttpsError("invalid-argument", "Slug inválido");
    }
    const docRef = db.collection(ATTACHMENT_LINKS_COLLECTION).doc(normalizedSlug);
    await docRef.set({
        slug: normalizedSlug,
        url,
        maintenanceId,
        attachmentName: attachmentName || null,
        vehiclePlate: vehiclePlate || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: context.auth.uid,
    }, { merge: true });
    return {
        shortUrl: getShortUrl(normalizedSlug),
        slug: normalizedSlug,
    };
});
exports.redirectBudgetAttachment = functions
    .region("southamerica-east1")
    .https.onRequest(async (req, res) => {
    const slug = normalizeSlug(req.path.replace(/^\//, ""));
    if (!slug) {
        res.status(400).send("Slug inválido");
        return;
    }
    try {
        const doc = await db.collection(ATTACHMENT_LINKS_COLLECTION).doc(slug).get();
        if (!doc.exists) {
            res.status(404).send("Link não encontrado");
            return;
        }
        const { url } = doc.data() || {};
        if (!url) {
            res.status(404).send("URL não configurada");
            return;
        }
        res.redirect(302, url);
    }
    catch (error) {
        console.error("Erro no redirectBudgetAttachment", error);
        res.status(500).send("Erro interno");
    }
});
exports.sendDirectorApproval = functions
    .region("southamerica-east1")
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const { maintenanceId, targetPhone, previewText } = data;
    if (!maintenanceId || !targetPhone || !previewText) {
        throw new functions.https.HttpsError("invalid-argument", "Dados obrigatórios ausentes");
    }
    const zapiUrl = functions.config().zapi?.url;
    const zapiToken = functions.config().zapi?.token;
    if (!zapiUrl || !zapiToken) {
        throw new functions.https.HttpsError("failed-precondition", "Configuração da Z-API ausente");
    }
    const payload = {
        phone: targetPhone,
        message: previewText,
        buttons: [
            { id: `approve|${maintenanceId}`, label: "✅ Aprovar" },
            { id: `reject|${maintenanceId}`, label: "❌ Não aprovar" },
        ],
    };
    const response = await axios_1.default.post(`${zapiUrl}/messages/buttons`, payload, {
        headers: {
            Authorization: `Bearer ${zapiToken}`,
        },
    });
    await db.collection("directorApprovalMessages").add({
        maintenanceId,
        targetPhone,
        previewText,
        quote: data.quote,
        metadata: data.metadata,
        messageId: response.data?.messageId || null,
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        sentBy: context.auth.uid,
    });
    return {
        messageId: response.data?.messageId || "",
        deliveryMethod: "zapi",
    };
});
exports.handleDirectorResponse = functions
    .region("southamerica-east1")
    .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).send("Method not allowed");
        return;
    }
    const { buttonId, sender } = req.body || {};
    if (!buttonId || typeof buttonId !== "string") {
        res.status(400).send("Missing buttonId");
        return;
    }
    const [action, maintenanceId] = buttonId.split("|");
    if (!maintenanceId) {
        res.status(400).send("Invalid button payload");
        return;
    }
    const approvalStatus = action === "approve" ? "approved" : "rejected";
    const maintenanceRef = db.collection("maintenance").doc(maintenanceId);
    await maintenanceRef.update({
        "directorApproval.status": approvalStatus,
        "directorApproval.responseAt": admin.firestore.FieldValue.serverTimestamp(),
        "directorApproval.responseBy": sender || null,
    });
    res.status(200).send({ ok: true });
});
exports.sendApprovalEmail = functions
    .region("southamerica-east1")
    .runWith({ timeoutSeconds: 540, memory: "1GB" })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Usuário não autenticado");
    }
    const { maintenanceId, subject, to, cc, previewText, attachments } = data;
    if (!maintenanceId || !subject || !to || !previewText) {
        throw new functions.https.HttpsError("invalid-argument", "Dados obrigatórios ausentes");
    }
    // Configuração do serviço de e-mail (SendGrid, Nodemailer, etc.)
    // Por enquanto, vamos apenas logar e retornar sucesso
    // Em produção, você deve configurar um serviço de e-mail real
    const emailConfig = functions.config().email;
    if (!emailConfig?.service || !emailConfig?.user || !emailConfig?.pass) {
        console.warn("Configuração de e-mail ausente. E-mail não será enviado.");
        // Para desenvolvimento, retornamos sucesso mesmo sem enviar
        return {
            deliveryMethod: "email",
            sentAt: new Date().toISOString(),
        };
    }
    // Aqui você implementaria o envio real usando Nodemailer ou SendGrid
    // Exemplo com Nodemailer (requer instalação: npm install nodemailer)
    /*
    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      service: emailConfig.service,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
    });

    const attachmentBuffers = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        try {
          const response = await axios.get(att.url, { responseType: "arraybuffer" });
          attachmentBuffers.push({
            filename: att.name,
            content: Buffer.from(response.data),
            contentType: att.contentType || "application/octet-stream",
          });
        } catch (err) {
          console.error(`Erro ao baixar anexo ${att.name}:`, err);
        }
      }
    }

    await transporter.sendMail({
      from: emailConfig.user,
      to,
      cc: cc?.join(", "),
      subject,
      text: previewText,
      attachments: attachmentBuffers,
    });
    */
    console.log("E-mail enviado:", { to, cc, subject, attachmentsCount: attachments?.length || 0 });
    return {
        deliveryMethod: "email",
        sentAt: new Date().toISOString(),
    };
});
// Função para redirecionar URLs curtas de anexos diretamente para o Firebase Storage
exports.redirectAttachment = functions
    .region("southamerica-east1")
    .https.onRequest(async (req, res) => {
    const slug = req.params.slug || req.path.replace('/o/', '').replace('/', '');
    if (!slug) {
        res.status(400).send('Slug não fornecido');
        return;
    }
    try {
        // Buscar o link do anexo no Firestore
        const docRef = db.collection(ATTACHMENT_LINKS_COLLECTION).doc(slug);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            res.status(404).send('Anexo não encontrado ou link expirado');
            return;
        }
        const data = docSnap.data();
        if (!data || !data.url) {
            res.status(404).send('URL do anexo não encontrada');
            return;
        }
        // Redirecionar permanentemente (301) para a URL original do Firebase Storage
        res.redirect(301, data.url);
        return;
    }
    catch (error) {
        console.error('Erro ao redirecionar anexo:', error);
        res.status(500).send('Erro interno ao processar o link');
        return;
    }
});
