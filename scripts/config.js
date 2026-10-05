/**
 * Configurações globais da aplicação Chat VISA
 */

// Endpoint da API de chat
export const API_BASE_URL = "http://192.168.110.71:3333";
export const CHAT_API_URL = `${API_BASE_URL}/api/chat`;

// Limite de mensagens recentes enviadas para a API (contexto)
export const MAX_HISTORY_LENGTH = 6;

// Configurações do armazenamento local (LocalStorage)
export const STORAGE_KEY = "chatVisaSessions";
export const MAX_SESSIONS = 20; // Limite máximo de sessões armazenadas