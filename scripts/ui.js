const chatContainer = document.getElementById("chat-container");
const welcomeScreen = document.getElementById("welcome-screen");
const inputField = document.getElementById("input");
const sendBtn = document.getElementById("send-btn");

/**
 * Escapa caracteres HTML para prevenir injeção (XSS) em textos crus
 * @param {string} text 
 * @returns {string}
 */
function escapeHtml(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Controla a exibição da tela de boas-vindas
 */
export function showWelcomeScreen() {
  if (welcomeScreen) welcomeScreen.classList.remove("hidden");
  if (chatContainer) chatContainer.classList.add("hidden");
}

/**
 * Controla a exibição do container de mensagens
 */
export function showChatContainer() {
  if (welcomeScreen) welcomeScreen.classList.add("hidden");
  if (chatContainer) chatContainer.classList.remove("hidden");
}

/**
 * Limpa todo o conteúdo de mensagens exibido no chat
 */
export function clearChatContainer() {
  if (chatContainer) chatContainer.innerHTML = "";
}

/**
 * Rola o container de chat até o final
 */
export function scrollToBottom() {
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

/**
 * Habilita ou desabilita o campo de entrada e o botão de envio
 * @param {boolean} disabled 
 */
export function setInputDisabled(disabled) {
  if (inputField) inputField.disabled = disabled;
  if (sendBtn) sendBtn.disabled = disabled;
}

/**
 * Foca o campo de entrada de texto
 */
export function focusInput() {
  if (inputField) inputField.focus();
}

/**
 * Exibe o indicador animado de digitação no chat
 */
export function showTypingIndicator() {
  removeTypingIndicator();

  const indicatorDiv = document.createElement("div");
  indicatorDiv.id = "typing-indicator";
  indicatorDiv.className =
    "flex items-center gap-2 p-4 max-w-[80%] rounded-2xl bg-slate-800 text-slate-100 self-start border border-slate-700/50 my-2";

  indicatorDiv.innerHTML = `
    <div class="flex items-center gap-1">
      <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: -0.3s"></span>
      <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay: -0.15s"></span>
      <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
    </div>
  `;

  if (chatContainer) {
    chatContainer.appendChild(indicatorDiv);
    scrollToBottom();
  }

  return indicatorDiv;
}

/**
 * Remove o indicador animado de digitação da tela
 */
export function removeTypingIndicator() {
  const indicator = document.getElementById("typing-indicator");
  if (indicator) indicator.remove();
}

/**
 * Adiciona uma mensagem (do usuário ou assistente) ao chat
 * @param {'user' | 'assistant'} role 
 * @param {string} text 
 * @param {Array} sources 
 * @returns {HTMLElement} elemento da bolha de conteúdo
 */
export function appendMessage(role, text = "", sources = []) {
  if (!chatContainer) return null;

  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}`;

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "content-bubble";

  if (role === "user") {
    bubbleDiv.textContent = text;
  } else {
    bubbleDiv.innerHTML = typeof marked !== "undefined" ? marked.parse(text || "") : text;
  }

  messageDiv.appendChild(bubbleDiv);

  if (Array.isArray(sources) && sources.length > 0) {
    appendSources(messageDiv, sources);
  }

  chatContainer.appendChild(messageDiv);
  scrollToBottom();

  return bubbleDiv;
}

/**
 * Adiciona o bloco com as fontes referenciadas à mensagem da assistente
 * @param {HTMLElement} parentDiv 
 * @param {Array} sources 
 */
export function appendSources(parentDiv, sources) {
  if (!parentDiv || !Array.isArray(sources) || sources.length === 0) return;

  const sourcesDiv = document.createElement("div");
  sourcesDiv.className = "sources";

  const sourceItemsHtml = sources
    .map((s) => {
      const artigo = escapeHtml(s.artigo || "Trecho");
      const fonte = escapeHtml(s.fonte || "Documento");
      const scorePercentage =
        typeof s.score === "number" ? ` (${(s.score * 100).toFixed(1)}%)` : "";
      return `- ${artigo} [${fonte}]${scorePercentage}`;
    })
    .join("<br>");

  sourcesDiv.innerHTML = `<strong>Fontes:</strong><br>${sourceItemsHtml}`;
  parentDiv.appendChild(sourcesDiv);
  scrollToBottom();
}

// Renderizador de Markdown com throttling (requestAnimationFrame) para evitar travamentos de tela em streaming
let renderScheduled = false;
let pendingTask = null;

/**
 * Atualiza o conteúdo markdown de forma otimizada durante streaming
 * @param {HTMLElement} element 
 * @param {string} markdownText 
 * @param {HTMLElement} container 
 */
export function updateMarkdownThrottled(element, markdownText, container = chatContainer) {
  if (!element) return;
  pendingTask = { element, markdownText, container };

  if (renderScheduled) return;

  renderScheduled = true;
  requestAnimationFrame(() => {
    if (pendingTask) {
      const { element: el, markdownText: md, container: ct } = pendingTask;
      el.innerHTML = typeof marked !== "undefined" ? marked.parse(md) : md;
      if (ct) {
        ct.scrollTop = ct.scrollHeight;
      }
      pendingTask = null;
    }
    renderScheduled = false;
  });
}

/**
 * Força a renderização imediata do markdown e cancela renderizações pendentes
 * @param {HTMLElement} element 
 * @param {string} markdownText 
 * @param {HTMLElement} container 
 */
export function flushMarkdown(element, markdownText, container = chatContainer) {
  if (!element) return;
  element.innerHTML = typeof marked !== "undefined" ? marked.parse(markdownText) : markdownText;
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
  pendingTask = null;
  renderScheduled = false;
}