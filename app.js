const languageButton=document.querySelector('.language');
const menu=document.querySelector('.menu');
const nav=document.querySelector('#nav');
let language=new URL(location.href).searchParams.get('lang')==='en'?'en':'zh';
function setLanguage(value,update=false){
 language=value;document.documentElement.lang=value==='en'?'en':'zh-Hant';
 document.querySelectorAll('[data-zh][data-en]').forEach(el=>{el.textContent=el.dataset[value]});
 document.title=document.body.dataset[value==='en'?'titleEn':'titleZh'];
 languageButton.textContent=value==='en'?'中文':'EN';languageButton.setAttribute('aria-label',value==='en'?'切換為繁體中文':'Switch to English');
 document.querySelectorAll('a[href^="/"]').forEach(el=>{const url=new URL(el.getAttribute('href'),location.origin);if(value==='en')url.searchParams.set('lang','en');else url.searchParams.delete('lang');el.setAttribute('href',url.pathname+url.search+url.hash)});
 if(update){const url=new URL(location.href);if(value==='en')url.searchParams.set('lang','en');else url.searchParams.delete('lang');history.replaceState(null,'',url)}
}
setLanguage(language);languageButton.addEventListener('click',()=>setLanguage(language==='en'?'zh':'en',true));
function closeMenu(){nav.classList.remove('open');menu.setAttribute('aria-expanded','false')}
menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});nav.querySelectorAll('a').forEach(el=>el.addEventListener('click',closeMenu));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('open')){closeMenu();menu.focus()}});
const tabs=[...document.querySelectorAll('[role="tab"]')];
function selectTab(index,focus=false){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=i!==index});if(focus)tabs[index].focus()}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>selectTab(i));tab.addEventListener('keydown',e=>{let n=i;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();selectTab(n,true)})});

/* Give slow static-page navigations immediate, calm feedback and warm the next page on intent. */
const pageLoader=document.createElement('div');
pageLoader.className='page-loader';
pageLoader.setAttribute('aria-hidden','true');
pageLoader.innerHTML='<div class="page-loader-mark"><span></span><span></span><span></span></div><p>Fervela.ai</p>';
document.body.append(pageLoader);
let navigating=false;
const isInternalPage=link=>{
  if(!link||link.target==='_blank'||link.hasAttribute('download'))return false;
  const url=new URL(link.href,location.href);
  return url.origin===location.origin&&url.pathname!==location.pathname;
};
const showLoader=()=>{pageLoader.classList.add('is-visible');document.body.classList.add('is-navigating')};
const clearLoader=()=>{navigating=false;pageLoader.classList.remove('is-visible');document.body.classList.remove('is-navigating')};
window.addEventListener('pageshow',clearLoader);
document.addEventListener('click',event=>{
  const link=event.target.closest('a');
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||!isInternalPage(link)||navigating)return;
  navigating=true;event.preventDefault();showLoader();
  window.setTimeout(()=>location.assign(link.href),140);
});
const prefetched=new Set();
document.addEventListener('pointerover',event=>{
  const link=event.target.closest('a');
  if(!isInternalPage(link)||prefetched.has(link.href))return;
  prefetched.add(link.href);const hint=document.createElement('link');hint.rel='prefetch';hint.href=link.href;document.head.append(hint);
});
