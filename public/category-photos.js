/* User pictures stay in local ledger data and JSON backups. */
globalThis.CategoryPhotos=(()=>{
 const key=(category,sub='')=>JSON.stringify([category,sub]);
 function valid(data){
  if(typeof data!=='string'||data.length>100000||!/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(data))return false;
  try{const bytes=atob(data.slice(22));if(bytes.length<33||bytes.slice(12,16)!=='IHDR')return false;const size=offset=>((bytes.charCodeAt(offset)*16777216)+(bytes.charCodeAt(offset+1)<<16)+(bytes.charCodeAt(offset+2)<<8)+bytes.charCodeAt(offset+3));return size(16)===128&&size(20)===128}catch{return false}
 }
 function validateMap(map){
  if(map===undefined)return {};
  if(!map||typeof map!=='object'||Array.isArray(map))throw Error('分类图片格式错误');
  const result={};for(const [id,data]of Object.entries(map)){let parts;try{parts=JSON.parse(id)}catch{throw Error('分类图片名称错误')}
   if(!Array.isArray(parts)||parts.length!==2||parts.some(x=>typeof x!=='string'||x.length>16)||!parts[0].trim()||!valid(data))throw Error('分类图片格式错误');result[id]=data;
  }return result;
 }
 function get(map,category,sub=''){const exact=map?.[key(category,sub)],parent=map?.[key(category)];return valid(exact)?exact:valid(parent)?parent:''}
 async function read(file){
  if(!file||!file.type.startsWith('image/')||file.type==='image/svg+xml')throw Error('请选择照片或 PNG、JPEG、WebP 图片');
  if(file.size>12*1024*1024)throw Error('请选择小于 12 MB 的图片');
  const url=URL.createObjectURL(file),img=new Image();
  try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('这张图片无法读取，请换用 PNG 或 JPEG'));img.src=url});
   const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)throw Error('无法处理图片');
   const ratio=Math.min(112/img.naturalWidth,112/img.naturalHeight),width=img.naturalWidth*ratio,height=img.naturalHeight*ratio;
   ctx.drawImage(img,(128-width)/2,(128-height)/2,width,height);const data=canvas.toDataURL('image/png');if(!valid(data))throw Error('图片处理失败');return data;
  }finally{URL.revokeObjectURL(url)}
 }
 return Object.freeze({key,valid,validateMap,get,read});
})();
