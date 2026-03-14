const getNayaBackendBaseUrl = (): string => {
  if (typeof window === "undefined") {
    return "http://localhost:3001";
  }

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:3001";
  }

  return "https://backend-nps.onrender.com";
};

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export const callNayaBackend = async (
  question: string,
  userName?: string,
  conversationHistory: ConversationMessage[] = [],
): Promise<string | null> => {
  const baseUrl = getNayaBackendBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/naya/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        user: {
          name: userName || "Gestor",
        },
        conversationHistory,
      }),
    });

    if (!response.ok) {
      console.error("[NayaFrontend] Erro ao chamar backend Naya:", response.status, response.statusText);
      return null;
    }

    const data = (await response.json()) as { answer?: string };

    if (!data.answer || typeof data.answer !== "string") {
      console.warn("[NayaFrontend] Resposta sem campo 'answer':", data);
      return null;
    }

    return data.answer.trim();
  } catch (error) {
    console.error("[NayaFrontend] Falha na requisição para o backend Naya:", error);
    return null;
  }
};
