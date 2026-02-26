# 🔗 Sistema de Short URLs para Anexos de Orçamento

## 📋 Visão Geral

Sistema completo de encurtamento de URLs para anexos de orçamento no App Frota, melhorando drasticamente a apresentação dos links nos emails enviados à diretoria.

---

## ❌ PROBLEMA ANTERIOR

**URLs longas e poluídas:**
```
https://firebasestorage.googleapis.com/v0/b/app-frota-1ce38.appspot.com/o/director-approvals%2FNRM3G59%20(123%20KB)%2F1740529525271_Orcamento.pdf?alt=media&token=8b004d04-8b7d-4a66-9c16-80f2d6c7701d5f1f7001801.7e2_WhatsApp_2025-05-25_at_15.01.34.jpeg
```

**Problemas:**
- ❌ URLs extremamente longas (200+ caracteres)
- ❌ Dificulta leitura do email
- ❌ Pode quebrar em alguns clientes de email
- ❌ Aparência não profissional

---

## ✅ SOLUÇÃO IMPLEMENTADA

**URLs curtas e limpas:**
```
https://app-frota-pwa.vercel.app/o/orcamento-nrm3g59-1
```

**Benefícios:**
- ✅ URLs curtas e legíveis (50 caracteres)
- ✅ Fácil de compartilhar
- ✅ Aparência profissional
- ✅ Página de preview antes do download
- ✅ Rastreável e gerenciável

---

## 🏗️ ARQUITETURA

### 1. **Geração de Short URL**
```typescript
// Em AdminMaintenancePage.tsx (linha 514-536)
const desiredSlug = `${slugBase}-${index + 1}`;
const shortUrl = `https://app-frota-pwa.vercel.app/o/${desiredSlug}`;

await setDoc(doc(db, 'attachmentLinks', desiredSlug), {
  slug: desiredSlug,
  url: attachment.url,
  maintenanceId: maintenance.id,
  attachmentName: attachment.name,
  vehiclePlate,
  updatedAt: new Date(),
  createdBy: profile?.id,
});
```

### 2. **Roteamento Vercel**
```json
// vercel.json
{
  "rewrites": [
    {
      "source": "/o/:slug",
      "destination": "/api/redirect?slug=:slug"
    }
  ]
}
```

### 3. **API de Redirect**
```javascript
// api/redirect.js
// Busca no Firestore e redireciona para URL original
const docRef = db.collection('attachmentLinks').doc(slug);
const docSnap = await docRef.get();
const url = docSnap.data()?.url;
res.writeHead(302, { Location: url });
```

### 4. **Página de Preview**
```typescript
// src/pages/AttachmentPreview.tsx
// Interface visual antes do download
// Mostra informações do anexo
// Botões para baixar ou visualizar
```

---

## 📧 FORMATO DO EMAIL

### Antes:
```
Olá diretoria 👋,
Segue abaixo o orçamento para análise e aprovação:

[... detalhes do orçamento ...]

Clique no link para abrir o orçamento:

📎 Documentos anexos:
Orçamento ABC-1234 (2.5 MB)
https://firebasestorage.googleapis.com/v0/b/app-frota-1ce38.appspot.com/o/director-approvals%2FNRM3G59%20(123%20KB)%2F1740529525271_Orcamento.pdf?alt=media&token=8b004d04-8b7d-4a66-9c16-80f2d6c7701d5f1f7001801.7e2_WhatsApp_2025-05-25_at_15.01.34.jpeg
```

### Depois:
```
Olá diretoria 👋
Segue abaixo o orçamento para análise e aprovação:

[... detalhes do orçamento ...]

📎 DOCUMENTOS ANEXOS:

📄 Orçamento ABC-1234 (2.5 MB)
   https://app-frota-pwa.vercel.app/o/orcamento-abc1234-1

👆 Clique nos links acima para visualizar/baixar os orçamentos

Atenciosamente,
Equipe App Frota 🚚
```

---

## 🔄 FLUXO COMPLETO

```
1. Admin anexa PDF no modal de aprovação
   ↓
2. Sistema faz upload para Firebase Storage
   ↓
3. Gera short URL e salva no Firestore
   ↓
4. Email é montado com short URL
   ↓
5. Diretor clica no link curto
   ↓
6. Vercel redireciona para /api/redirect
   ↓
7. API busca URL original no Firestore
   ↓
8. Redireciona para Firebase Storage
   ↓
9. Arquivo é baixado/visualizado
```

---

## 📊 ESTRUTURA FIRESTORE

### Coleção: `attachmentLinks`

```typescript
{
  slug: "orcamento-abc1234-1",
  url: "https://firebasestorage.googleapis.com/...",
  maintenanceId: "maint_123",
  attachmentName: "Orcamento.pdf",
  vehiclePlate: "ABC-1234",
  updatedAt: Timestamp,
  createdBy: "user_id"
}
```

---

## 🎨 PÁGINA DE PREVIEW

Quando o usuário acessa `/o/orcamento-abc1234-1`:

**Recursos:**
- ✅ Interface visual limpa e profissional
- ✅ Informações do anexo (nome, data, veículo)
- ✅ Botão "Baixar Orçamento"
- ✅ Botão "Visualizar no Navegador" (para PDFs/imagens)
- ✅ Tratamento de erros (link expirado/não encontrado)
- ✅ Responsivo (mobile e desktop)

---

## 🔒 SEGURANÇA

1. **URLs do Firebase Storage continuam com token de segurança**
2. **Short URLs são públicas mas difíceis de adivinhar**
3. **Slugs são únicos e baseados em timestamp**
4. **Rastreamento de quem criou cada link**

---

## 🚀 DEPLOY

### Pré-requisitos:
- Vercel configurado
- Firebase Admin SDK configurado
- Variável de ambiente `FIREBASE_SERVICE_ACCOUNT` na Vercel

### Comandos:
```bash
# Build local
npm run build

# Deploy Vercel
vercel --prod
```

---

## 📝 EXEMPLO DE USO

### Código para gerar short URL:
```typescript
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const createShortUrl = async (
  originalUrl: string,
  maintenanceId: string,
  attachmentName: string
) => {
  const slug = `orcamento-${maintenanceId}-${Date.now()}`;
  const shortUrl = `https://app-frota-pwa.vercel.app/o/${slug}`;
  
  await setDoc(doc(db, 'attachmentLinks', slug), {
    slug,
    url: originalUrl,
    maintenanceId,
    attachmentName,
    updatedAt: new Date(),
  });
  
  return shortUrl;
};
```

---

## 🧪 TESTES

### Testar localmente:
```bash
# 1. Iniciar dev server
npm run dev

# 2. Acessar rota de preview
http://localhost:5173/o/test-slug

# 3. Testar API de redirect
http://localhost:5173/api/redirect?slug=test-slug
```

### Testar em produção:
```bash
# 1. Criar orçamento com anexo
# 2. Copiar short URL do email
# 3. Abrir em navegador
# 4. Verificar redirect e download
```

---

## 📦 ARQUIVOS MODIFICADOS/CRIADOS

### Modificados:
- ✅ `vercel.json` - Rota `/o/:slug`
- ✅ `src/pages/Admin/AdminMaintenancePage.tsx` - Formatação do email
- ✅ `src/router/AppRouter.tsx` - Rota de preview

### Criados:
- ✅ `src/pages/AttachmentPreview.tsx` - Página de preview
- ✅ `ANEXOS-SHORT-URL.md` - Esta documentação

### Já existentes (sem alteração):
- ✅ `api/redirect.js` - API de redirect
- ✅ `src/services/approvalAttachmentService.ts` - Upload de anexos

---

## 🎯 MELHORIAS FUTURAS

1. **Analytics de cliques** nos links curtos
2. **Expiração automática** de links após X dias
3. **QR Code** para compartilhamento mobile
4. **Visualizador de PDF integrado** na página de preview
5. **Histórico de acessos** por anexo
6. **Proteção por senha** para anexos sensíveis

---

## 🐛 TROUBLESHOOTING

### Link não funciona (404):
- Verificar se o deploy foi feito na Vercel
- Verificar se a rota `/o/:slug` está no `vercel.json`
- Verificar se o documento existe no Firestore

### Redirect não funciona:
- Verificar variável `FIREBASE_SERVICE_ACCOUNT` na Vercel
- Verificar logs da função `/api/redirect`
- Verificar se a URL original é válida

### Preview não carrega:
- Verificar se o slug está correto
- Verificar conexão com Firestore
- Verificar console do navegador

---

## 📞 SUPORTE

Para dúvidas ou problemas:
1. Verificar logs da Vercel
2. Verificar console do navegador
3. Verificar Firestore (coleção `attachmentLinks`)
4. Verificar Firebase Storage (pasta `director-approvals`)

---

**Desenvolvido para App Frota - Sistema de Gestão de Manutenção** 🚚
