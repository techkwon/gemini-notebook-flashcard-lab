import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),web=path.join(root,'web');
const html=fs.readFileSync(path.join(web,'index.html'),'utf8');
const data=JSON.parse(fs.readFileSync(path.join(web,'data','research.json'),'utf8'));
const canonical='https://techkwon.github.io/gemini-notebook-flashcard-lab/';
const failures=[];let assetReferences=0;
function check(ok,message){if(!ok)failures.push(message);}
function local(ref,base=web){
 if(!ref||/^(https?:|data:|mailto:|tel:)/.test(ref))return;
 if(ref.startsWith('#')){check(html.includes('id="'+ref.slice(1)+'"'),'Missing anchor '+ref);return;}
 const relative=decodeURIComponent(ref.split(/[?#]/)[0]);
 check(!relative.startsWith('/'),'Root-absolute path breaks project Pages: '+ref);
 const target=path.resolve(base,relative);assetReferences++;
 check(target.startsWith(web+path.sep),'Asset escapes web directory: '+ref);
 check(fs.existsSync(target),'Missing local asset '+ref);
}
for(const m of html.matchAll(/\b(?:src|href)="([^"]*)"/g))local(m[1]);
for(const cssFile of ['styles.css','enhancements.css']){
 const css=fs.readFileSync(path.join(web,cssFile),'utf8');
 for(const m of css.matchAll(/url\(["']?([^\s)"']+)["']?\)/g))local(m[1]);
}
check(data.experiments.length===3,'Expected three rounds');
check(data.experiments.flatMap(x=>x.results).length===9,'Expected nine sets');
check(data.experiments.flatMap(x=>x.results).reduce((s,x)=>s+x.cards,0)===92,'Expected 92 cards');
check(data.cards===92&&data.rounds===3&&data.sets===9,'Public totals mismatch');
check(data.notebooks.length===3&&new Set(data.notebooks.map(x=>x.url)).size===3,'Notebook links mismatch');
check(html.includes('<link rel="canonical" href="'+canonical+'">'),'Canonical mismatch');
for(const name of ['description','robots','twitter:card'])check(new RegExp('name="'+name+'"').test(html),'Missing '+name);
for(const name of ['og:title','og:description','og:image','og:url'])check(html.includes('property="'+name+'"'),'Missing '+name);
const jsonld=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
check(Boolean(jsonld),'Missing JSON-LD');
if(jsonld){const schema=JSON.parse(jsonld[1]);check(schema['@graph'].length===2,'JSON-LD graph mismatch');const hash=crypto.createHash('sha256').update(jsonld[1]).digest('base64');check(html.includes("'sha256-"+hash+"'"),'CSP JSON-LD hash mismatch');}
const og=fs.readFileSync(path.join(web,'assets','og-cover.png'));check(og.readUInt32BE(16)===1200&&og.readUInt32BE(20)===630,'OG image must be 1200x630');
const manifest=JSON.parse(fs.readFileSync(path.join(web,'site.webmanifest'),'utf8'));
for(const icon of manifest.icons)local(icon.src);
check(fs.readFileSync(path.join(web,'sitemap.xml'),'utf8').includes(canonical),'Sitemap mismatch');
check(fs.readFileSync(path.join(web,'robots.txt'),'utf8').includes(canonical+'sitemap.xml'),'robots sitemap mismatch');
check(fs.readFileSync(path.join(web,'404.html'),'utf8').includes('noindex,follow'),'404 must not be indexed');
const ico=fs.readFileSync(path.join(web,'favicon.ico'));check(ico.readUInt16LE(2)===1&&ico.readUInt16LE(4)>0,'Invalid ICO header');
check((html.match(/class="card-flip-inner"/g)||[]).length===3,'Three real flip structures required');
check(html.includes('aria-label="실제 카드 증거 확대"'),'Dialog needs an accessible name');
check(html.includes('id="photo-credits"><p>'),'Photo credits must work without JavaScript');
check(html.includes('id="notebook-grid" class="notebook-grid"><article'),'Notebook links must work without JavaScript');
const files=[];function walk(dir){for(const name of fs.readdirSync(dir)){const file=path.join(dir,name);if(fs.statSync(file).isDirectory())walk(file);else files.push(file);}}walk(web);
for(const file of files.filter(x=>/\.(html|css|js|json|xml|txt|webmanifest)$/i.test(x))){const source=fs.readFileSync(file,'utf8');check(!/C:\\Users\\|127\.0\.0\.1|localhost|bq9248@gmail\.com|ghp_[A-Za-z0-9]+|sk-ant-[A-Za-z0-9]+/.test(source),'Private/dev data in '+path.relative(web,file));}
const size=files.reduce((sum,file)=>sum+fs.statSync(file).size,0);
if(failures.length){console.error(JSON.stringify({failures},null,2));process.exitCode=1;}else console.log(JSON.stringify({ok:true,rounds:3,sets:9,cards:92,notebooks:3,assetReferences,files:files.length,totalBytes:size,canonical},null,2));
