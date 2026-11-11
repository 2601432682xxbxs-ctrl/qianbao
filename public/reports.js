/* View-only summary periods do not alter stored ledger dates or fiscal settings. */
let summaryMode='month',summaryDay=localDate(new Date()),summaryStart='',summaryEnd='';
function ensureSummaryRange(){if(summaryStart&&summaryEnd)return;const range=ledgerRange($('#month').value),[year,month,day]=range.end.split('-').map(Number);summaryStart=range.start;summaryEnd=localDate(new Date(year,month-1,day-1))}
function summaryRows(){if(summaryMode==='month')return state.entries.filter(e=>inLedgerMonth(e,$('#month').value));if(summaryMode==='day')return state.entries.filter(e=>e.date===summaryDay);ensureSummaryRange();return state.entries.filter(e=>e.date>=summaryStart&&e.date<=summaryEnd)}
function summaryPeriodCaption(){return summaryMode==='day'?summaryDay:summaryMode==='range'?summaryStart+' 至 '+summaryEnd:ledgerMonthLabel($('#month').value)}
function renderSummaryControls(){
 ensureSummaryRange();document.querySelectorAll('[data-summary-mode]').forEach(button=>{const selected=button.dataset.summaryMode===summaryMode;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected))});
 $('#summaryHeading').textContent=summaryMode==='month'?'月度总结':summaryMode==='day'?'每日总结':'日期范围总结';$('#summaryPeriodLabel').textContent=summaryMode==='month'?'本月结余':summaryMode==='day'?'当日结余':'区间结余';
 $('#summaryDialog .monthbar').hidden=summaryMode!=='month';$('#summaryDayControls').hidden=summaryMode!=='day';$('#summaryRangeControls').hidden=summaryMode!=='range';
 $('#chooseSummaryDay span').textContent=summaryDay;$('#chooseSummaryStart span').textContent=summaryStart;$('#chooseSummaryEnd span').textContent=summaryEnd;
 for(const element of document.querySelectorAll('[data-summary-month-only]'))element.hidden=summaryMode!=='month';
}
for(const id of ['sixMonthChart','monthlyHistory']){
 const element=$('#'+id);element.dataset.summaryMonthOnly='true';let sibling=element.previousElementSibling;if(sibling?.classList.contains('chart-legend')){sibling.dataset.summaryMonthOnly='true';sibling=sibling.previousElementSibling}if(sibling?.tagName==='H3')sibling.dataset.summaryMonthOnly='true';
}
$('#openCalendar').parentElement.dataset.summaryMonthOnly='true';
const monthlySummaryRenderer=renderSummary;
renderSummary=function(){monthlySummaryRenderer();renderSummaryControls();if(summaryMode==='month')return;const rows=summaryRows(),sum=totals(rows);$('#monthBalance').textContent='¥ '+money(sum.income-sum.expense);$('#summaryIncome').textContent='¥ '+money(sum.income);$('#summaryExpense').textContent='¥ '+money(sum.expense);$('#monthlyNarrative').textContent=rows.length?summaryPeriodCaption()+'，收入 ¥ '+money(sum.income)+'，支出 ¥ '+money(sum.expense)+'，结余 ¥ '+money(sum.income-sum.expense)+'。':'该时间范围还没有账单。'};
const monthlyStatsRenderer=renderStats;
renderStats=function(){
 if(summaryMode==='month')return monthlyStatsRenderer();
 const rows=summaryRows().filter(e=>CategoryCatalog.accountingType(e)==='expense'),total=totals(rows).expense,buckets=new Map();
 for(const entry of rows){const slug=CategoryCatalog.slug(entry.category,entry.sub),food=['meal-staple','snacks','drinks','group-dining'].includes(slug),key=food?'food:'+slug:JSON.stringify([entry.category,entry.sub]),label=CategoryCatalog.label(entry.category)+(entry.sub&&!food?' · '+entry.sub:'');if(buckets.has(key))buckets.get(key).cents+=entry.cents;else buckets.set(key,{...entry,label})}
 $('#statsRows').replaceChildren();$('#statsTotal').textContent=summaryPeriodCaption()+' · 支出 ¥ '+money(total);if(!buckets.size)$('#statsRows').append(node('div','empty','该时间范围还没有消费记录。'));
 for(const entry of [...buckets.values()].sort((a,b)=>b.cents-a.cents)){const row=node('div','row'),info=node('div','info'),bar=node('div','category-bar');row.innerHTML=icon(entry.category,entry.sub);bar.style.setProperty('--share',entry.cents/total*100+'%');info.append(node('b','',entry.label),node('small','',(entry.cents/total*100).toFixed(1)+'%'),bar);row.append(info,node('strong','','¥ '+money(entry.cents)));$('#statsRows').append(row)}
};
for(const button of document.querySelectorAll('[data-summary-mode]'))button.onclick=()=>{summaryMode=button.dataset.summaryMode;renderSummary()};
$('#chooseSummaryDay').onclick=()=>AppPickers.openDate('选择统计日期',summaryDay,date=>{summaryDay=date;renderSummary()},true);
$('#chooseSummaryStart').onclick=()=>AppPickers.openDate('总结开始日期',summaryStart,date=>{summaryStart=date;if(summaryEnd<date)summaryEnd=date;renderSummary()},true);
$('#chooseSummaryEnd').onclick=()=>AppPickers.openDate('总结结束日期',summaryEnd,date=>{summaryEnd=date;if(summaryStart>date)summaryStart=date;renderSummary()},true);
renderSummary();
