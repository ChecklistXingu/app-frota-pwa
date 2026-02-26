# 📧 Configuração de Email com Anexos - Resend

## 🎯 SOLUÇÃO DEFINITIVA

Agora o sistema oferece **DUAS opções** ao enviar orçamento:

### ✅ **Opção 1: Email Automático com Anexos (RECOMENDADO)**
- PDF anexado diretamente no email
- Sem necessidade de links
- Email profissional
- Enviado automaticamente

### ⚠️ **Opção 2: Cliente de Email Tradicional**
- Abre Gmail/Outlook
- Mostra links para download
- Usuário precisa enviar manualmente

---

## 🚀 CONFIGURAÇÃO RÁPIDA (5 minutos)

### 1. Criar conta no Resend (GRÁTIS)

1. Acesse: https://resend.com/signup
2. Crie conta gratuita
3. Confirme email

### 2. Obter API Key

1. Acesse: https://resend.com/api-keys
2. Clique em "Create API Key"
3. Nome: `App Frota Production`
4. Permissão: `Sending access`
5. Copie a chave (começa com `re_`)

### 3. Configurar Domínio (Opcional mas Recomendado)

**Opção A: Usar domínio próprio**
1. Acesse: https://resend.com/domains
2. Clique em "Add Domain"
3. Digite seu domínio (ex: `app-frota.com`)
4. Adicione os registros DNS fornecidos
5. Aguarde verificação

**Opção B: Usar domínio de teste**
- Resend fornece domínio gratuito
- Limite: 100 emails/dia
- Suficiente para testes

### 4. Adicionar Variável de Ambiente na Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione projeto `app-frota-pwa`
3. Vá em **Settings** → **Environment Variables**
4. Adicione:
   - **Name:** `RESEND_API_KEY`
   - **Value:** `re_sua_chave_aqui`
   - **Environment:** Production, Preview, Development
5. Clique em **Save**

### 5. Redeploy

```bash
# Fazer commit e push (já vai deployar automaticamente)
git add .
git commit -m "feat: Adicionar envio de email com anexos via Resend"
git push origin main
```

---

## 📊 PLANO GRATUITO RESEND

✅ **100 emails/dia** (suficiente para maioria dos casos)
✅ **Anexos até 40MB** por email
✅ **Sem limite de anexos** por email
✅ **Rastreamento** de entrega
✅ **Logs** de envio
✅ **Webhooks** (opcional)

**Upgrade (se necessário):**
- $20/mês = 50.000 emails/mês
- Sem limite de anexos

---

## 🎨 COMO FUNCIONA

### Fluxo Atual:

```
1. Admin anexa PDF no modal
   ↓
2. Upload para Firebase Storage
   ↓
3. Clica em "Salvar Orçamento"
   ↓
4. Sistema pergunta: "Enviar automático ou manual?"
   ↓
5a. SE AUTOMÁTICO:
    - API baixa PDF do Firebase
    - Converte para base64
    - Envia via Resend com anexo
    - Email chega com PDF anexado
    ↓
5b. SE MANUAL:
    - Abre Gmail/Outlook
    - Mostra link para download
    - Usuário envia manualmente
```

### Email Enviado (Opção Automática):

```
De: App Frota <noreply@app-frota.com>
Para: diretoria@empresa.com
Assunto: Orçamento ABC-1234 - João Silva - Troca de óleo

Olá diretoria 👋
Segue abaixo o orçamento para análise e aprovação:

Veículo: ABC-1234 • Caminhão Mercedes
Motorista: João Silva
Filial: Água Boa

Itens:
- Filtro de óleo: R$ 150,00
- Óleo 15W40: R$ 450,00
- Mão de obra: R$ 200,00

Total: R$ 800,00

📎 1 arquivo(s) anexado(s)

Atenciosamente,
Equipe App Frota 🚚

---
📎 Orcamento_ABC1234.pdf (2.5 MB)
```

---

## 🔧 TROUBLESHOOTING

### Email não está sendo enviado

1. **Verificar API Key:**
   ```bash
   # No console da Vercel, verificar se variável existe
   echo $RESEND_API_KEY
   ```

2. **Verificar logs:**
   - Acesse: https://vercel.com/dashboard
   - Vá em **Functions** → **Logs**
   - Procure por erros em `/api/send-email`

3. **Verificar domínio:**
   - Acesse: https://resend.com/domains
   - Confirme que domínio está verificado

### Email vai para spam

1. **Configurar SPF/DKIM:**
   - Resend fornece registros DNS
   - Adicione no seu provedor de domínio

2. **Usar domínio verificado:**
   - Não use domínio de teste em produção

### Anexo muito grande

- Limite Resend: 40MB
- Limite Firebase Storage: Ilimitado
- **Solução:** Comprimir PDF antes de enviar

---

## 📝 EXEMPLO DE TESTE

### Testar localmente:

```bash
# 1. Criar arquivo .env.local
echo "RESEND_API_KEY=re_sua_chave_aqui" > .env.local

# 2. Instalar dependências
npm install

# 3. Rodar dev server
npm run dev

# 4. Testar envio
# Criar orçamento com anexo
# Escolher "Enviar automático"
# Verificar email
```

### Testar em produção:

1. Fazer deploy
2. Criar orçamento com anexo
3. Clicar em "Salvar Orçamento"
4. Escolher "OK" (enviar automático)
5. Verificar email na caixa de entrada

---

## 🎯 VANTAGENS vs LINKS

### ❌ Links (Solução Anterior):
- URLs longas e feias
- Usuário precisa clicar
- Pode expirar
- Depende de internet
- Não funciona offline

### ✅ Anexos (Solução Nova):
- PDF direto no email
- Usuário baixa facilmente
- Não expira
- Funciona offline depois de baixar
- Mais profissional

---

## 📊 MONITORAMENTO

### Dashboard Resend:

1. **Emails enviados:** https://resend.com/emails
2. **Taxa de entrega:** https://resend.com/analytics
3. **Logs de erro:** https://resend.com/logs
4. **Uso da API:** https://resend.com/usage

### Métricas importantes:

- ✅ Taxa de entrega (deve ser >95%)
- ✅ Taxa de abertura
- ✅ Taxa de bounce (deve ser <5%)
- ✅ Emails em spam (deve ser <1%)

---

## 🔐 SEGURANÇA

### Boas práticas:

1. **Nunca commitar API Key** no código
2. **Usar variáveis de ambiente** sempre
3. **Rotacionar chaves** a cada 6 meses
4. **Monitorar uso** para detectar abusos
5. **Limitar rate** se necessário

### Proteção contra spam:

- Resend tem proteção automática
- Limite de 100 emails/dia no plano gratuito
- Bloqueio automático de domínios suspeitos

---

## 💰 CUSTOS

### Plano Gratuito:
- ✅ 100 emails/dia = 3.000 emails/mês
- ✅ Suficiente para 10-15 orçamentos/dia
- ✅ Sem custo

### Se precisar mais:
- $20/mês = 50.000 emails/mês
- $0.0004 por email adicional
- Exemplo: 100 orçamentos/dia = ~$6/mês

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ Criar conta Resend
2. ✅ Obter API Key
3. ✅ Adicionar variável na Vercel
4. ✅ Fazer deploy
5. ✅ Testar envio
6. ✅ Monitorar resultados

---

## 📞 SUPORTE

**Resend:**
- Docs: https://resend.com/docs
- Discord: https://resend.com/discord
- Email: support@resend.com

**App Frota:**
- Verificar logs da Vercel
- Verificar console do navegador
- Verificar Firestore

---

**Configuração completa em 5 minutos! 🚀**
