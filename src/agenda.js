// O agendamento: gaveta à direita em quatro passos (serviço, barbeiro, horário, dados) e a confirmação.
// Os serviços saem do cardápio do HTML; os barbeiros, os horários livres e a reserva vêm da API (/api, ver api/_config.js).
// Nada é cobrado: ao confirmar, a reserva é gravada e o barbeiro recebe o aviso no Telegram.
import gsap from 'gsap';
import { HORARIO, agora } from './secoes/horario.js';

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const TITULOS = ['Escolha o serviço', 'Escolha o barbeiro', 'Escolha o horário', 'Seus dados'];
const NOME_CASA = 'Barbearia 5 Irmãos';
const fmtHora = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const dataLonga = (d) => `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
const curta = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const chave = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const iniciais = (n) => n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
async function api(caminho, opcoes) {
  const r = await fetch(`/api/${caminho}`, opcoes);
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(dados.erro || 'Não deu certo. Tente de novo.'), { status: r.status });
  return dados;
}

export function agenda({ lenis }) {
  const raiz = document.querySelector('.agenda');
  const gaveta = raiz.querySelector('.agenda__gaveta');
  const veu = raiz.querySelector('.agenda__veu');
  const corpo = raiz.querySelector('[data-corpo]');
  const rotulo = raiz.querySelector('[data-passo-rotulo]');
  const titulo = raiz.querySelector('[data-passo-titulo]');
  const barra = raiz.querySelector('.agenda__barra i');
  const resumo = raiz.querySelector('[data-resumo]');
  const voltar = raiz.querySelector('[data-voltar]');
  const seguir = raiz.querySelector('[data-seguir]');
  const rodape = raiz.querySelector('.agenda__rodape');

  // dados lidos da página
  const servicos = [...document.querySelectorAll('.cardapio .linha')].map((l) => ({
    num: l.querySelector('.linha__num').textContent.trim(),
    nome: l.querySelector('.linha__nome strong').textContent.trim(),
    min: parseInt(l.querySelector('.linha__tempo').textContent, 10),
    preco: parseInt(l.querySelector('.linha__preco').textContent.replace(/\D/g, ''), 10),
    ferramenta: l.dataset.ferramenta,
  }));
  // barbeiros (api/_config.js): carregados uma vez; se falhar, tenta de novo quando o passo do barbeiro abrir
  let barbeiros = [], diasAFrente = 7, pedidoBarbeiros = null;
  const carregaBarbeiros = () => (pedidoBarbeiros ??= api('barbeiros').then((d) => { barbeiros = d.barbeiros; diasAFrente = d.diasAFrente; return d; }).catch((e) => { pedidoBarbeiros = null; throw e; }));
  carregaBarbeiros().catch(() => {});
  // s.barbeiro: 0 = primeira cadeira livre, n = barbeiros[n - 1]
  const idBarbeiro = () => (s.barbeiro ? barbeiros[s.barbeiro - 1].id : 'livre');

  const PASSOS = [0, 1, 2, 3];
  const s = { passo: 0, servico: null, barbeiro: null, dia: null, hora: null, nome: '', fone: '', aviso: '' };
  let gatilho = null, aberta = false;

  /* ---------- abrir e fechar ---------- */
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-agendar]');
    if (!b) return;
    ev.preventDefault();
    gatilho = b;
    const sv = b.dataset.agendar, com = b.dataset.com;
    Object.assign(s, { servico: sv !== '' && sv != null ? Number(sv) : null, barbeiro: com != null ? Number(com) + 1 : null, dia: null, hora: null, aviso: '' });
    abre(s.servico == null ? 0 : s.barbeiro == null ? 1 : 2);
  });
  raiz.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fecha));
  addEventListener('keydown', (ev) => {
    if (!aberta) return;
    if (ev.key === 'Escape') fecha();
    if (ev.key === 'Tab') prende(ev);
  });

  function abre(passo) {
    aberta = true;
    raiz.hidden = false;
    lenis?.stop();
    document.documentElement.classList.add('agenda-aberta');
    vai(passo, false);
    gsap.fromTo(veu, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
    gsap.fromTo(gaveta, { xPercent: 100 }, { xPercent: 0, duration: 0.75, ease: 'pf-out', onComplete: () => gaveta.querySelector('.agenda__fechar').focus({ preventScroll: true }) });
  }
  function fecha() {
    if (!aberta) return;
    aberta = false;
    gsap.to(veu, { opacity: 0, duration: 0.4, ease: 'power2.in' });
    gsap.to(gaveta, { xPercent: 100, duration: 0.5, ease: 'pf-in', onComplete: () => { raiz.hidden = true; document.documentElement.classList.remove('agenda-aberta'); lenis?.start(); gatilho?.focus({ preventScroll: true }); } });
  }
  function prende(ev) {
    const foco = [...gaveta.querySelectorAll('button:not([disabled]), input, a[href]')].filter((el) => el.offsetParent !== null);
    if (!foco.length) return;
    const [primeiro, ultimo] = [foco[0], foco.at(-1)];
    if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
  }

  /* ---------- passos ---------- */
  voltar.addEventListener('click', () => vai(PASSOS[Math.max(0, PASSOS.indexOf(s.passo) - 1)]));
  seguir.addEventListener('click', () => {
    if (s.passo === 3) return paga();
    vai(PASSOS[PASSOS.indexOf(s.passo) + 1]);
  });

  function vai(passo, animado = true) {
    const dir = passo >= s.passo ? 1 : -1;
    s.passo = passo;
    const monta = () => {
      corpo.innerHTML = '';
      corpo.scrollTop = 0;
      [servico, barbeiro, horario, dados][passo]();
      const n = PASSOS.indexOf(passo) + 1;
      rotulo.textContent = `Passo ${n} de ${PASSOS.length}`;
      titulo.textContent = TITULOS[passo];
      barra.style.width = `${(n / PASSOS.length) * 100}%`;
      voltar.hidden = passo === 0;
      rodape.hidden = false;
      atualiza();
    };
    if (!animado) { monta(); return; }
    gsap.timeline()
      .to([corpo, titulo], { x: -24 * dir, opacity: 0, duration: 0.22, ease: 'pf-in' })
      .add(monta)
      .fromTo([titulo, corpo], { x: 30 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: 'pf-out', stagger: 0.04 });
  }

  function atualiza() {
    const sv = servicos[s.servico], bb = s.barbeiro == null ? null : s.barbeiro === 0 ? { nome: 'Primeira livre' } : barbeiros[s.barbeiro - 1];
    const partes = [];
    if (sv) partes.push(sv.nome, `R$ ${sv.preco}`);
    if (bb) partes.push(bb.nome);
    if (s.dia && s.hora != null) partes.push(`${curta(s.dia)} ${fmtHora(s.hora)}`);
    resumo.textContent = partes.length ? partes.join(' · ') : 'Nada escolhido ainda';
    const pode = [s.servico != null, s.barbeiro != null, s.dia && s.hora != null, valido()][s.passo];
    seguir.disabled = !pode;
    seguir.querySelector('.botao__txt')?.setAttribute('data-txt', s.passo === 3 ? 'Confirmar agendamento' : 'Continuar');
    const txt = seguir.querySelector('.botao__txt > span');
    if (txt) txt.textContent = s.passo === 3 ? 'Confirmar agendamento' : 'Continuar';
  }

  const opcao = (html, on, ao) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opcao';
    b.innerHTML = html;
    b.setAttribute('aria-pressed', String(on));
    if (on) b.classList.add('is-on');
    b.addEventListener('click', ao);
    corpo.append(b);
    return b;
  };

  function servico() {
    servicos.forEach((sv, i) => {
      opcao(`<img src="${import.meta.env.BASE_URL}img/ferramentas/${sv.ferramenta}.webp" alt="" class="opcao__icone"><span class="opcao__nome">${sv.num} ${sv.nome}<small class="mono">${sv.min} min</small></span><span class="opcao__preco">R$ ${sv.preco}</span>`,
        s.servico === i, () => { if (s.servico !== i) s.hora = null; s.servico = i; marca(i); atualiza(); });
    });
  }
  function barbeiro() {
    const carregando = document.createElement('div');
    carregando.className = 'carregando';
    carregando.innerHTML = '<i></i>';
    corpo.append(carregando);
    carregaBarbeiros().then(() => {
      if (s.passo !== 1) return;
      carregando.remove();
      const lista = [{ nome: 'Primeira cadeira livre', extra: 'quem estiver livre primeiro', livre: true }, ...barbeiros];
      lista.forEach((bb, i) => {
        const b = opcao(`<span class="opcao__avatar">${bb.livre ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' : `<b class="mono">${iniciais(bb.nome)}</b>`}</span><span class="opcao__nome">${bb.nome}<small class="mono">${bb.extra}</small></span><span class="opcao__seta" aria-hidden="true">→</span>`,
          s.barbeiro === i, () => { if (s.barbeiro !== i) s.hora = null; s.barbeiro = i; marca(i); atualiza(); setTimeout(() => s.passo === 1 && vai(2), 260); });
        gsap.from(b, { opacity: 0, y: 10, duration: 0.45, delay: i * 0.05, ease: 'pf-out' });
      });
    }).catch((e) => {
      if (s.passo !== 1) return;
      carregando.remove();
      falha(corpo, e.message, () => vai(1, false));
    });
  }
  // mensagem de erro com "Tentar de novo"
  function falha(onde, msg, deNovo) {
    const p = document.createElement('p');
    p.className = 'horas__vazio';
    p.innerHTML = `${msg} <button type="button" class="confirma__gerenciar mono">Tentar de novo</button>`;
    p.querySelector('button').addEventListener('click', deNovo);
    onde.append(p);
  }
  function horario() {
    const hoje = agora();
    const dias = Array.from({ length: diasAFrente }, (_, i) => { const d = new Date(hoje); d.setDate(d.getDate() + i); d.setHours(0, 0, 0, 0); return d; });
    if (!s.dia) s.dia = dias[0];
    const faixa = document.createElement('div');
    faixa.className = 'datas';
    dias.forEach((d, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'data';
      b.innerHTML = `<small class="mono">${i === 0 ? 'hoje' : DIAS[d.getDay()]}</small><b>${d.getDate()}</b>`;
      if (d.getTime() === s.dia.getTime()) b.classList.add('is-on');
      b.setAttribute('aria-label', dataLonga(d));
      b.addEventListener('click', () => { s.dia = d; s.hora = null; faixa.querySelectorAll('.data').forEach((x) => x.classList.toggle('is-on', x === b)); horas(); atualiza(); });
      faixa.append(b);
    });
    if (s.aviso) {
      const aviso = document.createElement('p');
      aviso.className = 'aviso-agenda';
      aviso.setAttribute('role', 'alert');
      aviso.innerHTML = `<strong>${s.aviso}</strong> Escolha outro horário.`;
      corpo.append(aviso);
      s.aviso = '';
    }
    corpo.append(faixa);
    const grade = document.createElement('div');
    grade.className = 'horas';
    corpo.append(grade);
    let pedido = 0;
    async function horas() {
      const meu = ++pedido;
      grade.innerHTML = '<div class="carregando" style="grid-column: 1 / -1"><i></i></div>';
      let livres;
      try {
        const q = new URLSearchParams({ barbeiro: idBarbeiro(), data: chave(s.dia), servico: servicos[s.servico].nome });
        livres = (await api(`horarios?${q}`)).horarios;
      } catch (e) {
        if (meu !== pedido) return;
        grade.innerHTML = '';
        return falha(grade, e.message, horas);
      }
      if (meu !== pedido || s.passo !== 2) return; // o cliente já trocou de dia ou de passo
      grade.innerHTML = '';
      for (const m of livres) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'hora';
        b.textContent = fmtHora(m);
        if (s.hora === m) b.classList.add('is-on');
        b.addEventListener('click', () => { s.hora = m; grade.querySelectorAll('.hora').forEach((x) => x.classList.toggle('is-on', x === b)); atualiza(); });
        grade.append(b);
      }
      if (s.hora != null && !livres.includes(s.hora)) { s.hora = null; atualiza(); }
      if (!livres.length) grade.innerHTML = '<p class="horas__vazio">Nenhum horário livre nesse dia. Escolha outro ali em cima.</p>';
      gsap.from(grade.children, { opacity: 0, y: 6, duration: 0.35, stagger: 0.008, ease: 'pf-out' });
    }
    horas();
  }
  function dados() {
    const campo = (id, rotuloTxt, attrs, valor, mascara) => {
      const w = document.createElement('label');
      w.className = 'campo';
      w.innerHTML = `<span class="mono">${rotuloTxt}</span><input id="${id}" ${attrs} value="${valor}"><em class="campo__erro mono" aria-live="polite"></em>`;
      const input = w.querySelector('input');
      input.addEventListener('input', () => { if (mascara) input.value = mascara(input.value); s[id] = input.value; w.classList.remove('is-erro'); w.classList.toggle('is-cheio', !!input.value); atualiza(); });
      input.addEventListener('blur', () => checa(w, id));
      if (valor) w.classList.add('is-cheio');
      corpo.append(w);
      return input;
    };
    const fone = (v) => { const d = v.replace(/\D/g, '').slice(0, 11); return d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d; };
    campo('nome', 'Nome', 'type="text" autocomplete="name" placeholder="Como chamamos você"', s.nome).focus?.();
    campo('fone', 'Celular com WhatsApp', 'type="tel" inputmode="numeric" autocomplete="tel" placeholder="(00) 00000-0000"', s.fone, fone);
    const aviso = document.createElement('p');
    aviso.className = 'aviso-agenda';
    aviso.innerHTML = '<strong>Nada é cobrado agora.</strong> Você paga na cadeira, depois do corte. Ao confirmar, o horário fica reservado e o barbeiro recebe o aviso na hora.';
    aviso.dataset.aviso = '';
    corpo.append(aviso);
  }
  function checa(w, id) {
    const erro = { nome: s.nome.trim().length < 2 ? 'Escreva seu nome' : '', fone: s.fone.replace(/\D/g, '').length < 10 ? 'Celular com DDD' : '' }[id];
    w.classList.toggle('is-erro', !!erro && !!s[id]);
    w.querySelector('.campo__erro').textContent = s[id] ? erro : '';
  }
  const valido = () => s.nome.trim().length > 1 && s.fone.replace(/\D/g, '').length >= 10;

  function marca(i) { corpo.querySelectorAll('.opcao').forEach((b, k) => { b.classList.toggle('is-on', k === i); b.setAttribute('aria-pressed', String(k === i)); }); }

  /* ---------- confirmar: grava a reserva (a API avisa o barbeiro no Telegram) ---------- */
  async function paga() {
    seguir.disabled = true;
    seguir.classList.add('is-pagando');
    const sv = servicos[s.servico];
    try {
      const r = await api('agendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barbeiro: idBarbeiro(), data: chave(s.dia), hora: s.hora, servico: sv.nome, nome: s.nome.trim(), fone: s.fone }),
      });
      seguir.classList.remove('is-pagando');
      confirma(r);
    } catch (e) {
      seguir.classList.remove('is-pagando');
      if (e.status === 409) { s.hora = null; s.aviso = e.message; return vai(2); }
      const aviso = corpo.querySelector('[data-aviso]');
      if (aviso) aviso.innerHTML = `<strong>${e.message}</strong>`;
      atualiza();
    }
  }
  function confirma(r) {
    const sv = servicos[s.servico];
    const bb = r.barbeiro;
    const quando = new Date(s.dia); quando.setHours(Math.floor(s.hora / 60), s.hora % 60);
    rotulo.textContent = 'Confirmado';
    titulo.textContent = 'Horário marcado';
    barra.style.width = '100%';
    rodape.hidden = true;
    corpo.innerHTML = `
      <svg class="confirma__marca" viewBox="0 0 48 20" aria-hidden="true"><use href="#marca"/></svg>
      <dl class="confirma__lista">
        <div><dt class="mono">Serviço</dt><dd>${sv.nome} · ${sv.min} min</dd></div>
        <div><dt class="mono">Barbeiro</dt><dd>${bb.nome}</dd></div>
        <div><dt class="mono">Quando</dt><dd>${dataLonga(quando)}, ${fmtHora(s.hora)}</dd></div>
        <div><dt class="mono">Valor</dt><dd>R$ ${sv.preco} · pago na cadeira</dd></div>
      </dl>
      <p class="confirma__msg">Seu horário está reservado e o barbeiro já foi avisado. Se precisar falar com você, ele chama no WhatsApp ${s.fone}. Se não puder vir, avise a barbearia para liberar o horário.</p>
      <div class="confirma__botoes">
        <button class="botao botao--claro botao--pequeno" type="button" data-ics>Adicionar à agenda</button>
      </div>
      <div class="confirma__pe"><p class="mono">Nada foi cobrado · pagamento na cadeira</p><button class="botao botao--claro botao--pequeno" type="button" data-fechar>Pronto</button></div>`;
    for (const b of corpo.querySelectorAll('.botao')) { const t = b.textContent.trim(); b.innerHTML = `<span class="botao__txt" data-txt="${t}"><span>${t}</span></span>`; }
    corpo.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); fecha(); }));
    corpo.querySelector('[data-ics]').addEventListener('click', () => ics(sv, bb, quando));
    gsap.timeline()
      .fromTo(corpo.querySelector('.confirma__marca'), { clipPath: 'inset(0 100% 0 0)', x: -10 }, { clipPath: 'inset(0 0% 0 0)', x: 0, duration: 0.9, ease: 'pf-io' })
      .from(corpo.querySelectorAll('.confirma__lista > div, .confirma__msg, .confirma__botoes, .confirma__pe'), { opacity: 0, y: 14, duration: 0.6, stagger: 0.07, ease: 'pf-out' }, 0.2);
  }
  function ics(sv, bb, quando) {
    const fim = new Date(quando.getTime() + sv.min * 60000);
    const z = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Barbearia 5 Irmaos//Agenda//PT', 'BEGIN:VEVENT', `UID:${Date.now()}@barbearia5irmaos`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(quando)}`, `DTEND:${z(fim)}`, `SUMMARY:${sv.nome}${bb ? ` com ${bb.nome}` : ''} · ${NOME_CASA}`, `LOCATION:${NOME_CASA}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar' }));
    a.download = 'barbearia-5-irmaos.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
}
