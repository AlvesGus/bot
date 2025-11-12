const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function interactWithGemini(text) {
  const prompt = `Você é um assistente financeiro que interpreta frases de despesas em português.
Extraia as informações e devolva **APENAS** um JSON (sem explicações ou comentários) no formato:
{
  "tMovimentacao": "Entrada" ou "Saída" ou "Investimento" ,
  "valorMovimentacao": número,
  "local": "texto",
  "tipo": "texto" (ex: Alimentação, Transporte, Lazer, Saúde, Educação, Moradia, Outros),
  "data": texto (no formato DD/MM/AAAA)
}

Mensagem: "${text}"`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) {
      console.log("⚠️ Nenhum JSON encontrado:", responseText);
      return null;
    }

    let json;
    try {
      json = JSON.parse(match[0]);
    } catch (err) {
      console.log("⚠️ Erro ao parsear JSON:", match[0]);
      return null;
    }
  } catch (error) {
    console.error("❌ Erro no Gemini API:", error);
    return null;
  }
}

module.exports = { interactWithGemini };
