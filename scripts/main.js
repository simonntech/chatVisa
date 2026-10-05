import { CHAT_API_URL, MAX_HISTORY_LENGTH, STREAM_TIMEOUT_MS } from "./config.js";
import { getSavedChats, saveChats, clearSavedChats, generateChatId } from "./storage.js";
import { toggleSidebar, closeSidebarMobile, renderHistory } from "./sidebar.js";
import {
  showWelcomeScreen,
  showChatContainer,
  clearChatContainer,
  setInputDisabled,
  setInputValue,
  focusInput,
  showTypingIndicator,
  removeTypingIndicator,
  appendMessage,
  appendSources,
  appendStreamAlert,
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
let currentAbortController = null;

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
  if (isStreaming) {
    if (currentAbortController) currentAbortController.abort();
    isStreaming = false;
  }

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
  if (isStreaming) {
    if (currentAbortController) currentAbortController.abort();
    isStreaming = false;
  }

  if (!chatSession) return;

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
  if (isStreaming && activeChatId === chatId) {
    if (currentAbortController) currentAbortController.abort();
    isStreaming = false;
  }

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
  if (savedChats.length === 0) return;

  const confirmed = window.confirm(
    "Tem certeza que deseja apagar todo o histórico de conversas?"
  );

  if (confirmed) {
    if (isStreaming && currentAbortController) {
      currentAbortController.abort();
      isStreaming = false;
    }
    savedChats = [];
    clearSavedChats();
    startNewChat();
  }
}

/**
 * Reenvia uma pergunta após falha ou queda de conexão
 * @param {string} questionText 
 */
function retryQuestion(questionText) {
  if (!questionText || isStreaming) return;
  setInputValue(questionText);
  handleSubmit();
}

/**
 * Envia uma pergunta para o backend e consome a resposta SSE via streaming com
 * proteção ativa contra quedas de rede e instabilidades
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
  let hasServerError = false;
  let isFirstChunk = true;
  let isStreamDone = false;

  // Gerenciamento de Timeout por inatividade e AbortController para queda de rede
  const controller = new AbortController();
  currentAbortController = controller;

  let inactivityTimer = null;
  const resetInactivityTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      controller.abort(new Error("STREAM_TIMEOUT"));
    }, STREAM_TIMEOUT_MS);
  };

  const handleOfflineEvent = () => {
    controller.abort(new Error("OFFLINE"));
  };

  window.addEventListener("offline", handleOfflineEvent);

  try {
    // Inicia o timer de inatividade inicial para aguardar o primeiro byte
    resetInactivityTimer();

    const response = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: recentHistory }),
      signal: controller.signal
    });

    if (response.status === 429) {
      hasServerError = true;
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Muitas requisições. Aguarde um momento.");
    }

    if (!response.ok) {
      throw new Error(`Erro na comunicação com o servidor (${response.status}).`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (!isStreamDone) {
      const { value, done } = await reader.read();

      if (done) {
        // Se o reader terminou mas não recebemos [DONE], houve encerramento prematuro da conexão
        if (!isStreamDone) {
          throw new Error("STREAM_INTERRUPTED_PREMATURELY");
        }
        break;
      }

      // Reinicia o timer de inatividade sempre que receber novos dados
      resetInactivityTimer();

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
            hasServerError = true;
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

    // Finaliza a renderização de qualquer markdown pendente
    if (assistantBubble) {
      flushMarkdown(assistantBubble, fullAnswer);
    }

    // Se a resposta foi concluída com sucesso
    if (!hasServerError && fullAnswer.trim() !== "") {
      chatHistory.push({
        role: "assistant",
        content: fullAnswer,
        sources: currentSources
      });

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
      chatHistory.pop();
    }
  } catch (error) {
    console.error("❌ Falha no streaming ou na conexão:", error);
    removeTypingIndicator();

    const parentMessageDiv = assistantBubble ? assistantBubble.parentElement : null;

    // Determina a mensagem de alerta amigável de acordo com o tipo de erro
    let alertMessage = "Erro ao conectar com o servidor da API.";
    const isTimeout =
      error.message === "STREAM_TIMEOUT" ||
      (controller.signal.aborted && controller.signal.reason?.message === "STREAM_TIMEOUT");
    const isOffline =
      error.message === "OFFLINE" ||
      !navigator.onLine ||
      (controller.signal.aborted && controller.signal.reason?.message === "OFFLINE");
    const isInterrupted =
      error.message === "STREAM_INTERRUPTED_PREMATURELY" ||
      error.name === "AbortError" ||
      !isFirstChunk;

    if (isOffline) {
      alertMessage = "A conexão caiu. Você parece estar sem internet no momento.";
    } else if (isTimeout) {
      alertMessage = "A conexão congelou e não recebeu novos dados do servidor (tempo limite excedido).";
    } else if (isInterrupted) {
      alertMessage = "A conexão com o servidor caiu durante a geração da resposta. O conteúdo acima pode estar incompleto.";
    } else if (error.message) {
      alertMessage = error.message;
    }

    // CENÁRIO 1: A conexão caiu no MEIO da resposta (já existiam dados parciais recebidos)
    if (!isFirstChunk && assistantBubble) {
      flushMarkdown(assistantBubble, fullAnswer);

      // Salva a resposta parcial no histórico para não perder o que já foi lido
      const partialAnswerWithNote = `${fullAnswer}\n\n*(Resposta interrompida por queda de conexão)*`;
      chatHistory.push({
        role: "assistant",
        content: partialAnswerWithNote,
        sources: currentSources
      });

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

      // Exibe o alerta visual destacado anexado logo abaixo da resposta incompleta
      appendStreamAlert(parentMessageDiv, alertMessage, {
        onRetry: () => retryQuestion(question),
        type: "warning"
      });
    }
    // CENÁRIO 2: A conexão caiu ANTES de receber qualquer resposta
    else {
      chatHistory.pop(); // Remove a pergunta sem resposta do histórico

      if (!assistantBubble) {
        assistantBubble = appendMessage("assistant", "");
      }
      assistantBubble.textContent = "Não foi possível obter uma resposta.";

      appendStreamAlert(assistantBubble.parentElement, alertMessage, {
        onRetry: () => retryQuestion(question),
        type: "error"
      });
    }
  } finally {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    window.removeEventListener("offline", handleOfflineEvent);

    isStreaming = false;
    currentAbortController = null;
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