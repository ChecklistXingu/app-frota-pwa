# Guia de Teste PWA Offline - Frota Xingu

## Problemas Identificados e Corrigidos

### 1. Service Worker Simplificado

- **Problema**: Lógica complexa com múltiplos callbacks que poderia falhar em cenários offline
- **Solução**: Refatorado para usar async/await com try/catch mais robusto

### 2. Melhor Cache Fallback

- **Problema**: Fallback offline poderia não funcionar em todos os cenários
- **Solução**: Adicionado fallback inline como último recurso

### 3. Cache de Ícones

- **Problema**: Ícones não estavam sendo cacheados na instalação
- **Solução**: Adicionado cache explícito dos ícones no install event

### 4. Runtime Caching Aprimorado

- **Problema**: Fontes do Google não tinham cache configurado
- **Solução**: Adicionado cache para Google Fonts e fontes estáticas

## Como Testar

### 1. Build e Deploy

```bash
npm run build
```

- Deploy a pasta `dist` para Vercel ou seu servidor

### 2. Teste Local

1. Inicie o servidor de desenvolvimento:

```bash
npm run dev
```

1. Abra `http://localhost:5173/test-pwa-offline.html`
2. Siga as instruções na página de teste

### 3. Teste em Produção

1. Acesse `https://app-frota-pwa.vercel.app`
2. Abra o DevTools (F12)
3. Vá para a aba Application > Service Workers
4. Verifique se o SW está "activated and is controlling"
5. Vá para a aba Network e selecione "Offline"
6. Recarregue a página - deve continuar funcionando

### 4. Teste no Dispositivo Móvel

1. Instale o PWA no dispositivo
2. Desconecte da internet
3. Abra o aplicativo
4. Deve funcionar offline com indicador laranja "Modo offline"

## Verificações Importantes

### Service Worker Status

- ✅ Deve estar "activated and is controlling"
- ✅ Console deve mostrar: `[SW] ✅ Service Worker v2.0.0 pronto!`

### Cache Verification

- ✅ DevTools > Application > Storage > Cache Storage
- ✅ Deve existir `frota-xingu-v2.0.0-runtime`
- ✅ Deve conter: `/`, `/index.html`, `/icons/icon-192.png`, `/icons/icon-512.png`

### Offline Functionality

- ✅ Navegação funciona offline
- ✅ Assets (CSS, JS, imagens) carregam do cache
- ✅ Firebase SDK funciona offline (sincronização automática)
- ✅ Indicador offline aparece no topo

## Troubleshooting

### Se o PWA não funcionar offline

1. **Limpe o cache antigo**:

```javascript
// No console do navegador
caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
```

2. **Unregister e re-register o SW**:

```javascript
// No console do navegador
navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(reg => reg.unregister()))
```

3. **Verifique o escopo do manifest**:
   - `start_url: '/'`
   - `scope: '/'`
   - `display: 'standalone'`

4. **Verifique headers HTTPS**:
   - O site deve servir via HTTPS
   - Service Worker só funciona em HTTPS (exceto localhost)

### Logs Importantes para Debug

- `[PWA] App pronto para uso offline!`
- `[SW] 📦 Instalando Service Worker v2.0.0`
- `[SW] ✅ Assumindo controle de todos os clientes`
- `[SW] 🔌 OFFLINE - Usando fallback para: /`

## Deploy para Vercel

O build já está configurado para Vercel. Basta:

1. Fazer push para o repositório
2. Vercel vai fazer deploy automático
3. Verificar se o arquivo `sw.js` está acessível em `https://app-frota-pwa.vercel.app/sw.js`

## Performance Offline

O app agora deve:

- ✅ Carregar instantaneamente offline
- ✅ Manter todas as funcionalidades básicas
- ✅ Sincronizar dados automaticamente quando voltar online
- ✅ Mostrar indicador visual de status offline/online
