const CACHE = "earnpro-v2";
const ASSETS = ["/","/index.html","/manifest.json","/icons/icon-192.png","/icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
  if(e.request.url.includes("firebase")||e.request.url.includes("googleapis"))return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    if(res.ok&&e.request.method==="GET"){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c))}
    return res;
  }).catch(()=>caches.match("/index.html"))));
});
