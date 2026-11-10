const CACHE='lanyu-shell-v24';
const ASSETS=['./','./index.html','./pwa.js','./app.js','./features.js','./style.css','./glass.css','./category-catalog.js','./category-photos.js',"./assets/category-icons/living-allowance.png","./assets/category-icons/other-income.png","./assets/category-icons/scholarship.png","./assets/category-icons/airplane.png","./assets/category-icons/bus.png","./assets/category-icons/car.png","./assets/category-icons/daily-entertainment.png","./assets/category-icons/daily-supplies.png","./assets/category-icons/drinks.png","./assets/category-icons/education.png","./assets/category-icons/entertainment-venue.png","./assets/category-icons/fitness.png","./assets/category-icons/generic.png","./assets/category-icons/gifts.png","./assets/category-icons/group-dining.png","./assets/category-icons/healthcare.png","./assets/category-icons/high-speed-rail.png","./assets/category-icons/home-repair.png","./assets/category-icons/housing-utilities.png","./assets/category-icons/intercity-travel.png","./assets/category-icons/meal-staple.png","./assets/category-icons/metro.png","./assets/category-icons/personal-care.png","./assets/category-icons/pet.png","./assets/category-icons/public-transport.png","./assets/category-icons/refund.png","./assets/category-icons/salary.png","./assets/category-icons/savings.png","./assets/category-icons/shopping-clothing.png","./assets/category-icons/shopping-electronics.png","./assets/category-icons/shopping-food.png","./assets/category-icons/snacks.png","./assets/category-icons/subscription.png","./assets/category-icons/telecom.png","./assets/category-icons/transfer.png","./assets/category-icons/travel-hotel.png",'./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'];

const STATUS_URL=new URL('./__offline_status__',self.registration.scope).href;
async function cacheStatus(){const cache=await caches.open(CACHE);const missing=[];for(const asset of ASSETS)if(!(await cache.match(asset)))missing.push(asset);return {version:CACHE,total:ASSETS.length,missing,ready:missing.length===0}}
async function downloadShell(onProgress){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),45000),responses=[];
 const progress=(completed,stage)=>onProgress({type:'OFFLINE_PROGRESS',version:CACHE,completed,total:ASSETS.length,stage});
 try{
  await progress(0,'download');
  for(let index=0;index<ASSETS.length;index++){
   const request=new Request(new URL(ASSETS[index],self.registration.scope),{cache:'reload'});
   const response=await fetch(request,{signal:abort.signal});if(!response.ok)throw Error('Offline file download failed');
   const body=await response.arrayBuffer();responses.push([request,new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers})]);
   await progress(index+1,'download');
  }
  await progress(ASSETS.length,'save');const cache=await caches.open(CACHE);
  await Promise.all(responses.map(([request,response])=>cache.put(request,response)));
  return await cacheStatus();
 }finally{clearTimeout(timer)}
}
async function broadcastProgress(data){const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of clients)client.postMessage(data)}
self.addEventListener('install',event=>event.waitUntil((async()=>{await downloadShell(broadcastProgress);await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('lanyu-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('message',event=>{if(event.data?.type!=='REPAIR_OFFLINE_CACHE'||!event.ports[0])return;event.waitUntil((async()=>{const port=event.ports[0];try{const result=await downloadShell(data=>port.postMessage(data));port.postMessage(result)}catch{port.postMessage({error:'无法补全离线文件，请确认手机与电脑同网，且电脑服务正在运行。'})}})())});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.href.split('?')[0]===STATUS_URL){event.respondWith((async()=>new Response(JSON.stringify(await cacheStatus()),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}))());return}
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  // Launch the versioned app shell directly from disk, even if LAN requests hang.
  if(event.request.mode==='navigate'){const shell=await cache.match('./index.html');if(shell)return shell;try{return await fetch(event.request)}catch{return new Response('离线启动文件缺失。请联网打开原地址，在设置中检查并修复离线。',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}})}}
  const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;
  try{return await fetch(event.request)}catch{return Response.error()}
 })());
});
