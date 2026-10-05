const STORAGE_KEY = "chatVisaSessions";

export function getSavedChats() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

export function saveChats(chats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

export function clearSavedChats() {
  localStorage.removeItem(STORAGE_KEY);
}