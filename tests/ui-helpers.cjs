async function openSettings(page){
 await page.locator('#openSettings').click();
 await page.locator('#settings .settings-group').evaluateAll(groups=>groups.forEach(group=>group.open=true));
}
async function chooseRecord(page,field,value){
 await page.locator(field==='recordType'?'#chooseRecordType':'#chooseRecordCategory').click();
 await page.locator('#recordChoiceRows button[data-value='+JSON.stringify(value)+']').click();
}
async function setRecordDate(page,field,value){
 await page.locator(field==='recordStart'?'#chooseRecordStart':'#chooseRecordEnd').click();
 if(!value)await page.locator('#clearRecordDate').click();
 else{
  const delta=await page.evaluate(date=>{const [year,month]=date.split('-').map(Number);return (year-recordCalendarYear)*12+month-1-recordCalendarMonth},value);
  for(let index=0;index<Math.abs(delta);index++)await page.locator(delta<0?'#recordCalendarPrev':'#recordCalendarNext').click();
  await page.locator('#recordCalendarDays button[data-date='+JSON.stringify(value)+']').click();
 }
 await page.locator('#confirmRecordDate').click();
}
async function chooseField(page,field,value){
 if(['recordType','recordCategory'].includes(field))return chooseRecord(page,field,value);
 await page.locator('#choose_'+field).click();
 await page.locator('#recordChoiceRows button[data-value='+JSON.stringify(String(value))+']').click();
}
async function setDateField(page,field,value){
 await page.locator(field==='recordStart'?'#chooseRecordStart':field==='recordEnd'?'#chooseRecordEnd':'#choose_'+field).click();
 if(!value)await page.locator('#clearRecordDate').click();
 else{
  const [year,month]=value.split('-').map(Number);
  const current=await page.evaluate(()=>({year:recordCalendarYear,month:recordCalendarMonth+1}));
  if(current.year!==year){await page.locator('#recordCalendarYearSelect').click();await page.locator('#recordChoiceRows button[data-value="'+year+'"]').click()}
  if(current.month!==month){await page.locator('#recordCalendarMonthSelect').click();await page.locator('#recordChoiceRows button[data-value="'+(month-1)+'"]').click()}
  await page.locator('#recordCalendarDays button[data-date='+JSON.stringify(value)+']').click();
 }
 await page.locator('#confirmRecordDate').click();
}
module.exports={openSettings,chooseRecord,setRecordDate,chooseField,setDateField};
