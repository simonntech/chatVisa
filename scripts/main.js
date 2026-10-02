const chatContainer = document.getElementById("chat-container");
const inputField = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");
const form = document.getElementById("form");

let chatHistory = [];

function appendMessage(role, text, sources = []) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "content-bubble";

  if (role === "user") {
    bubbleDiv.textContent = text;
  } else {
    // Renderiza Markdown para o assistente
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
          (s) => `- ${s.artigo} [${s.fonte}] (${(s.score * 100).toFixed(1)}%)`,
        )
        .join("<br>");
    messageDiv.appendChild(sourcesDiv);
  }

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return bubbleDiv; 
  // Retorna o elemento para atualização em tempo real
}

async function handleSubmit(e) {
  if (e) e.preventDefault();
  const question = inputField.value.trim();
  if (!question) return;

  inputField.value = "";
  inputField.disabled = true;
  sendBtn.disabled = true;

  // Adiciona mensagem do usuário na tela e no histórico
  appendMessage("user", question);
  chatHistory.push({ role: "user", content: question });

  // Cria espaço vazio para a resposta da IA preencher via streaming
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
      buffer = lines.pop(); // Mantém dados incompletos no buffer

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

    // Adiciona a resposta completa da IA ao histórico
    chatHistory.push({ role: "assistant", content: fullAnswer });

    // Se houver fontes, exibe abaixo da mensagem do assistente
    if (currentSources.length > 0) {
      const parentDiv = assistantBubble.parentElement;
      const sourcesDiv = document.createElement("div");
      sourcesDiv.className = "sources";
      sourcesDiv.innerHTML =
        "<strong>Fontes:</strong><br>" +
        currentSources
          .map(
            (s) =>
              `- ${s.artigo} [${s.fonte}] (${(s.score * 100).toFixed(1)}%)`,
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
sendBtn.addEventListener("click", handleSubmit);
