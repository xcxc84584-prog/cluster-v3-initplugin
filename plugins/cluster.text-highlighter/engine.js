/* PrismJS 1.30.0, MIT; original sources in vendor/. */
(() => {
'use strict';
const grammars=globalThis.clusterPrismGrammars;
const deps=globalThis.clusterPrismDeps;
const kinds=['comment','keyword','string','number','function','class-name','operator','punctuation','boolean','property','tag','attr-name','attr-value','regex','variable','constant','builtin','symbol','important','deleted','inserted'];
const aliases={html:'markup',xml:'markup',svg:'markup',md:'markdown',js:'javascript',mjs:'javascript',cjs:'javascript',ts:'typescript',h:'c',hpp:'cpp',cc:'cpp',cxx:'cpp',cs:'csharp',py:'python',sh:'bash',zsh:'bash',ps1:'powershell',psm1:'powershell',yml:'yaml',rs:'rust',rb:'ruby',kt:'kotlin',kts:'kotlin',tex:'latex',asm:'nasm',s:'nasm',conf:'ini',txt:'plain',text:'plain'};
function language(hint,filename){
 const raw=String(hint||'').toLowerCase().replace(/^language-/,'');
 if(raw)return aliases[raw]|| (Object.hasOwn(grammars,raw)?raw:'plain');
 const name=String(filename||'').toLowerCase().split(/[\\/]/).pop();
 const ext=name.includes('.')?name.split('.').pop():name;
 return aliases[ext]||(Object.hasOwn(grammars,ext)?ext:'plain');
}
function workerSource(){
 const factories=Object.entries(grammars).map(([name,source])=>JSON.stringify(name)+':function(){\n'+source+'\n}').join(',\n');
 return 'self.Prism={manual:true,disableWorkerMessageHandler:true};\n'+globalThis.clusterPrismCore+
 '\nconst grammarFactories={'+factories+'};\nconst grammarDeps='+JSON.stringify(deps)+';\nconst kinds='+JSON.stringify(kinds)+';\n'+
 `const loaded=new Set();
 function grammar(name){if(loaded.has(name))return;for(const dep of grammarDeps[name]||[])grammar(dep);grammarFactories[name]();loaded.add(name);}
 function tokenize(text,language){
   if(!grammarFactories[language])return {types:kinds,tokens:[]};
   grammar(language);
   const stream=Prism.tokenize(text,Prism.languages[language]);
   let offset=0;const out=[];
   function visit(value,kind=-1){
     if(typeof value==='string'){const start=offset;offset+=value.length;
       if(kind>=0&&offset>start){if(out.length>=3&&out[out.length-2]===start&&out[out.length-1]===kind)out[out.length-2]=offset;else out.push(start,offset,kind);if(out.length>600000)throw Error('Token limit');}return;}
     if(Array.isArray(value)){for(const item of value)visit(item,kind);return;}
     let k=kinds.indexOf(value.type);if(k<0)for(const alias of [].concat(value.alias||[])){k=kinds.indexOf(alias);if(k>=0)break;}
     visit(value.content,k<0?kind:k);
   }
   visit(stream);if(offset!==text.length)throw Error('Token coverage mismatch');
   const safe=[];for(let i=0;i<out.length;i+=3){const a=out[i],b=out[i+1];
     const splits=p=>p>0&&p<text.length&&text.charCodeAt(p)>=0xdc00&&text.charCodeAt(p)<=0xdfff&&text.charCodeAt(p-1)>=0xd800&&text.charCodeAt(p-1)<=0xdbff;
     if(!splits(a)&&!splits(b))safe.push(a,b,out[i+2]);}
   return {types:kinds,tokens:safe};
 }
 self.onmessage=e=>{const {id,text,language}=e.data;try{self.postMessage({id,result:tokenize(text,language)});}catch(error){self.postMessage({id,error:String(error.message||error)});}};
 `;
}
function palette(base){
 const match=/^#[0-9a-f]{6}$/i.test(base||'')?base:'#17191e';
 const rgb=[1,3,5].map(i=>parseInt(match.slice(i,i+2),16)/255);
 const luminance=c=>c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
 const bg=luminance(rgb);const dark=bg<.179;
 const max=Math.max(...rgb),min=Math.min(...rgb),delta=max-min;
 let hue=220;if(delta>.01){const [r,g,b]=rgb;hue=60*(max===r?((g-b)/delta+6)%6:max===g?(b-r)/delta+2:(r-g)/delta+4);}
 const hsl=(h,s,l)=>{const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));};return [f(0),f(8),f(4)];};
 const shifts=[0,70,145,110,25,185,210,0,110,35,70,145,110,160,25,110,185,35,70,0,145];
 return Object.fromEntries(kinds.map((kind,i)=>{let l=dark?.77:.28,s=kind==='comment'||kind==='punctuation'?.16:.65,c=hsl((hue+shifts[i])%360,s,l);
 for(let n=0;n<24&&(Math.max(luminance(c),bg)+.05)/(Math.min(luminance(c),bg)+.05)<4.5;n++){l=Math.max(0,Math.min(1,l+(dark?.035:-.035)));c=hsl((hue+shifts[i])%360,s,l);}
 return [kind,'#'+c.map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')];}));
}
globalThis.ClusterHighlightEngine=Object.freeze({language,workerSource,palette,kinds,languages:Object.keys(grammars).filter(x=>x!=='markup-templating'&&x!=='clike')});
})();
