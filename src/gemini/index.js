const { GoogleGenerativeAI } = require("@google/generative-ai");

// Suporte a múltiplas chaves Gemini (caso você tenha várias)
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
      model: "gemini-2.5-flash", // ✅ modelo correto e atualizado
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

      Exemplo de entrada: "Gastei 80 reais no posto hoje"
      Resposta esperada:
      {
        "tMovimentacao": "Gasto",
        "valorMovimentacao": 80,
        "local": "posto",
        "data": "09/11/2025",
        "tipo": "Transporte"
      }

      Frase: "${userText}"
      `;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      console.log(jsonMatch)
      return { erro: true, mensagem: "Formato inesperado da resposta do Gemini." };

    } catch (error) {
      console.error(`❌ Erro com chave ${currentKeyIndex + 1}:`, error.message);

      if (error.message.includes("429") || error.message.includes("quota") || error.message.includes("Resource exhausted")) {
        console.log("⚠️ Limite atingido, trocando para próxima chave...");
        currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
        attempts++;
        await new Promise((r) => setTimeout(r, 2000)); // espera 2s antes de tentar novamente
      } else if (error.message.includes("404")) {
        console.log("❌ Modelo não encontrado. Verifique o nome no painel da Google AI Studio.");
        break;
      } else if (error.message.includes("expired")) {
        console.log("🔑 Chave expirada. Pule para a próxima.");
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
