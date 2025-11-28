const { GoogleGenerativeAI } = require("@google/generative-ai");

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3
].filter(Boolean);

let currentKeyIndex = 0;

function getGeminiClient() {
  if (GEMINI_KEYS.length === 0) {
    throw new Error("Nenhuma chave Gemini configurada no .env");
  }
  const key = GEMINI_KEYS[currentKeyIndex];
  return new GoogleGenerativeAI(key);
}

async function interactWithGemini(userText) {
  let attempts = 0;

  while (attempts < GEMINI_KEYS.length) {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    try {
      const prompt = `
      Analise a frase abaixo e retorne apenas um JSON com as seguintes informações:
      {
        "tMovimentacao": "Gasto" | "Receita" | "Transferência",
        "valorMovimentacao": número,
        "local": "onde ocorreu",
        "data": "DD/MM/YYYY",
        "tipo": "categoria (alimentação, lazer, transporte, etc)"
      }

      Frase: "${userText}"
      `;

      // 🔥 IMPLEMENTAÇÃO CORRETA PARA MODELOS 2.5
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      });

      const text =
        result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { erro: true, mensagem: "Formato inesperado da resposta do Gemini." };

    } catch (error) {
      console.error(`❌ Erro com chave ${currentKeyIndex + 1}:`, error.message);

      if (
        error.message.includes("429") ||
        error.message.includes("quota") ||
        error.message.includes("Resource exhausted")
      ) {
        console.log("⚠️ Limite atingido, trocando para próxima chave...");
        currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
        attempts++;
        await new Promise((r) => setTimeout(r, 2000));
      } else if (error.message.includes("404")) {
        console.log("❌ Modelo não encontrado.");
        break;
      } else if (error.message.includes("expired")) {
        console.log("🔑 Chave expirada. Pulando...");
        currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
        attempts++;
      } else {
        return { erro: true, mensagem: "Erro inesperado ao comunicar com Gemini API." };
      }
    }
  }

  return { erro: true, mensagem: "Todas as chaves falharam. Tente novamente mais tarde." };
}

module.exports = { interactWithGemini };
