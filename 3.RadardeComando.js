// ============================================================
// Hotel Nebula - Parte 3: Radar de Comando
// Execução: mongosh --file 03_consultas.js  (após rodar 02_insercao.js)
// Ou copie e cole cada consulta no mongosh / MongoDB Compass (aba Aggregations).
// ============================================================

const dbn = db.getSiblingDB("hotel_nebula");
const titulo = t => print("\n=== " + t + " ===");

// ------------------------------------------------------------
// 1. QUARTOS POR CARACTERÍSTICAS
// ------------------------------------------------------------

titulo("1a. Quartos com vista para o mar");
dbn.quartos.find(
  { "caracteristicas.vista": "mar" },
  { _id: 0, numero: 1, tipo: 1, categoria: 1, preco_diaria: 1 }
).forEach(printjson);

titulo("1b. Quartos com banheira");
dbn.quartos.find(
  { "caracteristicas.banheira": true },
  { _id: 0, numero: 1, tipo: 1, "caracteristicas.vista": 1, preco_diaria: 1 }
).forEach(printjson);

titulo("1c. Quartos de luxo");
dbn.quartos.find(
  { categoria: "luxo" },
  { _id: 0, numero: 1, tipo: 1, preco_diaria: 1 }
).sort({ preco_diaria: 1 }).forEach(printjson);

titulo("1d. Combinando: luxo + vista mar + banheira + varanda, disponíveis");
dbn.quartos.find({
  categoria: "luxo",
  status: "disponivel",
  "caracteristicas.vista": "mar",
  "caracteristicas.banheira": true,
  "caracteristicas.varanda": true
}, { _id: 0, numero: 1, tipo: 1, preco_diaria: 1, comodidades: 1 }).forEach(printjson);

titulo("1e. Busca em array: quartos com cafeteira E cofre");
dbn.quartos.find(
  { comodidades: { $all: ["cafeteira", "cofre"] } },
  { _id: 0, numero: 1, comodidades: 1 }
).forEach(printjson);

titulo("1f. Quartos livres em um período (sem reserva conflitante) - 10 a 14/04/2025");
const ini = ISODate("2025-04-10"), fim = ISODate("2025-04-14");
const ocupados = dbn.reservas.distinct("quarto_id", {
  status: { $in: ["confirmada", "concluida"] },
  data_checkin: { $lt: fim },
  data_checkout: { $gt: ini }
});
dbn.quartos.find(
  { _id: { $nin: ocupados }, status: "disponivel" },
  { _id: 0, numero: 1, tipo: 1, preco_diaria: 1 }
).forEach(printjson);

// ------------------------------------------------------------
// 2. HÓSPEDES QUE RESERVARAM MAIS DE UMA VEZ
// ------------------------------------------------------------

titulo("2. Hóspedes com mais de uma reserva (excluindo canceladas)");
dbn.reservas.aggregate([
  { $match: { status: { $ne: "cancelada" } } },
  { $group: {
      _id: "$hospede_id",
      nome: { $first: "$hospede_snapshot.nome" },
      email: { $first: "$hospede_snapshot.email" },
      total_reservas: { $sum: 1 },
      total_noites: { $sum: "$num_noites" },
      valor_total_reservas: { $sum: "$valor_total" },
      codigos: { $push: "$codigo_reserva" }
  }},
  { $match: { total_reservas: { $gt: 1 } } },
  { $sort: { total_reservas: -1, valor_total_reservas: -1 } },
  { $project: { _id: 0, nome: 1, email: 1, total_reservas: 1, total_noites: 1, valor_total_reservas: 1, codigos: 1 } }
]).forEach(printjson);

// ------------------------------------------------------------
// 3. FATURAMENTO
// Base: coleção pagamentos (valor efetivamente recebido, status "pago")
// ------------------------------------------------------------

titulo("3a. Faturamento de abril/2025");
dbn.pagamentos.aggregate([
  { $match: {
      status: "pago",
      data_pagamento: { $gte: ISODate("2025-04-01"), $lt: ISODate("2025-05-01") }
  }},
  { $group: { _id: null, faturamento: { $sum: "$valor_total" }, qtd_pagamentos: { $sum: 1 } } },
  { $project: { _id: 0, periodo: { $literal: "2025-04" }, faturamento: 1, qtd_pagamentos: 1 } }
]).forEach(printjson);

titulo("3b. Faturamento anual de 2025 (total)");
dbn.pagamentos.aggregate([
  { $match: {
      status: "pago",
      data_pagamento: { $gte: ISODate("2025-01-01"), $lt: ISODate("2026-01-01") }
  }},
  { $group: { _id: null, faturamento_anual: { $sum: "$valor_total" }, qtd_pagamentos: { $sum: 1 },
              ticket_medio: { $avg: "$valor_total" } } },
  { $project: { _id: 0, faturamento_anual: 1, qtd_pagamentos: 1, ticket_medio: { $round: ["$ticket_medio", 2] } } }
]).forEach(printjson);

titulo("3c. Faturamento mês a mês em 2025");
dbn.pagamentos.aggregate([
  { $match: { status: "pago", data_pagamento: { $gte: ISODate("2025-01-01"), $lt: ISODate("2026-01-01") } } },
  { $group: { _id: { $month: "$data_pagamento" }, faturamento: { $sum: "$valor_total" }, pagamentos: { $sum: 1 } } },
  { $sort: { _id: 1 } },
  { $project: { _id: 0, mes: "$_id", faturamento: 1, pagamentos: 1 } }
]).forEach(printjson);

titulo("3d. Faturamento por método de pagamento (usa o array de parcelas)");
dbn.pagamentos.aggregate([
  { $match: { status: "pago" } },
  { $unwind: "$parcelas" },
  { $match: { "parcelas.status": "aprovado" } },
  { $group: { _id: "$parcelas.metodo", total: { $sum: "$parcelas.valor" }, transacoes: { $sum: 1 } } },
  { $sort: { total: -1 } }
]).forEach(printjson);

titulo("3e. Receita de diárias x serviços (usa o array de serviços consumidos)");
dbn.hospedagens.aggregate([
  { $match: { status: "encerrada" } },
  { $group: { _id: null, diarias: { $sum: "$total_diarias" }, servicos: { $sum: "$total_servicos" }, total: { $sum: "$total_geral" } } },
  { $project: { _id: 0, diarias: 1, servicos: 1, total: 1 } }
]).forEach(printjson);

titulo("3f. Serviços mais rentáveis");
dbn.hospedagens.aggregate([
  { $unwind: "$servicos_consumidos" },
  { $group: { _id: "$servicos_consumidos.nome", receita: { $sum: "$servicos_consumidos.total" },
              unidades: { $sum: "$servicos_consumidos.quantidade" } } },
  { $sort: { receita: -1 } }
]).forEach(printjson);

// ------------------------------------------------------------
// 4. OCUPAÇÃO / PERÍODOS MAIS MOVIMENTADOS
// ------------------------------------------------------------

titulo("4a. Meses com mais reservas (por data de check-in, sem canceladas)");
dbn.reservas.aggregate([
  { $match: { status: { $ne: "cancelada" } } },
  { $group: { _id: { ano: { $year: "$data_checkin" }, mes: { $month: "$data_checkin" } },
              reservas: { $sum: 1 }, noites: { $sum: "$num_noites" } } },
  { $sort: { reservas: -1, noites: -1 } },
  { $project: { _id: 0, ano: "$_id.ano", mes: "$_id.mes", reservas: 1, noites: 1 } }
]).forEach(printjson);

titulo("4b. Dias da semana mais movimentados (check-ins)");
const nomesDia = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
dbn.reservas.aggregate([
  { $match: { status: { $ne: "cancelada" } } },
  { $group: { _id: { $dayOfWeek: "$data_checkin" }, checkins: { $sum: 1 } } },   // 1 = domingo ... 7 = sábado
  { $sort: { checkins: -1 } },
  { $project: { _id: 0, dia_semana: { $arrayElemAt: [nomesDia, { $subtract: ["$_id", 1] }] }, checkins: 1 } }
]).forEach(printjson);

titulo("4c. Taxa de ocupação mensal em 2025 (noites ocupadas / noites disponíveis)");
// Considera as noites de cada reserva atribuídas ao mês do check-in (aproximação).
// 7 quartos x dias do mês = noites disponíveis.
const totalQuartos = dbn.quartos.countDocuments();
dbn.reservas.aggregate([
  { $match: { status: { $in: ["concluida", "confirmada"] },
              data_checkin: { $gte: ISODate("2025-01-01"), $lt: ISODate("2026-01-01") } } },
  { $group: { _id: { $month: "$data_checkin" }, noites_ocupadas: { $sum: "$num_noites" } } },
  { $addFields: {
      dias_mes: { $arrayElemAt: [[31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], { $subtract: ["$_id", 1] }] } } },
  { $project: { _id: 0, mes: "$_id", noites_ocupadas: 1,
      taxa_ocupacao_pct: { $round: [{ $multiply: [{ $divide: ["$noites_ocupadas", { $multiply: ["$dias_mes", totalQuartos] }] }, 100] }, 1] } } },
  { $sort: { mes: 1 } }
]).forEach(printjson);

titulo("4d. Quartos mais reservados");
dbn.reservas.aggregate([
  { $match: { status: { $ne: "cancelada" } } },
  { $group: { _id: "$quarto_snapshot.numero", tipo: { $first: "$quarto_snapshot.tipo" }, reservas: { $sum: 1 }, noites: { $sum: "$num_noites" } } },
  { $sort: { reservas: -1 } }
]).forEach(printjson);

// ------------------------------------------------------------
// 5. EXTRAS DE GESTÃO
// ------------------------------------------------------------

titulo("5a. Nota média por quarto (feedbacks) com dados do quarto via $lookup");
dbn.feedbacks.aggregate([
  { $group: { _id: "$quarto_id", nota_media: { $avg: "$nota_geral" }, avaliacoes: { $sum: 1 } } },
  { $lookup: { from: "quartos", localField: "_id", foreignField: "_id", as: "quarto" } },
  { $unwind: "$quarto" },
  { $project: { _id: 0, quarto: "$quarto.numero", tipo: "$quarto.tipo",
                nota_media: { $round: ["$nota_media", 2] }, avaliacoes: 1 } },
  { $sort: { nota_media: -1 } }
]).forEach(printjson);

titulo("5b. Canais de reserva com mais vendas");
dbn.reservas.aggregate([
  { $match: { status: { $ne: "cancelada" } } },
  { $group: { _id: "$canal", reservas: { $sum: 1 }, valor: { $sum: "$valor_total" } } },
  { $sort: { valor: -1 } }
]).forEach(printjson);

titulo("5c. Taxa de cancelamento");
dbn.reservas.aggregate([
  { $group: { _id: null, total: { $sum: 1 }, canceladas: { $sum: { $cond: [{ $eq: ["$status", "cancelada"] }, 1, 0] } } } },
  { $project: { _id: 0, total: 1, canceladas: 1, taxa_pct: { $round: [{ $multiply: [{ $divide: ["$canceladas", "$total"] }, 100] }, 1] } } }
]).forEach(printjson);
