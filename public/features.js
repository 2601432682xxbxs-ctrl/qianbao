/* All data stays on this device. Optional fields extend version 1 backups. */
function validateExtras(d){
 const templates=d.templates??[];
 if(!Array.isArray(templates))throw Error('模板格式错误');
 const ids=new Set();
 for(const t of templates){if(!t||typeof t.id!=='string'||!t.id||ids.has(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>40||typeof t.category!=='string'||!t.category||typeof t.sub!=='string'||!Number.isSafeInteger(t.cents)||t.cents<=0||!['monthly','weekly'].includes(t.cycle)||!Number.isInteger(t.day)||t.day<(t.cycle==='weekly'?0:1)||t.day>(t.cycle==='weekly'?6:31))throw Error('模板格式错误');ids.add(t.id)}
 const lock=d.lock??{enabled:false};
 if(!lock||typeof lock.enabled!=='boolean'||(lock.enabled&&(!/^[a-f0-9]{32}$/.test(lock.salt)||!/^[a-f0-9]{64}$/.test(lock.hash))))throw Error('PIN 设置格式错误');
 return {templates,lock:lock.enabled?{enabled:true,salt:lock.salt,hash:lock.hash}:{enabled:false},...(Number.isFinite(d.lastBackupAt)&&d.lastBackupAt>0?{lastBackupAt:d.lastBackupAt}:{})};
}
let templateEditing=null,pendingTemplate=null;
const templates=()=>Array.isArray(state.templates)?state.templates:[];
function templateDue(t,date=new Date()){
 if(t.cycle==='weekly')return date.getDay()===t.day;
 return date.getDate()===Math.min(t.day,new Date(date.getFullYear(),date.getMonth()+1,0).getDate());
}
function templateRecorded(t){return state.entries.some(e=>e.templateId===t.id&&e.templateDueDate===localDate(new Date()))}
function tomorrowDate(date=new Date()){const next=new Date(date);next.setDate(next.getDate()+1);return next}
function renderAdvanceReminder(){const rows=templates().filter(t=>templateDue(t,tomorrowDate())&&!templateRecorded(t));$('#recurringTomorrow').hidden=!rows.length;$('#recurringTomorrow').textContent=`明天有固定支出待记（${rows.length} 笔）`}
function renderSafety(){
 const due=templates().filter(t=>templateDue(t)&&!templateRecorded(t));
 $('#recurringNotice').textContent=due.length?`今天有固定支出待记（${due.length} 笔），点下方管理模板记账`:'今天没有固定支出待记';
 renderAdvanceReminder();
 $('#backupReminder').hidden=!!state.lastBackupAt&&Date.now()-state.lastBackupAt<=7*86400000;
 $('#pinStatus').textContent=state.lock?.enabled?'开屏锁已开启：打开应用或从后台切回时输入 PIN。':'开屏锁已关闭（默认）。';
 $('#disablePin').hidden=!state.lock?.enabled;
}
function templateSubs(selected=''){
 const c=$('#templateCategory').value,subs=[...new Set([...(state.categories[c]||[]),...(selected?[selected]:[])])];
 $('#templateSub').replaceChildren(new Option('无细分类',''),...subs.map(s=>new Option(s,s)));$('#templateSub').value=selected;
}
function templateDays(day){
 const weekly=$('#templateCycle').value==='weekly';
 $('#templateDay').replaceChildren(...Array.from({length:weekly?7:31},(_,i)=>new Option(weekly?['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][i]:`${i+1} 日`,String(weekly?i:i+1))));
 if(day!==undefined)$('#templateDay').value=String(day);
}
function editTemplate(t){
 templateEditing=t?.id||null;$('#templateHeading').textContent=t?'编辑模板':'新增模板';$('#templateName').value=t?.name||'';$('#templateAmount').value=t?(t.cents/100).toFixed(2):'';
 const cats=[...new Set([...Object.keys(state.categories),...(t?[t.category]:[])])];$('#templateCategory').replaceChildren(...cats.map(c=>new Option(CategoryCatalog.label(c),c)));$('#templateCategory').value=t?.category||cats[0];templateSubs(t?.sub||'');$('#templateCycle').value=t?.cycle||'monthly';templateDays(t?.day);
}
function renderTemplates(){
 $('#recurringRows').replaceChildren();
 for(const t of templates()){
 const due=templateDue(t),done=templateRecorded(t),r=node('div','template-row');r.append(node('b','',t.name),node('small','',`¥ ${(t.cents/100).toFixed(2)} · ${CategoryCatalog.label(t.category)}${t.sub?' / '+t.sub:''} · ${t.cycle==='monthly'?'每月 '+t.day+' 日':'每周'+['日','一','二','三','四','五','六'][t.day]}${due?(done?' · 今天已记':' · 今天待记'):''}${!done&&templateDue(t,tomorrowDate())?' · 明天待记':''}`));
 const actions=node('div','template-actions');
 if(due&&!done){const record=node('button','','记一笔');record.onclick=()=>{pendingTemplate=t;$('#recurringAmount').value=(t.cents/100).toFixed(2);$('#recurringNote').value=t.name;$('#recurringEntryInfo').textContent=`${localDate(new Date())} · ${CategoryCatalog.label(t.category)}${t.sub?' / '+t.sub:''}`;$('#recurringEntryDialog').showModal()};actions.append(record)}
 const edit=node('button','','编辑'),del=node('button','','删除');edit.onclick=()=>{editTemplate(t);$('#templateName').focus()};del.onclick=()=>{if(confirm('删除模板“'+t.name+'”？已有账单会保留。')&&persist({...state,templates:templates().filter(x=>x.id!==t.id)})){if(templateEditing===t.id)editTemplate();renderTemplates();renderSafety()}};actions.append(edit,del);r.append(actions);$('#recurringRows').append(r);
 }
}
$('#openRecurring').onclick=()=>{editTemplate();renderTemplates();$('#recurringDialog').showModal()};
$('#newTemplate').onclick=()=>editTemplate();$('#templateCategory').onchange=()=>templateSubs();$('#templateCycle').onchange=()=>templateDays();
$('#recurringForm').onsubmit=e=>{e.preventDefault();const cents=Math.round(Number($('#templateAmount').value)*100),name=$('#templateName').value.trim();if(!name||!Number.isSafeInteger(cents)||cents<=0)return toast('请输入名称和有效金额');const t={id:templateEditing||crypto.randomUUID(),name,cents,category:$('#templateCategory').value,sub:$('#templateSub').value,cycle:$('#templateCycle').value,day:Number($('#templateDay').value)};if(persist({...state,templates:templateEditing?templates().map(x=>x.id===templateEditing?t:x):[...templates(),t]})){editTemplate();renderTemplates();renderSafety();toast('模板已保存，不会自动生成账单')}};
$('#recurringEntryForm').onsubmit=e=>{e.preventDefault();const t=pendingTemplate,cents=Math.round(Number($('#recurringAmount').value)*100);if(!t||!templates().some(x=>x.id===t.id)||!templateDue(t)||templateRecorded(t))return toast('模板已变更或今天已记，请重新打开');if(!Number.isSafeInteger(cents)||cents<=0)return toast('请输入有效金额');const date=localDate(new Date()),entry={id:crypto.randomUUID(),created:Date.now(),date,type:'expense',category:t.category,sub:t.sub,cents,note:$('#recurringNote').value.trim(),transactionKind:CategoryCatalog.kind({category:t.category,type:'expense'}),templateId:t.id,templateDueDate:date};if(persist({...state,entries:[...state.entries,entry]})){pendingTemplate=null;$('#recurringEntryDialog').close();render();renderTemplates();renderSafety();toast('固定支出已记好')}};
function downloadFile(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
function csvText(rows){
 // Quote every field and neutralize spreadsheet formulas in user-controlled text.
 const cell=v=>'"'+String(v).replace(/^[=+\-@\t\r\n]/,"'$&").replaceAll('"','""')+'"';
 return '\uFEFF'+[['日期','类型','大分类','细分类','金额','备注'],...rows.map(e=>[e.date,e.type==='income'?'收入':'支出',CategoryCatalog.label(e.category),e.sub,(e.cents/100).toFixed(2),e.note])].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
$('#openCsv').onclick=()=>$('#csvDialog').showModal();
$('#exportCsv').onclick=()=>{const scope=$('#csvScope').value,rows=scope==='filtered'?filteredRecords():scope==='month'?state.entries.filter(e=>e.date.startsWith(currentMonth())):state.entries;downloadFile(new Blob([csvText(rows)],{type:'text/csv;charset=utf-8'}),`lanyu-ledger-${localDate(new Date())}.csv`);toast(`已导出 ${rows.length} 条记录`)};
$('#backupReminder').onclick=()=>downloadBackup();
const originalOpenSettings=$('#openSettings').onclick;
$('#openSettings').onclick=()=>{renderSafety();originalOpenSettings()};
// A salted digest avoids storing the PIN itself. This is a screen lock, not encryption.
async function pinDigest(pin,salt){const bytes=new TextEncoder().encode(salt+':'+pin);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')}
let lockEpoch=0,unlocking=false,lockTimer;
function readAttempts(){try{return JSON.parse(localStorage.getItem('lanyu-pin-attempts'))||{count:0,until:0}}catch{return {count:0,until:0}}}
function writeAttempts(value){try{localStorage.setItem('lanyu-pin-attempts',JSON.stringify(value));return true}catch{toast('无法保存锁定状态，请检查本机存储');return false}}
function lockMessage(){const a=readAttempts(),seconds=Math.ceil((a.until-Date.now())/1000);$('#unlockButton').disabled=seconds>0;$('#unlockPin').disabled=seconds>0;$('#lockMessage').textContent=seconds>0?`输错 5 次，请 ${seconds} 秒后重试`:a.count?`PIN 错误，还可尝试 ${5-a.count} 次`:''}
function lockLedger(){if(!state.lock?.enabled)return;lockEpoch++;document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.documentElement.classList.add('locked');$('.app').inert=true;$('#unlockPin').value='';lockMessage();clearInterval(lockTimer);lockTimer=setInterval(lockMessage,1000)}
function unlockLedger(){document.documentElement.classList.remove('locked');$('.app').inert=false;clearInterval(lockTimer);$('#unlockPin').value='';renderSafety()}
$('#unlockForm').onsubmit=async e=>{e.preventDefault();if(unlocking||!state.lock?.enabled)return;const a=readAttempts();if(a.until>Date.now())return lockMessage();unlocking=true;const epoch=lockEpoch,lock=state.lock,pin=$('#unlockPin').value;try{const hash=await pinDigest(pin,lock.salt);if(epoch!==lockEpoch||lock!==state.lock)return;if(hash===lock.hash){if(writeAttempts({count:0,until:0}))unlockLedger()}else{const count=(a.until?0:a.count||0)+1;writeAttempts({count:count>=5?0:count,until:count>=5?Date.now()+60000:0});$('#unlockPin').value='';lockMessage()}}catch{toast('PIN 校验失败，请使用受信任的 HTTPS 打开')}finally{unlocking=false}};
$('#openPin').onclick=()=>{renderSafety();$('#newPin').value='';$('#confirmPin').value='';$('#pinDialog').showModal()};
$('#pinForm').onsubmit=async e=>{e.preventDefault();const pin=$('#newPin').value;if(!/^\d{4}$/.test(pin)||pin!==$('#confirmPin').value)return toast('请输入两次相同的 4 位数字 PIN');const epoch=lockEpoch;try{const salt=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),hash=await pinDigest(pin,salt);if(epoch!==lockEpoch)return;if(persist({...state,lock:{enabled:true,salt,hash}})){writeAttempts({count:0,until:0});$('#pinDialog').close();lockLedger()}}catch{toast('无法设置 PIN，请使用受信任的 HTTPS 打开')}};
$('#disablePin').onclick=()=>{if(persist({...state,lock:{enabled:false}})){writeAttempts({count:0,until:0});renderSafety();$('#pinDialog').close();toast('开屏锁已关闭')}};
$('#resetLedger').onclick=()=>{if(!confirm('清除将永久删除本机账单、分类、模板和 PIN。请先确认已导出备份；没有备份将无法找回。是否继续？'))return;if(!confirm('再次确认：清除本机账本及恢复前副本，并重置 PIN？此操作无法撤销。'))return;try{for(const key of ['lanyu-ledger-v1','lanyu-ledger-before-restore','lanyu-pin-attempts'])localStorage.removeItem(key);location.reload()}catch{toast('清除失败，请检查本机存储')}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)lockLedger();else{if(state.lock?.enabled)lockLedger();renderSafety()}});
window.addEventListener('pageshow',e=>{if(e.persisted)lockLedger()});
// Refresh due dates and reminders across midnight without changing the home layout.
setInterval(()=>{renderSafety();if($('#recurringDialog').open)renderTemplates()},60000);
renderSafety();if(state.lock?.enabled)lockLedger();else unlockLedger();
