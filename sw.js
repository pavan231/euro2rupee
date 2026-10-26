const CACHE="e2r-v2";
const SHELL=["/","/index.html","/privacy.html","/style.css","/script.js","/reminders.js","/firebase-config.js","/sports.json","/manifest.webmanifest","/icons/icon-192.png","/icons/apple-touch-icon.png"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch",e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=="GET")return;

  // Versioned Firebase SDK files never change: cache first.
  if(url.hostname==="www.gstatic.com"&&url.pathname.startsWith("/firebasejs/")){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{
      const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res;
    })));
    return;
  }

  // Own files: network first so updates show immediately, cache when offline.
  if(url.origin===location.origin){
    e.respondWith(fetch(req).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}
      return res;
    }).catch(()=>caches.match(req,{ignoreSearch:true}).then(hit=>hit||(req.mode==="navigate"?caches.match("/index.html"):Response.error()))));
  }
});
