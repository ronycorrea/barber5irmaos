// A lupa dos cortes: uma bola que anda sobre a foto e mostra a versão grande (corte-N-zoom.webp) ampliada.
// Mouse: aparece ao entrar na foto e segue o cursor com uma mola curta.
// Toque: um toque abre a lupa no ponto, arrastar o dedo anda pela foto (sem rolar a página), outro toque fecha.
import gsap from 'gsap';

const ZOOM = 2.4;

export function lupa(foto) {
  const img = foto.querySelector('.corte__frente');
  const lente = document.createElement('span');
  lente.className = 'lupa';
  lente.setAttribute('aria-hidden', 'true');
  foto.append(lente);

  let carregada = false, aberta = false, rodando = false;
  let toque = null; // { x, y, moveu, abriu } durante um toque
  const pos = { x: 0, y: 0 }, alvo = { x: 0, y: 0 };

  // a foto grande só baixa quando alguém chega perto; até lá, a lente usa a própria foto do card
  function carrega() {
    if (carregada) return;
    carregada = true;
    const base = img.currentSrc || img.src;
    lente.style.backgroundImage = `url("${base}")`;
    const grande = base.replace('-frente.', '-zoom.');
    const pre = new Image();
    pre.onload = () => { lente.style.backgroundImage = `url("${grande}")`; };
    pre.src = grande;
  }

  const ponto = (e) => { const r = foto.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  function desenha() {
    pos.x += (alvo.x - pos.x) * 0.32;
    pos.y += (alvo.y - pos.y) * 0.32;
    const w = foto.clientWidth, h = foto.clientHeight, L = lente.offsetWidth;
    lente.style.transform = `translate3d(${(pos.x - L / 2).toFixed(1)}px, ${(pos.y - L / 2).toFixed(1)}px, 0)`;
    lente.style.backgroundSize = `${w * ZOOM}px ${h * ZOOM}px`;
    lente.style.backgroundPosition = `${(L / 2 - pos.x * ZOOM).toFixed(1)}px ${(L / 2 - pos.y * ZOOM).toFixed(1)}px`;
  }

  function abre(p) {
    carrega();
    Object.assign(alvo, p);
    Object.assign(pos, p);
    aberta = true;
    foto.classList.add('is-lupa');
    if (!rodando) { gsap.ticker.add(desenha); rodando = true; }
    desenha();
  }
  function fecha() {
    aberta = false;
    foto.classList.remove('is-lupa');
    // deixa a lente terminar de sumir antes de parar o desenho
    setTimeout(() => { if (!aberta && rodando) { gsap.ticker.remove(desenha); rodando = false; } }, 400);
  }

  /* ---------- mouse ---------- */
  foto.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') abre(ponto(e)); });
  foto.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') { if (!aberta) abre(ponto(e)); Object.assign(alvo, ponto(e)); return; }
    if (toque && aberta) {
      const p = ponto(e);
      if (Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 8) toque.moveu = true;
      Object.assign(alvo, p);
    }
  });
  foto.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') fecha(); });

  /* ---------- toque ---------- */
  foto.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    toque = { x: e.clientX, y: e.clientY, moveu: false, abriu: !aberta };
    if (!aberta) abre(ponto(e)); else Object.assign(alvo, ponto(e));
  });
  foto.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'mouse' || !toque) return;
    if (!toque.abriu && !toque.moveu) fecha();
    toque = null;
  });
  foto.addEventListener('pointercancel', () => { toque = null; });
  // tocar fora da foto, ou ela sair da tela, fecha a lupa
  document.addEventListener('pointerdown', (e) => { if (aberta && e.pointerType !== 'mouse' && !foto.contains(e.target)) fecha(); });
  new IntersectionObserver(([en]) => { if (!en.isIntersecting && aberta) fecha(); }).observe(foto);
}
