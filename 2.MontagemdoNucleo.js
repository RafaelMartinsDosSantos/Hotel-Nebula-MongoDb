// ============================================================
// Hotel Nebula - Parte 2: Montagem do Núcleo
// Execução: mongosh < 02_insercao.js   (ou: mongosh --file 02_insercao.js)
// Pode ser rodado várias vezes: o script recria o banco do zero.
// ============================================================

const dbn = db.getSiblingDB("hotel_nebula");
dbn.dropDatabase();

// ------------------------------------------------------------
// 1. Criação das coleções (com validação mínima de schema)
// ------------------------------------------------------------
dbn.createCollection("hospedes", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["nome", "cpf", "email", "ativo"],
    properties: {
      nome: { bsonType: "string" },
      cpf: { bsonType: "string" },
      email: { bsonType: "string" },
      ativo: { bsonType: "bool" }
    }
  }}
});
dbn.createCollection("quartos", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["numero", "tipo", "preco_diaria", "status"],
    properties: {
      preco_diaria: { bsonType: ["double", "int"], minimum: 0 },
      status: { enum: ["disponivel", "ocupado", "manutencao", "limpeza"] },
      comodidades: { bsonType: "array" }
    }
  }}
});
dbn.createCollection("reservas", {
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["hospede_id", "quarto_id", "data_checkin", "data_checkout", "status"],
    properties: {
      status: { enum: ["confirmada", "concluida", "cancelada", "pendente"] }
    }
  }}
});
["hospedagens", "pagamentos", "funcionarios", "servicos", "feedbacks"].forEach(c => dbn.createCollection(c));

// ------------------------------------------------------------
// 2. Funcionários
// ------------------------------------------------------------
const fnc = [
  { _id: new ObjectId(), nome: "Juliana Martins", cpf: "987.654.321-11", email: "juliana.martins@hotelnebula.com",
    telefone: "+55 21 99123-4567", cargo: "recepcionista", departamento: "recepção",
    turno: { tipo: "manha", entrada: "07:00", saida: "15:00" },
    permissoes: ["checkin", "checkout", "reservas_visualizar", "reservas_editar"],
    data_admissao: ISODate("2022-08-01"), salario: 3200.00, ativo: true },
  { _id: new ObjectId(), nome: "Rafael Souza", cpf: "321.654.987-22", email: "rafael.souza@hotelnebula.com",
    telefone: "+55 11 98888-1111", cargo: "recepcionista", departamento: "recepção",
    turno: { tipo: "tarde", entrada: "15:00", saida: "23:00" },
    permissoes: ["checkin", "checkout", "reservas_visualizar"],
    data_admissao: ISODate("2023-02-10"), salario: 3100.00, ativo: true },
  { _id: new ObjectId(), nome: "Marta Lima", cpf: "111.222.333-44", email: "marta.lima@hotelnebula.com",
    telefone: "+55 11 97777-2222", cargo: "gerente", departamento: "gestão",
    turno: { tipo: "comercial", entrada: "09:00", saida: "18:00" },
    permissoes: ["checkin", "checkout", "reservas_visualizar", "reservas_editar", "relatorios", "feedbacks_responder"],
    data_admissao: ISODate("2020-05-18"), salario: 8500.00, ativo: true }
];
dbn.funcionarios.insertMany(fnc);

// ------------------------------------------------------------
// 3. Serviços (catálogo)
// ------------------------------------------------------------
const svc = {
  cafe:   { _id: new ObjectId(), nome: "Café da manhã", categoria: "alimentacao", descricao: "Café da manhã completo no restaurante do hotel.",
            preco: 45.00, unidade: "pessoa", disponivel: true, horario_disponivel: { inicio: "06:30", fim: "10:30" },
            tags: ["buffet", "opcao_vegana"] },
  lav:    { _id: new ObjectId(), nome: "Lavanderia", categoria: "conveniencia", descricao: "Lavagem e passadoria de roupas.",
            preco: 80.00, unidade: "pacote", disponivel: true, horario_disponivel: { inicio: "08:00", fim: "18:00" },
            tags: ["expresso_disponivel"] },
  mini:   { _id: new ObjectId(), nome: "Minibar", categoria: "alimentacao", descricao: "Itens do frigobar do quarto.",
            preco: 25.00, unidade: "item", disponivel: true, horario_disponivel: { inicio: "00:00", fim: "23:59" },
            tags: ["24h"] },
  spa:    { _id: new ObjectId(), nome: "Massagem relaxante", categoria: "bem-estar", descricao: "Sessão de 50 minutos no spa.",
            preco: 180.00, unidade: "sessao", disponivel: true, horario_disponivel: { inicio: "10:00", fim: "20:00" },
            tags: ["spa", "agendamento"] },
  transf: { _id: new ObjectId(), nome: "Transfer aeroporto", categoria: "transporte", descricao: "Traslado aeroporto-hotel.",
            preco: 120.00, unidade: "viagem", disponivel: true, horario_disponivel: { inicio: "00:00", fim: "23:59" },
            tags: ["agendamento"] }
};
dbn.servicos.insertMany(Object.values(svc));

// ------------------------------------------------------------
// 4. Quartos (características variáveis: comodidades em array,
//    características em subdocumento)
// ------------------------------------------------------------
const q = [
  { _id: new ObjectId(), numero: "101", andar: 1, tipo: "standard", categoria: "economico", capacidade_max: 2, preco_diaria: 250.00,
    descricao: "Quarto padrão com vista para o jardim interno.",
    comodidades: ["ar-condicionado", "tv 42\"", "frigobar", "wifi", "cofre"],
    caracteristicas: { vista: "jardim", banheira: false, varanda: false, area_m2: 28 },
    status: "disponivel", fotos: ["https://storage.hotelnebula.com/quartos/101/foto1.jpg"], ultima_limpeza: ISODate("2025-03-31T08:00:00Z") },
  { _id: new ObjectId(), numero: "102", andar: 1, tipo: "standard", categoria: "economico", capacidade_max: 3, preco_diaria: 280.00,
    descricao: "Quarto padrão com cama extra, vista para a rua.",
    comodidades: ["ar-condicionado", "tv 42\"", "frigobar", "wifi"],
    caracteristicas: { vista: "rua", banheira: false, varanda: false, area_m2: 30 },
    status: "disponivel", fotos: [], ultima_limpeza: ISODate("2025-03-31T09:00:00Z") },
  { _id: new ObjectId(), numero: "201", andar: 2, tipo: "superior", categoria: "conforto", capacidade_max: 2, preco_diaria: 420.00,
    descricao: "Quarto superior com varanda e vista para o mar.",
    comodidades: ["ar-condicionado", "tv 50\"", "frigobar", "wifi", "cofre", "cafeteira"],
    caracteristicas: { vista: "mar", banheira: false, varanda: true, area_m2: 36 },
    status: "disponivel", fotos: [], ultima_limpeza: ISODate("2025-03-31T10:00:00Z") },
  { _id: new ObjectId(), numero: "202", andar: 2, tipo: "superior", categoria: "conforto", capacidade_max: 2, preco_diaria: 450.00,
    descricao: "Quarto superior com banheira de hidromassagem.",
    comodidades: ["ar-condicionado", "tv 50\"", "frigobar", "wifi", "cofre", "banheira de hidromassagem"],
    caracteristicas: { vista: "piscina", banheira: true, varanda: false, area_m2: 38 },
    status: "disponivel", fotos: [], ultima_limpeza: ISODate("2025-03-31T10:30:00Z") },
  { _id: new ObjectId(), numero: "301", andar: 3, tipo: "suite", categoria: "luxo", capacidade_max: 4, preco_diaria: 780.00,
    descricao: "Suíte de luxo com vista panorâmica para o mar, banheira e varanda.",
    comodidades: ["ar-condicionado", "tv 65\"", "frigobar", "wifi", "cofre", "cafeteira", "banheira", "sala de estar"],
    caracteristicas: { vista: "mar", banheira: true, varanda: true, area_m2: 65, cama: "king" },
    status: "disponivel", fotos: [], ultima_limpeza: ISODate("2025-03-31T11:00:00Z") },
  { _id: new ObjectId(), numero: "302", andar: 3, tipo: "suite", categoria: "luxo", capacidade_max: 4, preco_diaria: 720.00,
    descricao: "Suíte de luxo com vista para a cidade.",
    comodidades: ["ar-condicionado", "tv 65\"", "frigobar", "wifi", "cofre", "banheira", "escritorio"],
    caracteristicas: { vista: "cidade", banheira: true, varanda: true, area_m2: 60, cama: "king" },
    status: "manutencao", fotos: [], ultima_limpeza: ISODate("2025-03-30T11:00:00Z") },
  { _id: new ObjectId(), numero: "401", andar: 4, tipo: "cobertura", categoria: "luxo", capacidade_max: 5, preco_diaria: 1500.00,
    descricao: "Cobertura com piscina privativa e vista para o mar.",
    comodidades: ["ar-condicionado", "tv 75\"", "frigobar", "wifi", "cofre", "banheira", "piscina privativa", "mordomo"],
    caracteristicas: { vista: "mar", banheira: true, varanda: true, area_m2: 120, piscina_privativa: true },
    status: "disponivel", fotos: [], ultima_limpeza: ISODate("2025-03-31T12:00:00Z") }
];
dbn.quartos.insertMany(q);

// ------------------------------------------------------------
// 5. Hóspedes
// ------------------------------------------------------------
const h = [
  { _id: new ObjectId(), nome: "Carlos Andrade", cpf: "123.456.789-00", email: "carlos.andrade@email.com", telefone: "+55 11 98765-4321",
    data_nascimento: ISODate("1985-03-22"), nacionalidade: "Brasileiro",
    endereco: { logradouro: "Rua das Palmeiras, 142", cidade: "São Paulo", estado: "SP", cep: "01310-100", pais: "Brasil" },
    preferencias: { tipo_quarto: "suite", andar_alto: true, fumante: false, cama: "king" },
    data_cadastro: ISODate("2024-01-15T10:30:00Z"), ativo: true },
  { _id: new ObjectId(), nome: "Ana Beatriz Rocha", cpf: "222.333.444-55", email: "ana.rocha@email.com", telefone: "+55 21 99888-7766",
    data_nascimento: ISODate("1992-07-09"), nacionalidade: "Brasileira",
    endereco: { logradouro: "Av. Atlântica, 900", cidade: "Rio de Janeiro", estado: "RJ", cep: "22021-001", pais: "Brasil" },
    preferencias: { tipo_quarto: "superior", andar_alto: false, fumante: false },
    data_cadastro: ISODate("2024-03-02T09:00:00Z"), ativo: true },
  { _id: new ObjectId(), nome: "John Miller", cpf: "000.000.000-00", email: "john.miller@mail.com", telefone: "+1 415 555 0132",
    data_nascimento: ISODate("1979-11-30"), nacionalidade: "Americano",
    endereco: { logradouro: "245 Market St", cidade: "San Francisco", estado: "CA", cep: "94105", pais: "EUA" },
    preferencias: { tipo_quarto: "cobertura", fumante: false, idioma: "en", travesseiro_extra: true },
    data_cadastro: ISODate("2024-06-20T15:10:00Z"), ativo: true },
  { _id: new ObjectId(), nome: "Fernanda Costa", cpf: "555.666.777-88", email: "fernanda.costa@email.com", telefone: "+55 31 99777-1234",
    data_nascimento: ISODate("1988-01-14"), nacionalidade: "Brasileira",
    endereco: { logradouro: "Rua da Bahia, 1200", cidade: "Belo Horizonte", estado: "MG", cep: "30160-011", pais: "Brasil" },
    preferencias: { tipo_quarto: "standard", andar_alto: false, fumante: false },
    data_cadastro: ISODate("2024-09-05T18:45:00Z"), ativo: true },
  { _id: new ObjectId(), nome: "Pedro Henrique Lopes", cpf: "999.888.777-66", email: "pedro.lopes@email.com", telefone: "+55 41 98555-9090",
    data_nascimento: ISODate("1995-05-27"), nacionalidade: "Brasileiro",
    endereco: { logradouro: "Rua XV de Novembro, 50", cidade: "Curitiba", estado: "PR", cep: "80020-310", pais: "Brasil" },
    preferencias: { tipo_quarto: "standard" },
    data_cadastro: ISODate("2025-01-10T12:00:00Z"), ativo: true },
  { _id: new ObjectId(), nome: "Sofia Martínez", cpf: "444.555.666-77", email: "sofia.martinez@mail.com", telefone: "+54 11 5555-1010",
    data_nascimento: ISODate("1990-12-03"), nacionalidade: "Argentina",
    endereco: { logradouro: "Av. Corrientes 1234", cidade: "Buenos Aires", estado: "CABA", cep: "C1043", pais: "Argentina" },
    preferencias: { tipo_quarto: "suite", andar_alto: true, idioma: "es" },
    data_cadastro: ISODate("2025-02-18T08:30:00Z"), ativo: true }
];
dbn.hospedes.insertMany(h);

// ------------------------------------------------------------
// 6. Reservas -> Hospedagens -> Pagamentos -> Feedbacks
//    Gerados por código para manter consistência entre coleções
//    [hóspede, quarto, check-in, noites, nº hóspedes, status, canal, funcionário]
// ------------------------------------------------------------
const plano = [
  [0, 0, "2025-01-10", 3, 2, "concluida", "site_proprio", 0],
  [1, 2, "2025-01-24", 2, 2, "concluida", "booking",      1],
  [2, 6, "2025-02-14", 5, 3, "concluida", "site_proprio", 0],
  [0, 4, "2025-02-21", 2, 2, "concluida", "telefone",     1],
  [3, 1, "2025-03-07", 3, 2, "concluida", "booking",      0],
  [5, 4, "2025-03-28", 4, 3, "concluida", "site_proprio", 1],
  [0, 0, "2025-04-10", 4, 2, "concluida", "site_proprio", 0],
  [1, 3, "2025-04-18", 3, 2, "concluida", "booking",      1],
  [4, 1, "2025-04-25", 2, 2, "concluida", "telefone",     0],
  [2, 6, "2025-05-09", 4, 4, "concluida", "site_proprio", 1],
  [3, 2, "2025-06-13", 2, 2, "concluida", "booking",      0],
  [5, 4, "2025-07-04", 5, 4, "concluida", "site_proprio", 1],
  [1, 2, "2025-07-18", 3, 2, "concluida", "site_proprio", 0],
  [0, 4, "2025-07-25", 3, 2, "concluida", "site_proprio", 1],
  [4, 0, "2025-08-15", 2, 1, "cancelada", "booking",      0],
  [2, 5, "2025-09-05", 3, 2, "concluida", "telefone",     1],
  [3, 3, "2025-10-10", 2, 2, "concluida", "booking",      0],
  [5, 6, "2025-12-26", 6, 4, "concluida", "site_proprio", 1],
  [0, 4, "2026-12-20", 5, 2, "confirmada", "site_proprio", 0]
];

const servicosPorEstadia = i => {
  const lista = [{ s: svc.cafe, mult: "hospedes" }];
  if (i % 2 === 0) lista.push({ s: svc.lav, qtd: 1 });
  if (i % 3 === 0) lista.push({ s: svc.mini, qtd: 3 });
  if (i % 4 === 0) lista.push({ s: svc.spa, qtd: 2 });
  if (i % 5 === 0) lista.push({ s: svc.transf, qtd: 1 });
  return lista;
};

const comentarios = [
  "Ótima estadia! Equipe atenciosa e quarto impecável.",
  "Vista incrível, café da manhã excelente.",
  "Bom custo-benefício, mas o wifi oscilou.",
  "Suíte maravilhosa, voltaremos com certeza.",
  "Atendimento rápido no check-in, quarto confortável.",
  "Ótima localização, só achei o barulho da rua um pouco alto."
];

const reservas = [], hospedagens = [], pagamentos = [], feedbacks = [];
let seq = 1;

plano.forEach((p, i) => {
  const [hi, qi, ci, noites, nh, status, canal, fi] = p;
  const hosp = h[hi], quarto = q[qi];
  const checkin = ISODate(ci);
  const checkout = new Date(checkin.getTime() + noites * 86400000);
  const criacao = new Date(checkin.getTime() - 14 * 86400000);
  const valorDiarias = noites * quarto.preco_diaria;

  const reserva = {
    _id: new ObjectId(),
    hospede_id: hosp._id,
    hospede_snapshot: { nome: hosp.nome, email: hosp.email, telefone: hosp.telefone },
    quarto_id: quarto._id,
    quarto_snapshot: { numero: quarto.numero, tipo: quarto.tipo, preco_diaria: quarto.preco_diaria },
    data_checkin: checkin,
    data_checkout: checkout,
    num_noites: noites,
    num_hospedes: nh,
    valor_total: valorDiarias,
    status: status,
    canal: canal,
    codigo_reserva: "HN-" + checkin.getUTCFullYear() + "-" + String(seq++).padStart(5, "0"),
    data_criacao: criacao,
    data_atualizacao: criacao
  };
  if (i === 6) reserva.observacoes = "Solicita berço para bebê.";
  if (status === "cancelada") reserva.motivo_cancelamento = "Mudança de planos do hóspede";
  reservas.push(reserva);

  if (status !== "concluida") return;

  // Hospedagem (check-in realizado) com serviços embutidos
  const servicos = servicosPorEstadia(i).map((x, k) => {
    const qtd = x.mult === "hospedes" ? nh * noites : x.qtd;
    return { servico_id: x.s._id, nome: x.s.nome, quantidade: qtd, preco_unitario: x.s.preco,
             total: qtd * x.s.preco, data: new Date(checkin.getTime() + (k + 1) * 3600000 * 10) };
  });
  const totalServicos = servicos.reduce((a, s) => a + s.total, 0);
  const hospedagem = {
    _id: new ObjectId(),
    reserva_id: reserva._id, hospede_id: hosp._id, quarto_id: quarto._id,
    checkin_real: new Date(checkin.getTime() + 14.5 * 3600000),
    checkout_real: new Date(checkout.getTime() + 11 * 3600000),
    status: "encerrada",
    funcionario_checkin_id: fnc[fi]._id,
    funcionario_checkout_id: fnc[(fi + 1) % 2]._id,
    servicos_consumidos: servicos,
    total_servicos: totalServicos,
    total_diarias: valorDiarias,
    total_geral: valorDiarias + totalServicos
  };
  hospedagens.push(hospedagem);

  // Pagamento: alterna cartão único e pagamento misto (cartão + pix)
  const total = hospedagem.total_geral;
  const parcelas = i % 2 === 0
    ? [{ metodo: "cartao_credito", bandeira: "Visa", valor: total, num_parcelas: 1, status: "aprovado", transacao_id: "TXN-VISA-" + (1000 + i) }]
    : [{ metodo: "cartao_credito", bandeira: "Mastercard", valor: +(total * 0.8).toFixed(2), num_parcelas: 3, status: "aprovado", transacao_id: "TXN-MC-" + (1000 + i) },
       { metodo: "pix", valor: +(total * 0.2).toFixed(2), status: "aprovado", transacao_id: "TXN-PIX-" + (1000 + i) }];
  pagamentos.push({
    _id: new ObjectId(),
    hospedagem_id: hospedagem._id, reserva_id: reserva._id, hospede_id: hosp._id,
    valor_total: total, status: "pago",
    data_pagamento: new Date(checkout.getTime() + 11 * 3600000),
    parcelas: parcelas,
    nota_fiscal: "NF-e " + String(421 + i).padStart(6, "0"),
    data_criacao: new Date(checkout.getTime() + 11 * 3600000)
  });

  // Feedback (nem todos os hóspedes avaliam)
  if (i % 4 !== 3) {
    const nota = [5, 4.5, 4, 5, 4.5, 3.5][i % 6];
    const fb = {
      _id: new ObjectId(),
      hospede_id: hosp._id, hospedagem_id: hospedagem._id, quarto_id: quarto._id,
      data_avaliacao: new Date(checkout.getTime() + 86400000),
      nota_geral: nota,
      notas_detalhadas: { limpeza: Math.min(5, Math.ceil(nota)), atendimento: 5, conforto: Math.floor(nota),
                          custo_beneficio: Math.max(3, Math.floor(nota)), localizacao: 5 },
      comentario: comentarios[i % comentarios.length],
      visivel: true
    };
    // resposta do hotel é opcional (flexibilidade do schema)
    if (i % 2 === 0) {
      fb.resposta_hotel = { texto: "Obrigado pelo feedback, " + hosp.nome.split(" ")[0] + "! Esperamos recebê-lo novamente.",
                            data: new Date(checkout.getTime() + 2 * 86400000), funcionario_id: fnc[2]._id };
    }
    feedbacks.push(fb);
  }
});

dbn.reservas.insertMany(reservas);
dbn.hospedagens.insertMany(hospedagens);
dbn.pagamentos.insertMany(pagamentos);
dbn.feedbacks.insertMany(feedbacks);

// ------------------------------------------------------------
// 7. Índices (escalabilidade)
// ------------------------------------------------------------
dbn.hospedes.createIndex({ cpf: 1 }, { unique: true });
dbn.hospedes.createIndex({ email: 1 }, { unique: true });
dbn.quartos.createIndex({ numero: 1 }, { unique: true });
dbn.quartos.createIndex({ "caracteristicas.vista": 1, "caracteristicas.banheira": 1 });
dbn.quartos.createIndex({ comodidades: 1 });
dbn.reservas.createIndex({ codigo_reserva: 1 }, { unique: true });
dbn.reservas.createIndex({ hospede_id: 1 });
dbn.reservas.createIndex({ quarto_id: 1, data_checkin: 1, data_checkout: 1 });
dbn.hospedagens.createIndex({ reserva_id: 1 });
dbn.pagamentos.createIndex({ data_pagamento: 1, status: 1 });
dbn.feedbacks.createIndex({ quarto_id: 1, nota_geral: -1 });

// ------------------------------------------------------------
// 8. Conferência
// ------------------------------------------------------------
print("=== Banco hotel_nebula criado ===");
dbn.getCollectionNames().forEach(c => print(c.padEnd(14), dbn.getCollection(c).countDocuments()));
