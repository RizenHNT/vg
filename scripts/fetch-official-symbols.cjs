const fs=require('node:fs');
const sources={"critical":"https://cf-vanguard.com/wordpress/wp-content/uploads/f_guide_icon_ct.jpg","boost":"https://cf-vanguard.com/wordpress/wp-content/uploads/f_guide_icon_bt.jpg","intercept":"https://cf-vanguard.com/wordpress/wp-content/uploads/f_guide_icon_is.jpg","double-drive":"https://cf-vanguard.com/wordpress/wp-content/uploads/f_guide_icon_2d.jpg","triple-drive":"https://cf-vanguard.com/wordpress/wp-content/uploads/f_guide_icon_3d.jpg"};
(async()=>{fs.mkdirSync('public/symbols',{recursive:true});for(const [kind,url] of Object.entries(sources)){const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(kind+' HTTP '+r.status);const bytes=Buffer.from(await r.arrayBuffer());if(bytes[0]!==255||bytes[1]!==216)throw new Error(kind+' is not JPEG');const path='public/symbols/'+kind+'.jpg';fs.writeFileSync(path,bytes);console.log('VG_ICON_EXPORT:'+JSON.stringify({path,source:url,content:bytes.toString('base64')}));}})().catch(error=>{console.error(error);process.exitCode=1});

(async()=>{
 const url='https://cf-vanguard.com/cardlist/?cardno=D-SD01%2F011';
 const html=await(await fetch(url,{signal:AbortSignal.timeout(15000)})).text();
 const tags=[...html.matchAll(new RegExp('<img[^>]*>','gi'))].map(m=>m[0]);
 console.log('VG_CARD_IMAGES',JSON.stringify(tags.filter(t=>!/logo|banner|sns|twitter|facebook/i.test(t)).slice(0,20)));
 const links=[...html.matchAll(new RegExp('<link[^>]*>','gi'))].map(m=>m[0]).map(t=>t.match(/href=["']([^"']+)["']/)?.[1]).filter(Boolean).filter(x=>x.includes('.css')&&x.includes('themes/cf-vanguard'));
 console.log('VG_CARD_STYLESHEETS',JSON.stringify(links));
 for(const href of links.slice(0,8)){
  const css=await(await fetch(new URL(href,url),{signal:AbortSignal.timeout(15000)})).text();
  const clips=[...css.matchAll(/critical|\.power|\.shield|trigger/gi)].slice(0,15).map(m=>css.slice(Math.max(0,m.index-100),m.index+260));
  if(clips.length)console.log('VG_OFFICIAL_GLYPH_CSS',JSON.stringify({href,clips}));
 }
})().catch(e=>console.log('VG_CARD_INSPECT_FAILED',e.message));
