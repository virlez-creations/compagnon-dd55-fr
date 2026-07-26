const MENU_ID = "dd55-translate-sheet";
let menuReady = false;

function setupContextMenu(): void {
  if (menuReady) return;
  menuReady = true;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Traduire cette fiche D&D 2024",
      contexts: ["all"],
      documentUrlPatterns: [
        "https://app.roll20.net/*",
        "https://*.roll20.net/*",
        "https://*.roll20preflight.net/*",
        "https://storage.googleapis.com/roll20-cdn/*"
      ]
    });
  });
}

setupContextMenu();
chrome.runtime.onInstalled.addListener(setupContextMenu);

chrome.action.onClicked.addListener(tab => {
  if (!tab.id) return;
  void chrome.tabs.sendMessage(tab.id, { type: "DD55_TOGGLE_LAUNCHER" }, { frameId: 0 });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id) return;
  void chrome.tabs.sendMessage(tab.id, { type: "DD55_TRANSLATE_SHEET" }, { frameId: info.frameId ?? 0 });
});

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (!message || typeof message !== "object") return;
  if ((message as { type?: string }).type === "DD55_SHEET_DETECTED") {
    if (sender.tab?.id) void chrome.tabs.sendMessage(sender.tab.id, { type: "DD55_ENABLE_COMPANION" }, { frameId: 0 });
    return;
  }
  if ((message as { type?: string }).type === "DD55_OPEN_EXTERNAL") {
    const url = (message as { url?: string }).url;
    if (!url || !/^https:\/\/www\.aidedd\.org\/(?:feat|spell)\/fr\/[a-z0-9-]+$/.test(url)) return;
    void chrome.tabs.create({ url });
    return;
  }
  if ((message as { type?: string }).type !== "DD55_OPEN_COMPENDIUM") return;
  const entryId = (message as { entryId?: string }).entryId;
  if (!entryId || !sender.tab?.id) return;
  void chrome.tabs.sendMessage(sender.tab.id, { type: "DD55_SHOW_ENTRY", entryId }, { frameId: 0 });
});
