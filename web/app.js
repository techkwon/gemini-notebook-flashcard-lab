import { initMotion } from './motion.js';
const $ = (s,root=document)=>root.querySelector(s);
const escape = (s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const typeNames={images:'이미지형',slides:'슬라이드형',document:'문서형'};
const icons={images:'<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 3-3 5 5"/>',slides:'<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M12 17v4m-5 0 5-4 5 4M7 8h10m-10 4h6"/>',document:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8m-8 4h6"/>'};
const icon=t=>'<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[t]+'</svg>';
let motionController;
try { motionController=initMotion(); document.querySelector('#motion-toggle').disabled=false; } catch(e) { console.warn('[motion] static fallback',e); document.documentElement.dataset.motion='off'; }
const dialog=$('#evidence-dialog');document.querySelectorAll('[data-evidence]').forEach(b=>b.addEventListener('click',()=>{$('#evidence-full').src=b.dataset.evidence;$('#evidence-full').alt=b.dataset.caption;$('#evidence-caption').textContent=b.dataset.caption;dialog.showModal();}));$('.dialog-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
document.querySelectorAll('[data-hero-card]').forEach(b=>{
 b.removeAttribute('aria-label');b.title='클릭하거나 Enter 키로 카드 뒤집기';
 b.addEventListener('click',()=>{const flipped=b.classList.toggle('is-flipped');b.setAttribute('aria-pressed',String(flipped));b.querySelector('.card-face-front').setAttribute('aria-hidden',String(flipped));b.querySelector('.card-face-back').setAttribute('aria-hidden',String(!flipped));});
});

let data;
try { const response=await fetch('./data/research.json',{signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(12000):undefined}); if(!response.ok)throw new Error('data'); data=await response.json(); } catch(e){$('#round-results').insertAdjacentHTML('afterbegin','<p class="data-error" role="alert">연구 집계를 불러오지 못했습니다. 새로고침하거나 아래 공유 노트북과 공개 JSON을 직접 열어 주세요.</p>');document.querySelectorAll('[data-round]').forEach(b=>b.disabled=true);window.__LAB_DATA__={status:'unavailable'};data=null;}
if(data){
function renderRound(round){
const exp=data.experiments.find(x=>x.round===round);if(!exp)return;
const panel=$('#round-results');panel.setAttribute('aria-labelledby','round-tab-'+round);
panel.innerHTML='<div class="result-grid">'+exp.results.map((r,i)=>{
 const notebook=data.notebooks.find(n=>n.id===r.type);
 const frontLabel=round===1&&r.type==='slides'?'앞면 전체 슬라이드':'앞면 사진';
 const alt=r.altLeak===null?(r.frontPhotos===0?'해당 없음':'미집계'):r.altLeak+'장';
 return '<article class="result-card source-'+r.type+'" data-result-card style="--stagger:'+i+'"><div class="result-card-title">'+icon(r.type)+'<h3>'+typeNames[r.type]+'</h3><span class="result-count">'+r.cards+'장</span></div><div class="result-metrics"><div class="metric"><strong>'+r.frontPhotos+'<small> / '+r.cards+'</small></strong><span>'+frontLabel+'</span><div class="metric-track"><i style="--bar:'+r.frontPhotos/r.cards*100+'%"></i></div></div><div class="metric '+(r.frontLeak?'metric-bad':'')+'"><strong>'+r.frontLeak+'<small>장</small></strong><span>앞면 정답 노출</span></div></div><p>'+escape(r.verdict)+'</p><div class="result-minor"><span>대체텍스트 정답 노출 <b>'+alt+'</b></span><span>명칭 표기 문제 <b>'+r.nameIssues+'장</b></span></div><details><summary>관찰 내용 자세히</summary><ul>'+r.details.map(t=>'<li>'+escape(t)+'</li>').join('')+'</ul></details><a class="result-notebook-link" aria-label="'+typeNames[r.type]+' · 이 노트북에서 직접 확인 (새 탭)" href="'+notebook.url+'" target="_blank" rel="noopener noreferrer">이 노트북에서 직접 확인 ↗</a></article>';
}).join('')+'</div>';
$('#round-story').textContent='0'+round+' / '+exp.intent;
document.querySelectorAll('[data-round]').forEach(b=>{const active=Number(b.dataset.round)===round;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
document.dispatchEvent(new CustomEvent('lab:roundchange',{detail:{round}}));
}
document.querySelectorAll('[data-round]').forEach(b=>{b.disabled=false;b.addEventListener('click',()=>renderRound(Number(b.dataset.round)));b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const current=Number(b.dataset.round);const next=e.key==='Home'?1:e.key==='End'?3:(current-1+(e.key==='ArrowRight'?1:2))%3+1;renderRound(next);$('#round-tab-'+next).focus();});});
$('#notebook-grid').innerHTML=data.notebooks.map((n,i)=>'<article class="notebook-card source-'+n.id+'" data-tilt><div class="notebook-top">'+icon(n.id)+'<span>0'+(i+1)+' / '+n.sourceCount+' source'+(n.sourceCount>1?'s':'')+'</span></div><h3>'+escape(n.title)+'</h3><p>'+escape(n.description)+'</p><span class="share-state">링크가 있는 사용자 · 보기 전용</span><a class="button magnetic" aria-label="'+escape(n.title)+' 공유 노트북 열기 (새 탭)" href="'+n.url+'" target="_blank" rel="noopener noreferrer">공유 노트북 열기 ↗</a></article>').join('');
$('#method-scope').textContent=data.method.scope;$('#method-checks').innerHTML=data.method.checks.map(x=>'<li>'+escape(x)+'</li>').join('');$('#method-limits').innerHTML=data.method.limitations.map(x=>'<li>'+escape(x)+'</li>').join('');
$('#prompt-details').innerHTML=data.prompts.map(p=>'<details><summary>0'+p.round+'회차 실제 프롬프트</summary><p class="prompt-text">'+escape(p.text)+'</p><button type="button" class="copy-prompt" data-copy-round="'+p.round+'">프롬프트 복사</button><span class="copy-status" role="status"></span></details>').join('');
document.querySelectorAll('[data-copy-round]').forEach(b=>b.addEventListener('click',async()=>{const text=data.prompts.find(p=>p.round===Number(b.dataset.copyRound)).text;try{await navigator.clipboard.writeText(text);b.nextElementSibling.textContent='복사했습니다.';}catch{b.nextElementSibling.textContent='복사가 제한되어 있습니다. 위 내용을 선택해 복사해 주세요.';}}));
$('#photo-credits').innerHTML=data.credits.map(c=>'<p><strong>'+escape(c.breed)+'</strong> · '+escape(c.author)+' · <a href="'+c.licenseUrl+'" target="_blank" rel="noopener noreferrer">'+escape(c.license)+'</a> · <a href="'+c.sourceUrl+'" target="_blank" rel="noopener noreferrer">원본 보기</a></p>').join('');
window.__LAB_DATA__={rounds:data.rounds,sets:data.sets,cards:data.cards,breeds:data.breeds};
renderRound(1);
}
