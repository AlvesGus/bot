require("dotenv").config();
const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
const axios = require("axios");
const { interactWithGemini } = require("./gemini/");

// ===============================
// ⚙️ CONFIGURAÇÃO INICIAL
// ===============================

// Evita rodar múltiplas instâncias do bot
if (process.env.BOT_RUNNING) {
  console.log("⚠️ Bot já está rodando — encerrando duplicata");
  process.exit(0);
}
process.env.BOT_RUNNING = true;

// Inicializa o bot
const bot = new Telegraf(process.env.TELEGRAM_TOKKEN);

// URL base do backend (Render)
const BASE_URL = "https://pupinhos-bot.onrender.com/api";

// Evita processar duplicações
const usuariosEmProcessamento = new Map();
let ultimoUpdateId = null;

// ===============================
// 🚀 FUNÇÕES AUXILIARES
// ===============================

async function salvarTransacaoNoBackend(dados, user) {
  try {
    const novaTransacao = {
      tipo: dados.tMovimentacao,
      valor: parseFloat(dados.valorMovimentacao),
      tipoCategoria: dados.tipo || "Não especificado",
      local: dados.local,
      data: dados.data,
      telegram_id: user.id,
      nome_usuario: user.first_name,
    };

    const response = await axios.post(`${BASE_URL}/add-transactions`, novaTransacao);
    console.log("✅ Transação salva no backend:", response.data);
    return [true, "Transação registrada com sucesso no servidor!"];
  } catch (error) {
    console.error("❌ Erro ao salvar no backend:", error.response?.data || error.message);
    return [false, "Erro ao salvar a transação no servidor."];
  }
}

async function listarTransacoesDoUsuario(telegramId) {
  try {
    const response = await axios.get(`${BASE_URL}/transactions`, {
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

// ===============================
// 🚀 INICIALIZAÇÃO DO BOT
// ===============================

bot.launch();
console.log("🤖 Bot conectado e rodando...");

// Habilita parada segura (Koyeb, Render, Railway, etc.)
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
