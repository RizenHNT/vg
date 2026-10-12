function stripMetadata(bytes){const parts=[bytes.subarray(0,2)];let p=2;while(p<bytes.length){const marker=bytes[p+1];if(marker===0xda||marker===0xd9){parts.push(bytes.subarray(p));break;}if(bytes[p]!==255)throw Error('Invalid JPEG segment');const length=bytes.readUInt16BE(p+2);if(![0xe1,0xed,0xfe].includes(marker))parts.push(bytes.subarray(p,p+length+2));p+=length+2;}return Buffer.concat(parts);}
const fs=require('node:fs');
const sources={"critical":"https://cf-vanguard.com/wordpress/wp-content/uploads/f_guide_icon_ct.jpg","boost":"https://cf-vanguard.com/wordpress/wp-content/uploads/f_guide_icon_bt.jpg","intercept":"https://cf-vanguard.com/wordpress/wp-content/uploads/f_guide_icon_is.jpg","double-drive":"https://cf-vanguard.com/wordpress/wp-content/uploads/f_guide_icon_2d.jpg","triple-drive":"https://cf-vanguard.com/wordpress/wp-content/uploads/f_guide_icon_3d.jpg"};
(async()=>{fs.mkdirSync('public/symbols',{recursive:true});for(const [kind,url] of Object.entries(sources)){const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(kind+' HTTP '+r.status);const bytes=stripMetadata(Buffer.from(await r.arrayBuffer()));if(bytes[0]!==255||bytes[1]!==216)throw new Error(kind+' is not JPEG');const path='public/symbols/'+kind+'.jpg';fs.writeFileSync(path,bytes);console.log('VG_ICON_EXPORT:'+JSON.stringify({path,source:url,content:bytes.toString('base64')}));}})().catch(error=>{console.error(error);process.exitCode=1});

(async()=>{
 const url='https://cf-vanguard.com/cardlist/?cardno=D-SD01%2F011';
 const html=await(await fetch(url,{signal:AbortSignal.timeout(15000)})).text();
 const links=[...html.matchAll(new RegExp('<link[^>]*>','gi'))].map(m=>m[0]).map(t=>t.match(/href=["']([^"']+)["']/)?.[1]).filter(Boolean).filter(x=>x.includes('.css')).sort((a,b)=>Number(b.includes('cardlist'))-Number(a.includes('cardlist')));
 console.log('VG_CARD_STYLESHEETS',JSON.stringify(links));
 for(const href of links.slice(0,12)){
  const absolute=new URL(href,url);if(absolute.hostname!=='cf-vanguard.com')continue;
  const css=await(await fetch(absolute,{signal:AbortSignal.timeout(15000)})).text();
  const clips=[...css.matchAll(new RegExp('critical|[.]power|[.]shield|trigger','gi'))].slice(0,10).map(m=>css.slice(Math.max(0,m.index-100),m.index+260));
  if(clips.length)console.log('VG_OFFICIAL_GLYPH_CSS',JSON.stringify({href:absolute.href,clips}));
 }
})().catch(e=>console.log('VG_CARD_INSPECT_FAILED',e.message));
