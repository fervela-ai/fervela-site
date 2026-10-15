const m=document.querySelector('.menu'),n=document.querySelector('#nav');
m.addEventListener('click',()=>{const o=n.classList.toggle('open');m.setAttribute('aria-expanded',String(o))});
n.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{n.classList.remove('open');m.setAttribute('aria-expanded','false')}));
