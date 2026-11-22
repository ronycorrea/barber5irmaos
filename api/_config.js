// ============================================================================
// CONFIGURAÇÃO DA AGENDA: o único arquivo que precisa mudar quando os dados reais chegarem.
// ⚠ DADOS DE TESTE (provisórios). Trocar pelos barbeiros, números e horários de verdade.
// ============================================================================

// Fuso da barbearia: Manaus, UTC-4 o ano todo (o Brasil não tem mais horário de verão).
export const FUSO = '-04:00';

// Grade: de quantos em quantos minutos os horários começam.
export const GRADE_MIN = 20;
// Até quantos dias à frente o cliente pode agendar (7 = hoje + 6 dias).
export const DIAS_A_FRENTE = 7;
// Antecedência mínima, em minutos, para agendar um horário de hoje.
export const ANTECEDENCIA_MIN = 20;
// Quantos agendamentos futuros um mesmo celular pode ter ao mesmo tempo (contra quem lota a agenda de brincadeira).
export const MAX_POR_CLIENTE = 2;

// Endereço do site (vai na mensagem de cancelamento, para o cliente remarcar).
export const SITE_URL = 'https://barbearia5irmaos.vercel.app';
// WhatsApp para o cliente falar com a barbearia (o número da API só envia avisos e não é lido por ninguém).
export const CONTATO_BARBEARIA = '5592991004747';

// Barbeiros. `id`: curto, sem espaço e sem acento, e nunca muda depois de entrar no ar (fica gravado nos agendamentos).
// `whatsapp`: 55 + DDD + número, só dígitos. `expediente`: por dia da semana (0 = domingo … 6 = sábado), a lista
// de turnos ['entrada', 'saída']. O almoço é o buraco entre dois turnos. Dia que não aparece = folga fixa.
export const BARBEIROS = [
  {
    id: 'barbeiro1',
    nome: 'Barbeiro 1', // ⚠ trocar pelo nome real
    extra: 'seg a sex · 9h às 18h',
    whatsapp: '5592991004747', // ⚠ número de teste
    expediente: {
      1: [['09:00', '12:00'], ['13:00', '18:00']],
      2: [['09:00', '12:00'], ['13:00', '18:00']],
      3: [['09:00', '12:00'], ['13:00', '18:00']],
      4: [['09:00', '12:00'], ['13:00', '18:00']],
      5: [['09:00', '12:00'], ['13:00', '18:00']],
    },
  },
  {
    id: 'barbeiro2',
    nome: 'Barbeiro 2', // ⚠ trocar pelo nome real
    extra: 'ter a sáb · 12h às 21h',
    whatsapp: '5592991004747', // mesmo número: é teste
    expediente: {
      2: [['12:00', '21:00']],
      3: [['12:00', '21:00']],
      4: [['12:00', '21:00']],
      5: [['12:00', '21:00']],
      6: [['12:00', '21:00']],
    },
  },
];

// Serviços: o nome, a duração e o preço têm que bater com o cardápio do index.html (.cardapio .linha).
// O servidor usa esta lista (e não o que o navegador manda) para saber quanto tempo o horário ocupa e quanto custa.
export const SERVICOS = [
  { nome: 'Corte social', min: 30, preco: 20 },
  { nome: 'Corte degradê', min: 40, preco: 25 },
  { nome: 'Corte low fade', min: 40, preco: 30 },
  { nome: 'Corte americano', min: 40, preco: 30 },
  { nome: 'Corte do Jaca', min: 40, preco: 30 },
  { nome: 'Barba', min: 30, preco: 25 },
];
