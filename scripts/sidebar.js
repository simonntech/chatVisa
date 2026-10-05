import { getSavedChats, saveChats, clearSavedChats } from "./storage.js";

const sidebar = document.getElementById("sidebar");
const historyList = document.getElementById("history-list");
const clearAllBtn = document.getElementById("clear-all-btn");

export function toggleSidebar() {
  if (window.innerWidth >= 768) {
    sidebar.classList.toggle("md:-ml-72");
  } else {
    sidebar.classList.toggle("-translate-x-full");
  }
}

export function renderHistory(savedChats, onLoadChat, onDeleteChat) {
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
    itemWrapper.className =
      "group flex items-center justify-between w-full bg-gray-900 hover:bg-gray-700 rounded-lg p-1 transition-colors border border-transparent hover:border-gray-600";

    const btn = document.createElement("button");
    btn.className = "flex-1 text-left p-2 text-sm truncate text-gray-300 hover:text-white focus:outline-none";
    btn.textContent = title;
    btn.title = title;
    btn.onclick = () => onLoadChat(chatSession);

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
      onDeleteChat(realIndex);
    };

    itemWrapper.appendChild(btn);
    itemWrapper.appendChild(deleteBtn);
    historyList.appendChild(itemWrapper);
  });
}