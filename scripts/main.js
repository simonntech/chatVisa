const welcomeScreen = document.getElementById("welcome-screen");
const chatContainer = document.getElementById("chat-container");
const inputField = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const form = document.getElementById("form");

// Elementos do Menu Lateral
const sidebar = document.getElementById("sidebar");
const openSidebarBtn = document.getElementById("open-sidebar");
const closeSidebarBtn = document.getElementById("close-sidebar");
const historyList = document.getElementById("history-list");
const newChatBtn = document.getElementById("new-chat-btn");

let chatHistory = [];
// Carrega o histórico salvo (se existir)
let savedSearches = JSON.parse(localStorage.getItem("chatVisaHistory")) || [];


// Botão Nova Consulta
newChatBtn.addEventListener("click", () => {
  chatContainer.innerHTML = "";
  chatHistory = [];
  welcomeScreen.classList.remove("hidden");
  chatContainer.classList.add("hidden");
  if (window.innerWidth < 768) sidebar.classList.add("-translate-x-full");
});

// Renderiza a lista do histórico no menu
function renderHistory() {
  historyList.innerHTML = "";
  // Cria uma cópia, inverte (mais recentes no topo) e renderiza
  [...savedSearches].reverse().forEach((item) => {
    const btn = document.createElement("button");
    btn.className = "w-full text-left p-3 rounded-lg bg-gray-900 hover:bg-gray-700 transition-colors text-sm truncate text-gray-300 border border-transparent hover:border-gray-500";
    btn.textContent = item.question;
    btn.title = item.question;
    btn.onclick = () => loadHistoryItem(item);
    historyList.appendChild(btn);
  });
}

// Carrega uma pergunta/resposta do histórico na tela
function loadHistoryItem(item) {
  welcomeScreen.classList.add("hidden");
  chatContainer.classList.remove("hidden");
  chatContainer.innerHTML = "";
  
  // Atualiza a memória local da conversa
  chatHistory = [
    { role: "user", content: item.question },
    { role: "assistant", content: item.answer }
  ];

  // Renderiza a pergunta e a resposta salva (com as fontes se houver)
  appendMessage("user", item.question);
  appendMessage("assistant", item.answer, item.sources);

  // Fecha o menu se for versão mobile
  if (window.innerWidth < 768) sidebar.classList.add("-translate-x-full");
}

// Renderização inicial
renderHistory();

// Função original (sem alterações)
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

// Função original com acréscimo da lógica de salvar no localstorage
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

    // Adiciona a resposta completa ao histórico local
    chatHistory.push({ role: "assistant", content: fullAnswer });

    // Salva a busca e as fontes
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