const welcomeScreen = document.getElementById("welcome-screen");
const chatContainer = document.getElementById("chat-container");
const inputField = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const form = document.getElementById("form");

// Elementos do Menu Lateral
const sidebar = document.getElementById("sidebar");
const toggleSidebarBtn = document.getElementById("toggle-sidebar");
const closeSidebarBtn = document.getElementById("close-sidebar");
const historyList = document.getElementById("history-list");
const newChatBtn = document.getElementById("new-chat-btn");
const clearAllBtn = document.getElementById("clear-all-btn");

let chatHistory = [];
let savedChats = JSON.parse(localStorage.getItem("chatVisaSessions")) || [];

// Lógica de Esconder/Mostrar o Menu Lateral
function toggleSidebar() {
  const isHidden = sidebar.classList.contains("-translate-x-full") || sidebar.classList.contains("md:-ml-72");
  
  if (window.innerWidth >= 768) {
    sidebar.classList.toggle("md:-ml-72");
  } else {
    sidebar.classList.toggle("-translate-x-full");
  }
}

toggleSidebarBtn.addEventListener("click", toggleSidebar);
closeSidebarBtn.addEventListener("click", toggleSidebar);

// Botão Nova Consulta
newChatBtn.addEventListener("click", () => {
  chatContainer.innerHTML = "";
  chatHistory = [];
  welcomeScreen.classList.remove("hidden");
  chatContainer.classList.add("hidden");
  if (window.innerWidth < 768) {
    sidebar.classList.add("-translate-x-full");
  }
});

// Botão Limpar Todo o Histórico
clearAllBtn.addEventListener("click", () => {
  if (savedChats.length === 0) return;

  if (confirm("Tem certeza que deseja apagar todo o histórico de conversas?")) {
    savedChats = [];
    localStorage.removeItem("chatVisaSessions");
    renderHistory();
    
    chatContainer.innerHTML = "";
    chatHistory = [];
    welcomeScreen.classList.remove("hidden");
    chatContainer.classList.add("hidden");
  }
});

// Renderiza a lista de conversas no menu lateral
function renderHistory() {
  historyList.innerHTML = "";
  
  if (savedChats.length === 0) {
    historyList.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">Nenhuma conversa salva</p>`;
    clearAllBtn.classList.add("opacity-50", "cursor-not-allowed");
    return;
  }

  clearAllBtn.classList.remove("opacity-50", "cursor-not-allowed");

  savedChats.slice().reverse().forEach((chatSession, reverseIndex) => {
    const realIndex = savedChats.length - 1 - reverseIndex;
    const title = chatSession.title || "Conversa sem título";

    const itemWrapper = document.createElement("div");
    itemWrapper.className = "group flex items-center justify-between w-full bg-gray-900 hover:bg-gray-700 rounded-lg p-1 transition-colors border border-transparent hover:border-gray-600";

    const btn = document.createElement("button");
    btn.className = "flex-1 text-left p-2 text-sm truncate text-gray-300 hover:text-white focus:outline-none";
    btn.textContent = title;
    btn.title = title;
    btn.onclick = () => loadChatSession(chatSession);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "text-gray-500 hover:text-red-400 p-2 text-xs transition-colors rounded-md";
    deleteBtn.title = "Excluir conversa";
    deleteBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
      </svg>
    `;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteChatSession(realIndex);
    };

    itemWrapper.appendChild(btn);
    itemWrapper.appendChild(deleteBtn);
    historyList.appendChild(itemWrapper);
  });
}

function deleteChatSession(index) {
  savedChats.splice(index, 1);
  if (savedChats.length === 0) {
    localStorage.removeItem("chatVisaSessions");
  } else {
    localStorage.setItem("chatVisaSessions", JSON.stringify(savedChats));
  }
  renderHistory();
}

function loadChatSession(chatSession) {
  welcomeScreen.classList.add("hidden");
  chatContainer.classList.remove("hidden");
  chatContainer.innerHTML = "";
  
  // Restaura o histórico completo da sessão para a API manter o contexto
  chatHistory = [...chatSession.messages];

  // Re-renderiza todas as mensagens na tela
  chatSession.messages.forEach(msg => {
    if (msg.role === "user") {
      appendMessage("user", msg.content);
    } else {
      appendMessage("assistant", msg.content, msg.sources || []);
    }
  });

  if (window.innerWidth < 768) {
    sidebar.classList.add("-translate-x-full");
  }
}

renderHistory();

function appendMessage(role, text, sources = []) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "content-bubble";

  if (role === "user") {
    bubbleDiv.textContent = text;
  } else {
    bubbleDiv.innerHTML = marked.parse(text);
  }

  messageDiv.appendChild(bubbleDiv);

  if (sources && sources.length > 0) {
    const sourcesDiv = document.createElement("div");
    sourcesDiv.className = "sources";
    sourcesDiv.innerHTML =
      "<strong>Fontes:</strong><br>" +
      sources
        .map(
          (s) => `- ${s.artigo} [${s.fonte}] (${(s.score * 100).toFixed(1)}%)`
        )
        .join("<br>");
    messageDiv.appendChild(sourcesDiv);
  }

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return bubbleDiv;
}

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
  
  // Adiciona a nova pergunta ao histórico local de objetos
  chatHistory.push({ role: "user", content: question });

  // 1. Monta o payload estruturado para o back-end conforme a nova estratégia
  // Aqui podemos mapear o chatHistory para o formato que o back-end vai consumir direto no TokenLimiter
  const formattedMessages = chatHistory.map((msg, index) => {
    // Se for uma mensagem do assistente e tiver fontes, podemos opcionalmente embutir ou deixar limpo.
    // Mas o ponto principal é o usuário: se houver contexto anterior, podemos injetá-lo de forma limpa.
    return {
      role: msg.role,
      content: msg.content
    };
  });

  const assistantBubble = appendMessage("assistant", "");
  let fullAnswer = "";
  let currentSources = [];
  let hasError = false;

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
            fullAnswer += data.content;
            assistantBubble.innerHTML = marked.parse(fullAnswer);
            chatContainer.scrollTop = chatContainer.scrollHeight;
          } else if (data.type === "sources") {
            currentSources = data.sources;
          } else if (data.type === "error") {
            hasError = true;
            fullAnswer += `\n[Erro: ${data.message}]`;
            assistantBubble.innerHTML = marked.parse(fullAnswer);
          }
        }
      }
    }

    if (!hasError && fullAnswer.trim() !== "") {
      chatHistory.push({ role: "assistant", content: fullAnswer, sources: currentSources });

      // Se for a primeira interação deste chat, cria uma nova sessão no array de conversas salvas
      // Se já houver uma sessão ativa, atualiza as mensagens dela
      if (chatHistory.length === 2) {
        savedChats.push({
          title: question,
          messages: [...chatHistory]
        });
      } else {
        // Atualiza a última sessão salva com o novo histórico acumulado
        savedChats[savedChats.length - 1].messages = [...chatHistory];
      }

      localStorage.setItem("chatVisaSessions", JSON.stringify(savedChats));
      renderHistory();

      if (currentSources.length > 0) {
        const parentDiv = assistantBubble.parentElement;
        const sourcesDiv = document.createElement("div");
        sourcesDiv.className = "sources";
        sourcesDiv.innerHTML =
          "<strong>Fontes:</strong><br>" +
          currentSources
            .map(
              (s) =>
                `- ${s.artigo} [${s.fonte}] (${(s.score * 100).toFixed(1)}%)`
            )
            .join("<br>");
        parentDiv.appendChild(sourcesDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    } else {
      chatHistory.pop();
    }

  } catch (error) {
    console.error(error);
    assistantBubble.textContent = error.message || "Erro ao conectar com o servidor da API.";
    chatHistory.pop();
  } finally {
    inputField.disabled = false;
    sendBtn.disabled = false;
    inputField.focus();
  }
}

form.addEventListener("submit", handleSubmit);

function createTypingIndicator() {
  const indicatorDiv = document.createElement("div");
  indicatorDiv.id = "typing-indicator";
  indicatorDiv.className =
    "flex items-center gap-2 p-4 max-w-[80%] rounded-2xl bg-slate-800 text-slate-100 self-start border border-slate-100/50 my-2 animate-fade-in";

  indicatorDiv.innerHTML = `
    <span class="text-xs font-medium text-slate-400 mr-1">VISA está digitando</span>
    <div class="flex items-center gap-1">
      <span class="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
      <span class="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
      <span class="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></span>
    </div>
  `;

  return indicatorDiv;
}