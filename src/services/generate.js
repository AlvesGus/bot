// ===============================
// 🤖 Gemini → Groq (fallback free)
// ===============================

const Groq = require("groq-sdk");
const { interactWithGemini } = require("../gemini/index.js");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const promptBase = (texto) => `
Analise a frase abaixo e retorne APENAS um JSON puro no formato:
{
  "tMovimentacao": "Entrada" | "Saida" | "Investimento",
  "valorMovimentacao": número,
  "local": "onde ocorreu",
  "data": "DD/MM/YYYY",
  "tipo": "Alimentação" | "Transporte" | "Lazer" | "Outros"
}

Frase: "${texto}"
`;

// -----------------------------
// 1️⃣ Tenta Gemini primeiro
// -----------------------------
async function tentaGemini(texto) {
  try {
    const resposta = await interactWithGemini(texto);

    if (
      resposta &&
      resposta.tMovimentacao &&
      resposta.valorMovimentacao &&
      resposta.local &&
      resposta.data
    ) {
      console.log("🟢 GEMINI funcionou");
      return resposta;
    }

    console.log("⚠️ Gemini retornou JSON incompleto:", resposta);
    return null;

  } catch (e) {
    console.log("❌ Erro no Gemini:", e.message);
    return null;
  }
}

// -----------------------------
// 2️⃣ Fallback com Groq (FREE)
// -----------------------------
async function tentaGroq(texto) {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-70b-versatile",
      messages: [{ role: "user", content: promptBase(texto) }],
      temperature: 0,
    });

    const content = completion.choices[0].message.content;

    // -----------------------------------------
    // 🧠 Extrai SOMENTE o JSON do texto recebido
    // -----------------------------------------
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.log("⚠️ Groq respondeu sem JSON válido:", content);
      return null;
    }

    const json = JSON.parse(jsonMatch[0]);

    // -------------------------------------
    // 🛡️ Validação mínima do JSON da Groq
    // -------------------------------------
    if (
      !json.tMovimentacao ||
      !json.valorMovimentacao ||
      !json.local ||
      !json.data
    ) {
      console.log("⚠️ Groq retornou JSON incompleto:", json);
      return null;
    }

    console.log("🟢 GROQ funcionou");
    return json;

  } catch (e) {
    console.log("❌ Erro no Groq:", e.message);
    return null;
  }
}

// -----------------------------
// FUNÇÃO PRINCIPAL (exportada)
// -----------------------------
async function interpretarTransacao(texto) {
  // 1️⃣ GEMINI PRIMEIRO
  let resposta = await tentaGemini(texto);
  if (resposta) return resposta;

  // 2️⃣ FALLBACK GROQ (FREE)
  resposta = await tentaGroq(texto);
  if (resposta) return resposta;

  // 3️⃣ FALHA TOTAL
  return null;
}

module.exports = interpretarTransacao;
