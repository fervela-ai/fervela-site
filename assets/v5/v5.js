const m=document.querySelector('.menu'),n=document.querySelector('#nav');
m.addEventListener('click',()=>{const o=n.classList.toggle('open');m.setAttribute('aria-expanded',String(o))});
n.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{n.classList.remove('open');m.setAttribute('aria-expanded','false')}));
(function(){const d=document.querySelector('.doors');if(!d)return;const t=[...d.querySelectorAll('[role=tab]')],p=[...d.querySelectorAll('.door')];
function sel(i,f){t.forEach((b,j)=>{const o=i===j;b.setAttribute('aria-selected',String(o));b.tabIndex=o?0:-1;p[j].classList.toggle('on',o)});if(f)t[i].focus()}
t.forEach((b,i)=>{b.addEventListener('click',()=>sel(i));b.addEventListener('keydown',e=>{const k=e.key;if(k==='ArrowRight')sel((i+1)%t.length,1);else if(k==='ArrowLeft')sel((i+t.length-1)%t.length,1);else return;e.preventDefault()})});
d.classList.add('js');sel(0)})();
