/* Login Supabase e gravação com versão: nenhuma chave administrativa no navegador. */
(()=>{
'use strict';
const config=window.FINANCE_CLOUD_CONFIG||{};
let session=null,revision=0,document=null,ready=false,busy=false,recovery=false,refreshTask=null;let access=null;
const listeners=new Set();let validator=()=>true;
const configured=!!config.url&&!!config.publicKey;
let base='';
try{if(configured){const url=new URL(config.url);if(url.protocol!=='https:'||url.username||url.password)throw Error();base=url.origin;if(config.publicKey.startsWith('sb_secret_'))throw Error();if(config.publicKey.split('.').length===3){const payload=JSON.parse(atob(config.publicKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role==='service_role')throw Error();}}}catch{base='';}
const sessionKey='meu-saldo-auth:'+base;
const empty=()=>({version:1,entries:[],cards:[],schedules:[],categories:[]});
const emit=type=>{for(const fn of listeners)fn(type);};
function errorText(code){if(code==='finance_conflict')return 'Outra aba ou aparelho alterou as contas. Clique em Atualizar da nuvem antes de refazer esta alteração. Nada foi sobrescrito.';return code;}
async function request(path,{method='GET',body,token}={}){
 const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),15000);
 try{const response=await fetch(base+path,{method,headers:{apikey:config.publicKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:abort.signal,cache:'no-store'});
 const data=await response.json().catch(()=>({}));if(!response.ok){if(path.startsWith('/functions/')&&response.status===403){access=null;emit('access');}const code=data.message||data.msg||data.error_description||data.error||'';if(path.startsWith('/functions/'))throw Error(response.status===404?'Publique a função manage-users no Supabase para ativar a administração.':typeof data.error==='string'?data.error:'Não foi possível acessar a administração.');if(path.includes('/meu_saldo_members')&&response.status===404)throw Error('Execute o script ativar-admin.sql no Supabase para configurar o acesso.');if(code.includes('access_blocked')||response.status===401||response.status===403){ready=false;document=null;access=null;emit('blocked');}const error=new Error(code.includes('finance_conflict')?errorText('finance_conflict'):code.includes('access_blocked')?'Seu acesso está bloqueado ou aguardando liberação do administrador.':response.status===401?'Sessão expirada ou e-mail/senha inválidos. Entre novamente.':code.includes('Email not confirmed')?'Confirme o e-mail antes de entrar.':code.includes('already registered')?'Este e-mail já tem cadastro. Use Entrar ou recuperar senha.':'Não foi possível concluir a operação. Verifique sua conexão e a configuração da conta.');error.status=response.status;throw error;}return data;
 }catch(error){if(error.name==='AbortError'||error instanceof TypeError)throw Error('Sem conexão com a nuvem. Nenhuma alteração foi confirmada; tente novamente quando estiver online.');throw error;}finally{clearTimeout(timeout);}
}
function saveSession(value){session=value;try{if(value)localStorage.setItem(sessionKey,JSON.stringify(value));else localStorage.removeItem(sessionKey);}catch{}emit('session');}
async function token(){if(!session)throw Error('Entre na conta para sincronizar.');if(session.expires_at>Date.now()/1000+60)return session.access_token;
 if(!refreshTask)refreshTask=(async()=>{try{const next=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});saveSession({...next,expires_at:Math.floor(Date.now()/1000)+next.expires_in});return next.access_token;}finally{refreshTask=null;}})();return refreshTask;
}
async function checkAccess(){
 const data=await request('/rest/v1/meu_saldo_members?select=role,active&user_id=eq.'+encodeURIComponent(session.user.id),{token:await token()});
 if(!Array.isArray(data))throw Error('Execute a configuração administrativa no Supabase.');
 access=data[0]||null;emit('access');
 if(!access||access.active!==true){ready=false;document=null;emit('blocked');throw Error('Seu acesso está bloqueado ou aguardando liberação do administrador.');}
}
async function fetchDocument(){await checkAccess();const auth=await token();const user=session.user.id;const data=await request('/rest/v1/meu_saldo_accounts?select=document,revision&user_id=eq.'+encodeURIComponent(user),{token:auth});if(!Array.isArray(data)||data.length>1)throw Error('Resposta inválida do banco de dados.');return data[0]||{document:empty(),revision:0};}
function accept(row){if(!validator(row.document))throw Error('Os dados da conta não têm um formato válido. Nenhum registro local foi substituído.');if(!Number.isSafeInteger(Number(row.revision))||!row.document)throw Error('Resposta inválida do banco.');document=row.document;revision=Number(row.revision);ready=true;}
async function load(){busy=true;emit('state');try{accept(await fetchDocument());emit('loaded');}finally{busy=false;emit('state');}}
function requireConfig(){if(!configured||!base)throw Error('O login ainda precisa ser conectado ao Supabase. Consulte CONFIGURAR-LOGIN.md.');}
window.FinanceCloud={
 get isAdmin(){return access?.active===true&&access?.role==='admin';},get active(){return access?.active===true;},get configured(){return configured&&!!base;},get signedIn(){return !!session?.user?.id;},get connected(){return !!session&&ready;},get busy(){return busy;},get user(){return session?.user||null;},get document(){return document;},get revision(){return revision;},get recovery(){return recovery;},
 on(fn){listeners.add(fn);},setValidator(fn){validator=fn;},
 async boot(){if(!this.configured)return;try{const stored=localStorage.getItem(sessionKey);if(stored)session=JSON.parse(stored);}catch{}const hash=new URLSearchParams(location.hash.slice(1));if(hash.get('access_token')){recovery=['recovery','invite'].includes(hash.get('type'));saveSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),expires_at:Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600)});history.replaceState(null,'',location.pathname+location.search);try{const user=await request('/auth/v1/user',{token:session.access_token});saveSession({...session,user});}catch{saveSession(null);}}
 if(session?.user){try{await load();}catch(error){emit('state');throw error;}}else{session=null;emit('state');}},
 async login(email,password){requireConfig();if(busy)throw Error('Aguarde a operação atual.');busy=true;emit('state');try{const result=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});saveSession({...result,expires_at:Math.floor(Date.now()/1000)+result.expires_in});ready=false;}finally{busy=false;}await load();},
 async reset(email){requireConfig();await request('/auth/v1/recover?redirect_to='+encodeURIComponent(location.origin+location.pathname),{method:'POST',body:{email}});return 'Se houver uma conta para este e-mail, você receberá um link para redefinir a senha.';},
 async password(value){if(!session||!recovery)throw Error('Abra o link de recuperação enviado por e-mail.');await request('/auth/v1/user',{method:'PUT',token:await token(),body:{password:value}});recovery=false;emit('state');},
 async refresh(){if(busy)return;await load();},
 async save(next){if(!ready||!session)throw Error('Entre na conta e carregue os dados antes de salvar.');if(busy)throw Error('Aguarde a sincronização e tente novamente.');busy=true;emit('state');const expected=revision,user=session.user.id;try{await checkAccess();const rows=await request('/rest/v1/rpc/save_meu_saldo',{method:'POST',token:await token(),body:{p_document:next,p_expected_revision:expected}});if(session?.user.id!==user)throw Error('A conta mudou durante o salvamento.');if(!Array.isArray(rows)||rows.length!==1)throw Error('O banco não confirmou o salvamento.');accept(rows[0]);emit('saved');return document;}finally{busy=false;emit('state');}},
 async listUsers(page=0){return request('/functions/v1/manage-users',{method:'POST',token:await token(),body:{action:'list',page}});},
 async createUser(name,email,password){return request('/functions/v1/manage-users',{method:'POST',token:await token(),body:{action:'create',name,email,password}});},
 async setUserActive(userId,active){return request('/functions/v1/manage-users',{method:'POST',token:await token(),body:{action:'set-active',userId,active}});},
 async logout(){if(busy)throw Error('Aguarde o salvamento terminar antes de sair.');const old=session;try{if(old)await request('/auth/v1/logout?scope=local',{method:'POST',token:await token()});}catch{}try{if(old)localStorage.removeItem(sessionKey+':cache:'+old.user.id);}catch{}session=null;ready=false;document=null;access=null;revision=0;recovery=false;saveSession(null);emit('logout');}
};
})();
