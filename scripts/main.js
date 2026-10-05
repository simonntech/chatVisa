import { CHAT_API_URL, MAX_HISTORY_LENGTH } from "./config.js";
import { getSavedChats, saveChats, clearSavedChats, generateChatId } from "./storage.js";
import { toggleSidebar, closeSidebarMobile, renderHistory } from "./sidebar.js";
import {
  showWelcomeScreen,
  showChatContainer,
  clearChatContainer,
  setInputDisabled,
  focusInput,
  showTypingIndicator,
  removeTypingIndicator,
  appendMessage,
  appendSources,
  updateMarkdownThrottled,
  flushMarkdown
} from "./ui.js";

// Mapeamento de Elementos do DOM
const form = document.getElementById("form");
const inputField = document.getElementById("input");
const toggleSidebarBtn = document.getElementById("toggle-sidebar");
const closeSidebarBtn = document.getElementById("close-sidebar");
const newChatBtn = document.getElementById("new-chat-btn");
const clearAllBtn = document.getElementById("clear-all-btn");

// Estado da Aplicação
let savedChats = getSavedChats();
let activeChatId = null;
let chatHistory = [];
let isStreaming = false;

/**
 * Atualiza a interface da lista lateral de histórico
 */
function updateHistoryUI() {
  renderHistory(savedChats, activeChatId, {
    onLoadChat: loadChatSession,
    onDeleteChat: deleteChatSession
  });
}

/**
 * Inicia uma nova conversa limpa
 */
function startNewChat() {
  if (isStreaming) return;

  activeChatId = null;
  chatHistory = [];

  clearChatContainer();
  showWelcomeScreen();
  closeSidebarMobile();
  updateHistoryUI();
  focusInput();
}

/**
 * Carrega uma conversa salva do histórico
 * @param {Object} chatSession 
 */
function loadChatSession(chatSession) {
  if (isStreaming || !chatSession) return;

  activeChatId = chatSession.id;
  chatHistory = Array.isArray(chatSession.messages) ? [...chatSession.messages] : [];

  clearChatContainer();
  showChatContainer();

  chatHistory.forEach((msg) => {
    if (msg.role === "user") {
      appendMessage("user", msg.content);
    } else {
      appendMessage("assistant", msg.content, msg.sources || []);
    }
  });

  closeSidebarMobile();
  updateHistoryUI();
  focusInput();
}

/**
 * Exclui uma sessão de conversa por ID
 * @param {string} chatId 
 */
function deleteChatSession(chatId) {
  if (isStreaming && activeChatId === chatId) return;

  const wasActive = activeChatId === chatId;

  savedChats = savedChats.filter((chat) => chat.id !== chatId);

  if (savedChats.length === 0) {
    clearSavedChats();
  } else {
    savedChats = saveChats(savedChats);
  }

  if (wasActive) {
    startNewChat();
  } else {
    updateHistoryUI();
  }
}

/**
 * Limpa todo o histórico de conversas salvas
 */
function clearAllHistory() {
  if (isStreaming || savedChats.length === 0) return;

  const confirmed = window.confirm(
    "Tem certeza que deseja apagar todo o histórico de conversas?"
  );

  if (confirmed) {
    savedChats = [];
    clearSavedChats();
    startNewChat();
  }
}

/**
 * Envia uma pergunta para o backend e consome a resposta SSE via streaming
 * @param {Event} [e] 
 */
async function handleSubmit(e) {
  if (e) e.preventDefault();
  if (isStreaming) return;

  const question = inputField.value.trim();
  if (!question) return;

  // Prepara a interface
  isStreaming = true;
  setInputDisabled(true);
  inputField.value = "";

  showChatContainer();
  appendMessage("user", question);
  chatHistory.push({ role: "user", content: question });

  // Se não houver conversa ativa selecionada, cria um novo ID
  if (!activeChatId) {
    activeChatId = generateChatId();
  }

  // Exibe o indicador de carregamento
  showTypingIndicator();

  // Limita o histórico enviado ao contexto configurado
  const recentHistory = chatHistory.slice(-MAX_HISTORY_LENGTH).map((msg) => ({
    role: msg.role,
    content: msg.content
  }));

  let assistantBubble = null;
  let fullAnswer = "";
  let currentSources = [];
  let hasError = false;
  let isFirstChunk = true;

  try {
    const response = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: recentHistory })
    });

    if (response.status === 429) {
      hasError = true;
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Muitas requisições. Aguarde um momento.");
    }

    if (!response.ok) {
      throw new Error(`Erro na comunicação com o servidor (${response.status}).`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let isStreamDone = false;

    while (!isStreamDone) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop(); // Mantém o pedaço incompleto no buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const dataText = line.replace("data: ", "").trim();
        if (dataText === "[DONE]") {
          isStreamDone = true;
          break;
        }

        try {
          const data = JSON.parse(dataText);

          if (data.type === "chunk") {
            if (isFirstChunk) {
              removeTypingIndicator();
              assistantBubble = appendMessage("assistant", "");
              isFirstChunk = false;
            }

            fullAnswer += data.content;
            updateMarkdownThrottled(assistantBubble, fullAnswer);
          } else if (data.type === "sources") {
            currentSources = Array.isArray(data.sources) ? data.sources : [];
          } else if (data.type === "error") {
            hasError = true;
            if (isFirstChunk) {
              removeTypingIndicator();
              assistantBubble = appendMessage("assistant", "");
              isFirstChunk = false;
            }
            fullAnswer += `\n\n**[Erro: ${data.message || "Erro desconhecido"}]**`;
            updateMarkdownThrottled(assistantBubble, fullAnswer);
          }
        } catch (jsonErr) {
          console.warn("⚠️ Linha SSE ignorada (não-JSON):", dataText, jsonErr);
        }
      }
    }

    // Garante que todo o markdown acumulado seja renderizado de imediato
    if (assistantBubble) {
      flushMarkdown(assistantBubble, fullAnswer);
    }

    // Se houve resposta bem-sucedida, salva no histórico
    if (!hasError && fullAnswer.trim() !== "") {
      chatHistory.push({
        role: "assistant",
        content: fullAnswer,
        sources: currentSources
      });

      // Atualiza ou insere a sessão atual no histórico
      const existingSessionIndex = savedChats.findIndex((chat) => chat.id === activeChatId);

      if (existingSessionIndex >= 0) {
        savedChats[existingSessionIndex].messages = [...chatHistory];
      } else {
        savedChats.push({
          id: activeChatId,
          title: question,
          createdAt: new Date().toISOString(),
          messages: [...chatHistory]
        });
      }

      savedChats = saveChats(savedChats);
      updateHistoryUI();

      if (currentSources.length > 0 && assistantBubble) {
        appendSources(assistantBubble.parentElement, currentSources);
      }
    } else {
      // Remove a pergunta não respondida do histórico se falhou
      chatHistory.pop();
    }
  } catch (error) {
    console.error("❌ Erro durante handleSubmit:", error);
    removeTypingIndicator();

    if (!assistantBubble) {
      assistantBubble = appendMessage("assistant", "");
    }
    assistantBubble.textContent =
      error.message || "Erro ao conectar com o servidor da API.";
    chatHistory.pop();
  } finally {
    isStreaming = false;
    setInputDisabled(false);
    focusInput();
  }
}

// Registro de Eventos
if (toggleSidebarBtn) toggleSidebarBtn.addEventListener("click", toggleSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", toggleSidebar);
if (newChatBtn) newChatBtn.addEventListener("click", startNewChat);
if (clearAllBtn) clearAllBtn.addEventListener("click", clearAllHistory);
if (form) form.addEventListener("submit", handleSubmit);

// Inicialização
updateHistoryUI();