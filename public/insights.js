/* 2.9 optional version-1 backup fields. Amounts remain integer cents. */
const filterFields=['recordSearch','recordType','recordCategory','recordStart','recordEnd','recordMin','recordMax'];
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const positiveCents=n=>Number.isSafeInteger(n)&&n>0;
const extras28=validateExtras;
validateExtras=function(d){
 const result=extras28(d),savedFilters=d.savedFilters??[],goals=d.goals??[],loans=d.loans??[];
 const check=(rows,valid,label)=>{const ids=new Set();if(!Array.isArray(rows))throw Error(label+'格式错误');for(const r of rows){if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||!valid(r))throw Error(label+'格式错误');ids.add(r.id)}};
 const name=(r,max)=>typeof r.name==='string'&&!!r.name.trim()&&r.name.length<=max;
 check(savedFilters,r=>name(r,16)&&r.filters&&filterFields.every(k=>typeof r.filters[k]==='string'), '常用筛选');
 check(goals,r=>name(r,20)&&positiveCents(r.target)&&Number.isSafeInteger(r.saved)&&r.saved>=0&&(!r.date||validDate(r.date)),'攒钱目标');
 check(loans,r=>name(r,16)&&positiveCents(r.cents)&&['out','in'].includes(r.direction)&&validDate(r.date)&&typeof r.note==='string'&&['unpaid','paid'].includes(r.status)&&(r.status!=='paid'||validDate(r.repaidDate)),'借出借入');
 return {...result,savedFilters,goals,loans,eveningReminder:{enabled:d.eveningReminder?.enabled!==false,dismissed:validDate(d.eveningReminder?.dismissed)?d.eveningReminder.dismissed:''}};
};
function renderEvening(now=new Date()){
 const date=localDate(now);$('#eveningEnabled').checked=state.eveningReminder?.enabled!==false;
 $('#eveningNotice').hidden=now.getHours()<21||state.eveningReminder?.enabled===false||state.eveningReminder?.dismissed===date||state.entries.some(e=>e.date===date);
}
function dismissEvening(){if(persist({...state,eveningReminder:{enabled:state.eveningReminder?.enabled!==false,dismissed:localDate(new Date())}}))renderEvening()}
$('#eveningDismiss').onclick=dismissEvening;$('#eveningAction').onclick=()=>{dismissEvening();if(editingId)finishEditing();$('#date').value=localDate(new Date());updateDetails();$('#note').focus()};
$('#eveningEnabled').onchange=()=>{persist({...state,eveningReminder:{...state.eveningReminder,enabled:$('#eveningEnabled').checked}});renderEvening()};
const safety28=renderSafety;renderSafety=function(){safety28();renderEvening();renderSavedFilters()};
function amountBounds(){
 const parse=id=>{const raw=$('#'+id).value.trim(),n=Number(raw);return raw&&Number.isFinite(n)&&n>=0&&Number.isSafeInteger(Math.round(n*100))?Math.round(n*100):null};
 let min=parse('recordMin'),max=parse('recordMax');const reversed=min!==null&&max!==null&&min>max;
 $('#rangeHint').textContent=reversed?'下限大于上限，金额范围暂不生效。':'非法或负数金额视为未填。';
 if(reversed)min=max=null;return {min,max};
}
const records28=filteredRecords;filteredRecords=function(){const {min,max}=amountBounds();return records28().filter(e=>(min===null||e.cents>=min)&&(max===null||e.cents<=max))};
for(const id of ['recordMin','recordMax'])$('#'+id).oninput=()=>{renderRecords();$('#records').scrollTop=0};
function readFilter(){return Object.fromEntries(filterFields.map(k=>[k,$('#'+k).value]))}
function applyFilter(filters){syncRecordCategories();for(const k of filterFields){const el=$('#'+k),value=filters[k]||'';if(k==='recordCategory'&&value&&![...el.options].some(o=>o.value===value))el.add(new Option(CategoryCatalog.label(value),value));el.value=value}renderRecords();$('#records').scrollTop=0}
$('#clearFilters').onclick=()=>applyFilter({});
function renderSavedFilters(){const box=$('#savedFilterTags');box.replaceChildren();for(const f of state.savedFilters||[]){const tag=node('div','filter-tag'),apply=node('button','',f.name),del=node('button','','×');apply.onclick=()=>applyFilter(f.filters);del.setAttribute('aria-label','删除筛选'+f.name);del.onclick=()=>{if(persist({...state,savedFilters:state.savedFilters.filter(x=>x.id!==f.id)}))renderSavedFilters()};tag.append(apply,del);box.append(tag)}}
$('#saveFilter').onclick=()=>{const name=$('#filterName').value.trim();if(!name||name.length>16)return toast('请输入最多 16 字的筛选名称');const rows=state.savedFilters||[],old=rows.find(f=>f.name===name);if(old&&!confirm('同名筛选已存在，是否覆盖？'))return;const f={id:old?.id||crypto.randomUUID(),name,filters:readFilter()};if(persist({...state,savedFilters:old?rows.map(x=>x.id===old.id?f:x):[...rows,f]})){renderSavedFilters();toast('常用筛选已保存')}};
function monthlyNarrative(key){
 const rows=state.entries.filter(e=>inLedgerMonth(e,key));if(!rows.length)return '本月还没有账单';
 const t=totals(rows),[y,m]=key.split('-').map(Number),previous=localDate(new Date(y,m-2,1)).slice(0,7),last=totals(state.entries.filter(e=>inLedgerMonth(e,previous))).expense;
 const categories=[...new Set([...Object.keys(state.categories),...rows.map(e=>e.category)])];let top='',largest=0;
 for(const c of categories){const n=totals(rows.filter(e=>e.category===c)).expense;if(n>largest){top=c;largest=n}}
 const diff=t.expense-last,comparison=last?`比上月${diff>=0?'多':'少'}支出 ¥ ${money(Math.abs(diff))}（${(Math.abs(diff)/last*100).toFixed(2)}%）`:'上月无支出';
 return `本月支出 ¥ ${money(t.expense)}，收入 ¥ ${money(t.income)}，结余 ¥ ${money(t.income-t.expense)}。${top?`支出最多的是${CategoryCatalog.label(top)}：¥ ${money(largest)}，占支出 ${(largest/t.expense*100).toFixed(2)}%。`:'本月无支出。'}${comparison}。`;
}
const summary28=renderSummary;renderSummary=function(){summary28();$('#monthlyNarrative').textContent=monthlyNarrative($('#month').value)};
let calendarMonth=localDate(new Date()).slice(0,7),annualYear=new Date().getFullYear();
function shiftMonth(key,offset){const [y,m]=key.split('-').map(Number);return localDate(new Date(y,m-1+offset,1)).slice(0,7)}
function calendarMoney(cents){return cents>=1000000?(cents/1000000).toFixed(1)+'万':(cents/100).toFixed(2)}
function renderCalendar(){
 $('#calendarLabel').textContent=calendarMonth.replace('-',' 年 ')+' 月';const box=$('#calendarGrid');box.replaceChildren();for(const day of ['日','一','二','三','四','五','六'])box.append(node('span','weekday',day));
 const [y,m]=calendarMonth.split('-').map(Number),days=new Date(y,m,0).getDate(),data=Array.from({length:days},(_,i)=>{const date=calendarMonth+'-'+String(i+1).padStart(2,'0');return {date,...totals(state.entries.filter(e=>e.date===date))}}),max=Math.max(1,...data.map(d=>d.expense));
 for(let i=0;i<new Date(y,m-1,1).getDay();i++)box.append(node('span'));
 for(const d of data){const b=node('button','calendar-day');b.dataset.date=d.date;b.setAttribute('aria-label',`${d.date} 支出 ${money(d.expense)} 收入 ${money(d.income)}`);b.append(node('b','',String(Number(d.date.slice(-2)))));if(d.expense){b.style.background=`color-mix(in srgb,var(--accent) ${Math.round(8+40*d.expense/max)}%,var(--ground))`;b.append(node('small','',calendarMoney(d.expense)))}if(d.income)b.append(node('small','day-income','+'+calendarMoney(d.income)));if(d.date===localDate(new Date()))b.classList.add('is-today');b.onclick=()=>{applyFilter({recordStart:d.date,recordEnd:d.date});$('#recordsDialog').showModal()};box.append(b)}
}
$('#openCalendar').onclick=()=>{calendarMonth=$('#month').value;renderCalendar();$('#calendarDialog').showModal()};
$('#calendarPrev').onclick=()=>{calendarMonth=shiftMonth(calendarMonth,-1);renderCalendar()};$('#calendarNext').onclick=()=>{calendarMonth=shiftMonth(calendarMonth,1);renderCalendar()};
// Close underlying analysis dialogs when editing, exposing the existing home editor.
const beginEdit28=beginEdit;beginEdit=function(id){for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();beginEdit28(id)};
function renderAnnual(){
 $('#annualLabel').textContent=annualYear+' 年';const data=Array.from({length:12},(_,i)=>{const key=annualYear+'-'+String(i+1).padStart(2,'0');return {key,...totals(state.entries.filter(e=>inLedgerMonth(e,key)))}}),max=Math.max(1,...data.flatMap(d=>[d.income,d.expense])),chart=$('#annualChart');chart.replaceChildren();
 for(const [i,d] of data.entries()){const group=node('div','month-column'),bars=node('div','month-bars');for(const kind of ['income','expense']){const bar=node('div','month-bar '+kind);bar.style.height=d[kind]/max*100+'%';bars.append(bar)}const detail=node('details','chart-detail');detail.append(node('summary','',i+1+'月账月'),node('span','',ledgerRangeShort(d.key)+'；收入 '+money(d.income)+'；支出 '+money(d.expense)));group.append(bars,detail);chart.append(group)}
 const income=data.reduce((a,d)=>a+d.income,0),expense=data.reduce((a,d)=>a+d.expense,0);$('#annualTotals').textContent=`年总收入 ¥ ${money(income)} · 年总支出 ¥ ${money(expense)} · 年结余 ¥ ${money(income-expense)} · 月均支出 ¥ ${money(expense/12)} · 月均收入 ¥ ${money(income/12)}`;
}
$('#openAnnual').onclick=()=>{annualYear=new Date().getFullYear();renderAnnual();$('#annualDialog').showModal()};$('#annualPrev').onclick=()=>{annualYear--;renderAnnual()};$('#annualNext').onclick=()=>{annualYear++;renderAnnual()};
$('#saveThreshold').onclick=()=>{const b=normalizeBudgets({...state.budgets,threshold:$('#budgetThreshold').value});if(persist({...state,budgets:b})){render();renderBudgetSettings();toast('提醒比例已保存')}};
const budgets28=renderBudgetSettings;renderBudgetSettings=function(){budgets28();$('#budgetThreshold').value=normalizeBudgets(state.budgets).threshold};
$('#budgetThreshold').onchange=()=>{$('#budgetThreshold').value=normalizeBudgets({threshold:$('#budgetThreshold').value}).threshold};
// Independent savings goals and loans never enter state.entries or accounting totals.
let goalEditing=null,loanEditing=null;
const goals=()=>state.goals||[],loans=()=>state.loans||[];
function editGoal(g){goalEditing=g?.id||null;$('#goalHeading').textContent=g?'编辑目标':'新增目标';$('#goalName').value=g?.name||'';$('#goalAmount').value=g?(g.target/100).toFixed(2):'';$('#goalSaved').value=g?(g.saved/100).toFixed(2):'0';$('#goalDate').value=g?.date||''}
function remainingDays(date,now=new Date()){const [y,m,d]=date.split('-').map(Number);return Math.round((Date.UTC(y,m-1,d)-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000)}
function renderGoals(){const box=$('#goalRows');box.replaceChildren();if(!goals().length)box.append(node('p','muted','还没有攒钱目标'));for(const g of goals()){const r=node('div','template-row'),percent=g.saved/g.target*100;r.append(node('b','',g.name),node('small','',`已存 ¥ ${money(g.saved)} / ¥ ${money(g.target)} · ${percent.toFixed(2)}% · ${g.saved>=g.target?'已达成':'还差 ¥ '+money(g.target-g.saved)}${g.date?' · '+(remainingDays(g.date)<=0?'已到期':'剩余 '+remainingDays(g.date)+' 天'):''}`),budgetMeter(g.saved,g.target));const actions=node('div','template-actions'),edit=node('button','','编辑'),del=node('button','','删除');edit.onclick=()=>{editGoal(g);$('#goalName').focus()};del.onclick=()=>{if(confirm('删除目标“'+g.name+'”？')&&persist({...state,goals:goals().filter(x=>x.id!==g.id)})){if(goalEditing===g.id)editGoal();renderGoals()}};actions.append(edit,del);r.append(actions);box.append(r)}}
$('#openGoals').onclick=()=>{editGoal();renderGoals();$('#goalsDialog').showModal()};$('#newGoal').onclick=()=>editGoal();
$('#goalForm').onsubmit=e=>{e.preventDefault();const name=$('#goalName').value.trim(),target=Math.round(Number($('#goalAmount').value)*100),saved=Math.round(Number($('#goalSaved').value)*100),date=$('#goalDate').value;if(!name||name.length>20||!positiveCents(target)||!Number.isSafeInteger(saved)||saved<0||(date&&!validDate(date)))return toast('请检查目标名称、金额和日期');const g={id:goalEditing||crypto.randomUUID(),name,target,saved,date};if(persist({...state,goals:goalEditing?goals().map(x=>x.id===goalEditing?g:x):[...goals(),g]})){editGoal();renderGoals();toast('目标已保存')}};
function editLoan(l){loanEditing=l?.id||null;$('#loanHeading').textContent=l?'编辑往来':'新增往来';$('#loanName').value=l?.name||'';$('#loanAmount').value=l?(l.cents/100).toFixed(2):'';$('#loanDirection').value=l?.direction||'out';$('#loanDate').value=l?.date||localDate(new Date());$('#loanNote').value=l?.note||'';$('#loanStatus').value=l?.status||'unpaid';$('#loanRepaidDate').value=l?.repaidDate||''}
function renderLoans(){const box=$('#loanRows');box.replaceChildren();const pending=direction=>loans().filter(l=>l.direction===direction&&l.status==='unpaid').reduce((a,l)=>a+l.cents,0);$('#loanTotals').textContent=`借出未还 ¥${money(pending('out'))} · 借入未还 ¥${money(pending('in'))}`;if(!loans().length)box.append(node('p','muted','还没有借出借入记录'));for(const l of [...loans()].sort((a,b)=>b.date.localeCompare(a.date))){const r=node('div','template-row');r.append(node('b','',`${l.name} · ${l.direction==='out'?'借出':'借入'} ¥ ${money(l.cents)}`),node('small','',`${l.date} · ${l.status==='paid'?'已还 '+l.repaidDate:'未还'}${l.note?' · '+l.note:''}`));const actions=node('div','template-actions'),toggle=node('button','',l.status==='paid'?'改为未还':'标记已还'),edit=node('button','','编辑'),del=node('button','','删除');toggle.onclick=()=>{const next={...l,status:l.status==='paid'?'unpaid':'paid',repaidDate:l.status==='paid'?'':localDate(new Date())};if(persist({...state,loans:loans().map(x=>x.id===l.id?next:x)}))renderLoans()};edit.onclick=()=>{editLoan(l);$('#loanName').focus()};del.onclick=()=>{if(confirm('删除这条往来记录？')&&persist({...state,loans:loans().filter(x=>x.id!==l.id)})){if(loanEditing===l.id)editLoan();renderLoans()}};actions.append(toggle,edit,del);r.append(actions);box.append(r)}}
$('#openLoans').onclick=()=>{editLoan();renderLoans();$('#loansDialog').showModal()};$('#newLoan').onclick=()=>editLoan();
$('#loanForm').onsubmit=e=>{e.preventDefault();const name=$('#loanName').value.trim(),cents=Math.round(Number($('#loanAmount').value)*100),date=$('#loanDate').value,status=$('#loanStatus').value,repaidDate=status==='paid'?($('#loanRepaidDate').value||localDate(new Date())):'';if(!name||name.length>16||!positiveCents(cents)||!validDate(date)||(repaidDate&&!validDate(repaidDate)))return toast('请检查姓名、金额和日期');const l={id:loanEditing||crypto.randomUUID(),name,cents,date,direction:$('#loanDirection').value,note:$('#loanNote').value.trim(),status,repaidDate};if(persist({...state,loans:loanEditing?loans().map(x=>x.id===loanEditing?l:x):[...loans(),l]})){editLoan();renderLoans();toast('往来已保存')}};
// Keep secondary views fresh after edits, restores, and each minute's local-date check.
const render28=render;render=function(){render28();if($('#statsDialog').open)renderStats();renderEvening();renderSavedFilters();if($('#calendarDialog').open)renderCalendar();if($('#annualDialog').open)renderAnnual();if($('#goalsDialog').open)renderGoals();if($('#loansDialog').open)renderLoans()};
setInterval(()=>render(),60000);render();renderSafety();
