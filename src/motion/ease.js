// Curvas da marca e o que a página sabe do aparelho.
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

CustomEase.create('pf-out', '0.22, 1, 0.36, 1');
CustomEase.create('pf-in', '0.64, 0, 0.78, 0');
CustomEase.create('pf-io', '0.76, 0, 0.24, 1');

export const REDUZIDO = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const TOQUE = matchMedia('(hover: none)').matches;
export const CELULAR = () => innerWidth <= 760;
// 3D no celular: sem antialias (o mais caro da placa de vídeo) e resolução menor; no computador, como antes
export const GL_LEVE = TOQUE || innerWidth <= 760;
export const pixelGL = () => Math.min(devicePixelRatio, GL_LEVE ? 1.25 : 2);
// no celular, a barra de endereço some e volta ao rolar e dispara "resize" só na altura: recriar o 3D a cada vez trava.
// Só refaz quando a largura muda (girar o aparelho) ou, no computador, sempre.
export function aoRedimensionar(fn) {
  let largura = innerWidth, altura = innerHeight;
  addEventListener('resize', () => {
    const mudouLargura = innerWidth !== largura;
    if (TOQUE && !mudouLargura && Math.abs(innerHeight - altura) < 160) return;
    largura = innerWidth; altura = innerHeight;
    fn();
  });
}

// a altura das cenas presas é 100svh (a tela com as barras do navegador abertas): medir pelo innerHeight mudaria o
// tamanho das peças quando a barra do Safari some no meio da rolagem
const regua = document.createElement('div');
regua.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
document.body.append(regua);
export const alturaTela = () => regua.offsetHeight || innerHeight;
// a unidade de cena, a mesma conta do --u do CSS (tokens.css)
export const unidade = (vw = innerWidth, vh = alturaTela()) => (vw <= 760 ? Math.min(vw / 390, vh / 844) : Math.min(vw / 1440, vh / 900));

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const faixa = (v, a, b) => clamp((v - a) / (b - a));
export const suave = (t) => t * t * (3 - 2 * t);
