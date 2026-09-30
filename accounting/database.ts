import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { decimal as D, format as F, divide, amountFor, fxAmount } from './decimal';

export type Context = { tenant: string; user: string; owner?: boolean; ip?: string; grants?: string[]; scopes?: Record<string,string[]> };
export type JournalLine = { account: string; debit?: string; credit?: string; party?: string; project?: string; location?: string };
const now = () => new Date().toISOString();
const today = () => now().slice(0,10);
const ensure = (condition: any, message: string) => { if (!condition) throw new Error(message); };
const dateOK = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date || '') && new Date(date).toISOString().slice(0,10) === date;
export const kinds = ['QUOTE','SALES_ORDER','DELIVERY','INVOICE','CREDIT_NOTE','PURCHASE_ORDER','GOODS_RECEIPT','BILL','RECEIPT','PAYMENT','JOURNAL','STOCK_OPENING','STOCK_ADJUSTMENT','STOCK_TRANSFER','PRODUCTION','LANDED_COST'] as const;
export const moduleFor = (kind: string) => ['QUOTE','SALES_ORDER','DELIVERY','INVOICE','CREDIT_NOTE'].includes(kind) ? 'sales' : ['PURCHASE_ORDER','GOODS_RECEIPT','BILL','LANDED_COST'].includes(kind) ? 'purchases' : ['RECEIPT','PAYMENT'].includes(kind) ? 'banking' : kind === 'JOURNAL' ? 'ledger' : 'inventory';
const defaults = [
  ['1000','Cash and bank','asset'],['1100','Accounts receivable','asset'],['1200','Inventory','asset'],['1300','Input tax','asset'],
  ['1400','Fixed assets','asset'],['1490','Accumulated depreciation','asset'],['2000','Accounts payable','liability'],['2050','Goods received not invoiced','liability'],['2100','Output tax','liability'],
  ['3000','Opening equity','equity'],['4000','Sales','income'],['4100','FX gain','income'],['5000','Cost of goods sold','expense'],
  ['6000','General expenses','expense'],['6100','Stock adjustments','expense'],['6200','FX loss','expense'],['6300','Depreciation','expense'],['6900','Rounding differences','expense'],
];

/** All accounting writes run synchronously inside BEGIN IMMEDIATE. Tenant keys are mandatory. */
export class Books {
  db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY, name TEXT NOT NULL, settings TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS records(tenant TEXT NOT NULL REFERENCES companies(id), type TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(tenant,type,id));
      CREATE TABLE IF NOT EXISTS documents(tenant TEXT NOT NULL REFERENCES companies(id), id TEXT NOT NULL, number TEXT NOT NULL, kind TEXT NOT NULL, state TEXT NOT NULL, date TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(tenant,id), UNIQUE(tenant,number));
      CREATE TABLE IF NOT EXISTS sequences(tenant TEXT NOT NULL, kind TEXT NOT NULL, year TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY(tenant,kind,year));
      CREATE TABLE IF NOT EXISTS journals(tenant TEXT NOT NULL, id TEXT NOT NULL, source TEXT NOT NULL, date TEXT NOT NULL, actor TEXT NOT NULL, created TEXT NOT NULL, reversal_of TEXT, PRIMARY KEY(tenant,id), UNIQUE(tenant,source));
      CREATE TABLE IF NOT EXISTS journal_lines(tenant TEXT NOT NULL, journal TEXT NOT NULL, position INTEGER NOT NULL, account TEXT NOT NULL, debit TEXT NOT NULL, credit TEXT NOT NULL, party TEXT, project TEXT, location TEXT, PRIMARY KEY(tenant,journal,position), FOREIGN KEY(tenant,journal) REFERENCES journals(tenant,id));
      CREATE TABLE IF NOT EXISTS layers(tenant TEXT NOT NULL, id TEXT NOT NULL, product TEXT NOT NULL, location TEXT NOT NULL, batch TEXT NOT NULL, expiry TEXT, source TEXT NOT NULL, created TEXT NOT NULL, quantity TEXT NOT NULL, remaining TEXT NOT NULL, value TEXT NOT NULL, remaining_value TEXT NOT NULL, PRIMARY KEY(tenant,id));
      CREATE TABLE IF NOT EXISTS movements(tenant TEXT NOT NULL, id TEXT NOT NULL, source TEXT NOT NULL, product TEXT NOT NULL, location TEXT NOT NULL, batch TEXT NOT NULL, quantity TEXT NOT NULL, value TEXT NOT NULL, layers TEXT NOT NULL, date TEXT NOT NULL, PRIMARY KEY(tenant,id));
      CREATE TABLE IF NOT EXISTS allocations(tenant TEXT NOT NULL, id TEXT NOT NULL, settlement TEXT NOT NULL, invoice TEXT NOT NULL, amount TEXT NOT NULL, PRIMARY KEY(tenant,id));
      CREATE TABLE IF NOT EXISTS requests(tenant TEXT NOT NULL, key TEXT NOT NULL, hash TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(tenant,key));
      CREATE TABLE IF NOT EXISTS audit(ordinal INTEGER PRIMARY KEY AUTOINCREMENT, tenant TEXT NOT NULL, id TEXT NOT NULL, actor TEXT NOT NULL, ip TEXT, action TEXT NOT NULL, entity TEXT NOT NULL, before_data TEXT, after_data TEXT, created TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'Audit is append only'); END;
      CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'Audit is append only'); END;
      CREATE TRIGGER IF NOT EXISTS journal_no_update BEFORE UPDATE ON journals BEGIN SELECT RAISE(ABORT,'Journals are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS journal_no_delete BEFORE DELETE ON journals BEGIN SELECT RAISE(ABORT,'Journals are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS lines_no_update BEFORE UPDATE ON journal_lines BEGIN SELECT RAISE(ABORT,'Journal lines are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS lines_no_delete BEFORE DELETE ON journal_lines BEGIN SELECT RAISE(ABORT,'Journal lines are immutable'); END;
      CREATE INDEX IF NOT EXISTS fifo ON layers(tenant,product,location,created,id);
      CREATE INDEX IF NOT EXISTS lines_account ON journal_lines(tenant,account,party);
    `);
    if(!this.all('PRAGMA table_info(allocations)').some(c=>c.name==='date')) this.db.exec("ALTER TABLE allocations ADD COLUMN date TEXT NOT NULL DEFAULT ''");
    if(this.get("SELECT sql FROM sqlite_master WHERE name='allocations'")?.sql.includes('UNIQUE(tenant,settlement,invoice)')) this.transaction(()=>this.db.exec(`ALTER TABLE allocations RENAME TO allocations_previous;
      CREATE TABLE allocations(tenant TEXT NOT NULL,id TEXT NOT NULL,settlement TEXT NOT NULL,invoice TEXT NOT NULL,amount TEXT NOT NULL,date TEXT NOT NULL,PRIMARY KEY(tenant,id));
      INSERT INTO allocations SELECT tenant,id,settlement,invoice,amount,date FROM allocations_previous; DROP TABLE allocations_previous;`));
  }
  close() { this.db.close(); }
  all(sql: string, ...args: any[]): any[] { return this.db.prepare(sql).all(...args); }
  get(sql: string, ...args: any[]): any { return this.db.prepare(sql).get(...args); }
  run(sql: string, ...args: any[]) { return this.db.prepare(sql).run(...args); }
  transaction<T>(fn: () => T): T { this.db.exec('BEGIN IMMEDIATE'); try { const r = fn(); this.db.exec('COMMIT'); return r; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  company(id: string, name: string) {
    return this.transaction(() => {
      if (this.get('SELECT id FROM companies WHERE id=?',id)) return;
      this.run('INSERT INTO companies VALUES(?,?,?)',id,name,JSON.stringify({ currency:'PKR', lockDate:'', approvalThreshold:'0', providers:{} }));
      for (const [code,label,category] of defaults) this.writeRecord(id,'account',code,{ id:code,name:label,category,active:true });
      this.writeRecord(id,'location','MAIN',{id:'MAIN',name:'Main warehouse',active:true});
    });
  }
  settings(c: Context) { const row = this.get('SELECT * FROM companies WHERE id=?',c.tenant); ensure(row,'Company not found.'); return { ...JSON.parse(row.settings), name:row.name }; }
  authorize(c: Context, resource: string, action: string, record?: any) {
    ensure(c.owner || c.grants?.includes(`${resource}.${action}`),`Access denied: ${resource}.${action}`);
    if (!c.owner && record) for (const field of ['party','product','location','project','bank']) {
      const allowed = c.scopes?.[field];
      if (allowed) { const values=['product','location'].includes(field) && record.items ? record.items.map((i:any)=>i[field] || record[field] || (field==='location'?'MAIN':undefined)) : [record[field]]; ensure(values.length && values.every((value:any)=>value && allowed.includes(value)),`Access denied for ${field}.`); }
    }
  }
  visible(c: Context, record: any) {
    if (c.owner) return true;
    return Object.entries(c.scopes || {}).every(([key,ids]) => ['product','location'].includes(key) && record.items ? record.items.every((i:any)=>ids.includes(i[key] || record[key])) : ids.includes(record[key]));
  }
  audit(c: Context, action: string, entity: string, before: any, after: any) {
    this.run('INSERT INTO audit(tenant,id,actor,ip,action,entity,before_data,after_data,created) VALUES(?,?,?,?,?,?,?,?,?)',c.tenant,randomUUID(),c.user,c.ip || '',action,entity,JSON.stringify(before ?? null),JSON.stringify(after ?? null),now());
  }
  record(c: Context, type: string, id: string) { const r = this.get('SELECT data FROM records WHERE tenant=? AND type=? AND id=?',c.tenant,type,id); return r ? JSON.parse(r.data) : null; }
  records(c: Context, type: string) { return this.all('SELECT data FROM records WHERE tenant=? AND type=? ORDER BY id',c.tenant,type).map(r => JSON.parse(r.data)); }
  writeRecord(tenant: string, type: string, id: string, value: any) { this.run('INSERT INTO records VALUES(?,?,?,?) ON CONFLICT(tenant,type,id) DO UPDATE SET data=excluded.data',tenant,type,id,JSON.stringify(value)); }
  saveRecord(c: Context, type: string, input: any) {
    const resource = ['customer','supplier'].includes(type) ? type === 'customer' ? 'sales' : 'purchases' : ['product','location','bom'].includes(type) ? 'inventory' : ['bank','reconciliation'].includes(type) ? 'banking' : 'settings';
    this.authorize(c,resource,'write');
    ensure(['customer','supplier','product','location','project','account','bank','tax','budget','asset','bom','saved-view','template','custom-field'].includes(type),'Unsupported master type.');
    return this.transaction(() => {
      const data = structuredClone(input); data.id ||= randomUUID(); ensure(/^[\w.-]{1,100}$/.test(data.id),'Invalid record ID.');
      const scope=({customer:'party',supplier:'party',product:'product',location:'location',project:'project',bank:'bank'} as any)[type];
      if(!c.owner && scope && c.scopes?.[scope]) ensure(c.scopes[scope].includes(data.id),'Access denied for master record scope.');
      ensure(typeof data.name === 'string' && data.name.trim(),'Name is required.'); data.active = data.active !== false;
      const old = this.record(c,type,data.id);
      if (type === 'account') { ensure(['asset','liability','equity','income','expense'].includes(data.category),'Choose an account category.'); if (old) ensure(old.category === data.category,'Account category cannot change after creation.'); }
      if (type === 'bank') { const account=this.requireRecord(c,'account',data.account); ensure(account.category==='asset' && !['1100','1200','1300','1400','1490'].includes(account.id),'Bank requires a dedicated asset ledger account.'); ensure(!this.records(c,'bank').some(b=>b.id!==data.id && b.account===data.account),'Each bank needs its own ledger account.'); }
      if (type === 'tax') { ensure(D(data.rate) >= 0n && D(data.rate) <= D('100'),'Tax rate must be 0–100.'); this.requireRecord(c,'account',data.account); }
      if (type === 'product') { data.stock = data.stock !== false; data.units ||= [{name:'Each',factor:'1'}]; for (const unit of data.units) ensure(D(unit.factor,6)>0n,'Unit conversion must be positive.'); if(old && this.documents(c).some(d=>d.items?.some((i:any)=>i.product===data.id))) ensure(old.stock===data.stock && JSON.stringify(old.units)===JSON.stringify(data.units),'Preserve units and stock classification on products used in documents.'); }
      if (type === 'budget') { this.requireRecord(c,'account',data.account); ensure(dateOK(data.from) && dateOK(data.to) && data.from<=data.to,'Invalid budget period.'); ensure(D(data.amount)>=0n,'Budget must be nonnegative.'); }
      if (type === 'asset') { ensure(D(data.cost)>0n && D(data.residual || '0')>=0n && D(data.residual || '0')<D(data.cost),'Invalid asset cost/residual.'); ensure(Number.isInteger(data.months) && data.months>0,'Useful life must be a positive number of months.'); }
      if (old && ['bank','asset'].includes(type)) ensure(JSON.stringify({...old,name:data.name,active:data.active})===JSON.stringify(data),'Only name and archive status can change; preserve posted accounting references.');
      this.writeRecord(c.tenant,type,data.id,data); this.audit(c,old?'master.update':'master.create',`${type}:${data.id}`,old,data); return data;
    });
  }
  requireRecord(c: Context, type: string, id: string) { const r = this.record(c,type,id); ensure(r?.active !== false && r,`Choose an active ${type}.`); return r; }
  unlocked(c: Context, date: string) { ensure(dateOK(date),'Valid date required.'); const s = this.settings(c); ensure(!s.lockDate || date>s.lockDate,'The accounting period is locked.'); }
  updateSettings(c: Context, input: any) {
    ensure(c.owner,'Owner access required.');
    return this.transaction(() => {
      const old=this.settings(c), s={...old};
      if (input.lockDate !== undefined) { ensure(input.lockDate==='' || dateOK(input.lockDate),'Invalid lock date.'); s.lockDate=input.lockDate; }
      if (input.approvalThreshold !== undefined) { ensure(D(input.approvalThreshold)>=0n,'Invalid approval threshold.'); s.approvalThreshold=F(D(input.approvalThreshold)); }
      if(input.name) s.name=String(input.name).slice(0,200);
      // Credentials are environment references only, never returned to the browser or persisted in clear text.
      if(input.providers) for(const [key,value] of Object.entries(input.providers) as any) { ensure(['payments','email','sms','fbr'].includes(key),'Unknown provider.'); s.providers[key]={name:String(value.name || '').slice(0,100),mode:value.mode==='production'?'production':'sandbox',status:'NOT_CONFIGURED'}; }
      this.run('UPDATE companies SET name=?,settings=? WHERE id=?',s.name,JSON.stringify(s),c.tenant); this.audit(c,'settings.update',c.tenant,old,s); return s;
    });
  }
  idempotent(c: Context, key: string, payload: any, fn: () => any) {
    ensure(typeof key==='string' && key.length>=8 && key.length<=200,'An Idempotency-Key of 8–200 characters is required.');
    const hash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    return this.transaction(() => {
      const prior=this.get('SELECT * FROM requests WHERE tenant=? AND key=?',c.tenant,key);
      if(prior) { ensure(prior.hash===hash,'Idempotency key was already used for a different request.'); return JSON.parse(prior.result); }
      const result=fn(); this.run('INSERT INTO requests VALUES(?,?,?,?)',c.tenant,key,hash,JSON.stringify(result)); return result;
    });
  }
  nextNumber(c: Context, kind: string, date: string) {
    const year=date.slice(0,4); this.run('INSERT INTO sequences VALUES(?,?,?,1) ON CONFLICT(tenant,kind,year) DO UPDATE SET value=value+1',c.tenant,kind,year);
    return `${kind}-${year}-${String(this.get('SELECT value FROM sequences WHERE tenant=? AND kind=? AND year=?',c.tenant,kind,year).value).padStart(6,'0')}`;
  }
  document(c: Context, id: string) { const r=this.get('SELECT data FROM documents WHERE tenant=? AND id=?',c.tenant,id); ensure(r,'Document not found.'); return JSON.parse(r.data); }
  documents(c: Context) { return this.all('SELECT data FROM documents WHERE tenant=? ORDER BY date DESC,number DESC',c.tenant).map(r=>JSON.parse(r.data)); }
  writeDocument(c: Context,d: any) { this.run('INSERT INTO documents VALUES(?,?,?,?,?,?,?) ON CONFLICT(tenant,id) DO UPDATE SET state=excluded.state,date=excluded.date,data=excluded.data',c.tenant,d.id,d.number,d.kind,d.state,d.date,JSON.stringify(d)); }
  create(c: Context, input: any, key: string) {
    this.authorize(c,moduleFor(input.kind),'write',input);
    ensure(!input.source && input.kind!=='CREDIT_NOTE','Use source document conversion to create linked documents and credit notes.');
    return this.idempotent(c,key,{action:'create',input},()=>this.createInside(c,input));
  }
  updateDraft(c:Context,id:string,input:any,key:string) {
    const old=this.document(c,id);this.authorize(c,moduleFor(old.kind),'write',old);ensure(this.visible(c,old),'Access denied for document.');
    return this.idempotent(c,key,{action:'edit',id,input},()=>{ensure(old.state==='DRAFT' && !old.source,'Only unlinked drafts can be edited; cancel and reconvert linked drafts.');ensure(old.kind===input.kind && !input.source,'Document type and source cannot change.');this.unlocked(c,old.date);this.authorize(c,moduleFor(old.kind),'write',input);const next=this.createInside(c,input,old);this.audit(c,'document.edit',id,old,next);return next;});
  }
  createInside(c: Context, input: any, identity?:any) {
    ensure(kinds.includes(input.kind),'Unsupported document type.'); this.unlocked(c,input.date);
    const d:any={...structuredClone(input),id:identity?.id || randomUUID(),number:identity?.number || this.nextNumber(c,input.kind,input.date),state:'DRAFT',createdBy:c.user,createdAt:identity?.createdAt || now(),currency:input.currency || this.settings(c).currency,rate:String(input.rate || '1')};
    for(const field of ['journal','reversal','approvedBy','postedAt','postedBy','baseTotal']) delete d[field];
    if(d.kind!=='JOURNAL') delete d.lines;
    if(['JOURNAL','RECEIPT','PAYMENT','LANDED_COST'].includes(d.kind)) delete d.items;
    if(d.dueDate) ensure(dateOK(d.dueDate) && d.dueDate>=d.date,'Due date must be on or after the document date.');
    ensure(D(d.rate,8)>0n,'Exchange rate must be positive.'); if(d.currency===this.settings(c).currency) ensure(D(d.rate,8)===100000000n,'Base currency rate must be 1.');
    if (['INVOICE','CREDIT_NOTE','QUOTE','SALES_ORDER','DELIVERY','RECEIPT'].includes(d.kind)) this.requireRecord(c,'customer',d.party);
    if (['BILL','PURCHASE_ORDER','GOODS_RECEIPT','LANDED_COST','PAYMENT'].includes(d.kind)) this.requireRecord(c,'supplier',d.party);
    if(d.project) this.requireRecord(c,'project',d.project);
    if(d.kind==='LANDED_COST') { ensure(D(d.amount)>0n,'Positive landed cost required.'); ensure(['quantity','value'].includes(d.method),'Choose quantity or value allocation.'); const source=this.document(c,d.receipt); ensure(source.state==='POSTED' && ['BILL','GOODS_RECEIPT'].includes(source.kind),'Choose a posted stock receipt or bill.'); d.total=F(D(d.amount)); }
    else if (['RECEIPT','PAYMENT'].includes(d.kind)) { this.requireRecord(c,'bank',d.bank); ensure(D(d.amount)>0n,'Positive payment amount required.'); d.total=F(D(d.amount)); }
    else if(d.kind==='JOURNAL') { ensure(d.currency===this.settings(c).currency,'Journal lines use base currency.'); this.validateLines(c,d.lines); ensure(!d.lines.some((l:any)=>l.account==='1200'),'Use a stock opening or adjustment to change inventory value.'); d.total=F(d.lines.reduce((s:bigint,l:any)=>s+D(l.debit || '0'),0n)); }
    else {
      ensure(Array.isArray(d.items) && d.items.length>0 && d.items.length<=500,'Enter 1–500 item lines.'); let total=0n;
      d.items=d.items.map((item:any,index:number)=>{
        const p=this.requireRecord(c,'product',item.product); ensure(D(item.quantity,6)>0n,'Quantity must be positive.'); ensure(D(item.price)>=0n,'Price cannot be negative.');
        const unit=p.units.find((u:any)=>u.name===(item.unit || p.units[0].name)); ensure(unit,'Invalid product unit.');
        const baseQuantity=F(divide(D(item.quantity,6)*D(unit.factor,6),1000000n),6);
        const location=item.location || d.location || 'MAIN'; this.requireRecord(c,'location',location);
        this.authorize(c,moduleFor(d.kind),'write',{...d,...item,location});
        ensure(D(item.discount || '0')>=0n,'Discount cannot be negative.');const net=amountFor(item.quantity,item.price)-D(item.discount || '0'); ensure(net>=0n,'Discount exceeds line value.');
        const tax=item.tax ? this.requireRecord(c,'tax',item.tax) : null;
        const taxValue=tax ? divide(net*D(tax.rate),1000000n) : 0n; total+=net+taxValue;
        if(item.expiry) ensure(dateOK(item.expiry),'Invalid batch expiry.');
        return {...item,id:String(index+1),unit:unit.name,baseQuantity,location,batch:String(item.batch || ''),net:F(net),taxAmount:F(taxValue),taxAccount:tax?.account};
      }); d.total=F(total);
    }
    this.writeDocument(c,d); this.audit(c,'document.create',d.id,null,d); return d;
  }
  validateLines(c: Context, lines: JournalLine[]) {
    ensure(Array.isArray(lines) && lines.length>=2 && lines.length<=1000,'A journal needs 2–1000 lines.'); let debit=0n,credit=0n;
    for(const line of lines) { this.requireRecord(c,'account',line.account); const dr=D(line.debit || '0'),cr=D(line.credit || '0'); ensure(dr>=0n && cr>=0n && !(dr>0n && cr>0n) && dr+cr>0n,'Each journal line must have a positive debit or credit.'); debit+=dr; credit+=cr;
      if(['1100','2000'].includes(line.account)) this.requireRecord(c,line.account==='1100'?'customer':'supplier',line.party!);
      if(line.project) this.requireRecord(c,'project',line.project);
    }
    ensure(debit===credit,'Journal debits and credits must balance exactly.');
  }
  journal(c: Context, source: string, date: string, lines: JournalLine[], reversal?: string) {
    const filtered=lines.filter(l=>D(l.debit || '0')+D(l.credit || '0')>0n); this.validateLines(c,filtered);
    const id=randomUUID(); this.run('INSERT INTO journals VALUES(?,?,?,?,?,?,?)',c.tenant,id,source,date,c.user,now(),reversal || null);
    filtered.forEach((l,i)=>this.run('INSERT INTO journal_lines VALUES(?,?,?,?,?,?,?,?,?)',c.tenant,id,i,l.account,F(D(l.debit || '0')),F(D(l.credit || '0')),l.party || null,l.project || null,l.location || null)); return id;
  }
  receive(c: Context,d:any,item:any,value:bigint) {
    this.stockDate(c,d,item);
    const id=randomUUID(),q=D(item.baseQuantity,6); ensure(q>0n && value>=0n,'Invalid inventory receipt.');
    this.run('INSERT INTO layers VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',c.tenant,id,item.product,item.location,item.batch || '',item.expiry || null,d.id,`${d.date}T${now().slice(11)}`,String(q),String(q),String(value),String(value));
    this.movement(c,d,item,q,value,[{id,quantity:String(q),value:String(value)}]); return value;
  }
  issue(c:Context,d:any,item:any) {
    this.stockDate(c,d,item);
    let remaining=D(item.baseQuantity,6),total=0n; const used:any[]=[];
    const layers=this.all('SELECT * FROM layers WHERE tenant=? AND product=? AND location=? ORDER BY created,id',c.tenant,item.product,item.location).filter(l=>BigInt(l.remaining)>0n && (!item.batch || l.batch===item.batch) && (!l.expiry || l.expiry>=d.date) && l.created.slice(0,10)<=d.date);
    for(const l of layers) { if(!remaining) break; const available=BigInt(l.remaining),take=remaining<available?remaining:available; const cost=take===available?BigInt(l.remaining_value):divide(BigInt(l.remaining_value)*take,available); remaining-=take; total+=cost;
      this.run('UPDATE layers SET remaining=?,remaining_value=? WHERE tenant=? AND id=?',String(available-take),String(BigInt(l.remaining_value)-cost),c.tenant,l.id); used.push({id:l.id,quantity:String(take),value:String(cost),batch:l.batch,expiry:l.expiry});
    }
    ensure(remaining===0n,'Insufficient unexpired FIFO stock in the selected location/batch.'); this.movement(c,d,item,-D(item.baseQuantity,6),-total,used); return {value:total,layers:used};
  }
  movement(c:Context,d:any,item:any,quantity:bigint,value:bigint,layers:any[]) { this.run('INSERT INTO movements VALUES(?,?,?,?,?,?,?,?,?,?)',c.tenant,randomUUID(),d.id,item.product,item.location,item.batch || '',String(quantity),String(value),JSON.stringify(layers),d.date); }
  stockDate(c:Context,d:any,item:any) { const last=this.get('SELECT MAX(date) date FROM movements WHERE tenant=? AND product=?',c.tenant,item.product); ensure(!last?.date || d.date>=last.date,'Stock cannot be backdated before an existing movement; use a current-period correction.'); }
  transition(c:Context,id:string,action:string,key:string,extra:any={}) {
      const before=this.document(c,id); this.authorize(c,moduleFor(before.kind),['approve','reject'].includes(action)?'approve':action==='cancel'?'delete':'post',before); ensure(this.visible(c,before),'Access denied for document scope.');
    return this.idempotent(c,key,{id,action,extra},()=>{
      const d=this.document(c,id); this.unlocked(c,d.date); const old=structuredClone(d);
      if(action==='cancel') { ensure(['DRAFT','PENDING_APPROVAL','APPROVED'].includes(d.state),'Only unposted documents can be cancelled.'); d.state='CANCELLED'; }
      else if(action==='submit') { ensure(d.state==='DRAFT','Only drafts can be submitted.'); d.state='PENDING_APPROVAL'; }
      else if(action==='approve') { ensure(d.state==='PENDING_APPROVAL','Document is not awaiting approval.'); ensure(c.owner || d.createdBy!==c.user,'A different authorized user must approve this document.'); d.state='APPROVED'; d.approvedBy=c.user; }
      else if(action==='reject') { ensure(d.state==='PENDING_APPROVAL','Document is not awaiting approval.'); ensure(extra.reason?.trim(),'A rejection reason is required.'); d.state='REJECTED'; d.reason=extra.reason; }
      else if(action==='post') {
        ensure(['DRAFT','APPROVED'].includes(d.state),'Only a draft or approved document can be posted.');
        const threshold=D(this.settings(c).approvalThreshold); ensure(threshold===0n || fxAmount(D(d.total),d.rate)<threshold || d.state==='APPROVED','Submit this document for approval before posting.');
        this.postInside(c,d); d.state='POSTED'; d.postedAt=now(); d.postedBy=c.user;
      } else throw new Error('Unsupported transition.');
      this.writeDocument(c,d); this.audit(c,`document.${action}`,d.id,old,d); return d;
    });
  }
  postInside(c:Context,d:any) {
    const lines:JournalLine[]=[];
    const line=(account:string,net:bigint,party?:string,location?:string)=>{ if(net) lines.push({account,debit:F(net>0n?net:0n),credit:F(net<0n?-net:0n),party,project:d.project,location}); };
    if(['QUOTE','SALES_ORDER','PURCHASE_ORDER'].includes(d.kind)) return;
    if(d.kind==='JOURNAL') { this.validateLines(c,d.lines); lines.push(...d.lines); }
    else if(['RECEIPT','PAYMENT'].includes(d.kind)) {
      const bank=this.requireRecord(c,'bank',d.bank); ensure(!bank.currency || bank.currency===d.currency,'Payment currency must match the bank currency.');
      const receipt=d.kind==='RECEIPT',sign=receipt?1n:-1n;
      line(bank.account,sign*fxAmount(D(d.total),d.rate)); line(receipt?'1100':'2000',-sign*fxAmount(D(d.total),d.rate),d.party);
    } else if(d.kind==='LANDED_COST') {
      const layers=this.all('SELECT * FROM layers WHERE tenant=? AND source=?',c.tenant,d.receipt); ensure(layers.length,'The selected document has no stock layers.');
      ensure(layers.every(l=>l.quantity===l.remaining),'Allocate landed cost before issuing any stock from this receipt.');
      const basis=layers.reduce((sum:bigint,l:any)=>sum+BigInt(d.method==='quantity'?l.quantity:l.value),0n); ensure(basis>0n,'Allocation basis must be positive.');
      const total=fxAmount(D(d.total),d.rate); let allocated=0n;
      layers.forEach((l:any,index:number)=>{
        const share=index===layers.length-1?total-allocated:divide(total*BigInt(d.method==='quantity'?l.quantity:l.value),basis); allocated+=share;
        const inventory=divide(share*BigInt(l.remaining),BigInt(l.quantity));
        this.run('UPDATE layers SET value=?,remaining_value=? WHERE tenant=? AND id=?',String(BigInt(l.value)+share),String(BigInt(l.remaining_value)+inventory),c.tenant,l.id);
        this.movement(c,d,l,0n,inventory,[{id:l.id,value:String(inventory)}]);line('1200',inventory);line('5000',share-inventory);
      });line('2000',-total,d.party);
    } else if(d.kind==='GOODS_RECEIPT' || d.kind==='DELIVERY') {
      for(const i of d.items) { const p=this.requireRecord(c,'product',i.product); ensure(p.stock,'Goods receipts and deliveries require stock products.'); if(d.kind==='GOODS_RECEIPT') { const value=fxAmount(D(i.net),d.rate); this.receive(c,d,i,value); line('1200',value);line('2050',-value); } else {const value=this.issue(c,d,i).value;i.fifoCost=F(value);line('5000',value);line('1200',-value);} }
    } else if(['INVOICE','BILL','CREDIT_NOTE'].includes(d.kind)) {
      const sale=d.kind!=='BILL',credit=d.kind==='CREDIT_NOTE',sign=credit?-1n:1n;
      const source=d.source?this.document(c,d.source):null;
      if(credit) { const source=this.document(c,d.source); ensure(source.kind==='INVOICE' && source.state==='POSTED' && source.party===d.party,'A credit note needs its posted source invoice.'); ensure(source.currency===d.currency && source.rate===d.rate,'Credit note must use the invoice currency and rate.'); }
      let sum=0n;
      for(const i of d.items) {
        const p=this.requireRecord(c,'product',i.product),net=fxAmount(D(i.net),d.rate),tax=fxAmount(D(i.taxAmount),d.rate); sum+=net+tax;
        line(sale?'4000':p.stock?(source?.kind==='GOODS_RECEIPT'?'2050':'1200'):'6000',sale?-sign*net:net,undefined,i.location);
        if(tax) line(i.taxAccount || (sale?'2100':'1300'),sale?-sign*tax:tax,undefined,i.location);
        if(p.stock) {
          if(!sale) { if(source?.kind!=='GOODS_RECEIPT') this.receive(c,d,i,net); }
          else if(credit) {
            const source=this.document(c,d.source), original=source.items.find((x:any)=>x.id===i.sourceLine); ensure(original && original.product===i.product,'Credit line must reference an invoice line.');
            const returns=this.documents(c).filter(x=>x.state==='POSTED' && x.kind==='CREDIT_NOTE' && x.source===d.source).flatMap(x=>x.items).filter(x=>x.sourceLine===i.sourceLine).reduce((s:bigint,x:any)=>s+D(x.baseQuantity,6),0n);
            ensure(returns+D(i.baseQuantity,6)<=D(original.baseQuantity,6),'Returned quantity exceeds the original sale.');
            const cost=divide(D(original.fifoCost)*D(i.baseQuantity,6),D(original.baseQuantity,6)); this.receive(c,d,i,cost); line('1200',cost); line('5000',-cost);
          } else if(source?.kind==='DELIVERY') { const original=source.items.find((x:any)=>x.id===i.sourceLine);i.fifoCost=F(divide(D(original.fifoCost)*D(i.baseQuantity,6),D(original.baseQuantity,6))); }
          else { const result=this.issue(c,d,i); i.fifoCost=F(result.value); line('5000',result.value); line('1200',-result.value); }
        }
      }
      const baseTotal=fxAmount(D(d.total),d.rate); line('6900',sale?sign*(sum-baseTotal):baseTotal-sum);
      line(sale?'1100':'2000',sale?sign*baseTotal:-baseTotal,d.party); d.baseTotal=F(baseTotal);
      if(d.kind==='INVOICE') { const party=this.requireRecord(c,'customer',d.party); if(party.creditLimit && D(party.creditLimit)>0n) ensure(this.balance(c,'1100',d.party)+sum<=D(party.creditLimit),'Customer credit limit would be exceeded.'); }
    } else if(d.kind==='STOCK_TRANSFER') {
      this.requireRecord(c,'location',d.destination); this.authorize(c,'inventory','post',{...d,items:d.items.map((i:any)=>({...i,location:d.destination}))}); for(const i of d.items) { ensure(i.location!==d.destination,'Choose a different destination.'); const result=this.issue(c,d,i); for(const layer of result.layers) this.receive(c,d,{...i,location:d.destination,batch:layer.batch,expiry:layer.expiry,baseQuantity:F(BigInt(layer.quantity),6)},BigInt(layer.value)); } return;
    } else if(d.kind==='PRODUCTION') {
      ensure(d.output?.product && D(d.output.quantity,6)>0n,'Enter a finished product and quantity.'); const p=this.requireRecord(c,'product',d.output.product); ensure(p.stock,'Finished goods must be a stock product.'); this.requireRecord(c,'location',d.output.location || 'MAIN');
      this.authorize(c,'inventory','post',{...d,items:[{product:p.id,location:d.output.location || 'MAIN'}]});
      let cost=0n; for(const i of d.items) cost+=this.issue(c,d,i).value;
      const overhead=D(d.overhead || '0'); ensure(overhead>=0n,'Overhead cannot be negative.'); cost+=overhead;
      this.receive(c,d,{...d.output,baseQuantity:d.output.quantity,location:d.output.location || 'MAIN'},cost); line('1200',overhead); line('6000',-overhead); if(!overhead) return;
    } else {
      for(const i of d.items) { ensure(this.requireRecord(c,'product',i.product).stock,'Stock documents require stock products.'); const decrease=d.kind==='STOCK_ADJUSTMENT' && d.direction==='OUT'; const value=decrease?-this.issue(c,d,i).value:this.receive(c,d,i,fxAmount(D(i.net),d.rate)); line('1200',value); line(d.kind==='STOCK_OPENING'?'3000':'6100',-value); }
    }
    if(lines.length) d.journal=this.journal(c,d.id,d.date,lines);
  }
  balance(c:Context,account:string,party?:string) { return this.all(`SELECT debit,credit FROM journal_lines WHERE tenant=? AND account=?${party?' AND party=?':''}`,c.tenant,account,...(party?[party]:[])).reduce((s:bigint,l:any)=>s+D(l.debit)-D(l.credit),0n); }
  allocate(c:Context,settlementId:string,items:{invoice:string;amount:string}[],key:string,date=today()) {
    this.authorize(c,'banking','post');
    return this.idempotent(c,key,{action:'allocate',settlementId,items,date},()=>{
      const payment=this.document(c,settlementId); ensure(this.visible(c,payment),'Access denied for payment.'); ensure(payment.state==='POSTED' && ['RECEIPT','PAYMENT'].includes(payment.kind),'Choose a posted receipt or payment.'); this.unlocked(c,date);ensure(date>=payment.date,'Allocation date must not precede the settlement.');
      ensure(Array.isArray(items) && items.length>0,'Choose one or more invoices.');
      let used=this.all('SELECT amount FROM allocations WHERE tenant=? AND settlement=?',c.tenant,payment.id).reduce((s:bigint,a:any)=>s+D(a.amount),0n);
      const result=[]; for(const item of items) {
        const invoice=this.document(c,item.invoice); ensure(this.visible(c,invoice),'Access denied for invoice.'); ensure(invoice.state==='POSTED' && invoice.kind===(payment.kind==='RECEIPT'?'INVOICE':'BILL') && invoice.party===payment.party && invoice.currency===payment.currency,'Allocation must use a posted document for the same party and currency.'); ensure(date>=invoice.date,'Allocation date must not precede invoice.');
        const amount=D(item.amount); ensure(amount>0n && amount<=this.outstanding(c,invoice),'Allocation exceeds invoice outstanding.'); used+=amount; ensure(used<=D(payment.total),'Allocations exceed the settlement amount.');
        const id=randomUUID(); this.run('INSERT INTO allocations VALUES(?,?,?,?,?,?)',c.tenant,id,payment.id,invoice.id,F(amount),date); result.push({id,invoice:invoice.id,amount:F(amount),date});
        const gain=fxAmount(amount,payment.rate)-fxAmount(amount,invoice.rate); if(gain) { const signed=payment.kind==='RECEIPT'?gain:-gain; this.journal(c,`fx:${id}`,date,[{account:payment.kind==='RECEIPT'?'1100':'2000',party:payment.party,debit:F(signed>0n?signed:0n),credit:F(signed<0n?-signed:0n)},{account:signed>0n?'4100':'6200',debit:F(signed<0n?-signed:0n),credit:F(signed>0n?signed:0n)}]); }
      } this.audit(c,'payment.allocate',payment.id,null,result); return result;
    });
  }
  outstanding(c:Context,d:any,asOf?:string) {
    const paid=this.all("SELECT a.amount,COALESCE(NULLIF(a.date,''),d.date) date FROM allocations a JOIN documents d ON d.tenant=a.tenant AND d.id=a.settlement WHERE a.tenant=? AND a.invoice=?",c.tenant,d.id).filter(a=>!asOf || a.date<=asOf).reduce((s:bigint,a:any)=>s+D(a.amount),0n);
    const credited=d.kind==='INVOICE'?this.documents(c).filter(x=>x.kind==='CREDIT_NOTE' && x.state==='POSTED' && x.source===d.id && (!asOf || x.date<=asOf)).reduce((s:bigint,x:any)=>s+D(x.total),0n):0n;
    return D(d.total)-paid-credited;
  }
  convert(c:Context,id:string,input:any,key:string) {
    const source=this.document(c,id); this.authorize(c,moduleFor(source.kind),'write',source); ensure(this.visible(c,source),'Access denied for source.');
    return this.idempotent(c,key,{action:'convert',id,input},()=>{
      const map:Record<string,string[]>={QUOTE:['SALES_ORDER','INVOICE'],SALES_ORDER:['DELIVERY','INVOICE'],DELIVERY:['INVOICE'],PURCHASE_ORDER:['GOODS_RECEIPT','BILL'],GOODS_RECEIPT:['BILL'],INVOICE:['CREDIT_NOTE']};
      ensure(input.date>=source.date,'Linked document date cannot precede its source.');
      ensure(source.state==='POSTED' && map[source.kind]?.includes(input.kind),'Invalid source or target document.'); ensure(Array.isArray(input.items) && input.items.length,'Select source lines and quantities.');
      const seen=new Set(); const previous=this.documents(c).filter(d=>d.source===id && !['REJECTED','REVERSED','CANCELLED'].includes(d.state));
      const items=input.items.map((line:any)=>{
        ensure(!seen.has(line.sourceLine),'Duplicate source line.'); seen.add(line.sourceLine);
        const original=source.items.find((i:any)=>i.id===line.sourceLine); ensure(original,'Source line not found.');
        const used=previous.flatMap(d=>d.items).filter(i=>i.sourceLine===original.id).reduce((s:bigint,i:any)=>s+D(i.quantity,6),0n);
        ensure(D(line.quantity,6)>0n && used+D(line.quantity,6)<=D(original.quantity,6),'Quantity exceeds the unconverted source balance.');
        return {...original,sourceLine:original.id,quantity:line.quantity,discount:F(divide(D(original.discount || '0')*D(line.quantity,6),D(original.quantity,6)))};
      });
      const converted=this.createInside(c,{...source,source:id,kind:input.kind,date:input.date,items});
      // Preserve the tax snapshot of the source instead of repricing a credit or receipt conversion.
      let total=0n; for(const line of converted.items) { const original=source.items.find((i:any)=>i.id===line.sourceLine); line.taxAmount=F(divide(D(original.taxAmount)*D(line.quantity,6),D(original.quantity,6))); line.taxAccount=original.taxAccount; total+=D(line.net)+D(line.taxAmount); }
      converted.total=F(total); this.writeDocument(c,converted);this.audit(c,'document.convert',converted.id,{source:id},converted);return converted;
    });
  }
  reverse(c:Context,id:string,date:string,reason:string,key:string) {
    const original=this.document(c,id); this.authorize(c,moduleFor(original.kind),'post',original); ensure(this.visible(c,original),'Access denied.');
    return this.idempotent(c,key,{action:'reverse',id,date,reason},()=>{
      const d=this.document(c,id); this.unlocked(c,date); ensure(date>=d.date && reason?.trim(),'Enter a reversal date on or after posting and a reason.'); ensure(d.state==='POSTED' && d.journal,'Only a posted financial document can be reversed.');
      ensure(!this.records(c,'reconciliation').some(r=>r.state==='FINAL' && r.lines.some((l:string)=>l.startsWith(`${d.journal}:`))),'Reconciled bank transactions cannot be reversed.');
      ensure(!this.get('SELECT id FROM movements WHERE tenant=? AND source=?',c.tenant,id),'Use a linked credit or inventory adjustment for stock documents.');
      ensure(!this.get('SELECT id FROM allocations WHERE tenant=? AND (settlement=? OR invoice=?)',c.tenant,id,id),'Allocated documents cannot be reversed.');
      const lines=this.all('SELECT * FROM journal_lines WHERE tenant=? AND journal=?',c.tenant,d.journal).map(l=>({...l,debit:l.credit,credit:l.debit}));
      const reversal=this.journal(c,`reverse:${id}`,date,lines,d.journal); const before=structuredClone(d); d.state='REVERSED'; d.reversal={id:reversal,date,reason}; this.writeDocument(c,d); this.audit(c,'document.reverse',id,before,d); return d;
    });
  }
  reconcile(c:Context,input:any,key:string) {
    this.authorize(c,'banking','post');
    return this.idempotent(c,key,{action:'reconcile',input},()=>{
      const bank=this.requireRecord(c,'bank',input.bank); this.unlocked(c,input.to); ensure(dateOK(input.from) && input.from<=input.to,'Invalid statement dates.'); ensure(this.visible(c,{bank:input.bank}),'Access denied for bank.');
      const previous=this.records(c,'reconciliation').filter(r=>r.bank===bank.id && r.state==='FINAL'); ensure(!previous.some(r=>r.from<=input.to && r.to>=input.from),'Statement dates overlap an existing reconciliation.');
      const last=previous.sort((a,b)=>b.to.localeCompare(a.to))[0]; if(last) ensure(D(input.opening)===D(last.closing) && input.from>last.to,'Opening must match the previous statement closing balance.');
      ensure(Array.isArray(input.lines) && new Set(input.lines).size===input.lines.length,'Duplicate bank lines.'); let cleared=0n;
      for(const id of input.lines) { ensure(!previous.some(r=>r.lines.includes(id)),'Bank line already reconciled.'); const [journal,position]=id.split(':'); const l=this.get('SELECT l.*,j.date FROM journal_lines l JOIN journals j ON j.tenant=l.tenant AND j.id=l.journal WHERE l.tenant=? AND l.journal=? AND l.position=? AND l.account=?',c.tenant,journal,position,bank.account); ensure(l && l.date<=input.to,'Invalid statement line.'); cleared+=D(l.debit)-D(l.credit); }
      ensure(D(input.opening)+cleared===D(input.closing),'Statement difference must be exactly zero.'); const r={...input,id:randomUUID(),name:`${bank.name} ${input.to}`,state:'FINAL',createdBy:c.user}; this.writeRecord(c.tenant,'reconciliation',r.id,r); this.audit(c,'bank.reconcile',r.id,null,r); return r;
    });
  }
  report(c:Context,filters:any={}) {
    this.authorize(c,'reports','view');
    ensure(!filters.from || dateOK(filters.from),'Invalid report start date.');ensure(!filters.to || dateOK(filters.to),'Invalid report end date.');ensure(!filters.from || !filters.to || filters.from<=filters.to,'Report start date exceeds end date.');
    const lines=this.all('SELECT l.*,j.source,j.date FROM journal_lines l JOIN journals j ON l.tenant=j.tenant AND l.journal=j.id WHERE l.tenant=? ORDER BY j.date,j.created,l.position',c.tenant).filter(l=>this.visible(c,l) && (!filters.from || l.date>=filters.from) && (!filters.to || l.date<=filters.to) && (!filters.project || l.project===filters.project) && (!filters.location || l.location===filters.location));
    const accounts=this.records(c,'account'); const totals=new Map<string,bigint>(); for(const l of lines) totals.set(l.account,(totals.get(l.account)||0n)+D(l.debit)-D(l.credit));
    const trial=accounts.map(a=>{const net=totals.get(a.id)||0n;return {...a,debit:F(net>0n?net:0n),credit:F(net<0n?-net:0n),net:F(net)};});
    const category=(name:string):bigint=>trial.filter(a=>a.category===name).reduce((s:bigint,a:any)=>s+D(a.net),0n);
    const income=-category('income'),expense=category('expense');
    const budgets=this.records(c,'budget').filter(b=>this.visible(c,b)).map(b=>{const sign=['liability','equity','income'].includes(accounts.find(a=>a.id===b.account)?.category)?-1n:1n;return {...b,actual:F(lines.filter(l=>l.account===b.account && l.date>=b.from && l.date<=b.to && (!b.project || l.project===b.project)).reduce((s:bigint,l:any)=>s+sign*(D(l.debit)-D(l.credit)),0n))};});
    const asOf=filters.to || today();
    const aging=this.documents(c).filter(d=>d.state==='POSTED' && ['INVOICE','BILL'].includes(d.kind) && d.date<=asOf && this.visible(c,d)).map(d=>{const days=Math.max(0,Math.floor((Date.parse(asOf)-Date.parse(d.dueDate || d.date))/86400000));return {id:d.id,number:d.number,kind:d.kind,party:d.party,currency:d.currency,dueDate:d.dueDate || d.date,days,bucket:days===0?'Current':days<=30?'1–30':days<=60?'31–60':days<=90?'61–90':'90+',outstanding:F(this.outstanding(c,d,asOf))};}).filter(d=>D(d.outstanding)!==0n);
    const monthly:any={};for(const l of lines){const account=accounts.find(a=>a.id===l.account);if(!['income','expense'].includes(account?.category))continue;const month=l.date.slice(0,7);monthly[month]??={income:0n,expense:0n};monthly[month][account.category]+=account.category==='income'?D(l.credit)-D(l.debit):D(l.debit)-D(l.credit);}
    return {lines,trial,income:F(income),expense:F(expense),profit:F(income-expense),assets:F(category('asset')),liabilities:F(-category('liability')),equity:F(-category('equity')),budgets,aging,monthly:Object.entries(monthly).map(([month,v]:any)=>({month,income:F(v.income),expense:F(v.expense),profit:F(BigInt(v.income)-BigInt(v.expense))}))};
  }
  inventory(c:Context) {
    this.authorize(c,'inventory','view'); const layers=this.all('SELECT * FROM layers WHERE tenant=?',c.tenant).filter(l=>this.visible(c,l));
    return {layers:layers.map(l=>({...l,quantity:F(BigInt(l.quantity),6),remaining:F(BigInt(l.remaining),6),value:F(BigInt(l.value)),remainingValue:F(BigInt(l.remaining_value))})),movements:this.all('SELECT * FROM movements WHERE tenant=? ORDER BY date,id',c.tenant).filter(l=>this.visible(c,l)).map(l=>({...l,quantity:F(BigInt(l.quantity),6),value:F(BigInt(l.value)),layers:JSON.parse(l.layers)}))};
  }
  depreciation(c:Context,id:string,date:string,key:string) {
    this.authorize(c,'ledger','post');
    return this.idempotent(c,key,{action:'depreciate',id,date},()=>{
      const a=this.requireRecord(c,'asset',id); this.unlocked(c,date); ensure(!a.acquired || date>=a.acquired,'Date precedes acquisition.'); const source=`depreciation:${id}:${date.slice(0,7)}`;
      const prior=this.all('SELECT l.debit FROM journal_lines l JOIN journals j ON j.tenant=l.tenant AND j.id=l.journal WHERE l.tenant=? AND l.account=? AND j.source LIKE ?',c.tenant,'6300',`depreciation:${id}:%`).reduce((s:bigint,l:any)=>s+D(l.debit),0n);
      const basis=D(a.cost)-D(a.residual || '0'),remaining=basis-prior; ensure(remaining>0n,'Asset is fully depreciated.'); const monthly=divide(basis,BigInt(a.months)); const value=monthly<remaining?monthly:remaining;
      const journal=this.journal(c,source,date,[{account:'6300',debit:F(value)},{account:'1490',credit:F(value)}]); this.audit(c,'asset.depreciate',id,null,{journal,date,amount:F(value)}); return {journal,amount:F(value)};
    });
  }
}
