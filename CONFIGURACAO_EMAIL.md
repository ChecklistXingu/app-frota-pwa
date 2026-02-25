# Configuração de Envio de E-mail para Aprovações

## Visão Geral

O sistema de aprovação de manutenções agora suporta envio automático de e-mails com anexos (PDF, DOC, imagens) para os diretores. Esta funcionalidade está implementada através de uma Cloud Function do Firebase.

## Funcionalidades Implementadas

✅ Upload de até 5 anexos (máximo 20MB total)
✅ Tipos aceitos: PDF, DOC, DOCX, imagens (JPEG, PNG, WEBP, HEIC)
✅ Envio automático de e-mail ao clicar em "Salvar orçamento"
✅ Destinatários configurados:
   - **Para:** amauri@xingumaquinas.com
   - **CC:** silvana.bacca@xingumaquinas.com, gleidione.resende@xingumaquinas.com
✅ Assunto dinâmico com veículo, solicitação e valor total
✅ Corpo do e-mail formatado com todos os detalhes do orçamento
✅ Anexos incluídos automaticamente no e-mail

## Configuração Necessária

### 1. Instalar Dependências (Cloud Functions)

```bash
cd functions
npm install nodemailer
npm install @types/nodemailer --save-dev
```

### 2. Configurar Credenciais de E-mail

Você precisa configurar as credenciais do serviço de e-mail no Firebase Functions:

```bash
firebase functions:config:set email.service="gmail" email.user="seu-email@gmail.com" email.pass="sua-senha-de-app"
```

**Importante:** Para Gmail, você precisa usar uma "Senha de App" (App Password), não sua senha normal:
1. Acesse https://myaccount.google.com/security
2. Ative a verificação em duas etapas
3. Gere uma senha de app em "Senhas de app"
4. Use essa senha no comando acima

### 3. Descomentar o Código de Envio Real

No arquivo `functions/src/index.ts`, na função `sendApprovalEmail`, descomente o bloco de código que faz o envio real:

```typescript
// Remova o /* e */ que envolvem este bloco:
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
```

### 4. Deploy das Cloud Functions

```bash
firebase deploy --only functions
```

## Alternativa: SendGrid

Se preferir usar SendGrid ao invés de Gmail:

1. Instale o pacote:
```bash
cd functions
npm install @sendgrid/mail
```

2. Configure a API Key:
```bash
firebase functions:config:set sendgrid.apikey="SG.sua-api-key-aqui"
```

3. Modifique o código em `functions/src/index.ts`:
```typescript
const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(functions.config().sendgrid.apikey);

const attachmentBuffers = [];
if (attachments && attachments.length > 0) {
  for (const att of attachments) {
    const response = await axios.get(att.url, { responseType: "arraybuffer" });
    attachmentBuffers.push({
      filename: att.name,
      content: Buffer.from(response.data).toString("base64"),
      type: att.contentType || "application/octet-stream",
      disposition: "attachment",
    });
  }
}

await sgMail.send({
  from: "noreply@xingumaquinas.com",
  to,
  cc,
  subject,
  text: previewText,
  attachments: attachmentBuffers,
});
```

## Testando

1. Acesse o painel administrativo
2. Selecione uma manutenção e clique em "Solicitar aprovação"
3. Preencha os campos do orçamento
4. Anexe arquivos (opcional)
5. Clique em "Salvar orçamento"
6. O sistema irá:
   - Fazer upload dos anexos para o Firebase Storage
   - Salvar os dados no Firestore
   - Enviar o e-mail com os anexos
   - Mostrar mensagem de sucesso ou erro

## Estrutura de Armazenamento

Os anexos são salvos no Firebase Storage em:
```
director-approvals/{maintenanceId}/{timestamp}_{filename}
```

Os metadados dos anexos são salvos no Firestore em:
```
maintenance/{maintenanceId}/directorApproval/attachments[]
```

## Troubleshooting

### E-mail não está sendo enviado

1. Verifique se as configurações foram aplicadas:
```bash
firebase functions:config:get
```

2. Verifique os logs da Cloud Function:
```bash
firebase functions:log
```

3. Certifique-se de que a função foi deployada:
```bash
firebase deploy --only functions:sendApprovalEmail
```

### Erro de autenticação do Gmail

- Use uma senha de app, não sua senha normal
- Verifique se a verificação em duas etapas está ativada
- Tente desabilitar "Acesso a apps menos seguros" se estiver usando senha normal

### Anexos muito grandes

- O limite total é 20MB para garantir entrega
- Provedores de e-mail têm limites diferentes (Gmail: 25MB, Outlook: 20MB)
- Se necessário, aumente o limite em `MAX_ATTACHMENT_BYTES` no código

## Próximos Passos

- [ ] Configurar credenciais de e-mail
- [ ] Instalar dependências do Nodemailer
- [ ] Descomentar código de envio real
- [ ] Fazer deploy das Cloud Functions
- [ ] Testar envio de e-mail
- [ ] Configurar template HTML para e-mails mais bonitos (opcional)
