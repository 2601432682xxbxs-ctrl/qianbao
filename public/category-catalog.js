/* Existing string category keys are retained as IDs. All surfaces use this mapping. */
globalThis.CategoryCatalog=(()=>{
 const base='./assets/category-icons/';
 const files=['meal-staple','snacks','drinks','group-dining','shopping-clothing','shopping-food','shopping-electronics','daily-supplies','public-transport','intercity-travel','daily-entertainment','entertainment-venue','housing-utilities','healthcare','fitness','education','bus','metro','high-speed-rail','airplane','car','travel-hotel','subscription','telecom','pet','personal-care','gifts','home-repair','salary','refund','savings','transfer','generic','living-allowance','other-income','scholarship'];
 const names={
  '吃饭':'meal-staple','主食':'meal-staple','米饭':'meal-staple','面条':'meal-staple','食堂':'meal-staple','外卖':'meal-staple','校外就餐':'meal-staple','早餐':'meal-staple',
  '小吃':'snacks','炸鸡':'snacks','烤串':'snacks','零食':'snacks','奶茶饮品':'drinks','饮品':'drinks','奶茶':'drinks','咖啡':'drinks','果汁':'drinks','聚餐':'group-dining',
  '网购衣物':'shopping-clothing','衣物':'shopping-clothing','衣服':'shopping-clothing','网购食品':'shopping-food','食品':'shopping-food','网购电子':'shopping-electronics','电子物品':'shopping-electronics','电子产品':'shopping-electronics',
  '日用品':'daily-supplies','公共交通':'public-transport','公交地铁':'public-transport','城际出行':'intercity-travel','火车高铁':'intercity-travel','日常娱乐':'daily-entertainment','台球':'daily-entertainment','娱乐场馆':'entertainment-venue',
  '居住水电':'housing-utilities','医疗健康':'healthcare','医疗':'healthcare','运动健身':'fitness','健身':'fitness','学习教育':'education','学习':'education','教育':'education','书籍':'education',
  '公交':'bus','地铁':'metro','高铁':'high-speed-rail','火车':'high-speed-rail','飞机':'airplane','打车':'car','用车':'car','旅行住宿':'travel-hotel','住宿':'travel-hotel','会员订阅':'subscription','话费网费':'telecom','宠物':'pet','个护':'personal-care','礼物人情':'gifts','家居维修':'home-repair','工资':'salary','兼职':'salary','退款':'refund','储蓄':'savings','转账':'transfer'
 };
 Object.assign(names,{'生活费':'living-allowance','其他收入':'other-income','奖学金':'scholarship','娱乐':'daily-entertainment','日常生活':'daily-supplies','个人护肤品':'personal-care','礼物':'gifts'});
 const labels={'吃饭':'主食','奶茶饮品':'饮品'};
 const requestedPresets={'娱乐':['日常娱乐','娱乐场馆'],'医疗健康':[],'运动健身':[],'学习教育':[],'旅行住宿':[],'日常生活':['会员订阅','话费网费','个人护肤品','礼物']};
 // Apply once per ledger so a user's later deletions stay deleted.
 function addRequestedPresets(ledger){
  if(ledger.categoryPresetsVersion>=1)return ledger;
  const categories=structuredClone(ledger.categories);
  const has=name=>Object.entries(categories).some(([key,subs])=>key===name||subs.includes(name));
  for(const [parent,children] of Object.entries(requestedPresets)){
   if(!children.length){if(!has(parent))categories[parent]=[];continue}
   const missing=children.filter(name=>!has(name));
   if(missing.length){if(!Object.hasOwn(categories,parent))categories[parent]=[];categories[parent].push(...missing)}
  }
  return {...ledger,categories,categoryPresetsVersion:1};
 }
 const income={'生活费':[],'兼职':[],'奖学金':[],'其他收入':[],'工资':[],'退款':[]};
 const groups=[{id:'public',label:'公共交通',icon:'public-transport',children:['公交','地铁'],legacy:['公交地铁','公共交通']},{id:'intercity',label:'城际出行',icon:'intercity-travel',children:['高铁','飞机'],legacy:['火车高铁','城际出行']}];
 function label(key){return labels[key]||key}
 function kind(entry){if(['transfer','savings','refund','standard'].includes(entry.transactionKind))return entry.transactionKind;if(['转账','账户转账','内部转账'].includes(entry.category))return 'transfer';if(['储蓄','存钱'].includes(entry.category))return 'savings';return entry.type==='income'&&entry.category==='退款'?'refund':'standard'}
 function accountingType(entry){return ['transfer','savings'].includes(kind(entry))?'internal':entry.type}
 function slug(category,sub='',entryType='expense',transactionKind){
  const entry={category,sub,type:entryType,transactionKind};const k=kind(entry);if(k==='transfer'||k==='savings')return k;
  if(['吃饭','主食'].includes(category))return 'meal-staple';if(['奶茶饮品','饮品'].includes(category))return 'drinks';if(category==='小吃')return 'snacks';if(category==='聚餐')return 'group-dining';
  if(category==='网络购物')return sub?names[sub]||'generic':'shopping-clothing';
  if(category==='交通')return names[sub]||'public-transport';
  return names[sub]||names[category]||'generic';
 }
 function src(category,sub='',type='expense',transactionKind){return base+slug(category,sub,type,transactionKind)+'.png'}
 function normalizeCategories(categories){const next=structuredClone(categories);if(Array.isArray(next['交通'])){next['交通']=[...new Set(next['交通'].flatMap(name=>{const group=groups.find(g=>g.legacy.includes(name));return group?group.children:[name]}))]}return next}
 function transportGroup(sub){return groups.find(g=>g.children.includes(sub)||g.legacy.includes(sub))}
 return Object.freeze({base,files,names,groups,income,label,kind,accountingType,slug,src,normalizeCategories,transportGroup,requestedPresets,addRequestedPresets});
})();
