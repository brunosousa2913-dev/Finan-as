const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = {'/demo':'demo.html','/demo.html':'demo.html','/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/sw.js':'sw.js','/manifest.webmanifest':'manifest.webmanifest',...Object.fromEntries([180,192,512].map(size=>['/icons/icon-'+size+'.png','icons/icon-'+size+'.png']))};
const mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png'};
http.createServer((req,res)=>{
 const file=files[new URL(req.url,'http://localhost').pathname];
 if(!file){res.writeHead(404);return res.end('Não encontrado');}
 res.setHeader('Content-Type',mime[path.extname(file)]);
 res.setHeader('Cache-Control','no-cache');
 const stream=fs.createReadStream(path.join(__dirname,file));
 stream.on('error',()=>{res.writeHead(500);res.end('Não foi possível abrir o arquivo.');});
 stream.pipe(res);
}).listen(process.env.PORT || 3000,'0.0.0.0');
