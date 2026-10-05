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
 * Define o valor do campo de entrada
 * @param {string} value 
 */
export function setInputValue(value) {
  if (inputField) inputField.value = value;
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

/**
 * Exibe um alerta de erro ou de conexão interrompida no chat com opção de retry
 * @param {HTMLElement} parentContainer - Elemento onde o alerta será inserido (ou o próprio chatContainer)
 * @param {string} message - Mensagem explicativa
 * @param {Object} options - { onRetry, type: 'warning' | 'error' }
 * @returns {HTMLElement}
 */
export function appendStreamAlert(parentContainer, message, { onRetry, type = "warning" } = {}) {
  const container = parentContainer || chatContainer;
  if (!container) return null;

  const isWarning = type === "warning";
  const alertDiv = document.createElement("div");
  alertDiv.className = `stream-alert flex items-start sm:items-center justify-between gap-3 p-3 rounded-xl mt-3 text-xs sm:text-sm border transition-all ${
    isWarning
      ? "bg-amber-950/70 border-amber-500/60 text-amber-200"
      : "bg-red-950/70 border-red-500/60 text-red-200"
  }`;

  const contentDiv = document.createElement("div");
  contentDiv.className = "flex items-start sm:items-center gap-2 flex-1";

  // Ícone SVG de alerta/atenção
  contentDiv.innerHTML = `
    <svg class="w-5 h-5 shrink-0 ${isWarning ? "text-amber-400" : "text-red-400"}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    <span class="leading-relaxed">${escapeHtml(message)}</span>
  `;

  alertDiv.appendChild(contentDiv);

  if (typeof onRetry === "function") {
    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = `shrink-0 px-3 py-1.5 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5 ${
      isWarning
        ? "bg-amber-600 hover:bg-amber-500 text-white"
        : "bg-red-600 hover:bg-red-500 text-white"
    }`;
    retryBtn.innerHTML = `
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Tentar novamente
    `;
    retryBtn.onclick = () => {
      alertDiv.remove();
      onRetry();
    };
    alertDiv.appendChild(retryBtn);
  }

  container.appendChild(alertDiv);
  scrollToBottom();
  return alertDiv;
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