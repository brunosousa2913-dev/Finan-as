// Executado somente na Supabase Edge Function, nunca no navegador.
// SUPABASE_SERVICE_ROLE_KEY é fornecida no servidor pelo Supabase.
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
Deno.serve(async request=>{
 const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return reply(405,{error:'Método não permitido.'});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return reply(503,{error:'A função administrativa não está configurada no servidor.'});
 const authorization=request.headers.get('Authorization');
 if(!authorization?.startsWith('Bearer '))return reply(401,{error:'Entre na sua conta.'});
 async function api(path,method='GET',body,auth='Bearer '+key){
  const response=await fetch(url+path,{method,headers:{apikey:key,Authorization:auth,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  const data=await response.json().catch(()=>null);return {ok:response.ok,status:response.status,data};
 }
 try{
  // Valida o token no Auth. Não confia em role enviado no corpo/JWT decodificado.
  const user=await api('/auth/v1/user','GET',null,authorization);
  if(!user.ok||!user.data?.id)return reply(401,{error:'Sessão inválida. Entre novamente.'});
  const admin=await api('/rest/v1/meu_saldo_members?select=role,active&user_id=eq.'+encodeURIComponent(user.data.id));
  if(!admin.ok)return reply(503,{error:'Execute o script admin.sql antes de usar a administração.'});
  if(admin.data?.length!==1||admin.data[0].role!=='admin'||admin.data[0].active!==true)return reply(403,{error:'Acesso permitido somente ao administrador ativo.'});
  if(Number(request.headers.get('content-length')||0)>10000)return reply(413,{error:'Solicitação muito grande.'});
  const raw=await request.text();if(raw.length>10000)return reply(413,{error:'Solicitação muito grande.'});
  let body;try{body=JSON.parse(raw);}catch{return reply(400,{error:'Dados inválidos.'});}
  if(!body||typeof body!=='object')return reply(400,{error:'Dados inválidos.'});
  if(body.action==='list'){
   const page=Number(body.page||0);if(!Number.isInteger(page)||page<0||page>10000)return reply(400,{error:'Página inválida.'});
   const result=await api('/rest/v1/meu_saldo_members?select=user_id,email,name,role,active,created_at&order=created_at.desc,user_id.asc&limit=51&offset='+page*50);
   return result.ok?reply(200,{users:result.data.slice(0,50),hasMore:result.data.length>50}):reply(502,{error:'Não foi possível listar os usuários.'});
  }
  if(body.action==='create'){
   const email=typeof body.email==='string'?body.email.trim().toLowerCase():'',name=typeof body.name==='string'?body.name.trim():'';
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||name.length>100||typeof body.password!=='string'||body.password.length<12||body.password.length>128)return reply(400,{error:'Informe e-mail válido e senha inicial de 12 a 128 caracteres.'});
   const created=await api('/auth/v1/admin/users','POST',{email,password:body.password,email_confirm:true});
   if(!created.ok){const duplicate=['email_exists','user_already_exists'].includes(created.data?.code)||/already.*(registered|exists)/i.test(created.data?.msg||created.data?.message||'');return reply(duplicate?409:400,{error:duplicate?'Este e-mail já está cadastrado. Procure na lista e libere o acesso.':'Não foi possível cadastrar o usuário. Verifique o e-mail e as regras de senha do Supabase.'});}
   const id=created.data?.id;if(!id)return reply(502,{error:'Cadastro não confirmado pelo servidor.'});
   // O trigger cria o perfil pendente. Somente o servidor libera a conta.
   const saved=await api('/rest/v1/meu_saldo_members?user_id=eq.'+encodeURIComponent(id),'PATCH',{email,name,role:'user',active:true});
   if(!saved.ok||!Array.isArray(saved.data)||saved.data.length!==1){await api('/auth/v1/admin/users/'+encodeURIComponent(id),'DELETE');return reply(502,{error:'Não foi possível liberar o novo usuário. Atualize a lista antes de tentar novamente.'});}
   return reply(200,{message:'Usuário cadastrado e liberado. Envie o acesso inicial por um canal seguro.'});
  }
  if(body.action==='set-active'){
   if(typeof body.userId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.userId)||typeof body.active!=='boolean')return reply(400,{error:'Usuário ou status inválido.'});
   if(body.userId===user.data.id)return reply(400,{error:'Você não pode alterar seu próprio acesso.'});
   const member=await api('/rest/v1/meu_saldo_members?select=user_id,role&user_id=eq.'+encodeURIComponent(body.userId));
   if(!member.ok||member.data?.length!==1)return reply(404,{error:'Usuário não encontrado.'});
   if(member.data[0].role==='admin')return reply(400,{error:'O acesso de administradores não pode ser alterado por esta tela.'});
   if(body.active){const auth=await api('/auth/v1/admin/users/'+encodeURIComponent(body.userId),'PUT',{ban_duration:'none'});if(!auth.ok)return reply(502,{error:'Não foi possível desbloquear o login. O acesso continua bloqueado.'});}
   const changed=await api('/rest/v1/meu_saldo_members?user_id=eq.'+encodeURIComponent(body.userId),'PATCH',{active:body.active});
   if(!changed.ok||changed.data?.length!==1)return reply(502,{error:'O banco não confirmou a alteração de acesso.'});
   let warning='';if(!body.active){const auth=await api('/auth/v1/admin/users/'+encodeURIComponent(body.userId),'PUT',{ban_duration:'876000h'});if(!auth.ok)warning=' Os dados já foram bloqueados, mas o bloqueio adicional de login não foi confirmado.';}
   return reply(200,{message:(body.active?'Usuário desbloqueado.':'Usuário bloqueado. As finanças foram preservadas.')+warning});
  }
  return reply(400,{error:'Ação inválida.'});
 }catch{return reply(503,{error:'Não foi possível concluir. Verifique a conexão e tente novamente.'});}
});
