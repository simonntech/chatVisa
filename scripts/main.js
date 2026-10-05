import { getSavedChats, saveChats, clearSavedChats } from "./storage.js";
import { createTypingIndicator, removeTypingIndicator, appendMessage, appendSources } from "./ui.js";
import { toggleSidebar, renderHistory } from "./sidebar.js";

// Mapeamento de Elementos
const welcomeScreen = document.getElementById("welcome-screen");
const chatContainer = document.getElementById("chat-container");
const inputField = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const form = document.getElementById("form");

const toggleSidebarBtn = document.getElementById("toggle-sidebar");
const closeSidebarBtn = document.getElementById("close-sidebar");
const newChatBtn = document.getElementById("new-chat-btn");
const clearAllBtn = document.getElementById("clear-all-btn");

// Estado
let chatHistory = [];
let savedChats = getSavedChats();

// Eventos do Menu
toggleSidebarBtn.addEventListener("click", toggleSidebar);
closeSidebarBtn.addEventListener("click", toggleSidebar);

newChatBtn.addEventListener("click", () => {
  chatContainer.innerHTML = "";
  chatHistory = [];
  welcomeScreen.classList.remove("hidden");
  chatContainer.classList.add("hidden");
  if (window.innerWidth < 768) sidebar.classList.add("-translate-x-full");
});

clearAllBtn.addEventListener("click", () => {
  if (savedChats.length === 0) return;

  if (confirm("Tem certeza que deseja apagar todo o histórico de conversas?")) {
    savedChats = [];
    clearSavedChats();
    updateHistoryUI();
    
    chatContainer.innerHTML = "";
    chatHistory = [];
    welcomeScreen.classList.remove("hidden");
    chatContainer.classList.add("hidden");
  }
});

function deleteChatSession(index) {
  savedChats.splice(index, 1);
  if (savedChats.length === 0) {
    clearSavedChats();
  } else {
    saveChats(savedChats);
  }
  updateHistoryUI();
}

function loadChatSession(chatSession) {
  welcomeScreen.classList.add("hidden");
  chatContainer.classList.remove("hidden");
  chatContainer.innerHTML = "";
  
  chatHistory = [...chatSession.messages];

  chatSession.messages.forEach(msg => {
    if (msg.role === "user") {
      appendMessage("user", msg.content);
    } else {
      appendMessage("assistant", msg.content, msg.sources || []);
    }
  });

  if (window.innerWidth < 768) sidebar.classList.add("-translate-x-full");
}

function updateHistoryUI() {
  renderHistory(savedChats, loadChatSession, deleteChatSession);
}

// Submissão e consumo do SSE
async function handleSubmit(e) {
  if (e) e.preventDefault();
  const question = inputField.value.trim();
  if (!question) return;

  if (!welcomeScreen.classList.contains("hidden")) {
    welcomeScreen.classList.add("hidden");
    chatContainer.classList.remove("hidden");
  }

  inputField.value = "";
  inputField.disabled = true;
  sendBtn.disabled = true;

  appendMessage("user", question);
  chatHistory.push({ role: "user", content: question });

  // 1. ONDA DE CARREGAMENTO: Exibe o indicador "VISA está digitando"
  const typingIndicator = createTypingIndicator();
  chatContainer.appendChild(typingIndicator);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  const formattedMessages = chatHistory.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  let assistantBubble = null;
  let fullAnswer = "";
  let currentSources = [];
  let hasError = false;
  let isFirstChunk = true;

  try {
    const response = await fetch("http://192.168.110.71:3333/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: formattedMessages }),
    });

    if (response.status === 429) {
      hasError = true;
      const errorData = await response.json();
      throw new Error(errorData.error || "Muitas requisições. Aguarde um momento.");
    }

    if (!response.ok) throw new Error("Erro na comunicação com o servidor.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const dataText = line.replace("data: ", "").trim();
          if (dataText === "[DONE]") break;

          const data = JSON.parse(dataText);

          if (data.type === "chunk") {
            // 2. No primeiro chunk recebido, removemos o indicador e criamos a bolha oficial da mensagem
            if (isFirstChunk) {
              removeTypingIndicator();
              assistantBubble = appendMessage("assistant", "");
              isFirstChunk = false;
            }

            fullAnswer += data.content;
            assistantBubble.innerHTML = marked.parse(fullAnswer);
            chatContainer.scrollTop = chatContainer.scrollHeight;
          } else if (data.type === "sources") {
            currentSources = data.sources;
          } else if (data.type === "error") {
            hasError = true;
            if (isFirstChunk) {
              removeTypingIndicator();
              assistantBubble = appendMessage("assistant", "");
              isFirstChunk = false;
            }
            fullAnswer += `\n[Erro: ${data.message}]`;
            assistantBubble.innerHTML = marked.parse(fullAnswer);
          }
        }
      }
    }

    if (!hasError && fullAnswer.trim() !== "") {
      chatHistory.push({ role: "assistant", content: fullAnswer, sources: currentSources });

      if (chatHistory.length === 2) {
        savedChats.push({
          title: question,
          messages: [...chatHistory]
        });
      } else {
        savedChats[savedChats.length - 1].messages = [...chatHistory];
      }

      saveChats(savedChats);
      updateHistoryUI();

      if (currentSources.length > 0 && assistantBubble) {
        appendSources(assistantBubble.parentElement, currentSources);
      }
    } else {
      chatHistory.pop();
    }

  } catch (error) {
    console.error(error);
    removeTypingIndicator();
    if (!assistantBubble) {
      assistantBubble = appendMessage("assistant", "");
    }
    assistantBubble.textContent = error.message || "Erro ao conectar com o servidor da API.";
    chatHistory.pop();
  } finally {
    inputField.disabled = false;
    sendBtn.disabled = false;
    inputField.focus();
  }
}

form.addEventListener("submit", handleSubmit);

// Inicialização
updateHistoryUI();