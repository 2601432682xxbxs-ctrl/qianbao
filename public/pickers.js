/* Visible controls share the same scrollable chooser and confirmed date calendar.
   Hidden form fields retain the existing data model and change handlers. */
(()=>{
 const selectTitles={budgetTarget:'预算范围',templateCategory:'大分类',templateSub:'细分类',templateCycle:'周期',templateDay:'扣款日',csvScope:'导出范围',loanDirection:'方向',loanStatus:'状态'};
 const dateTitles={repaymentFirstDate:'首次还款日期',date:'记账日期',goalDate:'目标日期',loanDate:'往来日期',loanRepaidDate:'还款日期',recordStart:'开始日期',recordEnd:'结束日期'};
 function sync(){
  $('#choose_parent span').textContent=$('#parent').value?CategoryCatalog.label($('#parent').value):'选择所属大分类';
  for(const button of document.querySelectorAll('[data-select-field]')){
   const field=$('#'+button.dataset.selectField),text=field.selectedOptions[0]?.textContent||'请选择';
   button.querySelector('span').textContent=text;button.disabled=field.disabled;button.setAttribute('aria-label',selectTitles[field.id]+'：'+text);
  }
  for(const button of document.querySelectorAll('[data-date-field]')){
   const field=$('#'+button.dataset.dateField),text=field.value||(field.id==='goalDate'?'不设日期':field.id==='loanRepaidDate'?'未填写，已还时默认今天':'选择日期');
   button.querySelector('span').textContent=text;button.setAttribute('aria-label',dateTitles[field.id]+'：'+text);
  }
 }
 function chooseList(title,options,value,commit){
  $('#recordChoiceTitle').textContent=title;$('#recordChoiceRows').replaceChildren();
  for(const option of options){
   const selected=String(option.value)===String(value),button=node('button','vertical-choice'+(selected?' selected':''));button.type='button';button.dataset.value=option.value;button.disabled=!!option.disabled;button.setAttribute('aria-pressed',String(selected));
   if(option.category)button.innerHTML=icon(option.category,option.sub||'');
   button.append(node('span','',option.text),node('small','',selected?'✓':''));
   button.onclick=()=>{commit(String(option.value));sync();$('#recordChoiceDialog').close()};$('#recordChoiceRows').append(button);
  }
  $('#recordChoiceDialog').showModal();const scroll=$('#recordChoiceDialog .modal-scroll'),selected=$('#recordChoiceRows .selected');scroll.scrollTop=selected?Math.max(0,selected.offsetTop-scroll.offsetTop-20):0;
 }
 function openSelect(id){
  const field=$('#'+id),options=[...field.options].map(option=>({value:option.value,text:option.textContent,disabled:option.disabled,
   ...(['budgetTarget','templateCategory'].includes(id)&&option.value?{category:option.value}:id==='templateSub'&&option.value?{category:$('#templateCategory').value,sub:option.value}:{})}));
  if(!options.length){toast('当前没有可选项');return}
  chooseList(selectTitles[id],options,field.value,value=>{field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}))});
 }
 $('#choose_parent').onclick=()=>chooseList('所属大分类',Object.keys(state.categories).map(name=>({value:name,text:CategoryCatalog.label(name),category:name})),$('#parent').value,value=>renderParentChoices(value));
 $('#pickerYear').onclick=()=>{const min=Math.max(1900,pickerYear-100),max=Math.min(9999,pickerYear+100);chooseList('选择年份',Array.from({length:max-min+1},(_,i)=>({value:min+i,text:(min+i)+' 年'})),pickerYear,value=>{pickerYear=Number(value);renderMonthChoices()})};
 for(const button of document.querySelectorAll('[data-select-field]'))button.onclick=()=>openSelect(button.dataset.selectField);
 const originalCalendar=renderRecordCalendar;
 renderRecordCalendar=function(){originalCalendar();const field=$('#'+recordDateTarget),required=field?.required;$('#clearRecordDate').hidden=recordDateTarget==='monthStartDay';
  $('#clearRecordDate').textContent=required?'回到今天':recordDateTarget==='goalDate'?'不设日期':recordDateTarget==='loanRepaidDate'?'默认今天':'不限日期';
  if(!recordDateDraft)$('#recordDateDraft').textContent=required?'请选择日期':recordDateTarget==='goalDate'?'不设日期':recordDateTarget==='loanRepaidDate'?'已还时自动使用今天':'不限日期';
 };
 openRecordDate=function(id){recordDateTarget=id;recordDateDraft=id==='monthStartDay'?localDate(new Date()).slice(0,7)+'-'+String(state.monthStartDay).padStart(2,'0'):$('#'+id).value;const seed=recordDateDraft||localDate(new Date());[recordCalendarYear,recordCalendarMonth]=seed.split('-').map(Number);recordCalendarMonth--;$('#recordDateTitle').textContent=id==='monthStartDay'?'每月起始日（1–28 日）':dateTitles[id]||'选择日期';renderRecordCalendar();$('#recordDateDialog').showModal();$('#recordDateDialog .modal-scroll').scrollTop=0};
 for(const button of document.querySelectorAll('[data-date-field]'))button.onclick=()=>openRecordDate(button.dataset.dateField);
 $('#clearRecordDate').onclick=()=>{recordDateDraft=$('#'+recordDateTarget)?.required?localDate(new Date()):'';renderRecordCalendar()};
 $('#confirmRecordDate').onclick=()=>{
  if(recordDateTarget==='monthStartDay'){const day=Number(recordDateDraft.slice(8));if(!recordDateDraft||day<1||day>28){$('#recordDateDraft').textContent='每月起始日请选择 1–28 日';$('#recordDateDraft').style.color='#a33c40';return}if(persist({...state,monthStartDay:day})){$('#month').value=currentMonth();render();if($('#budgetDialog').open)renderBudgetSettings();sync();$('#recordDateDialog').close();toast('每月起始日已保存')}return}

  const field=$('#'+recordDateTarget);let error='';
  if(field.required&&!recordDateDraft)error='请选择日期';
  if(['recordStart','recordEnd'].includes(recordDateTarget)){
   const start=recordDateTarget==='recordStart'?recordDateDraft:$('#recordStart').value,end=recordDateTarget==='recordEnd'?recordDateDraft:$('#recordEnd').value;
   if(start&&end&&start>end)error='结束日期不能早于开始日期';
  }
  if(error){$('#recordDateDraft').textContent=error;$('#recordDateDraft').style.color='#a33c40';return}
  field.value=recordDateDraft;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
  if(field.id==='date')updateDetails();sync();$('#recordDateDialog').close();
 };
 $('#recordCalendarYearSelect').onclick=()=>{
  const min=Math.max(1900,recordCalendarYear-100),max=Math.min(9999,recordCalendarYear+100);
  chooseList('选择年份',Array.from({length:max-min+1},(_,i)=>({value:min+i,text:(min+i)+' 年'})),recordCalendarYear,value=>{recordCalendarYear=Number(value);renderRecordCalendar()});
 };
 $('#recordCalendarMonthSelect').onclick=()=>chooseList('选择月份',Array.from({length:12},(_,i)=>({value:i,text:(i+1)+' 月'})),recordCalendarMonth,value=>{recordCalendarMonth=Number(value);renderRecordCalendar()});
 // Programmatic edits rebuild options or assign values without firing change events.
 for(const name of ['renderParentChoices','editTemplate','templateSubs','templateDays','loadBudgetAmount','renderBudgetSettings','editGoal','editLoan','beginEdit','finishEditing','updateDetails']){
  const original=globalThis[name];if(typeof original==='function')globalThis[name]=function(...args){const result=original.apply(this,args);sync();return result};
 }
 for(const dialog of document.querySelectorAll('dialog'))new MutationObserver(()=>{if(dialog.open)sync()}).observe(dialog,{attributes:true,attributeFilter:['open']});
 for(const field of document.querySelectorAll('select')){field.addEventListener('change',sync);new MutationObserver(sync).observe(field,{childList:true,subtree:true})}
 let customDateCommit=null;
 $('#dynamicDateValue').addEventListener('change',()=>{const commit=customDateCommit;customDateCommit=null;if(commit)commit($('#dynamicDateValue').value)});
 globalThis.AppPickers=Object.freeze({openDate(title,value,commit,required=true){customDateCommit=commit;$('#dynamicDateValue').value=value||'';$('#dynamicDateValue').required=required;openRecordDate('dynamicDateValue');$('#recordDateTitle').textContent=title},chooseList});
 sync();
})();
