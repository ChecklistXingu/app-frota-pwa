# Como excluir completamente a assistente Naya do App Frota

Este arquivo explica, passo a passo, como remover toda a funcionalidade da assistente virtual **Naya** do projeto **App Frota**, caso você decida desativá-la no futuro.

---

## 1. Remover o componente da Naya do layout admin

1. Abra o arquivo de layout do painel admin (exemplo esperado):
   - `src/components/layout/AdminLayout.tsx`

2. Procure pelo **import** do componente da Naya, que deve ser semelhante a:

   ```ts
   import VirtualAssistant from "../../assistant/VirtualAssistant";
   ```

3. Apague essa linha de import.

4. No JSX do componente `AdminLayout`, procure onde a Naya é montada, algo como:

   ```tsx
   <VirtualAssistant />
   ```

5. Apague essa linha do JSX.

Após esses passos, o painel admin não renderizará mais a Naya na tela.

---

## 2. Excluir toda a pasta do assistente

1. Localize a pasta do assistente no projeto:
   - `src/assistant/`

2. Apague a pasta inteira `assistant` (e todos os arquivos dentro dela), por exemplo:
   - `src/assistant/VirtualAssistant.tsx`
   - `src/assistant/VoiceWave.tsx`
   - `src/assistant/hooks/...`
   - `src/assistant/services/...`
   - `src/assistant/config.ts`

Nenhum outro arquivo do projeto deve depender dessa pasta além do `AdminLayout` (ou outro ponto único de montagem que estiver documentado lá).

---

## 3. Conferir imports quebrados (opcional, mas recomendado)

Depois de remover o import e apagar a pasta `src/assistant`, é recomendável:

1. Rodar o build ou o comando de desenvolvimento (por exemplo, `npm run dev` ou `npm run build`) para verificar se não há imports quebrados.
2. Se aparecer algum erro citando `assistant` ou `VirtualAssistant`, basta:
   - Abrir o arquivo indicado no erro;
   - Remover o import e/ou o uso correspondente.

---

## 4. Remoção de integrações futuras (caso existam)

Se, no futuro, forem adicionados:
- Endpoints de backend específicos para a Naya (por exemplo, uma API própria em outro repositório), ou
- Regras adicionais em serviços de dados apenas para o assistente,

basta procurar por referências contendo as palavras-chave:
- `Naya`
- `VirtualAssistant`
- `assistant` (dentro da pasta ou módulo específico criado para isso)

e remover esses pontos conforme necessário.

---

## 5. Remover a Naya também do backend (projeto "3 nps")

Se quiser desligar totalmente a assistente, além do App Frota você precisa limpar o backend `3 nps-dashboard-newholland`, que hoje roda na Render (`backend-nps.onrender.com`).

### 5.1 Rotas e imports

1. Abra `3 nps-dashboard-newholland/backend/src/index.ts`.
2. Remova a linha de import:
   ```ts
   import nayaRoutes from './routes/nayaRoutes';
   ```
3. Apague o uso correspondente:
   ```ts
   app.use('/api/naya', nayaRoutes);
   ```

### 5.2 Arquivos exclusivos da Naya

Excluir os arquivos/pastas abaixo:

- `src/routes/nayaRoutes.ts`
- Diretório `src/services/naya/` inteiro (contém controller, chamadas ao GPT, integrações com Firestore e logger).
- `src/models/NayaUnhandledQuery.ts` (modelo que salva perguntas não atendidas).

Após apagar, rode `npm run build` para garantir que não sobrou nenhum import quebrado.

### 5.3 Variáveis de ambiente na Render

No serviço da Render (backend NPS), remova estas env vars:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `FROTA_FIREBASE_PROJECT_ID`
- `FROTA_FIREBASE_CLIENT_EMAIL`
- `FROTA_FIREBASE_PRIVATE_KEY`

Sem elas, o backend não tentará mais acessar o GPT nem o Firestore do App Frota.

### 5.4 Deploy

1. Faça `git add`, `git commit` e `git push` no repositório `ChecklistXingu/backend-nps`.
2. Aguarde a Render fazer o deploy automático (ou force um "Deploy latest").
3. Teste `https://backend-nps.onrender.com/api/health` para confirmar que o backend subiu.

### 5.5 Conferência final no App Frota

Depois de remover o backend, o componente do App Frota vai tentar chamar `/api/naya/query` e receber 404. Para evitar requisições desnecessárias:

- Apague também o arquivo `src/assistant/services/nayaBackendClient.ts` (ou ajuste o componente para não chamar o backend quando a Naya estiver desativada).
- Rode o build do App Frota novamente.

## 6. Resumo rápido

Para excluir a Naya do projeto:

1. **Remova o import e o JSX** do componente `VirtualAssistant` do layout admin (ou onde ele estiver montado).
2. **Apague a pasta** `src/assistant/` inteira.
3. No backend `3 nps`, **remova as rotas/serviços** descritos acima, delete as env vars e redeploy.
4. **Rode o build/dev** do App Frota e do backend para confirmar que não existe mais nenhuma referência à Naya.

Seguindo esses passos, toda a lógica, UI e integrações da assistente Naya serão removidas do App Frota, sem impactar o restante do sistema.
