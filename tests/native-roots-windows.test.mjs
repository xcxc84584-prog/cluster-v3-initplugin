import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {createRootAccess}=require('../plugins/cluster.powershell/bridge/root-access.cjs');

test('native Windows root selection provides canonical absolute path and enforces CRUD/PS',async(t)=>{
 if(process.platform!=='win32'){t.skip('Windows native root test');return;}
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cluster-roots-'));
 t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
 const folder=path.join(tmp,'workspace');
 const data=path.join(tmp,'agent-state');
 fs.mkdirSync(folder,{recursive:true});fs.mkdirSync(data);
 const roots=createRootAccess({directory:data,picker:async()=>folder});
 const chosen=await roots.choose();
 assert.equal(chosen.absolutePath,fs.realpathSync.native(folder));
 assert.ok(/^[a-f0-9]{24}$/.test(chosen.id));
 assert.deepEqual(chosen.rights,{create:false,read:false,update:false,delete:false,powershell:false,autoPowershell:false});
 await assert.rejects(()=>roots.action({id:chosen.id,action:'list',relative:''}),/permission denied/);
 roots.update(chosen.id,{read:true,create:true,update:true,delete:true,powershell:false});
 let list=await roots.action({id:chosen.id,action:'list',relative:''});
 assert.deepEqual(list.entries,[]);
 await roots.action({id:chosen.id,action:'create',relative:'hello.txt'});
 await roots.action({id:chosen.id,action:'write',relative:'hello.txt',content:'hello'});
 const read=await roots.action({id:chosen.id,action:'read',relative:'hello.txt'});
 assert.equal(read.content,'hello');
 await assert.rejects(()=>roots.action({id:chosen.id,action:'read',relative:'../outside.txt'}),/Unsafe|Invalid/);
 await assert.rejects(()=>roots.action({id:chosen.id,action:'read',relative:'C:/Windows/system.ini'}),/Unsafe/);
 assert.throws(()=>roots.checkPowerShell(chosen.id,folder),/permission denied/);
 roots.update(chosen.id,{read:true,powershell:true});
 assert.equal(roots.checkPowerShell(chosen.id,folder),fs.realpathSync.native(folder));
 assert.throws(()=>roots.checkPowerShell(chosen.id,folder,{automatic:true}),/permission denied/);
 roots.update(chosen.id,{read:true,powershell:true,autoPowershell:true});
 assert.equal(roots.checkPowerShell(chosen.id,folder,{automatic:true}),fs.realpathSync.native(folder));
 roots.update(chosen.id,{read:true,powershell:false,autoPowershell:true});
 assert.equal(roots.listing()[0].rights.autoPowershell,false);
 roots.update(chosen.id,{read:true,powershell:true});
 assert.throws(()=>roots.checkPowerShell(chosen.id,tmp),/differs from granted folder/);
 await assert.rejects(()=>roots.action({id:chosen.id,action:'write',relative:'hello.txt',content:'x'}),/permission denied/);
 roots.remove(chosen.id);
 assert.equal(roots.listing().length,0);
 const restarted=createRootAccess({directory:data,picker:async()=>folder});
 assert.equal(restarted.listing().length,0);
});
