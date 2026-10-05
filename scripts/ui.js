const chatContainer = document.getElementById("chat-container");

export function createTypingIndicator() {
  const indicatorDiv = document.createElement("div");
  indicatorDiv.id = "typing-indicator";
  indicatorDiv.className =
    "flex items-center gap-2 p-4 max-w-[80%] rounded-2xl bg-slate-800 text-slate-100 self-start border border-slate-700/50 my-2 animate-fade-in";

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

export function removeTypingIndicator() {
  const indicator = document.getElementById("typing-indicator");
  if (indicator) indicator.remove();
}

export function appendMessage(role, text, sources = []) {
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
    appendSources(messageDiv, sources);
  }

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return bubbleDiv;
}

export function appendSources(parentDiv, sources) {
  const sourcesDiv = document.createElement("div");
  sourcesDiv.className = "sources";
  sourcesDiv.innerHTML =
    "<strong>Fontes:</strong><br>" +
    sources
      .map((s) => `- ${s.artigo} [${s.fonte}] (${(s.score * 100).toFixed(1)}%)`)
      .join("<br>");
  parentDiv.appendChild(sourcesDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}