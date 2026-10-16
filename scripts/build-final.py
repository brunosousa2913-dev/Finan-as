"""Gera os artefatos finais sem dados pessoais e sem alterar o armazenamento."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re
import subprocess
root=Path(__file__).resolve().parent.parent
subprocess.run(['python3',str(root/'scripts/build-demo.py')],check=True)
html=(root/'index.html').read_text().replace('<link rel="stylesheet" href="./style.css">','<style>'+(root/'style.css').read_text()+'</style>').replace('<script src="./cloud-config.js" defer></script>','').replace('<script src="./cloud.js" defer></script>','').replace('<script src="./app.js" defer></script>','').replace('</body>','<script>'+(root/'cloud-config.js').read_text()+'\n'+(root/'cloud.js').read_text()+'\n'+(root/'app.js').read_text()+'</script></body>')
# Installation metadata belongs to the hosted package, not the independent file.
html=re.sub(r'<link rel="(?:manifest|apple-touch-icon)"[^>]*>','',html)
for name in ['financas-final.html','testar-financas.html','financas-v3-3.html']:
 Path('/workspace',name).write_text(html)
Path('/workspace/financas-final-demo.html').write_text((root/'demo.html').read_text())
files=['index.html','app.js','style.css','sw.js','manifest.webmanifest','PUBLICAR.md','cloud.js','cloud-config.js','CONFIGURAR-LOGIN.md','supabase/setup.sql','ADMINISTRADOR.md','supabase/admin.sql','supabase/bootstrap-admin.sql','supabase/ativar-admin.sql','supabase/functions/manage-users/index.ts','supabase/config.toml']+[str(p.relative_to(root)) for p in sorted((root/'icons').glob('*.png'))]
for target in ['financas-final-site.zip','financas-site.zip']:
 with ZipFile(Path('/workspace',target),'w',ZIP_DEFLATED) as archive:
  for name in files:archive.write(root/name,name)
print('Artefatos: financas-final.html, financas-final-demo.html e financas-final-site.zip')
