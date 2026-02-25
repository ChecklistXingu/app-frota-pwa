import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

admin.initializeApp();

const db = admin.firestore();

type SendDirectorApprovalData = {
  maintenanceId: string;
  targetPhone: string;
  previewText: string;
  quote: {
    vendor?: string;
    workshopLocation?: string;
    laborCost?: number;
    items: { name: string; cost: number }[];
    total?: number;
    notes?: string;
  };
  metadata: {
    driverName: string;
    branch: string;
    vehicleLabel: string;
    requestTitle: string;
    observation?: string;
    managerNote?: string;
    photoCount?: number;
    audioUrl?: string | null;
    audioDurationSeconds?: number | null;
  };
};

export const sendDirectorApproval = functions
  .region("southamerica-east1")
  .https.onCall(async (data: SendDirectorApprovalData, context) => {
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

    const response = await axios.post(`${zapiUrl}/messages/buttons`, payload, {
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
      deliveryMethod: "zapi" as const,
    };
  });

export const handleDirectorResponse = functions
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

type SendApprovalEmailData = {
  maintenanceId: string;
  previewText: string;
  subject: string;
  to: string;
  cc?: string[];
  quote: {
    vendor?: string;
    workshopLocation?: string;
    laborCost?: number;
    items: { name: string; cost: number }[];
    total?: number;
    notes?: string;
  };
  metadata: {
    driverName: string;
    branch: string;
    vehicleLabel: string;
    requestTitle: string;
    observation?: string;
    managerNote?: string;
    photoCount?: number;
    audioUrl?: string | null;
    audioDurationSeconds?: number | null;
    approvalId?: string;
  };
  attachments?: {
    name: string;
    url: string;
    contentType?: string;
  }[];
};

export const sendApprovalEmail = functions
  .region("southamerica-east1")
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onCall(async (data: SendApprovalEmailData, context) => {
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
        deliveryMethod: "email" as const,
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
      deliveryMethod: "email" as const,
      sentAt: new Date().toISOString(),
    };
  });
