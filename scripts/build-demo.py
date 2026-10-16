"""Gera uma demonstração independente com dados fictícios e armazenamento separado."""
import json
from pathlib import Path
root = Path(__file__).resolve().parent.parent
card = {'id':'demo-card','name':'Cartão principal','digits':'4821','limit':5000,'closing':20,'due':27}
def entry(id, description, amount, date, category, status='pending', type='expense', cardId='', **extra):
    return dict(id=id, description=description, amount=amount, date=date, category=category, status=status, type=type, cardId=cardId, invoiceMonth=date[:7], **extra)
entries = [
 entry('salario','Salário',5500,'2026-10-05','Salário','paid','income'),
 entry('freela','Trabalho extra',800,'2026-10-12','Outros','paid','income'),
 entry('aluguel:2026-10','Aluguel',1500,'2026-10-10','Moradia','paid',scheduleId='aluguel'),
 entry('mercado','Supermercado',320,'2026-10-14','Alimentação','paid'),
 entry('internet:2026-10','Internet',120,'2026-10-20','Moradia',scheduleId='internet'),
 entry('energia','Conta de energia',185,'2026-10-22','Moradia'),
 entry('transporte','Combustível',200,'2026-10-15','Transporte','paid'),
 entry('restaurante','Restaurante',85,'2026-10-16','Alimentação',cardId='demo-card'),
 entry('receber','Serviço a receber',450,'2026-10-25','Outros',type='income'),
]
for i in range(3):
 entries.append(entry('fin-'+str(i),'Financiamento ( '+str(i+1)+'/3 )',650,f'2026-{10+i:02}-25','Outros',installmentGroup='fin-demo'))
 entries.append(entry('cartao-'+str(i),'Celular ('+str(i+1)+'/3)',240,f'2026-{9+i:02}-28','Compras',cardId='demo-card',installmentGroup='cel-demo'))
for i in range(3):
 e=next(e for e in entries if e['id']=='cartao-'+str(i))
 e.update(invoiceMonth=f'2026-{10+i:02}',dueDate=f'2026-{10+i:02}-27',purchaseDate='2026-09-28',paymentMethod='credit')
entries.append(entry('demo-pagamento','Pagamento parcial de fatura — Cartão principal',100,'2026-10-16','Cartões','paid',paymentMethod='pix',paymentDate='2026-10-16',invoicePaymentKey='demo-card:2026-10',purchaseId='cartao-0'))
schedules=[{'id':id,'start':date,'active':True,'entry':entry(id,title,amount,date,'Moradia')} for id,title,amount,date in [('aluguel','Aluguel',1500,'2026-10-10'),('internet','Internet',120,'2026-10-20')]]
data={'version':1,'entries':entries,'cards':[card],'schedules':schedules,'invoices':[{'cardId':'demo-card','month':'2026-10','adjustment':0,'managed':True}]}
(root/'demo-data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
js=(root/'app.js').read_text().replace("const key = 'meu-saldo-v1';", "const key = 'meu-saldo-demo-v6-9';").replace("'meu-saldo-storage'", "'meu-saldo-demo-v6-9-storage'").replace("'meu-saldo-theme'", "'meu-saldo-demo-v6-9-theme'")
js=js.replace('let db = {version:1,entries:[],cards:[]}', 'let db = '+json.dumps(data,ensure_ascii=False))
js=js.replace("$('#month').value=today().slice(0,7);", "$('#month').value='2026-10';",1)
html=(root/'index.html').read_text().replace('<title>Meu saldo — Finanças pessoais</title>','<title>Demonstração final — Meu saldo</title>')
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+(root/'style.css').read_text()+'\n.demo-banner{padding:16px 20px;background:#fff1cf;color:#73551d;border:1px solid #ead6a8;border-radius:10px;margin-bottom:24px;font-size:13px;line-height:1.6}</style>')
html=html.replace('<script src="./cloud-config.js" defer></script>','').replace('<script src="./cloud.js" defer></script>','').replace('<script src="./app.js" defer></script>','').replace('<main>','<main><div class="demo-banner"><b>VERSÃO 6.9 · DEMONSTRAÇÃO · DADOS FICTÍCIOS</b><br>Outubro de 2026 já está preenchido para você explorar. Esta demonstração usa armazenamento separado dos seus registros. Experimente Nova movimentação: a forma de pagamento é o primeiro campo. Compra do celular em 28/09, fechamento dia 20: 1ª parcela em outubro, 2ª em novembro, 3ª em dezembro. Fatura de outubro: R$ 325,00, pagos R$ 100,00, em aberto R$ 225,00.</div>')
html=html.replace('</body>','<script>'+js+'</script></body>')
(root/'demo.html').write_text(html)
print('demo.html e demo-data.json gerados.')
