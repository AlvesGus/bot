require("dotenv").config();
const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
const axios = require("axios")
const { interactWithGemini } = require("./gemini/");

// ===============================
// ⚙️ CONFIGURAÇÃO INICIAL
// ===============================

if (process.env.BOT_RUNNING) {
  console.log("⚠️ Bot já está rodando — encerrando duplicata");
  process.exit(0);
}
process.env.BOT_RUNNING = true;

const bot = new Telegraf(process.env.TELEGRAM_TOKKEN);




const usuariosEmProcessamento = new Map();
let ultimoUpdateId = null;

// ===============================
// 🚀 FUNÇÕES AUXILIARES
// ===============================
const api = axios.create({
  baseURL: process.env.BASE_URL,
  timeout: 5000,
});

async function salvarTransacaoNoBackend(dados, user) {
  try {
    const novaTransacao = {
      category: dados.tMovimentacao,
      amount: parseFloat(dados.valorMovimentacao),
      type: dados.tipo || "Não especificado",
      title: dados.local,
      telegram_id: user.id.toString(),
      nome_usuario: user.first_name,
    };

    console.log("🚀 CONECTANDO AO BACKEND EM:", process.env.BASE_URL);
    const response = await api.post(`/api/add-transactions`, novaTransacao);
    console.log("✅ Transação salva no backend:", response.data);
    return [true, "Transação registrada com sucesso no servidor!"];
  } catch (error) {
    console.error("❌ Erro ao salvar no backend:", error.response?.data || error.message);
    return [false, "Erro ao salvar a transação no servidor."];
  }
}

async function listarTransacoesDoUsuario(telegramId) {
  try {
    const response = await api.get("/transactions", {
      params: { telegram_id: telegramId },
    });

    if (!response.data || response.data.length === 0) {
      return "📭 Nenhuma transação encontrada.";
    }

    let texto = "📋 *Suas últimas transações:*\n\n";
    response.data.forEach((t) => {
      texto += `💸 ${t.tipo} — R$${t.valor.toFixed(2)}\n🏷️ ${t.tipoCategoria}\n📍 ${t.local}\n📅 ${t.data}\n\n`;
    });
    return texto;
  } catch (error) {
    console.error("Erro ao buscar transações:", error.message);
    return "⚠️ Não consegui recuperar suas transações.";
  }
}

// ===============================
// 🤖 COMANDOS DO BOT
// ===============================

bot.start(async (ctx) => {
  await ctx.reply(`Bem-vindo, ${ctx.from.first_name}! 👋`);
  await ctx.reply("Envie sua nova transação para que eu cadastre.");
  await ctx.reply("Exemplo: *Gastei 150 reais no mercado hoje.*", {
    parse_mode: "Markdown",
  });
});

bot.command("minhastransacoes", async (ctx) => {
  await ctx.reply("🔎 Buscando suas transações...");
  const texto = await listarTransacoesDoUsuario(ctx.from.id);
  await ctx.reply(texto, { parse_mode: "Markdown" });
});

// ===============================
// 💬 PROCESSAMENTO DE MENSAGENS
// ===============================

bot.on(message("text"), async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text.trim();

  // Evita duplicação por update repetido
  if (ctx.update.update_id === ultimoUpdateId) {
    console.log("⚠️ Ignorando mensagem duplicada:", text);
    return;
  }
  ultimoUpdateId = ctx.update.update_id;

  // Evita que o mesmo usuário envie várias mensagens simultâneas
  if (usuariosEmProcessamento.get(userId)) {
    await ctx.reply("⏳ Aguarde, ainda estou processando sua última transação...");
    return;
  }

  usuariosEmProcessamento.set(userId, true);
  await ctx.reply("💭 Entendendo sua mensagem...");

  try {
    const dados = await interactWithGemini(text);

    if (
      !dados ||
      !dados.tMovimentacao ||
      !dados.valorMovimentacao ||
      !dados.local ||
      !dados.data
    ) {
      await ctx.reply(
        "❌ Não consegui entender sua mensagem. Tente algo como: *Gastei 80 reais no posto hoje.*",
        { parse_mode: "Markdown" }
      );
      return;
    }

    const [ok, msg] = await salvarTransacaoNoBackend(dados, ctx.from);
    await ctx.reply(ok ? `✅ ${msg}` : `⚠️ ${msg}`);
  } catch (error) {
    console.error("Erro ao processar mensagem:", error);
    await ctx.reply("⚠️ Ocorreu um erro ao interpretar sua transação.");
  } finally {
    usuariosEmProcessamento.delete(userId);
  }
});

bot.launch();
console.log("🤖 Bot conectado e rodando...");


process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// Tratamento global de erros
process.on("unhandledRejection", (err) => {
  console.error("💥 Unhandled rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught exception:", err);
});
