const $ = s => document.querySelector(s);
const key = 'meu-saldo-v1';
const paymentNames={cash:'Dinheiro',debit:'Débito',pix:'Pix',credit:'Crédito',pending:'Conta a pagar / a receber'};
const cloud=window.FinanceCloud;let localSnapshot=null,cloudMessage='',cloudError=false,adminUsers=[],adminPage=0,adminHasMore=false,adminMessage='';
// randomUUID is unavailable in some mobile browsers and HTTP contexts.
function newId(){
 if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
 const bytes=new Uint8Array(16);
 if(typeof globalThis.crypto?.getRandomValues==='function')globalThis.crypto.getRandomValues(bytes);
 else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
 bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
const themes={"blue": "Azul", "navy": "Azul-marinho", "sky": "Azul-claro", "purple": "Roxo", "rose": "Rosa", "pink": "Pink", "amber": "Terracota", "orange": "Laranja", "red": "Vermelho", "graphite": "Grafite"};
function setTheme(theme,save=false){
 if(!themes[theme])theme='blue';
 if(save){try{localStorage.setItem('meu-saldo-theme',theme);}catch{alert('A cor foi aplicada, mas o navegador não permitiu salvar a preferência.');}}
 document.documentElement.dataset.theme=theme;requestAnimationFrame(()=>{$('meta[name="theme-color"]').content=getComputedStyle(document.documentElement).getPropertyValue('--deep').trim();});
 $('#theme-select').value=theme;
}
try{setTheme(localStorage.getItem('meu-saldo-theme')||'blue');}catch{setTheme('blue');}
$('#theme-select').onchange=e=>setTheme(e.target.value,true);

let db = {version:1,entries:[],cards:[]}, tab='overview', search='', filter='all';
const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const money = n => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n);
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel = s => s.split('-').reverse().join('/');
function validPayment(e){return (e.paymentMethod===undefined||Object.hasOwn(paymentNames,e.paymentMethod))&&(!e.paymentDate||/^\d{4}-\d{2}-\d{2}$/.test(e.paymentDate))&&(!e.dueDate||/^\d{4}-\d{2}-\d{2}$/.test(e.dueDate))&&(e.invoicePaymentKey===undefined||typeof e.invoicePaymentKey==='string')&&(e.paymentMethod!=='credit'||(!!e.cardId&&e.type==='expense'));}
function valid(data){return data && (!data.invoices||(Array.isArray(data.invoices)&&data.invoices.every(i=>typeof i.cardId==='string'&&/^\d{4}-\d{2}$/.test(i.month)&&Number.isFinite(i.adjustment)&&typeof i.managed==='boolean'&&Array.isArray(data.cards)&&data.cards.some(c=>c.id===i.cardId))&&new Set(data.invoices.map(i=>i.cardId+':'+i.month)).size===data.invoices.length)) && (!data.categories||(Array.isArray(data.categories)&&data.categories.every(c=>typeof c==='string'&&c.trim().length>0&&c.length<=60))) && (!data.schedules||(Array.isArray(data.schedules)&&data.schedules.every(s=>typeof s.id==='string'&&typeof s.active==='boolean'&&(s.endMonth===undefined||/^\d{4}-(0[1-9]|1[0-2])$/.test(s.endMonth))&&/^\d{4}-\d{2}-\d{2}$/.test(s.start)&&s.entry&&typeof s.entry.description==='string'&&Number.isFinite(s.entry.amount)&&s.entry.amount>0&&['income','expense'].includes(s.entry.type)&&typeof s.entry.category==='string'&&typeof s.entry.cardId==='string'&&(!s.entry.cardId||data.cards.some(c=>c.id===s.entry.cardId))&&/^\d{4}-\d{2}$/.test(s.entry.invoiceMonth)))) && data.version===1 && Array.isArray(data.entries) && Array.isArray(data.cards) && data.cards.every(c=>typeof c.id==='string'&&typeof c.name==='string'&&/^\d{4}$/.test(c.digits)&&Number.isFinite(c.limit)&&c.limit>0&&Number.isInteger(c.closing)&&c.closing>=1&&c.closing<=31&&Number.isInteger(c.due)&&c.due>=1&&c.due<=31) && data.entries.every(e=>validPayment(e)&&typeof e.id==='string'&&typeof e.description==='string'&&['income','expense'].includes(e.type)&&['paid','pending'].includes(e.status)&&Number.isFinite(e.amount)&&e.amount>0&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&typeof e.category==='string'&&typeof e.cardId==='string'&&(!e.cardId||data.cards.some(c=>c.id===e.cardId))&&/^\d{4}-\d{2}$/.test(e.invoiceMonth)) && new Set(data.entries.map(e=>e.id)).size===data.entries.length && new Set(data.cards.map(c=>c.id)).size===data.cards.length;}
let storageMode='local', loadBlocked=false;
function idb(action,value){return new Promise((resolve,reject)=>{
 const request=indexedDB.open('meu-saldo-storage',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('data');
 request.onerror=()=>reject(request.error);
 request.onsuccess=()=>{const connection=request.result;const tx=connection.transaction('data',action==='get'?'readonly':'readwrite');const store=tx.objectStore('data');const op=action==='get'?store.get(key):store.put(value,key);let result;op.onsuccess=()=>{result=op.result;};tx.oncomplete=()=>{connection.close();resolve(result);};tx.onerror=()=>{connection.close();reject(tx.error);};};
});}
function formError(form,message){const target=form?.querySelector('.form-error');if(target){target.textContent=message;target.scrollIntoView({block:'nearest'});}else $('#storage-warning').textContent=message;}
const storageReady=(async()=>{try{
 let raw;try{raw=localStorage.getItem(key);}catch{storageMode='indexed';}
 if(!raw){try{const fallback=await idb('get');if(fallback){raw=fallback;storageMode='indexed';}}catch{}}
 if(raw){const data=JSON.parse(raw);if(!valid(data))throw Error('Dados existentes inválidos');db=data;}
 }catch{loadBlocked=true;$('#storage-warning').textContent='Os dados existentes não puderam ser carregados. O salvamento foi bloqueado para evitar sobrescrevê-los. Abra a versão anterior e exporte um backup.';}
})();
async function persist(next,form){await storageReady;next=normalizeInvoices(next);if(loadBlocked){formError(form,'Não foi possível carregar os registros anteriores. Exporte seu backup antes de continuar.');return false;}
 if(cloud?.configured&&!cloud.signedIn){formError(form,'Entre na sua conta antes de salvar.');return false;}
 if(cloud?.signedIn){try{const saved=await cloud.save(next);db=saved;cloudMessage='Salvo e sincronizado na sua conta.';cloudError=false;updateCloudStatus();return true;}catch(error){cloudMessage=error.message;cloudError=true;formError(form,error.message);updateCloudStatus();return false;}}
 const raw=JSON.stringify(next);
 try{if(storageMode==='indexed')await idb('put',raw);else{try{localStorage.setItem(key,raw);if(localStorage.getItem(key)!==raw)throw Error();}catch{await idb('put',raw);storageMode='indexed';}}db=next;localSnapshot=JSON.parse(raw);$('#storage-warning').textContent='';return true;}
 catch{formError(form,'O navegador bloqueou o armazenamento. Abra o site em uma aba normal do Chrome ou Safari, fora da prévia e da navegação privada. Nenhum registro foi salvo.');return false;}
}
function invoiceKey(cardId,month){return cardId+':'+month;}
function invoiceSummary(data,cardId,month){
 const key=invoiceKey(cardId,month),purchases=data.entries.filter(e=>e.cardId===cardId&&e.invoiceMonth===month),meta=(data.invoices||[]).find(i=>i.cardId===cardId&&i.month===month);
 const base=sum(purchases),adjustment=meta?.adjustment||0,total=Math.max(0,Math.round((base+adjustment)*100)/100);
 const paid=Math.round(sum(meta?.managed?data.entries.filter(e=>e.invoicePaymentKey===key&&e.status==='paid'):purchases.filter(e=>e.status==='paid'))*100)/100;
 return {key,purchases,base,adjustment,total,paid,remaining:Math.max(0,Math.round((total-paid)*100)/100),meta};
}
function invoicePendingEntries(){const [start,end]=dateBounds();if(dateError())return [];const keys=new Map();for(const e of db.entries.filter(e=>e.cardId))keys.set(invoiceKey(e.cardId,e.invoiceMonth),{cardId:e.cardId,month:e.invoiceMonth});for(const i of db.invoices||[])keys.set(invoiceKey(i.cardId,i.month),i);return [...keys.values()].map(i=>{const card=db.cards.find(c=>c.id===i.cardId),info=invoiceSummary(db,i.cardId,i.month);if(!card||info.remaining<=0)return null;const date=shiftedDate(i.month+'-'+String(card.due).padStart(2,'0'),0);return {id:'invoice-due:'+info.key,description:'Fatura — '+card.name,amount:info.remaining,date,type:'expense',category:'Cartões',status:'pending',cardId:card.id,invoiceMonth:i.month,paymentMethod:'credit',invoiceVirtual:true};}).filter(e=>e&&e.date>=start&&e.date<=end);}
function managedCredit(entry,data=db){return entry.cardId&&(data.invoices||[]).some(i=>i.managed&&i.cardId===entry.cardId&&i.month===entry.invoiceMonth);}
function purchasePaid(data,entry){
 const info=invoiceSummary(data,entry.cardId,entry.invoiceMonth);if(!info.meta?.managed)return entry.status==='paid'?entry.amount:0;
 if(info.remaining===0)return entry.amount;
 const payments=data.entries.filter(e=>e.invoicePaymentKey===info.key&&e.status==='paid'),allocated=new Map();let pool=0;
 for(const payment of payments){if(payment.purchaseId&&info.purchases.some(e=>e.id===payment.purchaseId))allocated.set(payment.purchaseId,(allocated.get(payment.purchaseId)||0)+Math.round(payment.amount*100));else pool+=Math.round(payment.amount*100);}
 for(const purchase of [...info.purchases].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))){const amount=Math.round(purchase.amount*100),targeted=Math.min(amount,allocated.get(purchase.id)||0),share=Math.min(pool,amount-targeted);allocated.set(purchase.id,targeted+share);pool-=share;}
 return (allocated.get(entry.id)||0)/100;
}
function normalizeInvoices(data){return {...data,entries:data.entries.map(e=>managedCredit(e,data)?{...e,status:purchasePaid(data,e)>=e.amount?'paid':'pending'}:e)};}
function openCreditRepair(id){const item=db.entries.find(e=>e.id===id);if(!item?.installmentGroup)return;const group=db.entries.filter(e=>e.installmentGroup===item.installmentGroup).sort((a,b)=>a.date.localeCompare(b.date)||a.description.localeCompare(b.description));const form=$('#repair-credit-form');form.reset();form.elements.id.value=id;form.elements.cardId.innerHTML='<option value="">Selecione o cartão</option>'+db.cards.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');form.elements.cardId.value=item.cardId;form.elements.date.value=group[0].purchaseDate||group[0].date;formError(form,'');syncCreditRepair();$('#repair-credit-dialog').showModal();}
function syncCreditRepair(){const form=$('#repair-credit-form'),card=db.cards.find(c=>c.id===form.elements.cardId.value);$('#repair-credit-preview').textContent=card&&form.elements.date.value?'Primeira parcela na fatura '+invoiceFor(form.elements.date.value,card).invoiceMonth.split('-').reverse().join('/')+'. As demais entram nas faturas seguintes.':'';}
$('#repair-credit-form').elements.cardId.onchange=syncCreditRepair;$('#repair-credit-form').elements.date.onchange=syncCreditRepair;
async function saveCreditRepair(){const form=$('#repair-credit-form');if(!checkForm(form))return;const button=$('#save-credit-repair');button.disabled=true;try{const values=Object.fromEntries(new FormData(form)),item=db.entries.find(e=>e.id===values.id),card=db.cards.find(c=>c.id===values.cardId);if(!item?.installmentGroup||!card)return;const group=db.entries.filter(e=>e.installmentGroup===item.installmentGroup).sort((a,b)=>a.date.localeCompare(b.date)||a.description.localeCompare(b.description));if(group.some(e=>e.status==='paid'||e.invoicePaymentKey||(e.cardId&&purchasePaid(db,e)>0)))return formError(form,'Este parcelamento já possui pagamentos. A correção foi bloqueada para preservar o histórico.');const first=invoiceFor(values.date,card).invoiceMonth;const corrections=new Map(group.map((entry,i)=>{const month=shiftedDate(first+'-01',i).slice(0,7);return [entry.id,{...entry,cardId:card.id,paymentMethod:'credit',status:'pending',paymentDate:'',purchaseDate:values.date,date:shiftedDate(values.date,i),invoiceMonth:month,dueDate:shiftedDate(month+'-'+String(card.due).padStart(2,'0'),0)}];}));const next={...db,entries:db.entries.map(e=>corrections.get(e.id)||e)};if(!valid(next))return formError(form,'Confira o cartão e a data da compra.');if(await persist(next,form)){$('#repair-credit-dialog').close();resetDateMonth(first);render();toast('Parcelas corrigidas. Primeira fatura: '+first.split('-').reverse().join('/'));}}catch(error){formError(form,error.message);}finally{button.disabled=false;}}
$('#save-credit-repair').onclick=saveCreditRepair;
function openSettlement(id,all=false){const item=db.entries.find(e=>e.id===id);if(!item)return;const form=$('#settlement-form');form.reset();form.elements.id.value=id;form.elements.scope.value=all?'all':'one';form.elements.scope.querySelector('[value=all]').disabled=!item.installmentGroup;form.elements.date.value=today();$('#settlement-caption').textContent=item.description;syncSettlementTotal();formError(form,'');$('#settlement-dialog').showModal();}
function syncSettlementTotal(){const form=$('#settlement-form'),item=db.entries.find(e=>e.id===form.elements.id.value);if(!item)return;const selected=db.entries.filter(e=>form.elements.scope.value==='all'&&item.installmentGroup?e.installmentGroup===item.installmentGroup:e.id===item.id);const total=selected.reduce((n,e)=>n+(e.cardId?Math.min(invoiceSummary(db,e.cardId,e.invoiceMonth).remaining,Math.max(0,Math.round((e.amount-purchasePaid(db,e))*100)/100)):e.status==='paid'?0:e.amount),0);$('#settlement-total').textContent='Valor a pagar: '+money(total);}
$('#settlement-form').elements.scope.onchange=syncSettlementTotal;
async function saveSettlement(){const form=$('#settlement-form');if(!checkForm(form))return;const button=$('#save-settlement');button.disabled=true;try{const values=Object.fromEntries(new FormData(form)),item=db.entries.find(e=>e.id===values.id);if(!item)return;let next=JSON.parse(JSON.stringify(db));const selected=next.entries.filter(e=>values.scope==='all'&&item.installmentGroup?e.installmentGroup===item.installmentGroup:e.id===item.id);
 for(const entry of selected){if(!entry.cardId){if(entry.status!=='paid'){entry.status='paid';entry.paymentDate=values.date;}continue;}const card=next.cards.find(c=>c.id===entry.cardId);let info=invoiceSummary(next,entry.cardId,entry.invoiceMonth);if(!info.meta?.managed){for(const old of info.purchases.filter(e=>e.status==='paid')){const payment=makeInvoicePayment(card,entry.invoiceMonth,old.amount,old.paymentDate||old.date,'debit');payment.purchaseId=old.id;next.entries.push(payment);}next.invoices=[...(next.invoices||[]).filter(i=>!(i.cardId===entry.cardId&&i.month===entry.invoiceMonth)),{cardId:entry.cardId,month:entry.invoiceMonth,adjustment:info.adjustment,managed:true}];}
 info=invoiceSummary(next,entry.cardId,entry.invoiceMonth);const remaining=Math.min(info.remaining,Math.max(0,Math.round((entry.amount-purchasePaid(next,entry))*100)/100));if(remaining>0){const payment=makeInvoicePayment(card,entry.invoiceMonth,remaining,values.date,values.method);payment.purchaseId=entry.id;next.entries.push(payment);}}
 if(!valid(next))return formError(form,'Não foi possível validar os pagamentos.');if(await persist(next,form)){$('#settlement-dialog').close();render();toast('Pagamento salvo. O limite disponível do cartão foi atualizado.');}
 }catch(error){formError(form,error.message);}finally{button.disabled=false;}}
$('#save-settlement').onclick=saveSettlement;
function openCancellation(id){const form=$('#cancel-form');form.reset();form.elements.id.value=id;form.elements.month.value=$('#month').value;formError(form,'');$('#cancel-dialog').showModal();}
async function saveCancellation(){const form=$('#cancel-form');if(!checkForm(form))return;const values=Object.fromEntries(new FormData(form));const schedule=(db.schedules||[]).find(s=>s.id===values.id);if(!schedule)return;const next={...db,schedules:db.schedules.map(s=>s.id===schedule.id?{...s,endMonth:values.month}:s),entries:db.entries.filter(e=>e.scheduleId!==schedule.id||e.date.slice(0,7)<values.month||e.status==='paid'||(e.cardId&&purchasePaid(db,e)>0))};if(await persist(next,form)){$('#cancel-dialog').close();render();toast('Conta cancelada a partir de '+values.month.split('-').reverse().join('/')+'. Histórico pago preservado.');}}
$('#save-cancel').onclick=saveCancellation;
function makeInvoicePayment(card,month,amount,date,method){return {id:newId(),description:'Pagamento de fatura — '+card.name+' ('+month.split('-').reverse().join('/')+')',type:'expense',amount:Math.round(amount*100)/100,date,category:'Cartões',status:'paid',cardId:'',invoiceMonth:date.slice(0,7),paymentMethod:method,paymentDate:date,invoicePaymentKey:invoiceKey(card.id,month)};}
function openInvoice(cardId,month){const card=db.cards.find(c=>c.id===cardId);if(!card)return;const form=$('#invoice-form'),info=invoiceSummary(db,cardId,month);form.reset();form.elements.cardId.value=cardId;form.elements.month.value=month;form.elements.total.value=info.total.toFixed(2);form.elements.paid.value=info.paid.toFixed(2);form.elements.paymentDate.value=today();$('#invoice-caption').textContent=card.name+' · '+month.split('-').reverse().join('/')+' · Compras: '+money(info.base);formError(form,'');$('#invoice-dialog').showModal();}
async function saveInvoice(){const form=$('#invoice-form');if(!checkForm(form))return;const values=Object.fromEntries(new FormData(form)),card=db.cards.find(c=>c.id===values.cardId),total=Number(values.total),paid=Number(values.paid);if(!card)return formError(form,'Cartão não encontrado.');if(paid>total)return formError(form,'O valor pago não pode ser maior que o total informado.');
 const button=$('#save-invoice');button.disabled=true;
 try{const info=invoiceSummary(db,card.id,values.month);let entries=db.entries.map(e=>({...e}));
 if(!info.meta?.managed){for(const e of info.purchases.filter(e=>e.status==='paid'))entries.push(makeInvoicePayment(card,values.month,e.amount,e.paymentDate||e.date,'debit'));}
 const payments=entries.filter(e=>e.invoicePaymentKey===info.key&&e.status==='paid'),oldPaid=sum(payments);let change=Math.round((paid-oldPaid)*100)/100;
 if(change>0)entries.push(makeInvoicePayment(card,values.month,change,values.paymentDate,values.method));
 if(change<0){let reduce=-change;for(const e of payments.sort((a,b)=>b.date.localeCompare(a.date))){const amount=Math.min(e.amount,reduce);e.amount=Math.round((e.amount-amount)*100)/100;reduce=Math.round((reduce-amount)*100)/100;if(reduce<=0)break;}entries=entries.filter(e=>e.amount>0);}
 const invoices=[...(db.invoices||[]).filter(i=>!(i.cardId===card.id&&i.month===values.month)),{cardId:card.id,month:values.month,adjustment:Math.round((total-info.base)*100)/100,managed:true}];
 const next={...db,entries,invoices};if(!valid(next))return formError(form,'Confira os valores e as datas da fatura.');if(await persist(next,form)){$('#invoice-dialog').close();render();toast('Fatura e pagamentos salvos');}
 }catch(error){formError(form,error.message);}finally{button.disabled=false;}
}
$('#save-invoice').onclick=saveInvoice;
$('#invoice-form').addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();if(!$('#save-invoice').disabled)saveInvoice();}});
function shiftedDate(date,offset){const [y,m,d]=date.split('-').map(Number);const end=new Date(y,m+offset,0);return `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(Math.min(d,end.getDate())).padStart(2,'0')}`;}
async function ensureMonth(month=$('#month').value){await storageReady;const missing=(db.schedules||[]).filter(s=>s.active&&(!s.endMonth||month<s.endMonth)&&month>=s.start.slice(0,7)&&!db.entries.some(e=>e.id===s.id+':'+month)&&!(s.skipped||[]).includes(month)).map(s=>{const offset=(Number(month.slice(0,4))-Number(s.start.slice(0,4)))*12+Number(month.slice(5))-Number(s.start.slice(5,7));const date=shiftedDate(s.start,offset);return {...s.entry,id:s.id+':'+month,date,invoiceMonth:shiftedDate(s.entry.invoiceMonth+'-01',offset).slice(0,7),status:'pending',paymentDate:'',paymentMethod:s.entry.paymentMethod==='credit'?'credit':'pending',...(s.entry.paymentMethod==='credit'&&db.cards.find(c=>c.id===s.entry.cardId)?invoiceFor(date,db.cards.find(c=>c.id===s.entry.cardId)):{}),scheduleId:s.id};});if(missing.length)return persist({...db,entries:[...db.entries,...missing]});return true;}
function checkForm(form){formError(form,'');if(!form.checkValidity()){const invalid=form.querySelector(':invalid');formError(form,'Confira o campo “'+(invalid?.closest('label')?.childNodes[0]?.textContent?.trim()||'obrigatório')+'”. Preencha um valor válido.');invalid?.focus();return false;}return true;}
function toast(msg){$('#toast').textContent=msg;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',3000);}
$('#month').value=today().slice(0,7);
function dateBounds(){
 const mode=$('#date-mode').value,month=$('#month').value;
 if(mode==='day'){const day=$('#filter-day').value;return [day,day];}
 if(mode==='range')return [$('#filter-start').value,$('#filter-end').value];
 return [month+'-01',month+'-31'];
}
function dateError(){const [start,end]=dateBounds();if(!start||!end)return 'Preencha as datas do filtro.';if(start>end)return 'A data inicial deve ser anterior ou igual à data final.';const span=(Number(end.slice(0,4))-Number(start.slice(0,4)))*12+Number(end.slice(5,7))-Number(start.slice(5,7));if(span>119)return 'Selecione um período de até 10 anos.';return '';}
async function ensureSelection(){if(dateError())return;const [start,end]=dateBounds();let month=start.slice(0,7);const last=end.slice(0,7);while(month<=last){if(!await ensureMonth(month))return;month=shiftedDate(month+'-01',1).slice(0,7);}}
const monthEntries=()=>{if(dateError())return [];const [start,end]=dateBounds();return db.entries.filter(e=>{const date=e.cardId?(e.dueDate||shiftedDate(e.invoiceMonth+'-'+String(db.cards.find(c=>c.id===e.cardId)?.due||1).padStart(2,'0'),0)):e.date;return date>=start&&date<=end;});};
function resetDateMonth(month){$('#date-mode').value='month';$('#month').value=month;updateDateFields();}
function updateDateFields(){const mode=$('#date-mode').value;$('#month-field').hidden=mode!=='month';$('#day-field').hidden=mode!=='day';$('#start-field').hidden=$('#end-field').hidden=mode!=='range';}
async function applyDates(){
 const error=dateError();$('#date-error').textContent=error;$('#date-error').hidden=!error;
 if(!error){const [start]=dateBounds();if($('#date-mode').value!=='month')$('#month').value=start.slice(0,7);await ensureSelection();}
 render();
}
const sum=a=>a.reduce((n,e)=>n+e.amount,0);
const empty=(text,detail='')=>`<div class="empty"><span class="symbol">◈</span><b>${text}</b><p>${detail}</p></div>`;
function status(e){return e.status==='paid'?'<span class="badge">'+(e.type==='income'?'Recebido':'Pago')+'</span>':`<span class="badge ${e.date<today()?'overdue':'pending'}">${e.date<today()?'Em atraso':'Pendente'}</span>`;}
function rows(entries){return entries.length?entries.map(e=>`<div class="row"><div><div class="row-title">${esc(e.description)}</div><small>${esc(e.category)} · ${dateLabel(e.date)}${e.paymentMethod?' · '+esc(paymentNames[e.paymentMethod]||e.paymentMethod):''}${e.cardId?' · '+esc(db.cards.find(c=>c.id===e.cardId)?.name||'Cartão')+' · Fatura '+esc(e.invoiceMonth.split('-').reverse().join('/')):''}</small></div><div class="row-right"><div class="${e.type==='income'?'positive':'red'}">${e.type==='income'?'+':'−'} ${money(e.amount)}</div><div style="margin-top:6px">${status(e)}</div><label class="paid-check"><input type="checkbox" data-paid="${esc(e.id)}" data-invoice-card="${esc(e.cardId||'')}" data-invoice-month="${esc(e.invoiceMonth)}" ${e.status==='paid'?'checked':''} aria-label="${e.type==='income'?'Recebido':'Pago'}: ${esc(e.description)}">${e.type==='income'?'Recebido':'Pago'}</label><div class="actions">${e.installmentGroup?`<button data-repair-credit="${esc(e.id)}">Corrigir cartão e faturas</button><button data-settle="${esc(e.id)}">Pagar parcela</button><button data-settle-all="${esc(e.id)}">Quitar todas</button>`:''}${e.invoiceVirtual?`<button data-invoice="${esc(e.cardId)}" data-month="${esc(e.invoiceMonth)}">Ver fatura</button>`:`<button data-edit="${esc(e.id)}">Editar</button><button data-delete="${esc(e.id)}" aria-label="Excluir ${esc(e.description)}">Excluir</button>`}</div></div></div>`).join(''):empty('Nenhuma movimentação por aqui','Adicione suas receitas e despesas para começar.');}
function panel(title,body,subtitle=''){return `<div class="panel"><div class="panel-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div></div>${body}</div>`;}
function render(){
 const titles={overview:'Visão geral',transactions:'Movimentações',bills:'Contas e vencimentos',cards:'Cartões e faturas',backup:'Backup dos dados',fixed:'Contas fixas e parcelas',install:'Instalar no celular',account:'Minha conta e sincronização',users:'Administrar usuários'};
 $('#page-title').textContent=titles[tab];document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 const entries=monthEntries(),income=sum(entries.filter(e=>e.type==='income'&&e.status==='paid')),expense=sum(entries.filter(e=>e.type==='expense'&&e.status==='paid'&&!managedCredit(e))),pending=sum(entries.filter(e=>e.type==='expense'&&e.status==='pending'&&!e.cardId))+sum(invoicePendingEntries());
 let html='';
 if(cloud?.configured&&!cloud.connected&&!['account','install'].includes(tab)){html=panel('Entre e carregue sua conta','<p>Os registros locais estão preservados. Abra Minha conta para carregar seus dados online ou sair.</p>');$('#content').innerHTML=html;return;}
 if(tab==='account'){html=accountPanel();}else if(tab==='users'){html=usersPanel();}else if(tab==='overview'){
 html=`<div class="stats">${[['Saldo do período',income-expense,'Entradas recebidas menos saídas pagas'],['Entradas recebidas',income,'Receitas confirmadas no filtro'],['Saídas pagas',expense,'Despesas quitadas no filtro'],['Contas a pagar',pending,'Despesas pendentes no filtro']].map(([t,v,s])=>`<div class="stat"><div class="stat-label">${t}</div><strong>${money(v)}</strong><small>${s}</small></div>`).join('')}</div>`;
 const categories=Object.create(null);entries.filter(e=>e.type==='expense'&&!e.invoicePaymentKey).forEach(e=>categories[e.category]=(categories[e.category]||0)+e.amount);const total=Object.values(categories).reduce((a,b)=>a+b,0);
 html+=`<div class="dashboard-grid"><div>${panel('Últimas movimentações',rows([...entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5)),'Acompanhe o que entrou e saiu')}${panel('Próximos vencimentos',rows([...entries.filter(e=>e.status==='pending'&&!e.cardId),...invoicePendingEntries()].sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3)),'Contas a pagar e valores a receber')}</div><div>${panel('Despesas por categoria',Object.keys(categories).length?Object.entries(categories).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<div class="category-row"><div><span>${esc(c)}</span><b>${money(v)}</b></div><div class="progress"><div style="width:${v/total*100}%"></div></div></div>`).join(''):empty('Tudo começa com um registro','As categorias aparecerão aqui.'),'Inclui despesas pagas e pendentes')}<div class="welcome"><span>✧</span><div><b>Pequenos hábitos, grandes planos.</b><p>Registre seus gastos e acompanhe sua evolução todos os meses.</p></div></div></div></div>`;
 }else if(tab==='transactions'||tab==='bills'){
 let list=entries.filter(e=>e.description.toLowerCase().includes(search.toLowerCase()));if(tab==='bills')list=[...list.filter(e=>e.status==='pending'&&!e.cardId),...invoicePendingEntries().filter(e=>e.description.toLowerCase().includes(search.toLowerCase()))];if(filter!=='all')list=list.filter(e=>e.type===filter);
 html=panel(tab==='bills'?'Suas contas pendentes':'Todas as movimentações',`<div class="filters"><input id="search" aria-label="Buscar descrição" placeholder="Buscar movimentação…" value="${esc(search)}"><select id="filter" aria-label="Tipo de movimentação"><option value="all">Entradas e saídas</option><option value="income" ${filter==='income'?'selected':''}>Entradas</option><option value="expense" ${filter==='expense'?'selected':''}>Saídas</option></select></div><div id="entry-list" class="movement-scroll" tabindex="0" aria-label="Lista de movimentações">${rows(list.sort((a,b)=>a.date.localeCompare(b.date)))}</div>`,'Crédito: filtro pelo vencimento da fatura. Demais pagamentos: filtro pela data do lançamento.');
 }else if(tab==='fixed'){
 const schedules=db.schedules||[];
 html=panel('Contas fixas mensais',`<button id="add-fixed" class="primary">+ Nova conta fixa ou parcela</button><p class="hint">Aluguel e outras contas fixas geram uma conta pendente ao abrir cada mês. Cancele a partir do mês escolhido. Contas pendentes desse mês em diante são removidas; pagamentos anteriores são preservados.</p>`+ (schedules.length?schedules.map(s=>`<div class="row"><div><b>${esc(s.entry.description)}</b><small>${money(s.entry.amount)} / mês · Início ${dateLabel(s.start)} · ${s.endMonth?'Cancelada a partir de '+esc(s.endMonth.split('-').reverse().join('/')):s.active?'Ativa':'Encerrada'}</small></div>${s.active?`<button data-stop="${esc(s.id)}">Cancelar próximos meses</button>`:''}</div>`).join(''):empty('Nenhuma conta fixa cadastrada')));
 const installments=entries.filter(e=>e.installmentGroup);
 html+=panel('Parcelas cadastradas','<div class="movement-scroll" tabindex="0" aria-label="Parcelas">'+rows(installments.sort((a,b)=>a.date.localeCompare(b.date)))+'</div>','Parcelas nas datas selecionadas. Pague uma parcela ou quite todas, incluindo as futuras.');
 }else if(tab==='cards'){
 const summaries=db.cards.map(c=>invoiceSummary(db,c.id,$('#month').value));
 const totals=summaries.reduce((acc,info)=>({total:acc.total+Math.round(info.total*100),paid:acc.paid+Math.round(info.paid*100),remaining:acc.remaining+Math.round(info.remaining*100)}),{total:0,paid:0,remaining:0});
 const summaryHtml=`<div class="stats invoice-summary" aria-label="Resumo das faturas do mês">${[['total','Total das faturas','Inclui encargos e descontos'],['paid','Já pago','Pagamentos das faturas selecionadas'],['remaining','Em aberto','Valor restante a pagar']].map(([key,title,hint])=>`<div class="stat"><div class="stat-label">${title}</div><strong data-invoices-summary="${key}">${money(totals[key]/100)}</strong><small>${hint}</small></div>`).join('')}</div>`;
 html=`<div class="panel-head"><div><h2>Meus cartões</h2><p>Fatura de ${esc(dateLabel($('#month').value))} · O cartão usa o mês inicial do filtro.</p></div><button id="add-card">+ Cadastrar cartão</button></div>${summaryHtml}<div class="cards-grid">`;
 html+=db.cards.map(c=>{const info=invoiceSummary(db,c.id,$('#month').value),months=new Set([...db.entries.filter(e=>e.cardId===c.id).map(e=>e.invoiceMonth),...(db.invoices||[]).filter(i=>i.cardId===c.id).map(i=>i.month)]),outstanding=[...months].reduce((n,m)=>n+invoiceSummary(db,c.id,m).remaining,0);return `<div><div class="credit-card"><h3>${esc(c.name)}</h3><div class="digits">•••• •••• •••• ${esc(c.digits)}</div><small>Total da fatura do mês</small><strong data-invoice-total="${esc(c.id)}">${money(info.total)}</strong><small>Fecha dia ${c.closing} · Vence dia ${c.due}</small></div><div class="panel"><div class="row"><span>Compras</span><b>${money(info.base)}</b></div><div class="row"><span>Encargos / descontos</span><b>${money(info.adjustment)}</b></div><div class="row"><span>Total pago</span><b>${money(info.paid)}</b></div><div class="row"><span>Saldo a pagar</span><b>${money(info.remaining)}</b></div><div class="row"><span>Limite total</span><b>${money(c.limit)}</b></div><div class="row"><span>Disponível estimado</span><b>${money(Math.max(0,c.limit-outstanding))}</b></div><p class="hint">Crédito entra na fatura pelo mês do fechamento; compras no dia do fechamento passam para a próxima. O limite estimado desconta o saldo das faturas, incluindo ajustes. Registre pagamentos parciais e encargos abaixo.</p><button data-invoice="${esc(c.id)}">Editar fatura / registrar pagamento</button><button data-remove-card="${esc(c.id)}">Excluir cartão</button></div></div>`;}).join('')||empty('Cadastre seu primeiro cartão','Registre compras como saídas e escolha Crédito no pagamento.');html+='</div>';
 }else if(tab==='install'){
 html=panel('Seu Meu saldo na tela inicial',`<p>Publique este site com HTTPS e abra o endereço no navegador do celular. Depois de abrir uma vez com internet, a versão instalada pode funcionar offline.</p><div class="install-guide"><h3>Android · Chrome</h3><p>Toque em <b>Instalar aplicativo</b> abaixo quando disponível, ou abra o menu ⋮ e escolha <b>Instalar aplicativo</b> / <b>Adicionar à tela inicial</b>.</p><h3>iPhone · Safari</h3><p>Abra o site no Safari, toque em <b>Compartilhar</b> e escolha <b>Adicionar à Tela de Início</b>. Se aparecer, ative “Abrir como App da Web”.</p><h3>Computador</h3><p>No Chrome ou Edge, use o ícone de instalação na barra de endereço ou o menu do navegador.</p></div><button id="install-app" class="primary" ${installPrompt?'':'hidden'}>Instalar aplicativo</button><p id="install-state" class="hint">${location.protocol==='file:'?'Você está usando o arquivo local. A instalação e o modo offline precisam da versão publicada com HTTPS.':'A opção de instalar depende do navegador. Caso não apareça, use as instruções acima.'}</p><p class="hint">Sem login, os dados ficam neste aparelho. Com sua conta conectada, alterações confirmadas são sincronizadas online. Para salvar na conta, é preciso conexão. Antes de mudar de endereço, navegador ou versão, exporte seu backup na aba Backup dos dados e importe no novo local.</p>`);
 }else html=panel('Seus dados, com você' ,`<p>Sem login, as alterações ficam neste navegador. Com login, são salvas na sua conta e podem ser abertas em outros aparelhos. Mantenha também um backup.</p><p class="hint">Limpar os dados do navegador remove seus registros. O arquivo exportado contém informações financeiras pessoais: guarde-o em um local seguro. Entre na mesma conta em cada aparelho para sincronizar. Ao importar com login, você substitui os registros da sua conta online.</p><div class="backup-actions"><button id="export" class="primary">↓ Exportar backup</button><label>↑ Importar backup<input type="file" id="import" accept="application/json,.json"></label></div>`);
 $('#content').innerHTML=html;
}
const defaultCategories=['Alimentação','Moradia','Transporte','Saúde','Lazer','Educação','Compras','Salário'];
const categoryKey=name=>name.trim().normalize('NFC').toLocaleLowerCase('pt-BR');
function allCategories(){const result=[...defaultCategories];for(const name of [...(db.categories||[]),...db.entries.map(e=>e.category),...(db.schedules||[]).map(s=>s.entry.category)])if(name!=='Outros'&&!result.some(c=>categoryKey(c)===categoryKey(name)))result.push(name);return result;}
function syncCustomCategory(){const form=$('#entry-form'),visible=form.elements.category.value==='Outros';$('#custom-category-field').hidden=!visible;form.elements.customCategory.disabled=!visible;}
$('#entry-form').elements.category.onchange=()=>{syncCustomCategory();if(!$('#custom-category-field').hidden)$('#entry-form').elements.customCategory.focus();};
function invoiceFor(date,card){
 const [year,month,day]=date.split('-').map(Number);
 const closing=Math.min(card.closing,new Date(year,month,0).getDate());
 const closingMonth=shiftedDate(date.slice(0,7)+'-01',day>=closing?1:0).slice(0,7);
 const invoiceMonth=closingMonth;
 return {invoiceMonth,dueDate:shiftedDate(invoiceMonth+'-'+String(card.due).padStart(2,'0'),0)};
}
function syncPayment(){const form=$('#entry-form'),method=form.elements.paymentMethod.value,credit=method==='credit',income=form.elements.type.value==='income';
 form.elements.paymentMethod.querySelector('[value="credit"]').disabled=income;
 if(income&&credit){form.elements.paymentMethod.value='pix';return syncPayment();}
 $('#card-field').hidden=!credit;form.elements.cardId.disabled=!credit;form.elements.cardId.required=credit;
 $('#invoice-field').hidden=!credit;form.elements.invoiceMonth.disabled=true;
 $('#status-field').hidden=method!=='pending';
 $('#entry-date-label').textContent=credit?'Data da compra':method==='pending'?'Data / vencimento':income?'Data do recebimento':'Data do pagamento';
 const card=db.cards.find(c=>c.id===form.elements.cardId.value);
 form.elements.invoiceMonth.value=credit&&card&&form.elements.date.value?invoiceFor(form.elements.date.value,card).invoiceMonth:'';
}
$('#payment-method').onchange=()=>{if($('#payment-method').value==='pending')$('#entry-form').elements.status.value='pending';syncPayment();};$('#payment-select').onchange=syncPayment;
$('#entry-form').elements.type.onchange=syncPayment;$('#entry-form').elements.date.onchange=syncPayment;
function openEntry(id){const form=$('#entry-form');form.reset();form.elements.id.value='';form.elements.category.innerHTML=[...allCategories(),'Outros'].map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');formError(form,'');form.elements.repeat.disabled=!!id;form.elements.repeat.closest('label').hidden=!!id;$('#installment-field').hidden=true;const e=db.entries.find(e=>e.id===id);$('#payment-select').innerHTML='<option value="">Selecione um cartão</option>'+db.cards.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');form.elements.date.value=today();form.elements.invoiceMonth.value=$('#month').value;if(e)Object.keys(e).forEach(k=>{if(form.elements[k])form.elements[k].value=e[k];});form.elements.paymentMethod.value=e?.paymentMethod||(e?.cardId?'credit':e?.status==='pending'?'pending':'cash');syncPayment();syncCustomCategory();syncInstallments();$('#form-title').textContent=e?'Editar movimentação':'Nova movimentação';$('#entry-dialog').showModal();form.elements.paymentMethod.focus();}
$('#new-entry').onclick=()=>openEntry();document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#month').onchange=()=>{if(!$('#month').value)$('#month').value=today().slice(0,7);applyDates();};
$('#date-mode').onchange=()=>{const month=$('#month').value;if(!$('#filter-day').value)$('#filter-day').value=month+'-01';if(!$('#filter-start').value)$('#filter-start').value=month+'-01';if(!$('#filter-end').value)$('#filter-end').value=shiftedDate(month+'-31',0);updateDateFields();applyDates();};
for(const id of ['filter-day','filter-start','filter-end'])document.getElementById(id).onchange=applyDates;
document.querySelector('nav').onclick=e=>{const b=e.target.closest('[data-tab]');if(b){tab=b.dataset.tab;search='';filter='all';render();if(tab==='users')loadUsers();}};
function syncInstallments(){const form=$('#entry-form'),split=form.elements.repeat.value==='installments'&&!form.elements.id.value;$('#installment-field').hidden=!split;$('#entry-amount-label').textContent=split?'Valor total da compra (R$)':'Valor (R$)';const cents=Math.round(Number(form.elements.amount.value)*100),count=Number(form.elements.installments.value);$('#installment-preview').textContent=split&&Number.isInteger(count)&&count>=2&&count<=360&&cents>=count?'Total '+money(cents/100)+' em '+count+' parcelas de aproximadamente '+money(Math.floor(cents/count)/100)+'. Os centavos restantes são distribuídos nas primeiras parcelas.':'';}
$('#entry-form').elements.repeat.onchange=syncInstallments;
$('#entry-form').elements.amount.oninput=syncInstallments;
$('#entry-form').elements.installments.oninput=syncInstallments;
async function saveEntry(form){if(!checkForm(form))return;const button=form.querySelector('#save-entry');button.disabled=true;
 try{await storageReady;const data=Object.fromEntries(new FormData(form));const repeat=data.repeat||'once',count=Number(data.installments);delete data.repeat;delete data.installments;const custom=(data.customCategory||'').trim().normalize('NFC');delete data.customCategory;if(data.category==='Outros'&&custom){data.category=[...allCategories(),'Outros'].find(c=>categoryKey(c)===categoryKey(custom))||custom;}const previous=db.entries.find(x=>x.id===data.id);data.id=data.id||newId();data.amount=Number(data.amount);data.cardId=data.cardId||'';
 const method=data.paymentMethod;
 if(!Object.hasOwn(paymentNames,method)){formError(form,'Escolha a forma de pagamento.');return;}
 if(method==='credit'){
  const card=db.cards.find(c=>c.id===data.cardId);
  if(data.type==='income'||!card){formError(form,'Selecione um cartão cadastrado para a compra no crédito.');return;}
  Object.assign(data,invoiceFor(data.date,card));
  data.status=previous?.cardId===data.cardId&&previous?.status==='paid'?'paid':'pending';
  data.paymentDate=data.status==='paid'?(previous.paymentDate||''):'';
 }else{
  data.cardId='';data.invoiceMonth=data.date.slice(0,7);delete data.dueDate;
  data.status=method==='pending'?(data.status||'pending'):'paid';data.paymentDate=data.status==='paid'?data.date:'';
 }
if(previous)for(const k of ['scheduleId','installmentGroup','invoicePaymentKey'])if(previous[k])data[k]=previous[k];

 if(previous?.invoicePaymentKey&&(data.type!=='expense'||data.cardId)){formError(form,'O pagamento de fatura deve ser uma saída em dinheiro, débito ou Pix.');return;}
 let additions=[data],schedules=db.schedules||[];
 if(repeat==='installments'){if(!Number.isInteger(count)||count<2||count>360){formError(form,'Informe entre 2 e 360 parcelas.');return;}const totalCents=Math.round(data.amount*100);if(totalCents<count){formError(form,'O valor total deve permitir pelo menos R$ 0,01 por parcela.');return;}const baseCents=Math.floor(totalCents/count),remainder=totalCents%count;const group=newId();additions=Array.from({length:count},(_,i)=>({...data,...(data.cardId?{purchaseDate:data.date}:{}),amount:(baseCents+(i<remainder?1:0))/100,id:i===0?data.id:newId(),description:`${data.description} (${i+1}/${count})`,date:shiftedDate(data.date,i),invoiceMonth:shiftedDate(data.invoiceMonth+'-01',i).slice(0,7),status:i===0?data.status:'pending',paymentDate:i===0?data.paymentDate:'',paymentMethod:i===0||data.paymentMethod==='credit'?data.paymentMethod:'pending',...(data.cardId?{dueDate:shiftedDate(shiftedDate(data.invoiceMonth+'-01',i).slice(0,7)+'-'+String(db.cards.find(c=>c.id===data.cardId).due).padStart(2,'0'),0)}:{}),installmentGroup:group}));}
 if(repeat==='monthly'){const id=newId();schedules=[...schedules,{id,start:data.date,active:true,entry:{...data}}];additions=[{...data,id:id+':'+data.date.slice(0,7),scheduleId:id}];}
 const customCategories=[...(db.categories||[])];if(![...defaultCategories,'Outros',...customCategories].some(c=>categoryKey(c)===categoryKey(data.category)))customCategories.push(data.category);const next={...db,categories:customCategories,schedules,entries:[...db.entries.filter(x=>x.id!==data.id),...additions]};if(!valid(next)){formError(form,'Verifique descrição, valor, data e mês da fatura.');return;}
 if(await persist(next,form)){resetDateMonth(data.cardId?data.invoiceMonth:data.date.slice(0,7));$('#date-error').hidden=true;tab='transactions';search=data.description;filter='all';$('#entry-dialog').close();render();toast(data.cardId?'Compra salva na fatura '+data.invoiceMonth.split('-').reverse().join('/'):cloud?.signedIn?'Salvo e sincronizado na conta':'Salvo com sucesso neste navegador');}
 }catch(error){formError(form,'Não foi possível concluir: '+error.message);}finally{button.disabled=false;}
};
async function saveCard(form){if(!checkForm(form))return;try{await storageReady;const c=Object.fromEntries(new FormData(form));c.id=newId();['limit','closing','due'].forEach(k=>c[k]=Number(c[k]));const next={...db,cards:[...db.cards,c]};if(!valid(next)){formError(form,'Confira os dados do cartão.');return;}if(await persist(next,form)){$('#card-dialog').close();render();toast('Cartão cadastrado');}}catch(error){formError(form,'Não foi possível concluir: '+error.message);}};
// Preview sandboxes may suppress native form submission before submit events fire.
// Save via a regular button so the application can validate and persist directly.
for(const [formId,buttonId,save] of [['entry-form','save-entry',saveEntry],['card-form','save-card',saveCard]]){
 const form=document.getElementById(formId),button=document.getElementById(buttonId);
 button.addEventListener('click',()=>save(form));
 form.addEventListener('submit',e=>{e.preventDefault();if(!button.disabled)save(form);});
 form.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();if(!button.disabled)button.click();}});
}
$('#content').addEventListener('input',e=>{if(e.target.id==='search'){const start=e.target.selectionStart;search=e.target.value;render();$('#search').focus();$('#search').setSelectionRange(start,start);}});
$('#content').addEventListener('change',async e=>{
 if(e.target.matches('[data-paid]')){const box=e.target,previous=!box.checked;const item=db.entries.find(x=>x.id===box.dataset.paid);if(item?.installmentGroup&&box.checked){box.checked=previous;openSettlement(item.id);return;}if(box.dataset.invoiceCard){box.checked=previous;openInvoice(box.dataset.invoiceCard,box.dataset.invoiceMonth);return;}box.disabled=true;const next={...db,entries:db.entries.map(x=>x.id===box.dataset.paid?{...x,status:box.checked?'paid':'pending',paymentDate:box.checked?today():''}:x)};if(await persist(next)){render();toast(box.checked?'Pagamento confirmado':'Marcado como pendente');}else{box.checked=previous;box.disabled=false;}return;}
if(e.target.id==='filter'){filter=e.target.value;render();}if(e.target.id==='import'){const file=e.target.files[0];if(!file)return;try{if(file.size>5e6)throw Error();const data=JSON.parse(await file.text());if(!valid(data))throw Error();if(confirm('Importar este backup substituirá todos os dados atuais. Deseja continuar?')&&await persist(data)){await ensureSelection();render();toast('Backup importado');}}catch{alert('Backup inválido. Selecione um arquivo JSON exportado pelo Meu saldo (até 5 MB).');}e.target.value='';}});
$('#content').onclick=async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.admin){await adminAction(b);return;}if(b.dataset.cloud){await accountAction(b);return;}let next;
 if(b.id==='install-app'&&installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;render();}
 if(b.id==='add-fixed'){openEntry();$('#entry-form').elements.repeat.value='monthly';$('#entry-form').elements.status.value='pending';$('#entry-form').elements.paymentMethod.value='pending';syncPayment();}
 if(b.dataset.stop)openCancellation(b.dataset.stop);
 if(b.dataset.repairCredit)openCreditRepair(b.dataset.repairCredit);
 if(b.dataset.settle)openSettlement(b.dataset.settle);
 if(b.dataset.settleAll)openSettlement(b.dataset.settleAll,true);
 if(b.id==='add-card'){$('#card-form').reset();formError($('#card-form'),'');$('#card-dialog').showModal();}
 if(b.dataset.edit)openEntry(b.dataset.edit);
 if(b.dataset.delete&&confirm('Excluir esta movimentação?')){const removed=db.entries.find(x=>x.id===b.dataset.delete);next={...db,entries:db.entries.filter(x=>x.id!==b.dataset.delete),schedules:(db.schedules||[]).map(s=>s.id===removed?.scheduleId?{...s,skipped:[...(s.skipped||[]),removed.date.slice(0,7)]}:s)};}
 if(b.dataset.pay)next={...db,entries:db.entries.map(x=>x.id===b.dataset.pay?{...x,status:'paid',paymentDate:today()}:x)};
 if(b.dataset.invoice)openInvoice(b.dataset.invoice,b.dataset.month||$('#month').value);
 if(b.dataset.removeCard){if((db.invoices||[]).some(i=>i.cardId===b.dataset.removeCard&&i.adjustment!==0)||db.entries.some(x=>x.cardId===b.dataset.removeCard||x.invoicePaymentKey?.startsWith(b.dataset.removeCard+':'))||(db.schedules||[]).some(s=>s.entry.cardId===b.dataset.removeCard))return alert('Este cartão tem movimentações vinculadas. Edite ou exclua esses registros primeiro.');if(confirm('Excluir este cartão?'))next={...db,cards:db.cards.filter(c=>c.id!==b.dataset.removeCard),invoices:(db.invoices||[]).filter(i=>i.cardId!==b.dataset.removeCard)};}
 if(b.id==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`meu-saldo-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 if(next&&await persist(next)){render();toast('Alteração salva');}
};
function updateCloudStatus(){
 const status=$('#cloud-status');if(!status)return;$('#users-nav').hidden=!cloud?.isAdmin;$('#new-entry').disabled=!!cloud?.configured&&!cloud.connected;
 status.textContent=cloud?.signedIn?(cloud.busy?'Sincronizando…':cloudError?'Sincronização pendente — abra Minha conta':cloud.connected?'Conectado: '+(cloud.user?.email||'sua conta'):'Conta conectada — aguardando carregar dados'):'Dados locais neste navegador';
 status.classList.toggle('sync-error',cloudError);
}
function accountPanel(){
 if(!cloud?.configured)return panel('Conecte sua conta',`<p>Login e sincronização precisam ser ativados no projeto Supabase. Os registros locais continuam disponíveis.</p><p>Depois da configuração, entre com o mesmo e-mail no computador e no celular. Use a conta exclusiva deste sistema de finanças.</p><p class="hint">O responsável pelo site deve seguir CONFIGURAR-LOGIN.md e publicar cloud-config.js com a URL e a chave pública do projeto. Nenhuma senha de banco de dados deve ser colocada no site.</p>`);
 const message=`<p id="cloud-message" class="${cloudError?'form-error':'hint'}" role="status">${esc(cloudMessage)}</p>`;
 if(cloud.signedIn){return panel('Sua conta',`<p>Conectado como <b>${esc(cloud.user.email)}</b></p>${message}<div class="account-actions"><button data-cloud="refresh">Atualizar da nuvem</button><button data-cloud="logout">Sair da conta</button></div>${cloud.recovery?'<form id="recovery-form"><label>Nova senha<input type="password" name="newPassword" autocomplete="new-password" minlength="12" required></label><button type="button" data-cloud="password">Salvar nova senha</button></form>':''}<h3 style="margin-top:24px">Contas que já estavam neste navegador</h3><p class="hint">Os dados locais anteriores foram preservados. Para colocá-los na conta, exporte uma cópia e use o botão abaixo. Ele só permite importar para uma conta online vazia. Se já houver dados online, use o backup e revise antes de substituir.</p><button data-cloud="migrate">Levar minhas contas locais para a nuvem</button><p class="hint">A atualização acontece ao salvar, ao voltar para o site e a cada 20 segundos enquanto nenhuma edição está aberta. Alterações simultâneas são bloqueadas para evitar sobrescrever outro aparelho. Com a conta conectada é necessário estar online para confirmar mudanças.</p>`);}
 return panel('Entre para usar suas contas em vários aparelhos',`<p>Use o mesmo e-mail e senha no computador, Android e iPhone. Cada usuário acessa apenas as próprias finanças.</p><form id="login-form" novalidate><label>E-mail<input type="email" name="email" autocomplete="username" required></label><label>Senha<input type="password" name="password" autocomplete="current-password"></label>${message}<div class="account-actions"><button type="button" class="primary" data-cloud="login">Entrar</button><button type="button" data-cloud="reset">Esqueci minha senha</button></div><p class="hint">O acesso é cadastrado pelo administrador. Solicite seu usuário ao responsável. Use o mesmo e-mail e senha em todos os aparelhos.</p></form>`);
}
function usersPanel(){
 if(!cloud?.isAdmin)return panel('Acesso restrito','<p>Somente o administrador pode gerenciar usuários.</p>');
 const list=adminUsers.map(u=>`<div class="row"><div><b>${esc(u.name||u.email)}</b><small>${esc(u.email)} · ${u.role==='admin'?'Administrador':'Usuário'} · ${u.active?'Ativo':'Bloqueado / pendente'}</small></div>${u.role==='admin'?'<span class="badge">Administrador</span>':`<button type="button" data-admin="toggle" data-user="${esc(u.user_id)}" data-active="${u.active?'false':'true'}">${u.active?'Bloquear':'Desbloquear'}</button>`}</div>`).join('');
 return panel('Cadastrar usuário',`<p>Somente você, como administrador, pode cadastrar e liberar acessos. Cada pessoa vê apenas as próprias finanças.</p><form id="admin-create" novalidate><div class="form-grid"><label>Nome<input name="name" maxlength="100" autocomplete="off" required></label><label>E-mail<input type="email" name="email" maxlength="254" autocomplete="off" required></label><label>Senha inicial<input type="password" name="password" minlength="12" maxlength="128" autocomplete="new-password" required></label></div><p class="hint">Use uma senha inicial forte de pelo menos 12 caracteres. Envie o acesso por um canal seguro. O usuário pode usar Esqueci minha senha para definir outra.</p><div class="form-error" role="alert"></div><button type="button" class="primary" data-admin="create">Cadastrar e liberar</button></form>`)+panel('Usuários cadastrados',`<p id="admin-message" role="status">${esc(adminMessage)}</p><button type="button" data-admin="reload">Atualizar lista</button>${list||empty('Nenhum usuário nesta página')}<div class="account-actions"><button data-admin="prev" ${adminPage===0?'disabled':''}>Anterior</button><span>Página ${adminPage+1}</span><button data-admin="next" ${adminHasMore?'':'disabled'}>Próxima</button></div><p class="hint">Bloquear impede novas leituras e alterações das finanças. Desbloquear restaura o acesso sem apagar os registros. O acesso de administradores não pode ser bloqueado nesta tela.</p>`);
}
async function loadUsers(){if(!cloud?.isAdmin)return;adminMessage='Carregando…';try{const result=await cloud.listUsers(adminPage);if(!Array.isArray(result.users))throw Error('Resposta administrativa inválida.');adminUsers=result.users;adminHasMore=!!result.hasMore;adminMessage='';}catch(error){adminUsers=[];adminMessage=error.message;}if(tab==='users')render();}
async function adminAction(button){if(!cloud?.isAdmin)return;const action=button.dataset.admin;
 if(['reload','prev','next'].includes(action)){if(action==='prev')adminPage=Math.max(0,adminPage-1);if(action==='next')adminPage++;await loadUsers();return;}
 button.disabled=true;
 try{
  if(action==='create'){const form=button.closest('form');if(!checkForm(form))return;const values=Object.fromEntries(new FormData(form));const result=await cloud.createUser(values.name.trim(),values.email.trim(),values.password);form.reset();adminMessage=result.message;const message=adminMessage;adminPage=0;await loadUsers();adminMessage=message;render();}
  if(action==='toggle'){const active=button.dataset.active==='true';if(!confirm(active?'Desbloquear o acesso deste usuário?':'Bloquear o acesso deste usuário? Os dados serão preservados.'))return;const result=await cloud.setUserActive(button.dataset.user,active);const message=result.message;await loadUsers();adminMessage=message;render();}
 }catch(error){if(action==='create')formError(button.closest('form'),error.message);else{adminMessage=error.message;const node=$('#admin-message');if(node)node.textContent=adminMessage;}}
 finally{button.disabled=false;}
}
async function accountAction(button){
 const action=button.dataset.cloud,form=button.closest('form');
 let email=form?.elements.email?.value.trim(),password=form?.elements.password?.value;
 if(['login','reset'].includes(action)){if(!form.elements.email.checkValidity()){cloudMessage='Informe um e-mail válido.';cloudError=true;showAccountMessage();return;}if(action!=='reset'&&!password){cloudMessage='Informe sua senha.';cloudError=true;showAccountMessage();return;}}
 if(action==='password'&&!form.reportValidity())return;
 button.disabled=true;cloudMessage='Aguarde…';cloudError=false;showAccountMessage();
 try{
  if(action==='login'){await cloud.login(email,password);await ensureSelection();render();}
  if(action==='reset')cloudMessage=await cloud.reset(email);
  if(action==='password'){await cloud.password(form.elements.newPassword.value);cloudMessage='Senha atualizada.';render();}
  if(action==='refresh'){await cloud.refresh();await ensureSelection();render();}
  if(action==='logout'){await cloud.logout();cloudMessage='Você saiu da conta. Seus dados online continuam protegidos.';render();}
  if(action==='migrate'){
   if(!cloud.connected)throw Error('Atualize os dados da nuvem antes de importar.');
   if(db.entries.length||db.cards.length||(db.schedules||[]).length)throw Error('A conta online já contém registros. A importação automática foi bloqueada para preservar os dados.');
   if(!localSnapshot||(!localSnapshot.entries.length&&!localSnapshot.cards.length))throw Error('Não há contas locais neste navegador. Exporte o backup no navegador onde você cadastrou as contas e importe aqui.');
   if(!confirm('Copiar as contas locais deste navegador para sua conta online? Os dados locais serão preservados.')){cloudMessage='Importação cancelada.';return;}
   db=await cloud.save(JSON.parse(JSON.stringify(localSnapshot)));cloudMessage='Contas locais copiadas para sua conta online.';render();
  }
 }catch(error){cloudMessage=error.message;cloudError=true;}
 finally{password='';button.disabled=false;showAccountMessage();updateCloudStatus();}
}
function showAccountMessage(){const node=$('#cloud-message');if(node){node.textContent=cloudMessage;node.className=cloudError?'form-error':'hint';}}
$('#open-account').onclick=()=>{tab='account';render();};
$('#content').addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.closest('#admin-create')){event.preventDefault();$('#content [data-admin="create"]')?.click();return;}if(event.key==='Enter'&&event.target.closest('#login-form')){event.preventDefault();$('#content [data-cloud="login"]')?.click();}});
async function refreshCloud(){if(!cloud?.connected||cloud.busy||document.hidden||document.querySelector('dialog[open]')||tab==='account')return;try{await cloud.refresh();cloudError=false;}catch(error){cloudMessage=error.message;cloudError=true;}updateCloudStatus();}
setInterval(refreshCloud,20000);window.addEventListener('focus',refreshCloud);window.addEventListener('online',refreshCloud);
storageReady.then(async()=>{
 if(!cloud?.configured)await ensureSelection();localSnapshot=JSON.parse(JSON.stringify(db));
 if(cloud){cloud.setValidator(valid);cloud.on(type=>{
  if(type==='access'&&!cloud.isAdmin){adminUsers=[];if(tab==='users'){tab='account';render();}}
  if(type==='blocked'){db={version:1,entries:[],cards:[]};adminUsers=[];document.querySelectorAll('dialog[open]').forEach(d=>d.close());tab='account';cloudError=true;cloudMessage='Seu acesso está bloqueado ou aguardando liberação do administrador.';render();}
  if(type==='loaded'){db=cloud.document;cloudMessage='Dados atualizados da nuvem.';cloudError=false;if(!document.querySelector('dialog[open]'))render();}
  if(type==='logout'){adminUsers=[];db=JSON.parse(JSON.stringify(localSnapshot||{version:1,entries:[],cards:[]}));tab='account';search='';render();}
  updateCloudStatus();
 });try{await cloud.boot();if(cloud.connected)await ensureSelection();}catch(error){cloudMessage=error.message;cloudError=true;}
 }
 if(cloud?.configured&&!cloud.connected)tab='account';render();updateCloudStatus();
});

let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(tab==='install')render();});
window.addEventListener('appinstalled',()=>{installPrompt=null;toast('Aplicativo adicionado à tela inicial');if(tab==='install')render();});
if('serviceWorker' in navigator&&location.protocol!=='file:'&&!location.pathname.includes('demo')){
 window.addEventListener('load',async()=>{try{await navigator.serviceWorker.register('./sw.js');}catch{if(tab==='install')$('#install-state').textContent='Não foi possível ativar o modo offline. Você ainda pode usar o site online; a instalação exige HTTPS e um navegador fora da prévia.';}});
}
