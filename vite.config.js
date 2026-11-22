import { defineConfig, loadEnv } from 'vite';

// No computador (npm run dev), o próprio Vite responde as rotas /api/* com os mesmos arquivos que a Vercel publica
// como funções. Assim dá para testar a agenda sem instalar mais nada. Na Vercel, a pasta /api vira funções sozinha.
function api() {
  return {
    name: 'api-local',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        const rota = url.pathname.match(/^\/api\/([a-z-]+)\/?$/)?.[1];
        if (!rota) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${rota}.js`);
          const fn = mod[req.method];
          if (!fn) { res.statusCode = 405; return res.end('método não permitido'); }
          const partes = [];
          for await (const p of req) partes.push(p);
          const corpo = partes.length ? Buffer.concat(partes) : undefined;
          const resposta = await fn(new Request(url, { method: req.method, headers: req.headers, body: corpo }));
          res.statusCode = resposta.status;
          resposta.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await resposta.arrayBuffer()));
        } catch (e) {
          if (e.code === 'ERR_LOAD_URL' || /Failed to load url/.test(e.message)) return next();
          console.error(e);
          res.statusCode = 500;
          res.end('erro');
        }
      });
    },
  };
}

// base relativa: o dist/ abre em qualquer pasta da hospedagem, não só na raiz do domínio
export default defineConfig(({ mode }) => {
  // as variáveis do .env / .env.local (Supabase, WhatsApp) para as rotas /api no computador
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { base: './', plugins: [api()] };
});
