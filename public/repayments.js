/* Finite installment schedules. Posted IDs survive bill deletion and backups. */
function validateRepaymentPlans(value){
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>200)throw Error('还款计划格式错误');const ids=new Set();
 return value.map(plan=>{
  if(!plan||typeof plan.id!=='string'||!plan.id||ids.has(plan.id)||typeof plan.name!=='string'||!plan.name.trim()||plan.name.length>24||!positiveCents(plan.cents)||!validDate(plan.firstDate)||typeof plan.enabled!=='boolean'||!Array.isArray(plan.installments)||!plan.installments.length||plan.installments.length>600||!Array.isArray(plan.postedIds)||plan.postedIds.some(id=>typeof id!=='string'||!id))throw Error('还款计划格式错误');
  ids.add(plan.id);const parts=new Set(),installments=plan.installments.map(part=>{if(!part||typeof part.id!=='string'||!part.id||parts.has(part.id)||!validDate(part.date)||!positiveCents(part.cents))throw Error('还款分期格式错误');parts.add(part.id);return {...part,customDate:part.customDate!==false,customAmount:part.customAmount!==false}});
  if(plan.postedIds.some(id=>!parts.has(id))||!Number.isSafeInteger(installments.reduce((sum,part)=>sum+part.cents,0)))throw Error('还款分期或金额合计无效');
  return {...plan,installments,postedIds:[...new Set(plan.postedIds)]};
 });
}
const extrasBeforeRepayments=validateExtras;
validateExtras=function(data){return {...extrasBeforeRepayments(data),repaymentPlans:validateRepaymentPlans(data.repaymentPlans)}};
function repaymentDue(firstDate,index){const [year,month,day]=firstDate.split('-').map(Number),date=new Date(year,month-1+index,1),last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();return localDate(new Date(date.getFullYear(),date.getMonth(),Math.min(day,last)))}
function settleRepayments(ledger,date=localDate(new Date())){
 let changed=false,added=0,cents=0;const entries=[...ledger.entries],existing=new Set(entries.filter(e=>e.repaymentPlanId&&e.repaymentInstallmentId).map(e=>JSON.stringify([e.repaymentPlanId,e.repaymentInstallmentId])));
 const plans=(ledger.repaymentPlans||[]).map(plan=>{
  if(!plan.enabled)return plan;const posted=new Set(plan.postedIds);
  plan.installments.forEach((part,index)=>{const key=JSON.stringify([plan.id,part.id]);if(part.date>date||posted.has(part.id))return;posted.add(part.id);changed=true;if(existing.has(key))return;existing.add(key);
   entries.push({id:'repayment:'+plan.id+':'+part.id,created:Date.now()+added,type:'expense',category:'分期还款',sub:plan.name,cents:part.cents,date:part.date,note:plan.name+' · 第 '+(index+1)+'/'+plan.installments.length+' 期还款',transactionKind:'standard',repaymentPlanId:plan.id,repaymentInstallmentId:part.id});added++;cents+=part.cents;
  });return posted.size===plan.postedIds.length?plan:{...plan,postedIds:[...posted]};
 });return {state:changed?{...ledger,entries,repaymentPlans:plans}:ledger,added,cents};
}
let repaymentEditing=null,repaymentDraft=[];
const repaymentPlans=()=>state.repaymentPlans||[];
function reconcileRepayments(){const next=settleRepayments(state);return next.state===state||persist(next.state)}
function monthlyRepaymentTotal(month=localDate(new Date()).slice(0,7)){
 const amounts=new Map();for(const plan of repaymentPlans())for(const part of plan.installments)if(part.date.startsWith(month)&&(plan.enabled||plan.postedIds.includes(part.id)))amounts.set(JSON.stringify([plan.id,part.id]),part.cents);
 for(const entry of state.entries)if(entry.repaymentPlanId&&entry.repaymentInstallmentId&&entry.date.startsWith(month)&&entry.type==='expense')amounts.set(JSON.stringify([entry.repaymentPlanId,entry.repaymentInstallmentId]),entry.cents);
 return [...amounts.values()].reduce((sum,cents)=>sum+cents,0);
}
function renderRepaymentHome(){const has=repaymentPlans().length>0;$('#repaymentHome').hidden=!has;document.documentElement.classList.toggle('has-repayments',has);$('#repaymentHomeAmount').textContent='本月计划还款 ¥ '+money(monthlyRepaymentTotal())}
function renderRepaymentRows(){
 $('#repaymentPlanRows').replaceChildren();for(const plan of repaymentPlans()){
  const row=node('div','repayment-plan'),paid=plan.postedIds.length;row.append(node('b','',plan.name),node('small','',`${plan.installments.length} 期 · 已记 ${paid} 期 · 总额 ¥ ${money(plan.installments.reduce((s,p)=>s+p.cents,0))}${paid>=plan.installments.length?' · 已完成':plan.enabled?'':' · 已暂停'}`));
  const actions=node('div','template-actions'),edit=node('button','','编辑分期'),pause=node('button','',plan.enabled?'暂停':'继续'),remove=node('button','','删除');edit.type=pause.type=remove.type='button';edit.onclick=()=>editRepayment(plan);
  pause.onclick=()=>{const next=settleRepayments({...state,repaymentPlans:repaymentPlans().map(p=>p.id===plan.id?{...p,enabled:!p.enabled}:p)});if(persist(next.state)){render();toast(plan.enabled?'计划已暂停':'已继续，到期款已补记')}};
  remove.onclick=()=>{if(confirm('删除“'+plan.name+'”计划？已记账的还款仍会保留。')&&persist({...state,repaymentPlans:repaymentPlans().filter(p=>p.id!==plan.id)})){if(repaymentEditing===plan.id)editRepayment();render()}};actions.append(edit,pause,remove);row.append(actions);$('#repaymentPlanRows').append(row);
 }if(!repaymentPlans().length)$('#repaymentPlanRows').append(node('p','muted','可添加多个还款平台，自定义期数、每期日期和金额。'));
}
function draftPosted(){return new Set(repaymentPlans().find(p=>p.id===repaymentEditing)?.postedIds||[])}
function renderRepaymentInstallments(){
 const posted=draftPosted();$('#repaymentInstallments').replaceChildren();repaymentDraft.forEach((part,index)=>{
  const row=node('div','repayment-installment'),heading=node('b','',`第 ${index+1} 期${posted.has(part.id)?' · 已记账':''}`),date=node('button','filter-choice'),amountInput=node('input');date.type='button';date.setAttribute('aria-label','第'+(index+1)+'期还款日期');date.append(node('span','',part.date),node('i','','⌄'));date.disabled=posted.has(part.id);
  date.onclick=()=>AppPickers.openDate('第 '+(index+1)+' 期还款日期',part.date,value=>{part.date=value;part.customDate=true;date.querySelector('span').textContent=value;renderRepaymentPreview()},true);
  amountInput.type='number';amountInput.inputMode='decimal';amountInput.min='0.01';amountInput.step='0.01';amountInput.setAttribute('aria-label','第'+(index+1)+'期金额（元）');amountInput.value=part.cents?(part.cents/100).toFixed(2):'';amountInput.disabled=posted.has(part.id);amountInput.oninput=()=>{part.cents=Math.round(Number(amountInput.value)*100);part.customAmount=true;renderRepaymentPreview()};
  row.append(heading,date,amountInput);$('#repaymentInstallments').append(row);
 });
}
function syncRepaymentDraft(){
 const count=Number($('#repaymentMonths').value),first=$('#repaymentFirstDate').value,cents=Math.round(Number($('#repaymentAmount').value)*100),posted=draftPosted();if(!Number.isInteger(count)||count<1||count>600||!validDate(first))return;
 if(repaymentDraft.slice(count).some(p=>posted.has(p.id))){$('#repaymentError').textContent='已记账的期数不能删除';$('#repaymentMonths').value=repaymentDraft.length;return}
 repaymentDraft=Array.from({length:count},(_,index)=>{const old=repaymentDraft[index];if(old){if(!posted.has(old.id)){if(!old.customDate)old.date=repaymentDue(first,index);if(!old.customAmount)old.cents=cents}return old}return {id:crypto.randomUUID(),date:repaymentDue(first,index),cents,customDate:false,customAmount:false}});renderRepaymentInstallments();renderRepaymentPreview();
}
function readRepaymentDraft(){
 const count=Number($('#repaymentMonths').value),name=$('#repaymentName').value.trim(),cents=Math.round(Number($('#repaymentAmount').value)*100),firstDate=$('#repaymentFirstDate').value,old=repaymentPlans().find(p=>p.id===repaymentEditing),posted=new Set(old?.postedIds||[]);
 // A due installment may have posted while this editor was open. Preserve it.
 const installments=repaymentDraft.map(part=>posted.has(part.id)?structuredClone(old.installments.find(item=>item.id===part.id)):structuredClone(part));
 if(!Number.isInteger(count)||count<1||count>600||count!==installments.length||!name||name.length>24||!positiveCents(cents)||!validDate(firstDate)||!installments.length||installments.some(p=>!validDate(p.date)||!positiveCents(p.cents))||!Number.isSafeInteger(installments.reduce((sum,p)=>sum+p.cents,0)))return null;
 return {id:old?.id||'preview',name,cents,firstDate,enabled:old?.enabled??true,postedIds:old?.postedIds||[],installments};
}
function repaymentDraftState(plan){return {...state,repaymentPlans:repaymentEditing?repaymentPlans().map(p=>p.id===repaymentEditing?plan:p):[...repaymentPlans(),plan]}}
function renderRepaymentPreview(){const plan=readRepaymentDraft();if(!plan){$('#repaymentPreview').textContent='每期日期和金额可单独设置，保存后到期自动记账。';return}const next=settleRepayments(repaymentDraftState(plan));$('#repaymentPreview').textContent=next.added?`保存后将立即补记 ${next.added} 笔到期还款，共 ¥ ${money(next.cents)}。`:'当前没有待补记还款，到期自动记账。'}
function editRepayment(plan){repaymentEditing=plan?.id||null;repaymentDraft=plan?structuredClone(plan.installments):[];$('#repaymentFormTitle').textContent=plan?'编辑还款计划':'新增还款计划';$('#repaymentName').value=plan?.name||'';$('#repaymentAmount').value=plan?(plan.cents/100).toFixed(2):'';$('#repaymentFirstDate').value=plan?.firstDate||localDate(new Date());$('#repaymentMonths').value=plan?.installments.length||'';$('#choose_repaymentFirstDate span').textContent=$('#repaymentFirstDate').value;$('#repaymentError').textContent='';renderRepaymentInstallments();syncRepaymentDraft();renderRepaymentPreview()}
function openRepayments(){reconcileRepayments();editRepayment();renderRepaymentRows();$('#repaymentDialog').showModal()}
$('#openRepayments').onclick=$('#repaymentHomeOpen').onclick=openRepayments;$('#newRepayment').onclick=()=>editRepayment();
for(const id of ['repaymentAmount','repaymentFirstDate','repaymentMonths'])$('#'+id).addEventListener('input',syncRepaymentDraft);$('#repaymentName').addEventListener('input',renderRepaymentPreview);
$('#repaymentForm').onsubmit=event=>{event.preventDefault();const plan=readRepaymentDraft();if(!plan){$('#repaymentError').textContent='请检查名称、默认金额及每一期的日期和金额。';return}if(!repaymentEditing)plan.id=crypto.randomUUID();const next=settleRepayments(repaymentDraftState(plan));if(persist(next.state)){editRepayment();render();toast(next.added?'计划已保存，已记 '+next.added+' 笔还款':'还款计划已保存')}};
const renderBeforeRepayments=render;render=function(){reconcileRepayments();renderBeforeRepayments();renderRepaymentHome();if($('#repaymentDialog').open)renderRepaymentRows()};setInterval(()=>render(),60000);render();
