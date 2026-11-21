/* Host PRMU is the ONLY palette authority. No local palette persistence. */
(()=>{'use strict';
  const keys=['background','surface','panel','control','hover','border',
    'text','muted','accent','editor','gutter'];
  const root=document.documentElement;
  const hex=/^#[0-9a-f]{6}$/i;
  const contrast=(a,b)=>{
    const rgb=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16)/255)
      .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
    const lum=x=>rgb(x).reduce((n,v,i)=>n+v*[0.2126,0.7152,0.0722][i],0);
    const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
  };
  const safe=(preferred,bg,min=4.5)=>{
    if(contrast(preferred,bg)>=min)return preferred;
    return contrast('#000000',bg)>=contrast('#ffffff',bg)?'#000000':'#ffffff';
  };
  function apply(data){
    const palette=data?.palette||data?.data?.palette;
    if(!palette||typeof palette!=='object')return;
    const colors={};
    for(const k of keys)if(hex.test(palette[k]||'')){
      colors[k]=palette[k].toLowerCase();
      root.style.setProperty('--ui-'+k,colors[k]);
    }
    if(!colors.text || !colors.background)return;
    for(const surface of ['background','surface','panel','control','hover','editor','gutter']){
      const bg=colors[surface]||colors.background;
      root.style.setProperty('--ui-on-'+surface,safe(colors.text,bg));
      root.style.setProperty('--ui-muted-on-'+surface,safe(colors.muted||colors.text,bg));
    }
    root.style.setProperty('--ui-on-accent',safe(colors.text,colors.accent||colors.background));
    const light=contrast('#000000',colors.background)>contrast('#ffffff',colors.background);
    root.style.colorScheme=light?'light':'dark';
    root.dispatchEvent(new CustomEvent('cluster-public-properties',{
      detail:{language:data?.language||data?.data?.language,palette:colors}
    }));
  }
  window.addEventListener('message',ev=>{
    if(ev.source!==parent)return;
    const m=ev.data;
    if(m?.protocol==='cluster.plugin.v1'&&m.type==='context')apply(m);
    if(m?.protocol==='cluster.settings.context.v1')apply(m);
    if(m?.protocol==='cluster.public.v1'&&
      (m.type==='snapshot'||m.type==='properties.changed'))apply(m);
  });
  if(parent!==window)parent.postMessage({protocol:'cluster.public.v1',
    type:'subscribe',properties:['palette','language']},'*');
})();
