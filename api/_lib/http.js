// Respostas JSON e tratamento de erro comum às rotas.
export const json = (dados, status = 200) => new Response(JSON.stringify(dados), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export async function protegido(fn) {
  try { return await fn(); }
  catch (e) {
    if (e.code === 'SEM_BANCO') { console.error(e.message); return json({ erro: 'A agenda está fora do ar. Fale com a barbearia.' }, 503); }
    console.error(e);
    return json({ erro: 'Algo deu errado. Tente de novo em instantes.' }, 500);
  }
}
