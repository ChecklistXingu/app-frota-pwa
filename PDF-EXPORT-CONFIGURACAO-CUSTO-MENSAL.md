# 📄 CONFIGURAÇÃO COMPLETA - EXPORTAÇÃO PDF - RELATÓRIO CUSTO MENSAL

## 🎯 **LOCALIZAÇÃO DO COMPONENTE**
- **Página:** Dashboard Admin → Card "Custo mensal"
- **Botão:** "Ver relatórios" (ícone Download)
- **Arquivo:** `src/pages/Admin/dashboard/DashboardPage.tsx` (linha 223-226)
- **Status:** ✅ **REMOVIDO** - Botão excluído em 09/02/2026 (commit 537fab9)

---

## 📋 **FLUXO DE EXPORTAÇÃO (ANTIGO)**

### 1. **BOTÃO E TRIGGER**
```tsx
<Button variant="ghost" size="sm" onClick={handleExportPDF} className="flex items-center gap-2">
  <Download className="w-4 h-4" />
  Ver relatórios
</Button>
```

### 2. **FUNÇÃO handleExportPDF**
```tsx
const handleExportPDF = () => {
  console.log('[Dashboard] Botão clicado - Iniciando exportação PDF');
  console.log('[Dashboard] Data disponível:', !!data);
  console.log('[Dashboard] Filtros:', filters);
  
  if (!data) {
    console.error('[Dashboard] Dados não disponíveis para gerar PDF');
    alert('Aguarde o carregamento dos dados antes de gerar o relatório.');
    return;
  }
  
  generateCostReportPDF(data, filters, profile?.name);
};
```

### 3. **CHAMADA DA FUNÇÃO PRINCIPAL**
- **Arquivo:** `src/utils/generateCostReportPDF.ts`
- **Função:** `generateCostReportPDF(data, filters, userName)`
- **Status:** ✅ **FUNCIONAL** - Código PDF intacto para uso futuro

---

## 🎨 **ESTRUTURA E LAYOUT DO PDF**

### **PALETA DE CORES**
```typescript
const COLORS = {
  primary: [37, 99, 235],    // blue-600
  secondary: [249, 115, 22], // orange-500  
  success: [22, 163, 74],    // green-600
  warning: [245, 158, 11],   // amber-500
  danger: [220, 38, 38],     // red-600
  gray: [107, 114, 128],     // gray-500
  light: [249, 250, 251],    // gray-50
  dark: [17, 24, 39],        // gray-900
};
```

### **CONFIGURAÇÃO DO DOCUMENTO**
```typescript
const doc = new jsPDF();
const pageWidth = doc.internal.pageSize.width;  // ~210mm (A4)
const pageHeight = doc.internal.pageSize.height; // ~297mm (A4)
```

---

## 📐 **SEÇÕES DO PDF**

### **1. CABEÇALHO (Header)**
- **Altura:** 40px
- **Background:** Azul primário (#2563eb)
- **Conteúdo:**
  - **Logo:** Placeholder (25x25px, canto esquerdo)
    - **Atual:** Quadrado azul com texto "LOGO"
    - **Para implementar logo real:** `public/icon-192.png`
    ```typescript
    // Substituir placeholder por:
    const addLogo = (yPosition: number = 10) => {
      const logoImg = new Image();
      logoImg.src = '/icons/icon-192.png';
      doc.addImage(logoImg, 'PNG', 15, yPosition, 25, 25);
    };
    ```
  - Título: "Relatório de Custo Mensal" (fontSize: 24, branco, centro)
  - Subtítulo: "Análise detalhada de custos da frota" (fontSize: 12, branco, centro)

### **2. INFORMAÇÕES DO FILTRO**
- **Posição:** Y = 50
- **Conteúdo:**
  - "Período do Relatório" (fontSize: 14, negrito)
  - Período formatado: "01/01/2025 a 31/12/2025"
  - Filial: "Todas as filiais" ou específica
  - Gerado por: [nome do usuário]
  - Data de geração: timestamp atual

### **3. CARDS DE RESUMO**
- **Background:** Cinza claro (#f9fafb)
- **Layout:** 3 cards horizontais
- **Dimensões:** Cada card com ~60px de largura
- **Conteúdo:**
  - **Card 1 (Laranja):** Manutenção - Total em R$
  - **Card 2 (Azul):** Combustível - Total em R$
  - **Card 3 (Verde):** Custo Total - Soma dos dois

### **4. TABELA - EVOLUÇÃO MENSAL**
- **Título:** "Evolução Mensal de Custos"
- **Colunas:** Mês | Manutenção | Combustível | Custo Total
- **Estilo:** 
  - Header: Azul primário, texto branco
  - Linhas alternadas: fundo cinza claro
  - Última linha: "TOTAL" em negrito, fundo cinza escuro

### **5. TABELA - ANÁLISE POR FILIAL**
- **Título:** "Análise por Filial"
- **Colunas:** Filial | Manutenção | Combustível | Custo Total | % do Total
- **Ordenação:** Por custo total (decrescente)
- **Estilo:** Header laranja, linhas alternadas

### **6. INSIGHTS E RECOMENDAÇÕES**
- **Título:** "Insights e Recomendações"
- **Background:** Caixa cinza clara com borda azul
- **Conteúdo dinâmico:**
  - Percentual manutenção vs combustível
  - Filial com maior custo
  - Número de filiais analisadas
  - Recomendações de otimização

### **7. RODAPÉ (Footer)**
- **Posição:** Y = pageHeight - 15
- **Conteúdo:**
  - Centro: "Relatório gerado pelo App Frota - Sistema de Gestão de Frotas"
  - Direita: "Página X" (numeração automática)

---

## 🔧 **CONFIGURAÇÕES TÉCNICAS**

### **BIBLIOTECAS UTILIZADAS**
```json
{
  "jspdf": "^2.5.1",
  "jspdf-autotable": "^3.5.31"
}
```

### **IMPORTS NECESSÁRIOS**
```typescript
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { DashboardFilters, DashboardData } from '../pages/Admin/dashboard/types/dashboard.types';
```

### **TYPEDEFINES**
```typescript
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable: { finalY: number };
  }
}
```

---

## 📊 **CONFIGURAÇÃO DAS TABELAS**

### **ESTILO PADRÃO**
```typescript
styles: {
  fontSize: 10,
  cellPadding: 5,
},
headStyles: {
  fillColor: [COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]],
  textColor: 255,
  fontStyle: 'bold',
},
alternateRowStyles: {
  fillColor: [COLORS.light[0], COLORS.light[1], COLORS.light[2]],
},
```

### **LARGURAS DAS COLUNAS**
- **Evolução Mensal:** [40, 50, 50, 50] px
- **Análise por Filial:** [50, 45, 45, 45, 25] px

---

## 🔄 **PAGINAÇÃO AUTOMÁTICA**

### **CONFIGURAÇÃO ANTI-CORTE**
✅ **Totalmente configurado para não cortar conteúdo**

#### **Verificação de espaço**
```typescript
if (currentY > pageHeight - 100) {
  doc.addPage();
  addHeader();
  currentY = 50;
}
```
- **Margem de segurança:** 100px do final
- **Reposicionamento:** Y = 50px após nova página

#### **Margens seguras**
- **Topo:** 50px após header
- **Fundo:** 30px antes do footer  
- **Laterais:** 15px cada lado
- **Total útil:** ~180px de altura para conteúdo

#### **Paginação nas tabelas**
```typescript
didDrawPage: (data: any) => {
  if (data.pageNumber > 1) {
    addHeader();
    addFooter(data.pageNumber);
  }
}
```
- **Auto-paginação:** Tabelas se partem automaticamente
- **Repetição:** Header em todas as páginas
- **Numeração:** Footer com "Página X"

#### **Responsividade de conteúdo**
- **Textos:** `doc.splitTextToSize()` quebra automática
- **Insights:** Altura dinâmica calculada
- **Tabelas:** Paginação própria do `autoTable`

#### **Validação final**
```typescript
// Check if box fits in current page
if (currentY + boxHeight > pageHeight - 30) {
  doc.addPage();
  addHeader();
  currentY = 50;
}
```

**Resultado:** ✅ **Nenhum conteúdo cortado**, paginação inteligente

---

## 💾 **CONFIGURAÇÃO DE SALVAMENTO**

### **NOME DO ARQUIVO**
```typescript
const fileName = `relatorio-custo-mensal-${new Date().toISOString().split('T')[0]}.pdf`;
// Exemplo: relatorio-custo-mensal-2026-02-09.pdf
```

### **MÉTODO DE EXPORTAÇÃO**
```typescript
doc.save(fileName);
```

---

## 📝 **DADOS UTILIZADOS**

### **TIPO DashboardData**
```typescript
interface DashboardData {
  monthlyCosts: Array<{
    month: string;
    maintenance: number;
    fuel: number;
  }>;
  costsByBranch: Array<{
    branch: string;
    maintenance: number;
    fuel: number;
  }>;
  // ... outros dados
}
```

### **TIPO DashboardFilters**
```typescript
interface DashboardFilters {
  branch: string;
  startDate?: string;
  endDate?: string;
}
```

---

## 🎯 **PONTOS DE CUSTOMIZAÇÃO**

### **CORES**
- Alterar objeto `COLORS` no início do arquivo
- Cores em RGB para jsPDF

### **LAYOUT**
- Modificar larguras/alturas nas funções específicas
- Ajustar `currentY` para espaçamento

### **CONTEÚDO**
- Adicionar/remover seções nas funções `add*()`
- Customizar textos e insights

### **FONTES**
- Tamanhos definidos em `setFontSize()`
- Padrão: helvetica (padrão jsPDF)

---

## 🚨 **TRATAMENTO DE ERROS**

### **VALIDAÇÃO**
```typescript
if (!data) {
  alert('Aguarde o carregamento dos dados antes de gerar o relatório.');
  return;
}
```

### **TRY-CATCH**
```typescript
try {
  // Geração do PDF
} catch (error) {
  console.error('[PDF] Erro ao gerar PDF:', error);
  alert('Erro ao gerar o relatório PDF. Verifique o console para mais detalhes.');
}
```

---

## 📈 **MÉTRICAS E DESEMPENHO**

### **VERSÃO ATUAL**
- **Build:** 2026-02-09 08:42
- **Versão:** v2.2
- **Melhorias:** Paginação corrigida, layout responsivo

### **LOGS**
```typescript
console.log('[PDF v2.2] Iniciando geração do PDF - Build 2026-02-09 08:42 - COM PAGINAÇÃO CORRIGIDA');
console.log('[PDF] Dados recebidos:', { data, filters, userName });
```

---

## 🔄 **COMO RESTAURAR O BOTÃO (SE NECESSÁRIO)**

### **1. ADICIONAR IMPORTS NOVAMENTE**
```typescript
// Em src/pages/Admin/dashboard/DashboardPage.tsx
import { Download } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { generateCostReportPDF } from "../../../utils/generateCostReportPDF";
import { useAuth } from "../../../contexts/AuthContext";
```

### **2. RESTAURAR FUNÇÃO**
```typescript
const DashboardPage = () => {
  const { profile } = useAuth(); // Restaurar
  // ... resto do código
  
  const handleExportPDF = () => {
    console.log('[Dashboard] Botão clicado - Iniciando exportação PDF');
    console.log('[Dashboard] Data disponível:', !!data);
    console.log('[Dashboard] Filtros:', filters);
    
    if (!data) {
      console.error('[Dashboard] Dados não disponíveis para gerar PDF');
      alert('Aguarde o carregamento dos dados antes de gerar o relatório.');
      return;
    }
    
    try {
      console.log('[Dashboard] Chamando generateCostReportPDF...');
      generateCostReportPDF(data, filters, profile?.name);
    } catch (error) {
      console.error('[Dashboard] Erro ao gerar PDF:', error);
      alert('Erro ao gerar o relatório PDF. Tente novamente.');
    }
  };
  
  // ... resto do código
```

### **3. RESTAURAR BOTÃO NO CARD**
```tsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between">
    <div>
      <CardTitle>Custo mensal</CardTitle>
      <CardDescription>Comparativo entre manutenção e combustível</CardDescription>
    </div>
    <Button variant="ghost" size="sm" onClick={handleExportPDF} className="flex items-center gap-2">
      <Download className="w-4 h-4" />
      Ver relatórios
    </Button>
  </CardHeader>
  <CardContent>
    <ChartPlaceholder data={monthlyCosts} />
  </CardContent>
</Card>
```

---

## 🔮 **EVOLUÇÕES FUTURAS**

### **PLANEJADO**
- [ ] Incluir logo real da empresa
- [ ] Adicionar gráficos visuais
- [ ] Configurações de filtros avançados
- [ ] Exportação para Excel
- [ ] Assinatura digital

---

**Última atualização:** 2026-02-09  
**Responsável:** Sistema App Frota  
**Status:** ✅ Produção
