/* Local-only data; the service worker caches program files, never uploads ledger data. */
function downloadBackup(){const exported={...state,lastBackupAt:Date.now()};downloadFile(new Blob([JSON.stringify({format:'lanyu-ledger',version:1,...exported},null,2)],{type:'application/json'}),'小布的记账本-'+localDate(new Date())+'.json');persist(exported);renderSafety()}
$('#backupJson').onclick=downloadBackup;
$('#restoreJson').onclick=()=>$('#restoreFile').click();
function validateBackup(d){if(!d||d.format!=='lanyu-ledger'||d.version!==1||!d.categories||typeof d.categories!=='object'||Array.isArray(d.categories)||!Array.isArray(d.entries))throw Error('不是有效的小布的记账本备份');if(!Object.keys(d.categories).length)throw Error('备份缺少分类');for(const [k,v] of Object.entries(d.categories)){if(!k.trim()||k.length>16||!Array.isArray(v)||v.some(x=>typeof x!=='string'||!x.trim()||x.length>16))throw Error('分类格式错误')}const ids=new Set();for(const e of d.entries){if(!e||typeof e.id!=='string'||!e.id||ids.has(e.id)||!['income','expense'].includes(e.type)||(e.transactionKind!==undefined&&!['standard','refund','savings','transfer'].includes(e.transactionKind))||!Number.isSafeInteger(e.cents)||e.cents<=0||!Number.isFinite(e.created)||typeof e.category!=='string'||typeof e.sub!=='string'||typeof e.note!=='string'||typeof e.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date))||new Date(e.date).toISOString().slice(0,10)!==e.date)throw Error('账单格式错误');ids.add(e.id)}return CategoryCatalog.addRequestedPresets({categories:CategoryCatalog.normalizeCategories(d.categories),entries:d.entries,...validateExtras(d),budgets:normalizeBudgets(d.budgets),categoryIcons:CategoryPhotos.validateMap(d.categoryIcons),...([1,2].includes(d.categoryPresetsVersion)?{categoryPresetsVersion:d.categoryPresetsVersion}:{})})}
$('#restoreFile').onchange=async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>20*1024*1024)throw Error('备份文件过大');const next=validateBackup(JSON.parse(await file.text()));if(!confirm('恢复后将替换当前账本，是否继续？建议先备份当前数据。'))return;const serialized=JSON.stringify(next);localStorage.setItem('lanyu-ledger-before-restore',JSON.stringify(state));localStorage.setItem('lanyu-ledger-v1',serialized);state=next;editingId=null;editingOriginal=null;draftBeforeEdit=null;chooseEntryType('expense');amount='';$('#note').value='';$('#date').value=today;showAmount();updateDetails();render();renderSafety();if(state.lock?.enabled)lockLedger();else unlockLedger();toast('账本已恢复')}catch(err){toast('恢复失败：'+err.message)}finally{event.target.value=''}};

let offlineCheckSequence=0;
function paintOfflineProgress(completed,total,label){const bar=$('#offlineProgress'),caption=$('#offlineProgressText');bar.max=total;bar.value=Math.max(0,Math.min(total,completed));bar.dataset.state='active';caption.textContent=label+' '+completed+' / '+total+' · '+Math.floor(completed/total*100)+'%'}
function receiveOfflineProgress(data){if(data.type!=='OFFLINE_PROGRESS'||data.version!=='lanyu-shell-v21'||$('#offlineStatus').dataset.ready==='true')return;paintOfflineProgress(data.completed,data.total,data.stage==='save'?'正在保存并校验':'正在下载离线文件')}
if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',event=>receiveOfflineProgress(event.data||{}));
async function offlineProbe(){const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),1500);try{const response=await fetch('./__offline_status__?t='+Date.now(),{cache:'no-store',signal:abort.signal});if(!response.ok)throw Error('离线启动程序尚未接管');return await response.json()}finally{clearTimeout(timer)}}
async function repairCache(){const worker=navigator.serviceWorker.controller;if(!worker)throw Error('离线启动程序尚未接管，请联网关闭后重新打开');return await new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(Error('修复超时，请确认电脑服务正在运行'))},60000);channel.port1.onmessage=event=>{if(event.data.type==='OFFLINE_PROGRESS'){receiveOfflineProgress(event.data);return}clearTimeout(timer);channel.port1.close();event.data.error?reject(Error(event.data.error)):resolve(event.data)};worker.postMessage({type:'REPAIR_OFFLINE_CACHE'},[channel.port2])})}
async function checkOffline(repair=false){
 const sequence=++offlineCheckSequence,status=$('#offlineStatus'),details=$('#offlineDetails'),button=$('#repairOffline');button.disabled=true;status.dataset.ready='false';status.textContent=repair?'正在补全离线文件…':'正在检查本机离线读取…';details.textContent='';$('#offlineProgress').removeAttribute('value');$('#offlineProgress').dataset.state='active';$('#offlineProgressText').textContent=repair?'准备下载离线文件…':'正在核对本机文件…';
 try{
  if(!window.isSecureContext||!('serviceWorker'in navigator))throw Error('请通过已信任的 HTTPS 记账地址打开');
  let registration=await navigator.serviceWorker.getRegistration('./');
  if(!registration)registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  else if(navigator.onLine)registration.update().catch(()=>{});
  let result,lastError;
  for(let attempt=0;attempt<30;attempt++){
   if(sequence!==offlineCheckSequence)return;
   if(navigator.serviceWorker.controller){try{result=await offlineProbe();if(result.version==='lanyu-shell-v21')break}catch(err){lastError=err}}
   await new Promise(resolve=>setTimeout(resolve,200));
  }
  if(!result||result.version!=='lanyu-shell-v21')throw Error('离线启动程序未完成更新，请联网关闭后重新打开一次');
  if(repair)result=await repairCache();
  paintOfflineProgress(result.total-result.missing.length,result.total,'已缓存');
  if(!result.ready)throw Error('缺少 '+result.missing.length+' 个离线文件，请点“检查并修复离线”');
  if(sequence!==offlineCheckSequence)return;
  paintOfflineProgress(result.total,result.total,'准备完成');$('#offlineProgress').dataset.state='complete';status.textContent='离线已就绪 · 本机读取检查通过';status.dataset.ready='true';
  const desktop=!!navigator.standalone||matchMedia('(display-mode: standalone)').matches;
  details.textContent=(desktop?'已从桌面应用打开。':'当前在浏览器中，请从桌面图标再检查一次。')+' 开启飞行模式后，完全关闭并重新打开，验证离线启动。';
  navigator.storage?.persist?.().catch(()=>{});
 }catch(err){if(sequence===offlineCheckSequence){$('#offlineProgress').dataset.state='error';$('#offlineProgressText').textContent='未完成 · 可联网后重试';status.textContent='离线未就绪：'+err.message;details.textContent='请保留现有应用和账单数据，联网后在这里重试。'}}finally{if(sequence===offlineCheckSequence)button.disabled=false}
}
$('#repairOffline').onclick=()=>checkOffline(true);
checkOffline();
