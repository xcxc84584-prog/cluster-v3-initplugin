import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const base='plugins/cluster.init-cluster/';
const read=p=>readFileSync(resolve(root,p),'utf8');
const json=p=>JSON.parse(read(p));
const print=o=>JSON.stringify(o,null,2)+'\n';
const catalog=json(base+'collection.json');
const check=process.argv.includes('--check');
const require=(condition,message)=>{if(!condition)throw Error(message);};
require(catalog.schemaVersion==='1.0.0'&&catalog.type==='cluster.community-index','Invalid collection schema');
require(/^\d+\.\d+\.\d+$/.test(catalog.collectionVersion),'Invalid collection version');
require(Array.isArray(catalog.plugins)&&catalog.plugins.length<=100,'Invalid membership');
const ids=new Set();
for(const p of catalog.plugins){
 require(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(p.id)&&p.id!=='cluster.init-cluster'&&!ids.has(p.id),'Invalid/duplicate plugin '+p.id);
 ids.add(p.id);
 require(p.directory==='plugins/'+p.id,'Invalid directory '+p.id);
 require(typeof p.initialize==='boolean'&&typeof p.community==='boolean','Missing policy '+p.id);
 const m=json(p.directory+'/manifest.json');
 for(const k of ['id','name','version','description'])require(m[k]===p[k],'Manifest mismatch '+p.id+' '+k);
 require(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(p.version),'Invalid plugin version '+p.id);
}
const m=json(base+'manifest.json');m.version=catalog.collectionVersion;
const outputs={
 'community-index.json':print(catalog),
 [base+'manifest.json']:print(m),
 [base+'collection-view.js']:'globalThis.clusterInitialCollection = '+JSON.stringify(catalog,null,2)+';\n'
};
for(const [p,data] of Object.entries(outputs)){
 if(check)require(read(p).replace(/\r\n/g,'\n')===data,'Stale generated file '+p);
 else writeFileSync(resolve(root,p),data);
}
console.log('init_cluster collection '+catalog.collectionVersion+' verified');
