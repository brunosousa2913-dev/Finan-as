const $ = s => document.querySelector(s);
const key = 'meu-saldo-v1';
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
function valid(data){return data && (!data.categories||(Array.isArray(data.categories)&&data.categories.every(c=>typeof c==='string'&&c.trim().length>0&&c.length<=60))) && (!data.schedules||(Array.isArray(data.schedules)&&data.schedules.every(s=>typeof s.id==='string'&&typeof s.active==='boolean'&&/^\d{4}-\d{2}-\d{2}$/.test(s.start)&&s.entry&&typeof s.entry.description==='string'&&Number.isFinite(s.entry.amount)&&s.entry.amount>0&&['income','expense'].includes(s.entry.type)&&typeof s.entry.category==='string'&&typeof s.entry.cardId==='string'&&(!s.entry.cardId||data.cards.some(c=>c.id===s.entry.cardId))&&/^\d{4}-\d{2}$/.test(s.entry.invoiceMonth)))) && data.version===1 && Array.isArray(data.entries) && Array.isArray(data.cards) && data.cards.every(c=>typeof c.id==='string'&&typeof c.name==='string'&&/^\d{4}$/.test(c.digits)&&Number.isFinite(c.limit)&&c.limit>0&&Number.isInteger(c.closing)&&c.closing>=1&&c.closing<=31&&Number.isInteger(c.due)&&c.due>=1&&c.due<=31) && data.entries.every(e=>typeof e.id==='string'&&typeof e.description==='string'&&['income','expense'].includes(e.type)&&['paid','pending'].includes(e.status)&&Number.isFinite(e.amount)&&e.amount>0&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&typeof e.category==='string'&&typeof e.cardId==='string'&&(!e.cardId||data.cards.some(c=>c.id===e.cardId))&&/^\d{4}-\d{2}$/.test(e.invoiceMonth)) && new Set(data.entries.map(e=>e.id)).size===data.entries.length && new Set(data.cards.map(c=>c.id)).size===data.cards.length;}
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
async function persist(next,form){await storageReady;if(loadBlocked){formError(form,'Não foi possível carregar os registros anteriores. Exporte seu backup antes de continuar.');return false;}
 const raw=JSON.stringify(next);
 try{if(storageMode==='indexed')await idb('put',raw);else{try{localStorage.setItem(key,raw);if(localStorage.getItem(key)!==raw)throw Error();}catch{await idb('put',raw);storageMode='indexed';}}db=next;$('#storage-warning').textContent='';return true;}
 catch{formError(form,'O navegador bloqueou o armazenamento. Abra o site em uma aba normal do Chrome ou Safari, fora da prévia e da navegação privada. Nenhum registro foi salvo.');return false;}
}
function shiftedDate(date,offset){const [y,m,d]=date.split('-').map(Number);const end=new Date(y,m+offset,0);return `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(Math.min(d,end.getDate())).padStart(2,'0')}`;}
async function ensureMonth(month=$('#month').value){await storageReady;const missing=(db.schedules||[]).filter(s=>s.active&&month>=s.start.slice(0,7)&&!db.entries.some(e=>e.id===s.id+':'+month)&&!(s.skipped||[]).includes(month)).map(s=>{const offset=(Number(month.slice(0,4))-Number(s.start.slice(0,4)))*12+Number(month.slice(5))-Number(s.start.slice(5,7));const date=shiftedDate(s.start,offset);return {...s.entry,id:s.id+':'+month,date,invoiceMonth:shiftedDate(s.entry.invoiceMonth+'-01',offset).slice(0,7),status:'pending',scheduleId:s.id};});if(missing.length)return persist({...db,entries:[...db.entries,...missing]});return true;}
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
const monthEntries=()=>{if(dateError())return [];const [start,end]=dateBounds();return db.entries.filter(e=>e.date>=start&&e.date<=end);};
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
function rows(entries){return entries.length?entries.map(e=>`<div class="row"><div><div class="row-title">${esc(e.description)}</div><small>${esc(e.category)} · ${dateLabel(e.date)}${e.cardId?' · '+esc(db.cards.find(c=>c.id===e.cardId)?.name||'Cartão'):''}</small></div><div class="row-right"><div class="${e.type==='income'?'positive':'red'}">${e.type==='income'?'+':'−'} ${money(e.amount)}</div><div style="margin-top:6px">${status(e)}</div><label class="paid-check"><input type="checkbox" data-paid="${esc(e.id)}" ${e.status==='paid'?'checked':''} aria-label="${e.type==='income'?'Recebido':'Pago'}: ${esc(e.description)}">${e.type==='income'?'Recebido':'Pago'}</label><div class="actions"><button data-edit="${esc(e.id)}">Editar</button><button data-delete="${esc(e.id)}" aria-label="Excluir ${esc(e.description)}">Excluir</button></div></div></div>`).join(''):empty('Nenhuma movimentação por aqui','Adicione suas receitas e despesas para começar.');}
function panel(title,body,subtitle=''){return `<div class="panel"><div class="panel-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div></div>${body}</div>`;}
function render(){
 const titles={overview:'Visão geral',transactions:'Movimentações',bills:'Contas e vencimentos',cards:'Cartões e faturas',backup:'Backup dos dados',fixed:'Contas fixas e parcelas',install:'Instalar no celular'};
 $('#page-title').textContent=titles[tab];document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 const entries=monthEntries(),income=sum(entries.filter(e=>e.type==='income'&&e.status==='paid')),expense=sum(entries.filter(e=>e.type==='expense'&&e.status==='paid')),pending=sum(entries.filter(e=>e.type==='expense'&&e.status==='pending'));
 let html='';
 if(tab==='overview'){
 html=`<div class="stats">${[['Saldo do período',income-expense,'Entradas recebidas menos saídas pagas'],['Entradas recebidas',income,'Receitas confirmadas no filtro'],['Saídas pagas',expense,'Despesas quitadas no filtro'],['Contas a pagar',pending,'Despesas pendentes no filtro']].map(([t,v,s])=>`<div class="stat"><div class="stat-label">${t}</div><strong>${money(v)}</strong><small>${s}</small></div>`).join('')}</div>`;
 const categories=Object.create(null);entries.filter(e=>e.type==='expense').forEach(e=>categories[e.category]=(categories[e.category]||0)+e.amount);const total=Object.values(categories).reduce((a,b)=>a+b,0);
 html+=`<div class="dashboard-grid"><div>${panel('Últimas movimentações',rows([...entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5)),'Acompanhe o que entrou e saiu')}${panel('Próximos vencimentos',rows(entries.filter(e=>e.status==='pending').sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3)),'Contas a pagar e valores a receber')}</div><div>${panel('Despesas por categoria',Object.keys(categories).length?Object.entries(categories).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<div class="category-row"><div><span>${esc(c)}</span><b>${money(v)}</b></div><div class="progress"><div style="width:${v/total*100}%"></div></div></div>`).join(''):empty('Tudo começa com um registro','As categorias aparecerão aqui.'),'Inclui despesas pagas e pendentes')}<div class="welcome"><span>✧</span><div><b>Pequenos hábitos, grandes planos.</b><p>Registre seus gastos e acompanhe sua evolução todos os meses.</p></div></div></div></div>`;
 }else if(tab==='transactions'||tab==='bills'){
 let list=entries.filter(e=>e.description.toLowerCase().includes(search.toLowerCase()));if(tab==='bills')list=list.filter(e=>e.status==='pending');if(filter!=='all')list=list.filter(e=>e.type===filter);
 html=panel(tab==='bills'?'Suas contas pendentes':'Todas as movimentações',`<div class="filters"><input id="search" aria-label="Buscar descrição" placeholder="Buscar movimentação…" value="${esc(search)}"><select id="filter" aria-label="Tipo de movimentação"><option value="all">Entradas e saídas</option><option value="income" ${filter==='income'?'selected':''}>Entradas</option><option value="expense" ${filter==='expense'?'selected':''}>Saídas</option></select></div><div id="entry-list">${rows(list.sort((a,b)=>a.date.localeCompare(b.date)))}</div>`,'Registros das datas selecionadas');
 }else if(tab==='fixed'){
 const schedules=db.schedules||[];
 html=panel('Contas fixas mensais',`<button id="add-fixed" class="primary">+ Nova conta fixa ou parcela</button><p class="hint">Aluguel e outras contas fixas geram uma conta pendente ao abrir cada mês. Encerrar mantém os registros já gerados.</p>`+ (schedules.length?schedules.map(s=>`<div class="row"><div><b>${esc(s.entry.description)}</b><small>${money(s.entry.amount)} / mês · Início ${dateLabel(s.start)} · ${s.active?'Ativa':'Encerrada'}</small></div>${s.active?`<button data-stop="${esc(s.id)}">Encerrar</button>`:''}</div>`).join(''):empty('Nenhuma conta fixa cadastrada')));
 const installments=entries.filter(e=>e.installmentGroup);
 html+=panel('Parcelas cadastradas',rows(installments.sort((a,b)=>a.date.localeCompare(b.date))),'Parcelas nas datas selecionadas. Marque a caixa para confirmar o pagamento.');
 }else if(tab==='cards'){
 html=`<div class="panel-head"><div><h2>Meus cartões</h2><p>Fatura de ${esc(dateLabel($('#month').value))} · O cartão usa o mês inicial do filtro.</p></div><button id="add-card">+ Cadastrar cartão</button></div><div class="cards-grid">`;
 html+=db.cards.map(c=>{const invoice=db.entries.filter(e=>e.cardId===c.id&&e.invoiceMonth===$('#month').value),outstanding=sum(db.entries.filter(e=>e.cardId===c.id&&e.status==='pending')),unpaid=invoice.filter(e=>e.status==='pending');return `<div><div class="credit-card"><h3>${esc(c.name)}</h3><div class="digits">•••• •••• •••• ${esc(c.digits)}</div><small>Fatura do mês</small><strong>${money(sum(invoice))}</strong><small>Fecha dia ${c.closing} · Vence dia ${c.due}</small></div><div class="panel"><div class="row"><span>Limite total</span><b>${money(c.limit)}</b></div><div class="row"><span>Limite disponível</span><b>${money(c.limit-outstanding)}</b></div><p class="hint">Disponível = limite menos todas as compras pendentes. Selecione o mês ao registrar cada compra; o fechamento não muda a fatura automaticamente.</p>${unpaid.length?`<button data-invoice="${esc(c.id)}">Quitar fatura (${money(sum(unpaid))})</button>`:''}<button data-remove-card="${esc(c.id)}">Excluir cartão</button></div></div>`;}).join('')||empty('Cadastre seu primeiro cartão','Registre compras como saídas e escolha o cartão no pagamento.');html+='</div>';
 }else if(tab==='install'){
 html=panel('Seu Meu saldo na tela inicial',`<p>Publique este site com HTTPS e abra o endereço no navegador do celular. Depois de abrir uma vez com internet, a versão instalada pode funcionar offline.</p><div class="install-guide"><h3>Android · Chrome</h3><p>Toque em <b>Instalar aplicativo</b> abaixo quando disponível, ou abra o menu ⋮ e escolha <b>Instalar aplicativo</b> / <b>Adicionar à tela inicial</b>.</p><h3>iPhone · Safari</h3><p>Abra o site no Safari, toque em <b>Compartilhar</b> e escolha <b>Adicionar à Tela de Início</b>. Se aparecer, ative “Abrir como App da Web”.</p><h3>Computador</h3><p>No Chrome ou Edge, use o ícone de instalação na barra de endereço ou o menu do navegador.</p></div><button id="install-app" class="primary" ${installPrompt?'':'hidden'}>Instalar aplicativo</button><p id="install-state" class="hint">${location.protocol==='file:'?'Você está usando o arquivo local. A instalação e o modo offline precisam da versão publicada com HTTPS.':'A opção de instalar depende do navegador. Caso não apareça, use as instruções acima.'}</p><p class="hint">Os dados são salvos neste aparelho. Não há sincronização automática. Antes de mudar de endereço, navegador ou versão, exporte seu backup na aba Backup dos dados e importe no novo local.</p>`);
 }else html=panel('Seus dados, com você' ,`<p>As alterações são salvas automaticamente neste navegador e neste aparelho. Para levar seus dados a outro celular ou computador, exporte e importe um backup.</p><p class="hint">Limpar os dados do navegador remove seus registros. O arquivo exportado contém informações financeiras pessoais: guarde-o em um local seguro. Esta versão não sincroniza entre aparelhos.</p><div class="backup-actions"><button id="export" class="primary">↓ Exportar backup</button><label>↑ Importar backup<input type="file" id="import" accept="application/json,.json"></label></div>`);
 $('#content').innerHTML=html;
}
const defaultCategories=['Alimentação','Moradia','Transporte','Saúde','Lazer','Educação','Compras','Salário'];
const categoryKey=name=>name.trim().normalize('NFC').toLocaleLowerCase('pt-BR');
function allCategories(){const result=[...defaultCategories];for(const name of [...(db.categories||[]),...db.entries.map(e=>e.category),...(db.schedules||[]).map(s=>s.entry.category)])if(name!=='Outros'&&!result.some(c=>categoryKey(c)===categoryKey(name)))result.push(name);return result;}
function syncCustomCategory(){const form=$('#entry-form'),visible=form.elements.category.value==='Outros';$('#custom-category-field').hidden=!visible;form.elements.customCategory.disabled=!visible;}
$('#entry-form').elements.category.onchange=()=>{syncCustomCategory();if(!$('#custom-category-field').hidden)$('#entry-form').elements.customCategory.focus();};
function openEntry(id){const form=$('#entry-form');form.reset();form.elements.id.value='';form.elements.category.innerHTML=[...allCategories(),'Outros'].map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');formError(form,'');form.elements.repeat.disabled=!!id;form.elements.repeat.closest('label').hidden=!!id;$('#installment-field').hidden=true;const e=db.entries.find(e=>e.id===id);$('#payment-select').innerHTML='<option value="">Dinheiro / conta bancária</option>'+db.cards.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');form.elements.date.value=today();form.elements.invoiceMonth.value=$('#month').value;if(e)Object.keys(e).forEach(k=>{if(form.elements[k])form.elements[k].value=e[k];});syncCustomCategory();$('#form-title').textContent=e?'Editar movimentação':'Nova movimentação';$('#entry-dialog').showModal();}
$('#new-entry').onclick=()=>openEntry();document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('#month').onchange=()=>{if(!$('#month').value)$('#month').value=today().slice(0,7);applyDates();};
$('#date-mode').onchange=()=>{const month=$('#month').value;if(!$('#filter-day').value)$('#filter-day').value=month+'-01';if(!$('#filter-start').value)$('#filter-start').value=month+'-01';if(!$('#filter-end').value)$('#filter-end').value=shiftedDate(month+'-31',0);updateDateFields();applyDates();};
for(const id of ['filter-day','filter-start','filter-end'])document.getElementById(id).onchange=applyDates;
document.querySelector('nav').onclick=e=>{const b=e.target.closest('[data-tab]');if(b){tab=b.dataset.tab;search='';filter='all';render();}};
$('#entry-form').elements.repeat.onchange=e=>{$('#installment-field').hidden=e.target.value!=='installments';};
async function saveEntry(form){if(!checkForm(form))return;const button=form.querySelector('#save-entry');button.disabled=true;
 try{await storageReady;const data=Object.fromEntries(new FormData(form));const repeat=data.repeat||'once',count=Number(data.installments);delete data.repeat;delete data.installments;const custom=(data.customCategory||'').trim().normalize('NFC');delete data.customCategory;if(data.category==='Outros'&&custom){data.category=[...allCategories(),'Outros'].find(c=>categoryKey(c)===categoryKey(custom))||custom;}const previous=db.entries.find(x=>x.id===data.id);data.id=data.id||newId();data.amount=Number(data.amount);data.invoiceMonth=data.invoiceMonth||data.date.slice(0,7);if(previous)for(const k of ['scheduleId','installmentGroup'])if(previous[k])data[k]=previous[k];
 if(data.cardId&&data.type==='income'){formError(form,'Para receitas, selecione dinheiro / conta bancária.');return;}
 let additions=[data],schedules=db.schedules||[];
 if(repeat==='installments'){if(!Number.isInteger(count)||count<2||count>360){formError(form,'Informe entre 2 e 360 parcelas.');return;}const group=newId();additions=Array.from({length:count},(_,i)=>({...data,id:i===0?data.id:newId(),description:`${data.description} (${i+1}/${count})`,date:shiftedDate(data.date,i),invoiceMonth:shiftedDate(data.invoiceMonth+'-01',i).slice(0,7),status:i===0?data.status:'pending',installmentGroup:group}));}
 if(repeat==='monthly'){const id=newId();schedules=[...schedules,{id,start:data.date,active:true,entry:{...data}}];additions=[{...data,id:id+':'+data.date.slice(0,7),scheduleId:id}];}
 const customCategories=[...(db.categories||[])];if(![...defaultCategories,'Outros',...customCategories].some(c=>categoryKey(c)===categoryKey(data.category)))customCategories.push(data.category);const next={...db,categories:customCategories,schedules,entries:[...db.entries.filter(x=>x.id!==data.id),...additions]};if(!valid(next)){formError(form,'Verifique descrição, valor, data e mês da fatura.');return;}
 if(await persist(next,form)){resetDateMonth(data.date.slice(0,7));$('#date-error').hidden=true;tab='transactions';search=data.description;filter='all';$('#entry-dialog').close();render();toast('Salvo com sucesso neste navegador');}
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
 if(e.target.matches('[data-paid]')){const box=e.target,previous=!box.checked;box.disabled=true;const next={...db,entries:db.entries.map(x=>x.id===box.dataset.paid?{...x,status:box.checked?'paid':'pending'}:x)};if(await persist(next)){render();toast(box.checked?'Pagamento confirmado':'Marcado como pendente');}else{box.checked=previous;box.disabled=false;}return;}
if(e.target.id==='filter'){filter=e.target.value;render();}if(e.target.id==='import'){const file=e.target.files[0];if(!file)return;try{if(file.size>5e6)throw Error();const data=JSON.parse(await file.text());if(!valid(data))throw Error();if(confirm('Importar este backup substituirá todos os dados atuais. Deseja continuar?')&&await persist(data)){await ensureSelection();render();toast('Backup importado');}}catch{alert('Backup inválido. Selecione um arquivo JSON exportado pelo Meu saldo (até 5 MB).');}e.target.value='';}});
$('#content').onclick=async e=>{const b=e.target.closest('button');if(!b)return;let next;
 if(b.id==='install-app'&&installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;render();}
 if(b.id==='add-fixed'){openEntry();$('#entry-form').elements.repeat.value='monthly';$('#entry-form').elements.status.value='pending';}
 if(b.dataset.stop&&confirm('Encerrar esta conta fixa? Os vencimentos já gerados serão mantidos.'))next={...db,schedules:(db.schedules||[]).map(s=>s.id===b.dataset.stop?{...s,active:false}:s)};
 if(b.id==='add-card'){$('#card-form').reset();formError($('#card-form'),'');$('#card-dialog').showModal();}
 if(b.dataset.edit)openEntry(b.dataset.edit);
 if(b.dataset.delete&&confirm('Excluir esta movimentação?')){const removed=db.entries.find(x=>x.id===b.dataset.delete);next={...db,entries:db.entries.filter(x=>x.id!==b.dataset.delete),schedules:(db.schedules||[]).map(s=>s.id===removed?.scheduleId?{...s,skipped:[...(s.skipped||[]),removed.date.slice(0,7)]}:s)};}
 if(b.dataset.pay)next={...db,entries:db.entries.map(x=>x.id===b.dataset.pay?{...x,status:'paid'}:x)};
 if(b.dataset.invoice&&confirm('Marcar todas as compras desta fatura como pagas?'))next={...db,entries:db.entries.map(x=>x.cardId===b.dataset.invoice&&x.invoiceMonth===$('#month').value?{...x,status:'paid'}:x)};
 if(b.dataset.removeCard){if(db.entries.some(x=>x.cardId===b.dataset.removeCard)||(db.schedules||[]).some(s=>s.entry.cardId===b.dataset.removeCard))return alert('Este cartão tem movimentações vinculadas. Edite ou exclua esses registros primeiro.');if(confirm('Excluir este cartão?'))next={...db,cards:db.cards.filter(c=>c.id!==b.dataset.removeCard)};}
 if(b.id==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`meu-saldo-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 if(next&&await persist(next)){render();toast('Alteração salva');}
};
storageReady.then(async()=>{await ensureSelection();render();});

let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(tab==='install')render();});
window.addEventListener('appinstalled',()=>{installPrompt=null;toast('Aplicativo adicionado à tela inicial');if(tab==='install')render();});
if('serviceWorker' in navigator&&location.protocol!=='file:'&&!location.pathname.includes('demo')){
 window.addEventListener('load',async()=>{try{await navigator.serviceWorker.register('./sw.js');}catch{if(tab==='install')$('#install-state').textContent='Não foi possível ativar o modo offline. Você ainda pode usar o site online; a instalação exige HTTPS e um navegador fora da prévia.';}});
}
