import { STORAGE_KEY, MAX_SESSIONS } from "./config.js";

/**
 * Gera um identificador único simples para cada sessão de chat
 * @returns {string}
 */
export function generateChatId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Lê o histórico de conversas salvo no localStorage.
 * Garante que cada sessão contenha um id único e estrutura válida.
 * @returns {Array} Lista de sessões salvas
 */
export function getSavedChats() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) return [];

    const parsed = JSON.parse(rawData);
    if (!Array.isArray(parsed)) return [];

    // Normaliza para assegurar retrocompatibilidade e integridade dos dados
    return parsed.map((chat) => ({
      id: chat.id || generateChatId(),
      title: chat.title || "Conversa sem título",
      createdAt: chat.createdAt || new Date().toISOString(),
      messages: Array.isArray(chat.messages) ? chat.messages : []
    }));
  } catch (error) {
    console.error("⚠️ Erro ao ler histórico do localStorage:", error);
    return [];
  }
}

/**
 * Salva a lista de conversas no localStorage com controle de cota e limite de sessões.
 * @param {Array} chats - Lista de conversas a salvar
 * @returns {Array} Lista atualizada das conversas que puderam ser salvas
 */
export function saveChats(chats) {
  if (!Array.isArray(chats)) return [];

  // 1. Aplica o limite de sessões (mantém apenas as últimas MAX_SESSIONS)
  let trimmedChats = [...chats];
  if (trimmedChats.length > MAX_SESSIONS) {
    trimmedChats = trimmedChats.slice(-MAX_SESSIONS);
  }

  // 2. Tenta salvar no localStorage com tratamento de exceção de cota
  let savedSuccessfully = false;

  while (!savedSuccessfully && trimmedChats.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedChats));
      savedSuccessfully = true;
    } catch (error) {
      // Verifica se o erro é de cota excedida (QuotaExceededError)
      const isQuotaError =
        error instanceof DOMException &&
        (error.code === 22 ||
          error.code === 1014 ||
          error.name === "QuotaExceededError" ||
          error.name === "NS_ERROR_DOM_QUOTA_REACHED");

      if (isQuotaError && trimmedChats.length > 1) {
        console.warn(
          "⚠️ Cota do localStorage excedida. Removendo a conversa mais antiga para liberar espaço..."
        );
        // Desloca a conversa mais antiga (índice 0) e tenta salvar novamente
        trimmedChats.shift();
      } else {
        console.error("❌ Falha crítica ao salvar no localStorage:", error);
        break;
      }
    }
  }

  return trimmedChats;
}

/**
 * Limpa completamente o armazenamento local do histórico
 */
export function clearSavedChats() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("⚠️ Erro ao limpar localStorage:", error);
  }
}