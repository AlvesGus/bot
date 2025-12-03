// ===============================
// 🤖 Gemini → Groq (fallback free)
// ===============================

const Groq = require('groq-sdk')

import { interactWithGemini } from "../gemini/index.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const promptBase = (texto) => `
Analise a frase abaixo e retorne APENAS um JSON puro no formato:
{
  "tMovimentacao": "Gasto" | "Receita" | "Transferência",
  "valorMovimentacao": número,
  "local": "onde ocorreu",
  "data": "DD/MM/YYYY",
  "tipo": "categoria (alimentação, lazer, transporte, etc)"
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

    console.log("⚠️ Gemini retornou JSON incompleto");
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
      model: "llama-3.1-70b-versatile", // modelo gratuito da Groq
      messages: [
        { role: "user", content: promptBase(texto) }
      ],
      temperature: 0,
    });

    const content = completion.choices[0].message.content;
    const json = JSON.parse(content);

    console.log("🟢 GROQ funcionou");
    return json;

  } catch (e) {
    console.log("❌ Erro no Groq:", e.message);
    return null;
  }
}

// -----------------------------
// FUNÇÃO PRINCIPAL
// -----------------------------
 async function interpretarTransacao(texto) {
  let resposta = await tentaGemini(texto);
  if (resposta) return resposta;

  resposta = await tentaGroq(texto);
  if (resposta) return resposta;

  return null;
}


module.exports = interpretarTransacao