import type { Express } from 'express';
import { Books, type Context, kinds, moduleFor } from './database';
import { format } from './decimal';
import { can } from '../src/utils/permissions';
import { isIP } from 'node:net';

export function registerBooks(app:Express,books:Books,actor:(req:any)=>any,legacy:()=>any) {
  books.company('main','APEX ERP');
  const context=(req:any):Context=>{
    const user=actor(req); if(!user || user.role!=='admin') throw new Error('Administrator sign-in required.');
    const policy=books.record({tenant:'main',user:user.id},'access',user.id);
    if(policy?.disabled) throw new Error('This accounting account is disabled.');
    const tenant=String(req.headers['x-company-id'] || 'main');
    if(!user.isOwner && !(policy?.companies || ['main']).includes(tenant)) throw new Error('Company access denied.');
    if(!user.isOwner && policy?.ips?.length && !policy.ips.includes(req.socket.remoteAddress)) throw new Error('IP access denied.');
    const grants=policy?.grants || ['sales','purchases','banking','inventory','reports','settings'].flatMap(m=>['view','write','post','delete'].filter(a=>can(user,m as any,a as any)).map(a=>`${m}.${a}`));
    return {tenant,user:user.id,owner:user.isOwner===true,grants,scopes:policy?.scopes || {},ip:req.socket.remoteAddress};
  };
  const route=(method:'get'|'post'|'put',path:string,fn:(c:Context,req:any)=>any)=>app[method](`/api/v1${path}`,(req,res)=>{
    try { const c=context(req); books.settings(c); res.json(fn(c,req)); } catch(e:any) { const denied=/access|denied|sign-in/i.test(e.message); res.status(denied?403:400).json({error:e.message}); }
  });
  const key=(req:any)=>String(req.headers['idempotency-key'] || '');
  const allowed=(c:Context,m:string,a='view')=>c.owner || c.grants?.includes(`${m}.${a}`);
  route('get','/books',(c)=>{
    const resources:Record<string,string>={customer:'sales',supplier:'purchases',product:'inventory',location:'inventory',project:'reports',account:'reports',bank:'banking',tax:'settings',budget:'reports',asset:'reports',bom:'inventory','saved-view':'reports',template:'settings','custom-field':'settings',reconciliation:'banking'};
    const masters=Object.fromEntries(Object.entries(resources).map(([type,m])=>[type,allowed(c,m)?books.records(c,type).filter(r=>{
      if(c.owner)return true;
      if(['budget','asset','saved-view','reconciliation'].includes(type))return books.visible(c,r);
      const scope=({customer:'party',supplier:'party',product:'product',location:'location',project:'project',bank:'bank'} as any)[type];
      return !scope || !c.scopes?.[scope] || c.scopes[scope].includes(r.id);
    }):[]]));
    const documents=books.documents(c).filter(d=>books.visible(c,d) && allowed(c,moduleFor(d.kind))).map(d=>({...d,outstanding:d.state==='POSTED' && ['INVOICE','BILL'].includes(d.kind)?format(books.outstanding(c,d)):undefined}));
    return {settings:books.settings(c),masters,documents,kinds,access:{owner:c.owner,grants:c.grants},companies:c.owner?books.all('SELECT id,name FROM companies'):books.all('SELECT id,name FROM companies').filter(x=>(books.record({tenant:'main',user:c.user},'access',c.user)?.companies || ['main']).includes(x.id)),audit:c.owner?books.all('SELECT actor,action,entity,created FROM audit WHERE tenant=? ORDER BY ordinal DESC LIMIT 100',c.tenant):[]};
  });
  route('post','/documents',(c,r)=>books.create(c,r.body,key(r)));
  route('put','/documents/:id',(c,r)=>books.updateDraft(c,r.params.id,r.body,key(r)));
  route('post','/documents/:id/:action',(c,r)=>{
    if(r.params.action==='convert') return books.convert(c,r.params.id,r.body,key(r));
    if(r.params.action==='allocate') return books.allocate(c,r.params.id,r.body.items,key(r),r.body.date);
    if(r.params.action==='reverse') return books.reverse(c,r.params.id,r.body.date,r.body.reason,key(r));
    return books.transition(c,r.params.id,r.params.action,key(r),r.body);
  });
  route('post','/masters/:type',(c,r)=>books.saveRecord(c,r.params.type,r.body));
  route('get','/reports',(c,r)=>books.report(c,r.query));
  route('post','/reports/export',(c,r)=>{books.authorize(c,'reports','export');const report=books.report(c,r.body);books.transaction(()=>books.audit(c,'report.export','trial-balance',null,{filters:r.body,rows:report.trial.length}));return {headers:['Account','Name','Debit','Credit'],rows:report.trial.map(a=>[a.id,a.name,a.debit,a.credit])};});
  route('get','/inventory',(c)=>books.inventory(c));
  route('put','/settings',(c,r)=>books.updateSettings(c,r.body));
  route('post','/reconciliations',(c,r)=>books.reconcile(c,r.body,key(r)));
  route('post','/assets/:id/depreciation',(c,r)=>books.depreciation(c,r.params.id,r.body.date,key(r)));
  route('post','/companies',(c,r)=>{if(!c.owner) throw new Error('Owner access required.'); if(!/^[a-z0-9-]{2,40}$/.test(r.body.id) || !r.body.name?.trim()) throw new Error('Enter a company ID and name.'); if(books.get('SELECT id FROM companies WHERE id=?',r.body.id)) throw new Error('Company ID already exists.'); books.company(r.body.id,r.body.name); return {success:true};});
  route('get','/access',(c)=>{if(!c.owner) throw new Error('Owner access required.');return books.records({tenant:'main',user:c.user},'access');});
  route('put','/access/:id',(c,r)=>{
    if(!c.owner) throw new Error('Owner access required.');
    const data={...r.body,id:r.params.id}; const users=legacy().users;
    if(!users.some((u:any)=>u.id===data.id && u.role==='admin' && !u.isOwner)) throw new Error('Choose a staff administrator.');
    if(!Array.isArray(data.companies) || data.companies.some((id:string)=>!books.get('SELECT id FROM companies WHERE id=?',id))) throw new Error('Unknown company.');
    if(!Array.isArray(data.grants) || data.grants.some((g:string)=>! /^(sales|purchases|inventory|banking|ledger|reports|settings)\.(view|write|post|approve|delete|export)$/.test(g))) throw new Error('Invalid access grants.');
    if(!Array.isArray(data.ips) || data.ips.some((ip:string)=>!isIP(ip))) throw new Error('Enter valid exact IP addresses.');
    if(!data.scopes || Object.entries(data.scopes).some(([field,ids])=>!['party','product','location','project','bank'].includes(field) || !Array.isArray(ids) || ids.some(id=>typeof id!=='string'))) throw new Error('Invalid row scopes.');
    return books.transaction(()=>{const cc={...c,tenant:'main'},old=books.record(cc,'access',data.id);books.writeRecord('main','access',data.id,data);books.audit(cc,'access.update',data.id,old,data);return data;});
  });
  route('get','/migration/preview',(c)=>{
    if(!c.owner) throw new Error('Owner access required.'); const l=legacy();
    return {products:l.products.length,customers:l.customers.length,suppliers:l.suppliers.length,banks:l.banks.length,note:'Imports master records only. Existing documents and balances stay in legacy history. Review and post balanced opening journals and stock opening documents before using these books.'};
  });
  route('post','/migration/masters',(c,r)=>{
    if(!c.owner) throw new Error('Owner access required.');
    return books.idempotent(c,key(r),{action:'importLegacyMasters'},()=>{
      const l=legacy(); let imported=0; const add=(type:string,data:any)=>{if(!books.record(c,type,data.id)){books.writeRecord(c.tenant,type,data.id,data); imported++;}};
      for(const p of l.products) add('product',{id:p.id,name:p.name || p.title || p.id,stock:true,active:true,units:[{name:'Each',factor:'1'}],price:String(p.price || 0)});
      for(const p of l.customers) add('customer',{id:p.id,name:p.name || p.companyName || p.fullName || p.id,phone:p.phone || '',active:true});
      for(const p of l.suppliers) add('supplier',{id:p.id,name:p.name || p.companyName || p.vendorName || p.id,phone:p.phone || '',active:true});
      for(const b of l.banks) { const code=b.glAccountCode || `BANK-${b.id}`; add('account',{id:code,name:b.accountName,category:'asset',active:true}); add('bank',{id:b.id,name:b.accountName,account:code,currency:'PKR',active:true}); }
      books.audit(c,'migration.masters',c.tenant,null,{imported}); return {imported};
    });
  });
}
