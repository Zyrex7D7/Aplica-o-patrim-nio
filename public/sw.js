// Service worker mínimo — o objetivo principal é tornar a app instalável
// ("Adicionar ao ecrã principal") e mostrar algo útil sem rede, e não
// implementar uma estratégia de cache agressiva: esta app depende de dados
// em tempo real da Supabase, por isso as páginas em si usam sempre a rede
// primeiro.
const CACHE_NAME = "livro-shell-v1";
const APP_SHELL = ["/offline.html", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Só nos preocupamos com navegação de páginas (HTML); tudo o resto
  // (JS, CSS, chamadas à API/Supabase) segue sempre direto à rede.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(() => caches.match("/offline.html").then((r) => r ?? Response.error()))
  );
});
