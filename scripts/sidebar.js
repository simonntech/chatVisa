const sidebar = document.getElementById("sidebar");
const historyList = document.getElementById("history-list");
const clearAllBtn = document.getElementById("clear-all-btn");

/**
 * Alterna a visibilidade da barra lateral (responsivo mobile/desktop)
 */
export function toggleSidebar() {
  if (!sidebar) return;
  if (window.innerWidth >= 768) {
    sidebar.classList.toggle("md:-ml-72");
  } else {
    sidebar.classList.toggle("-translate-x-full");
  }
}

/**
 * Fecha a barra lateral apenas se estiver em visualização mobile
 */
export function closeSidebarMobile() {
  if (sidebar && window.innerWidth < 768) {
    sidebar.classList.add("-translate-x-full");
  }
}

/**
 * Renderiza a lista de conversas salvas no histórico lateral
 * @param {Array} savedChats - Lista de conversas persistidas
 * @param {string|null} activeChatId - ID da conversa atualmente aberta
 * @param {Object} callbacks - Funções de callback { onLoadChat, onDeleteChat }
 */
export function renderHistory(savedChats, activeChatId = null, { onLoadChat, onDeleteChat } = {}) {
  if (!historyList || !clearAllBtn) return;

  historyList.innerHTML = "";

  if (!savedChats || savedChats.length === 0) {
    historyList.innerHTML = `<p class="text-xs text-gray-500 text-center py-4">Nenhuma conversa salva</p>`;
    clearAllBtn.classList.add("opacity-50", "cursor-not-allowed");
    clearAllBtn.disabled = true;
    return;
  }

  clearAllBtn.classList.remove("opacity-50", "cursor-not-allowed");
  clearAllBtn.disabled = false;

  // Renderiza do mais recente para o mais antigo sem mutar o array original
  [...savedChats].reverse().forEach((chatSession) => {
    const title = chatSession.title || "Conversa sem título";
    const isActive = chatSession.id === activeChatId;

    const itemWrapper = document.createElement("div");
    itemWrapper.className = `group flex items-center justify-between w-full rounded-lg p-1 transition-colors border ${
      isActive
        ? "bg-gray-800 border-blue-500/70 text-white"
        : "bg-gray-900 hover:bg-gray-800/80 border-transparent hover:border-gray-700 text-gray-300"
    }`;

    // Botão de carregar conversa
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `flex-1 text-left p-2 text-sm truncate focus:outline-none ${
      isActive ? "text-white font-medium" : "text-gray-300 group-hover:text-white"
    }`;
    btn.textContent = title;
    btn.title = title;
    btn.onclick = () => {
      if (typeof onLoadChat === "function") {
        onLoadChat(chatSession);
      }
    };

    // Botão de deletar conversa
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "text-gray-500 hover:text-red-400 p-2 text-xs transition-colors rounded-md";
    deleteBtn.title = "Excluir conversa";
    deleteBtn.setAttribute("aria-label", `Excluir conversa: ${title}`);
    deleteBtn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
      </svg>
    `;
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      if (typeof onDeleteChat === "function") {
        onDeleteChat(chatSession.id);
      }
    };

    itemWrapper.appendChild(btn);
    itemWrapper.appendChild(deleteBtn);
    historyList.appendChild(itemWrapper);
  });
}