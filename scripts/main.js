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
let savedSearches = JSON.parse(localStorage.getItem("chatVisaHistory")) || [];

// Lógica de Esconder/Mostrar o Menu Lateral
function toggleSidebar() {
  const isHidden = sidebar.classList.contains("-translate-x-full") || sidebar.classList.contains("md:-ml-72");
  
  if (window.innerWidth >= 768) {
    // Desktop: esconde recolhendo a margem esquerda ou largura
    sidebar.classList.toggle("md:-ml-72");
  } else {
    // Mobile: esconde deslizando para fora da tela
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
  if (savedSearches.length === 0) return;

  if (confirm("Tem certeza que deseja apagar todo o histórico de pesquisas?")) {
    savedSearches = [];
    localStorage.removeItem("chatVisaHistory");
    renderHistory();
    
    chatContainer.innerHTML = "";
    chatHistory = [];
    welcomeScreen.classList.remove("hidden");
    chatContainer.classList.add("hidden");
  }
});

// Renderiza a lista do histórico no menu
function renderHistory() {
  historyList.innerHTML = "";
  
  if (savedSearches.length === 0) {
    historyList.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">Nenhuma pesquisa salva</p>`;
    clearAllBtn.classList.add("opacity-50", "cursor-not-allowed");
    return;
  }

  clearAllBtn.classList.remove("opacity-50", "cursor-not-allowed");

  savedSearches.slice().reverse().forEach((item, reverseIndex) => {
    const realIndex = savedSearches.length - 1 - reverseIndex;

    const itemWrapper = document.createElement("div");
    itemWrapper.className = "group flex items-center justify-between w-full bg-gray-900 hover:bg-gray-700 rounded-lg p-1 transition-colors border border-transparent hover:border-gray-600";

    const btn = document.createElement("button");
    btn.className = "flex-1 text-left p-2 text-sm truncate text-gray-300 hover:text-white focus:outline-none";
    btn.textContent = item.question;
    btn.title = item.question;
    btn.onclick = () => loadHistoryItem(item);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "text-gray-500 hover:text-red-400 p-2 text-xs transition-colors rounded-md";
    deleteBtn.title = "Excluir item";
    deleteBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
      </svg>
    `;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteHistoryItem(realIndex);
    };

    itemWrapper.appendChild(btn);
    itemWrapper.appendChild(deleteBtn);
    historyList.appendChild(itemWrapper);
  });
}

function deleteHistoryItem(index) {
  savedSearches.splice(index, 1);
  if (savedSearches.length === 0) {
    localStorage.removeItem("chatVisaHistory");
  } else {
    localStorage.setItem("chatVisaHistory", JSON.stringify(savedSearches));
  }
  renderHistory();
}

function loadHistoryItem(item) {
  welcomeScreen.classList.add("hidden");
  chatContainer.classList.remove("hidden");
  chatContainer.innerHTML = "";
  
  chatHistory = [
    { role: "user", content: item.question },
    { role: "assistant", content: item.answer }
  ];

  appendMessage("user", item.question);
  appendMessage("assistant", item.answer, item.sources);

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
  chatHistory.push({ role: "user", content: question });

  const assistantBubble = appendMessage("assistant", "");
  let fullAnswer = "";
  let currentSources = [];

  try {
    const response = await fetch("http://192.168.110.71:3333/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: chatHistory }),
    });

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
            fullAnswer += `\n[Erro: ${data.message}]`;
            assistantBubble.innerHTML = marked.parse(fullAnswer);
          }
        }
      }
    }

    chatHistory.push({ role: "assistant", content: fullAnswer });

    savedSearches.push({
      question: question,
      answer: fullAnswer,
      sources: currentSources
    });
    localStorage.setItem("chatVisaHistory", JSON.stringify(savedSearches));
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
  } catch (error) {
    console.error(error);
    assistantBubble.textContent = "Erro ao conectar com o servidor da API.";
  } finally {
    inputField.disabled = false;
    sendBtn.disabled = false;
    inputField.focus();
  }
}

form.addEventListener("submit", handleSubmit);