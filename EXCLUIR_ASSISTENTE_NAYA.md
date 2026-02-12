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

## 5. Resumo rápido

Para excluir a Naya do projeto:

1. **Remova o import e o JSX** do componente `VirtualAssistant` do layout admin (ou onde ele estiver montado).
2. **Apague a pasta** `src/assistant/` inteira.
3. **Rode o build/dev** para confirmar que não existe mais nenhuma referência à Naya.

Seguindo esses passos, toda a lógica, UI e integrações da assistente Naya serão removidas do App Frota, sem impactar o restante do sistema.
