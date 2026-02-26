const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  admin.initializeApp({
    credential: serviceAccount 
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'app-frota-1ce38'
  });
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { to, cc, subject, body, attachments } = req.body;

    if (!to || !subject || !body) {
      res.status(400).json({ error: 'Campos obrigatórios: to, subject, body' });
      return;
    }

    // Usar Resend para enviar email com anexos
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
      res.status(500).json({ error: 'RESEND_API_KEY não configurada' });
      return;
    }

    // Preparar anexos (baixar de Firebase Storage)
    const processedAttachments = [];
    
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        try {
          // Baixar arquivo do Firebase Storage URL
          const response = await fetch(att.url);
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          
          processedAttachments.push({
            filename: att.name || 'anexo.pdf',
            content: base64,
            type: att.contentType || 'application/pdf',
          });
        } catch (error) {
          console.error('Erro ao processar anexo:', error);
        }
      }
    }

    // Enviar email via Resend
    const emailPayload = {
      from: 'App Frota <onboarding@resend.dev>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html: body.replace(/\n/g, '<br>'),
      attachments: processedAttachments,
    };

    if (cc && cc.length > 0) {
      emailPayload.cc = cc;
    }

    console.log('[Email] Enviando para Resend:', {
      to: emailPayload.to,
      subject: emailPayload.subject,
      attachmentCount: processedAttachments.length
    });

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const result = await resendResponse.json();

    console.log('[Email] Resposta Resend:', {
      status: resendResponse.status,
      ok: resendResponse.ok,
      result
    });

    if (!resendResponse.ok) {
      console.error('[Email] Erro Resend:', result);
      res.status(500).json({ error: 'Erro ao enviar email', details: result });
      return;
    }

    res.status(200).json({ 
      success: true, 
      messageId: result.id,
      attachmentCount: processedAttachments.length 
    });

  } catch (error) {
    console.error('Erro ao enviar email:', error);
    res.status(500).json({ error: error.message });
  }
};
