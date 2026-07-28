// Intercepte les clics pour une navigation fluide instantanée
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (link && link.href.startsWith(window.location.origin) && !link.getAttribute('target')) {
    e.preventDefault();
    if (!document.startViewTransition) {
      window.location = link.href;
      return;
    }
    document.startViewTransition(() => {
      window.location = link.href;
    });
  }
});

// Reveal au scroll — opacity/transform uniquement
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('vu'); io.unobserve(e.target); } });
}, {threshold: .12});
document.querySelectorAll('.reveal, .reveal-img').forEach(el => io.observe(el));

// Image hero : fondu one-shot au chargement (pas de parallax continu — coût perf inutile)
const heroImg = document.querySelector('.hero-media img');
if(heroImg){
  heroImg.addEventListener('load', function(){ this.classList.add('loaded'); });
  if(heroImg.complete){ heroImg.classList.add('loaded'); }
}

// Nav : fond plein à partir du scroll
const nav = document.querySelector('nav');
function onScroll(){ nav.classList.toggle('is-scrolled', window.scrollY > 30); }
window.addEventListener('scroll', onScroll, {passive:true});
onScroll();

// Menu mobile
const toggle = document.querySelector('.nav-toggle');
const menu = document.getElementById('mobile-menu');
function closeMenu(){
  menu.classList.remove('is-open');
  toggle.setAttribute('aria-expanded','false');
  document.body.style.overflow = '';
}
function openMenu(){
  menu.classList.add('is-open');
  toggle.setAttribute('aria-expanded','true');
  document.body.style.overflow = 'hidden';
}
toggle.addEventListener('click', () => {
  toggle.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu();
});
menu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeMenu(); });

// Avis : rotation manuelle uniquement (pas d'autoplay — cf. WCAG 2.2.2)
const avisQuotes = document.querySelectorAll('.avis-quote');
const avisDots = document.querySelectorAll('.avis-dot');
avisDots.forEach((dot, i) => {
  dot.addEventListener('click', () => {
    avisQuotes.forEach((q, j) => { q.hidden = j !== i; });
    avisDots.forEach((d, j) => d.setAttribute('aria-current', j === i ? 'true' : 'false'));
  });
});

// Page séance : switcher avant/après (inerte si les éléments n'existent pas sur la page)
(function(){
  const switcher = document.getElementById('switcher');
  if(!switcher) return;

  const pill = document.getElementById('switcher-pill');
  const btnAvant = document.getElementById('btn-avant');
  const btnApres = document.getElementById('btn-apres');
  const secAvant = document.getElementById('section-avant');
  const secApres = document.getElementById('section-apres');
  const titre = document.getElementById('hero-titre');
  const sub = document.getElementById('hero-sub');
  const ctaTitre = document.getElementById('cta-titre');
  const ctaSub = document.getElementById('cta-sub');
  const ctaBtnMain = document.getElementById('cta-btn-main');
  const ctaBtnSec = document.getElementById('cta-btn-sec');
  const ctaEyebrow = document.getElementById('cta-eyebrow');
  let mode = 'avant';

  function revealSection(sec){
    sec.querySelectorAll('.reveal').forEach(el => {
      el.classList.remove('vu');
      requestAnimationFrame(() => el.classList.add('vu'));
    });
  }

  function basculer(next){
    if(next === mode) return;
    mode = next;

    if(next === 'apres'){
      pill.style.transform = `translateX(${btnAvant.offsetWidth}px)`;
      pill.style.width = btnApres.offsetWidth + 'px';
      btnAvant.classList.remove('actif');
      btnApres.classList.add('actif');

      titre.innerHTML = 'Après votre <em>séance</em>';
      sub.textContent = "Ce que votre corps fait maintenant, comment l'aider, et à quoi vous attendre dans les heures qui suivent.";
      ctaEyebrow.textContent = 'La suite';
      ctaTitre.innerHTML = 'Revenez — <em>nous avons encore à faire</em>';
      ctaSub.textContent = "La prochaine séance consolide ce qui a été commencé aujourd'hui. Les effets s'accumulent.";
      ctaBtnMain.textContent = 'Réserver ma prochaine séance';
      ctaBtnSec.textContent = 'Voir les accompagnements';
      ctaBtnSec.href = 'soins';

      secAvant.classList.add('hidden');
      secApres.classList.remove('hidden');
      revealSection(secApres);
    } else {
      pill.style.transform = 'translateX(0)';
      pill.style.width = btnAvant.offsetWidth + 'px';
      btnApres.classList.remove('actif');
      btnAvant.classList.add('actif');

      titre.innerHTML = 'Avant votre <em>première séance</em>';
      sub.textContent = 'Ce que vous devez savoir, ce que vous allez ressentir, et comment vous préparer pour en tirer le meilleur.';
      ctaEyebrow.textContent = 'Prochaine étape';
      ctaTitre.innerHTML = 'Prête à réserver <em>votre première séance ?</em>';
      ctaSub.textContent = 'La séance Initiale dure 1h30. Elle comprend le bilan, le drainage complet et le débriefing.';
      ctaBtnMain.textContent = "Réserver l'Initiale — 160 €";
      ctaBtnSec.textContent = 'Faire mon bilan d\'abord';
      ctaBtnSec.href = 'bilan';

      secApres.classList.add('hidden');
      secAvant.classList.remove('hidden');
      revealSection(secAvant);
    }
  }

  pill.style.width = btnAvant.offsetWidth + 'px';
  btnAvant.addEventListener('click', () => basculer('avant'));
  btnApres.addEventListener('click', () => basculer('apres'));
})();

// Page FAQ : accordéon + filtre par catégorie (inerte si absent de la page)
(function(){
  const items = document.querySelectorAll('.faq-item');
  if(!items.length) return;

  items.forEach(item => {
    const btn = item.querySelector('.faq-question');
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      item.classList.toggle('open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  const catBtns = document.querySelectorAll('.faq-cat-btn');
  const sections = document.querySelectorAll('.faq-section');
  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      catBtns.forEach(b => b.classList.toggle('actif', b === btn));
      sections.forEach(sec => {
        sec.hidden = !(cat === 'tout' || sec.dataset.cat === cat);
      });
    });
  });
})();
