# Hotel Nebula — Banco de Dados (MongoDB)

Projeto em três partes: **modelagem**, **implementação** e **consultas** para a rede Hotel Nebula.

## Estrutura do repositório

```
hotel-nebula/
├── README.md             # Parte 1 (modelagem) + explicação da arquitetura (Parte 2)
├── schemas.md            # Esquema e exemplos JSON de cada coleção
├── 02_insercao.js        # Parte 2: cria coleções, validações, documentos e índices
└── 03_consultas.js       # Parte 3: consultas de gestão
```

## Como executar

```bash
mongosh --file 02_insercao.js     # cria o banco hotel_nebula e popula
mongosh --file 03_consultas.js    # roda todas as consultas
```

Requer MongoDB 5+ e `mongosh`. Também funciona no MongoDB Atlas (use a connection string: `mongosh "<string>" --file ...`).

---

# Parte 1 — Origem do Sistema

## 1.1 Núcleos de informação identificados

| Núcleo | Coleção | O que representa |
|---|---|---|
| Pessoas atendidas | `hospedes` | Cadastro do cliente |
| Infraestrutura | `quartos` | Unidades do hotel e suas características |
| Intenção de estadia | `reservas` | Pedido futuro (ou cancelado) de um quarto em um período |
| Estadia real | `hospedagens` | Check-in realizado até o check-out, com a conta de serviços |
| Financeiro | `pagamentos` | Quitação da hospedagem (um ou mais métodos) |
| Equipe | `funcionarios` | Profissionais, turnos e permissões |
| Catálogo | `servicos` | Serviços extras e preços vigentes |
| Qualidade | `feedbacks` | Avaliações e respostas do hotel |

A separação **reserva × hospedagem** é intencional: uma reserva pode ser cancelada ou não comparecer (nunca vira hospedagem), e a hospedagem guarda dados que só existem após o check-in (horários reais, funcionários, consumo).

## 1.2 Mapa de relações

```
hospedes ──< reservas >── quartos
                │
                └──< hospedagens >── funcionarios (check-in / check-out)
                          │
                          ├──< pagamentos
                          └──< feedbacks >── quartos
servicos (catálogo) ··· copiado para hospedagens.servicos_consumidos
```

| Coleção | Referencia | Embute |
|---|---|---|
| `hospedes` | — | `endereco`, `preferencias` |
| `quartos` | — | `comodidades[]`, `caracteristicas{}`, `fotos[]` |
| `reservas` | `hospedes`, `quartos` | `hospede_snapshot`, `quarto_snapshot` |
| `hospedagens` | `reservas`, `hospedes`, `quartos`, `funcionarios` | `servicos_consumidos[]` |
| `pagamentos` | `hospedagens`, `reservas`, `hospedes` | `parcelas[]` |
| `funcionarios` | — | `turno{}`, `permissoes[]` |
| `servicos` | — | `horario_disponivel{}`, `tags[]` |
| `feedbacks` | `hospedes`, `hospedagens`, `quartos` | `notas_detalhadas{}`, `resposta_hotel{}` |

## 1.3 Respostas às questões do enunciado

**Uma reserva deve guardar dados do hóspede embutidos ou referenciados? → Os dois (padrão híbrido).**
Guarda o `hospede_id` (referência) para navegar até o cadastro atualizado e agrupar reservas por hóspede, **e** um `hospede_snapshot` (nome, e-mail, telefone) para preservar o que valia na data da reserva. Se o hóspede trocar de telefone, a reserva antiga continua fiel ao momento em que foi feita, e listagens de reservas não precisam de `$lookup`. O mesmo vale para `quarto_snapshot` (o preço da diária pode mudar depois, mas a reserva mantém o preço contratado).

**Avaliações ficam dentro do documento do quarto ou em coleção própria? → Coleção própria (`feedbacks`).**
Avaliações crescem sem limite e o documento do quarto seria reescrito a cada nova nota (risco do limite de 16 MB e de documentos "inchados" lidos à toa). Em coleção própria é possível filtrar, paginar, calcular médias por quarto/período e moderar (`visivel`) sem carregar o quarto. A relação é 1 quarto → N feedbacks (não limitada), o caso clássico de referência.

**Serviços consumidos ficam dentro da hospedagem? → Sim, embutidos como array.**
O consumo pertence só àquela estadia, é sempre lido junto com a conta e tem tamanho pequeno e limitado. Cada item guarda `nome` e `preco_unitario` copiados do catálogo, então mudar o preço em `servicos` não altera contas antigas. O `servico_id` mantém a ligação com o catálogo para relatórios.

**Como representar histórico sem perder flexibilidade?**
1. **Snapshots** em `reservas` (dados do hóspede e do quarto na data).
2. **Preço congelado** nos itens consumidos e em `quarto_snapshot.preco_diaria`.
3. **Status em vez de exclusão**: reserva `cancelada`, hospedagem `encerrada`, hóspede/funcionário `ativo: false`. Nada é apagado.
4. **Datas de auditoria** (`data_criacao`, `data_atualizacao`, `checkin_real`, `checkout_real`).
5. **Campos opcionais** (ex.: `resposta_hotel`, `motivo_cancelamento`, `observacoes`) que só existem quando fazem sentido, sem colunas vazias.

## 1.4 Justificativa das principais escolhas

- **`endereco` e `preferencias` embutidos em `hospedes`**: são lidos sempre com o hóspede, não existem sem ele e não são compartilhados. `preferencias` é flexível: cada hóspede pode ter chaves diferentes (ex.: `idioma`, `travesseiro_extra`).
- **`comodidades` como array de strings**: permite buscas como `{ comodidades: "cafeteira" }` e `$all`, e aceita novas comodidades sem alterar o schema. **`caracteristicas`** como subdocumento: agrupa atributos estruturados (vista, banheira, varanda, área) e aceita atributos extras por tipo (ex.: `piscina_privativa` só na cobertura).
- **`parcelas[]` em `pagamentos`**: representa pagamento misto (cartão + Pix) e parcelamento num único documento, e cada método pode ter campos próprios (`bandeira` só no cartão).
- **`servicos` separado**: catálogo muda com frequência (preços, horários, novos serviços) e é referenciado por muitas hospedagens.
- **`funcionarios` com `turno` e `permissoes` embutidos**: dados de uso conjunto e pequenos; `permissoes[]` facilita futura API com controle de acesso.
- **Pagamentos em coleção própria**: o financeiro é auditado, consultado por período e pode ter múltiplas tentativas/estornos, o que não deve inflar a hospedagem.
- **Tipos nativos**: datas como `ISODate` (não string), valores como número, para permitir `$month`, `$dayOfWeek` e `$sum`.

## 1.5 Exemplos de documentos JSON

Exemplos completos de todas as coleções estão em [`schemas.md`](schemas.md). Resumo da reserva (padrão híbrido):

```json
{
  "hospede_id": "ObjectId('...')",
  "hospede_snapshot": { "nome": "Carlos Andrade", "email": "carlos.andrade@email.com", "telefone": "+55 11 98765-4321" },
  "quarto_id": "ObjectId('...')",
  "quarto_snapshot": { "numero": "101", "tipo": "standard", "preco_diaria": 250.00 },
  "data_checkin": "2025-04-10", "data_checkout": "2025-04-14",
  "num_noites": 4, "valor_total": 1000.00,
  "status": "confirmada", "codigo_reserva": "HN-2025-00007"
}
```

---

# Parte 2 — Montagem do Núcleo (arquitetura adotada)

O script `02_insercao.js`:

1. **Recria o banco** `hotel_nebula` (pode ser executado várias vezes).
2. **Cria as 8 coleções**, com `$jsonSchema` em `hospedes`, `quartos` e `reservas` para garantir o mínimo (campos obrigatórios, valores válidos de `status`, preço ≥ 0) sem engessar os campos opcionais.
3. **Insere** 3 funcionários, 5 serviços, 7 quartos (standard a cobertura, com vistas e comodidades diferentes), 6 hóspedes (nacionais e estrangeiros, com preferências distintas) e **19 reservas** entre jan/2025 e dez/2026.
4. **Gera por código** hospedagens, pagamentos e feedbacks a partir das reservas concluídas, garantindo consistência entre coleções: `total_geral = total_diarias + total_servicos`, e o `valor_total` do pagamento é igual à soma das `parcelas`. Há uma reserva cancelada (sem hospedagem) e uma futura (apenas confirmada).
5. **Cria índices** para os acessos mais comuns (CPF/e-mail únicos, número do quarto, vista/banheira, conflito de datas, pagamentos por data, feedbacks por quarto).

**Variabilidade intencional dos dados** (para testar flexibilidade): pagamentos com cartão único ou misto; feedbacks com e sem `resposta_hotel` e hóspedes que não avaliaram; `preferencias` com chaves diferentes por hóspede; `caracteristicas` extras só em alguns quartos; `observacoes` e `motivo_cancelamento` opcionais.

**Escalabilidade:** referências nas relações 1→N ilimitadas (reservas, feedbacks, pagamentos); embutidos apenas nos arrays pequenos e limitados (comodidades, serviços por estadia, parcelas); índices alinhados às consultas da Parte 3.

---

# Parte 3 — Radar de Comando

Todas as consultas estão em `03_consultas.js`.

| Pergunta de gestão | Consulta |
|---|---|
| Quartos com vista para o mar / banheira / luxo / combinações / comodidades | 1a–1e |
| Quartos livres em um período | 1f |
| Hóspedes que reservaram mais de uma vez | 2 |
| Faturamento de abril, anual, mensal, por método, diárias × serviços, serviços mais rentáveis | 3a–3f |
| Meses com mais reservas | 4a |
| Dias da semana mais movimentados | 4b |
| Taxa de ocupação mensal | 4c |
| Quartos mais reservados | 4d |
| Nota média por quarto, canais de venda, taxa de cancelamento | 5a–5c |

**Decisões de cálculo:** o faturamento usa `pagamentos` com `status: "pago"` e `data_pagamento` (dinheiro realmente recebido). Reservas canceladas são excluídas das métricas de ocupação. O dia da semana considera a data de check-in, e a taxa de ocupação atribui as noites ao mês do check-in (aproximação simples).
