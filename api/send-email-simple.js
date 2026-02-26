export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, cc, subject, body, attachments } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: to, subject, body',
        received: { to, subject, body }
      });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
      return res.status(500).json({ 
        error: 'RESEND_API_KEY não configurada',
        envKeys: Object.keys(process.env).filter(k => k.includes('RESEND'))
      });
    }

    console.log('[Email] Dados:', { 
      to, 
      subject, 
      hasAttachments: !!attachments?.length,
      attachmentCount: attachments?.length || 0
    });

    // Por enquanto, enviar SEM anexos para testar
    const emailPayload = {
      from: 'App Frota <onboarding@resend.dev>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html: body.replace(/\n/g, '<br>')
    };

    if (cc && cc.length > 0) {
      emailPayload.cc = cc;
    }

    // Processar anexos
    const processedAttachments = [];
    
    if (attachments && attachments.length > 0) {
      console.log('[Email] Processando anexos:', attachments.length);
      
      for (const att of attachments) {
        try {
          console.log('[Email] Baixando anexo:', att.name, att.url);
          
          // Baixar arquivo do Firebase Storage
          const fileResponse = await fetch(att.url);
          if (!fileResponse.ok) {
            throw new Error(`Falha ao baixar anexo: ${fileResponse.status}`);
          }
          
          const buffer = await fileResponse.arrayBuffer();
          const base64 = Buffer.from(buffer).toString('base64');
          
          processedAttachments.push({
            filename: att.name || 'anexo.pdf',
            content: base64,
            type: att.contentType || 'application/pdf',
          });
          
          console.log('[Email] Anexo processado:', att.name);
        } catch (error) {
          console.error('[Email] Erro ao processar anexo:', error);
        }
      }
    }

    // Adicionar anexos ao payload
    if (processedAttachments.length > 0) {
      emailPayload.attachments = processedAttachments;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text };
    }

    console.log('[Email] Resposta Resend:', { 
      status: response.status, 
      ok: response.ok, 
      result 
    });

    if (!response.ok) {
      return res.status(500).json({ 
        error: 'Erro ao enviar email', 
        details: result,
        status: response.status
      });
    }

    return res.status(200).json({ 
      success: true, 
      messageId: result.id,
      message: 'Email enviado com sucesso!',
      attachmentCount: attachments?.length || 0
    });

  } catch (error) {
    console.error('[Email] Erro:', error);
    return res.status(500).json({ 
      error: error.message || 'Erro interno',
      stack: error.stack
    });
  }
}
