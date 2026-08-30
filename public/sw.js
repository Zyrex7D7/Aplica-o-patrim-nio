self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
// Sem cache agressivo: os dados são financeiros e têm de estar sempre atualizados.
// Este service worker existe só para cumprir os critérios de instalação da PWA.
self.addEventListener("fetch", () => {});
