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
module.exports={openSettings,chooseRecord,setRecordDate};
