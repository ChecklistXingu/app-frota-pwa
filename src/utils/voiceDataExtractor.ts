/**
 * Extrai dados numéricos de texto falado
 * Suporta diversos formatos de fala em português
 */

export interface ExtractedData {
  km?: number;
  liters?: number;
  value?: number;
}

// Converte texto de número por extenso para número
const textToNumber: Record<string, number> = {
  "zero": 0,
  "um": 1, "uma": 1,
  "dois": 2, "duas": 2,
  "três": 3, "tres": 3,
  "quatro": 4,
  "cinco": 5,
  "seis": 6,
  "sete": 7,
  "oito": 8,
  "nove": 9,
  "dez": 10,
  "onze": 11,
  "doze": 12,
  "treze": 13,
  "quatorze": 14, "catorze": 14,
  "quinze": 15,
  "dezesseis": 16,
  "dezessete": 17,
  "dezoito": 18,
  "dezenove": 19,
  "vinte": 20,
  "trinta": 30,
  "quarenta": 40,
  "cinquenta": 50,
  "sessenta": 60,
  "setenta": 70,
  "oitenta": 80,
  "noventa": 90,
  "cem": 100, "cento": 100,
  "duzentos": 200, "duzentas": 200,
  "trezentos": 300, "trezentas": 300,
  "quatrocentos": 400, "quatrocentas": 400,
  "quinhentos": 500, "quinhentas": 500,
  "seiscentos": 600, "seiscentas": 600,
  "setecentos": 700, "setecentas": 700,
  "oitocentos": 800, "oitocentas": 800,
  "novecentos": 900, "novecentas": 900,
  "mil": 1000,
  "milhão": 1000000, "milhao": 1000000,
};

/**
 * Converte texto com números por extenso para número
 * Ex: "cento e vinte e cinco mil" -> 125000
 */
const parseSpokenNumber = (text: string): number | null => {
  // Primeiro tenta extrair número direto
  const directNumber = text.match(/[\d.,]+/);
  if (directNumber) {
    // Remove pontos de milhar e converte vírgula para ponto
    const cleaned = directNumber[0]
      .replace(/\./g, "")
      .replace(",", ".");
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }

  // Tenta converter texto por extenso
  const words = text.toLowerCase().split(/\s+/);
  let total = 0;
  let current = 0;

  for (const word of words) {
    if (word === "e") continue;
    
    const value = textToNumber[word];
    if (value !== undefined) {
      if (value === 1000) {
        current = current === 0 ? 1000 : current * 1000;
        total += current;
        current = 0;
      } else if (value === 1000000) {
        current = current === 0 ? 1000000 : current * 1000000;
        total += current;
        current = 0;
      } else {
        current += value;
      }
    }
  }

  total += current;
  return total > 0 ? total : null;
};

/**
 * Extrai KM, litros e valor de um texto falado
 */
export const extractVoiceData = (text: string): ExtractedData => {
  const result: ExtractedData = {};
  const lowerText = text.toLowerCase();

  // Padrões para KM
  const kmPatterns = [
    /(\d+[\d.,]*)\s*(km|quilômetros?|quilometros?|quilometragem)/i,
    /(quilômetros?|quilometros?|quilometragem)\s*(\d+[\d.,]*)/i,
    /km\s*(\d+[\d.,]*)/i,
  ];

  for (const pattern of kmPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      const numStr = match[1].match(/\d/) ? match[1] : match[2];
      const num = parseSpokenNumber(numStr);
      if (num) {
        result.km = num;
        break;
      }
    }
  }

  // Padrão especial: "X mil" sem unidade (assume km se for número grande)
  if (!result.km) {
    const milMatch = lowerText.match(/(\d+)\s*mil/i);
    if (milMatch) {
      const num = parseInt(milMatch[1]) * 1000;
      if (num > 10000) { // Provavelmente é km
        result.km = num;
      }
    }
  }

  // Padrões para litros
  const litersPatterns = [
    /(\d+[\d.,]*)\s*(litros?|l\b)/i,
    /(litros?)\s*(\d+[\d.,]*)/i,
    /abastec\w*\s*(\d+[\d.,]*)/i,
  ];

  for (const pattern of litersPatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      const numStr = match[1].match(/\d/) ? match[1] : match[2];
      const num = parseSpokenNumber(numStr);
      if (num && num < 500) { // Litros geralmente < 500
        result.liters = num;
        break;
      }
    }
  }

  // Padrões para valor
  const valuePatterns = [
    /(\d+[\d.,]*)\s*(reais?|r\$|rs)/i,
    /(reais?|r\$|rs)\s*(\d+[\d.,]*)/i,
    /valor\s*(\d+[\d.,]*)/i,
    /(\d+[\d.,]*)\s*por\s*litro/i, // Ignora preço por litro
  ];

  for (const pattern of valuePatterns) {
    const match = lowerText.match(pattern);
    if (match) {
      // Ignora se for "por litro"
      if (match[0].includes("por litro")) continue;
      
      const numStr = match[1].match(/\d/) ? match[1] : match[2];
      const num = parseSpokenNumber(numStr);
      if (num) {
        result.value = num;
        break;
      }
    }
  }

  console.log("[VoiceExtractor] Texto:", text);
  console.log("[VoiceExtractor] Extraído:", result);

  return result;
};

/**
 * Formata o texto reconhecido para exibição
 */
export const formatRecognizedText = (text: string, data: ExtractedData): string => {
  const parts: string[] = [];
  
  if (data.km) parts.push(`KM: ${data.km.toLocaleString("pt-BR")}`);
  if (data.liters) parts.push(`Litros: ${data.liters}`);
  if (data.value) parts.push(`Valor: R$ ${data.value.toFixed(2)}`);
  
  if (parts.length === 0) {
    return `"${text}" - Não consegui extrair dados`;
  }
  
  return parts.join(" • ");
};
