/**
 * HortiTech — Nutritional Assistant Backend
 * MVP for thesis data collection
 * 
 * Setup:
 *   npm install express cors @google/generative-ai dotenv
 *   Create a .env file with: GEMINI_API_KEY=your_key_here
 *   node server.js
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── System Prompt Factory ────────────────────────────────────────────────────
function buildSystemPrompt(cartItems, dietaryRestrictions, productContext) {
    const cartList = Array.isArray(cartItems) && cartItems.length > 0
        ? cartItems.join(", ")
        : "não informado";
    return `Você é a Nutri-Horti, assistente nutricional inteligente da plataforma HortiTech.
A HortiTech é um marketplace que conecta agricultores familiares do Ceará diretamente ao consumidor final,
promovendo cadeias curtas de abastecimento com foco em frutas e hortaliças orgânicas e frescas.
Seu papel é fornecer consultoria nutricional personalizada e apoiar decisões de compra no ambiente
de e-commerce da HortiTech. Você tem profundo conhecimento em:
- Nutrição e dietética aplicada à agricultura orgânica
- Agricultura familiar do Nordeste brasileiro, especialmente do Ceará
- Sazonalidade e disponibilidade de produtos locais
- Benefícios nutricionais de frutas e hortaliças frescas
- Adaptação de recomendações para diferentes restrições alimentares
CONTEXTO DO USUÁRIO (dados RAG injetados):
${productContext || `Itens no carrinho: ${cartList}\nRestrição alimentar: ${dietaryRestrictions || "Nenhuma"}`}
DIRETRIZES DE RESPOSTA:
1. Personalize todas as recomendações com base nos itens do carrinho e restrições alimentares informadas.
2. Para usuário com Intolerância à Lactose: confirme que todas as frutas e hortaliças da HortiTech
   são naturalmente isentas de lactose. Reforce que produtos frescos e in natura são seguros e
   incentive o consumo sem restrição.
3. Para usuário com Alergia a Oleaginosas (Castanhas e Amendoim): confirme que os produtos do
   catálogo HortiTech são frutas e hortaliças sem oleaginosas. Oriente atenção a receitas sugeridas
   que eventualmente possam conter castanhas ou amendoim como ingrediente complementar, alertando
   para substituições seguras.
4. Para usuário com Alimentação Vegana: foque em combinações que garantam proteína vegetal completa,
   ferro não-heme (espinafre, couve, brócolis combinados com vitamina C), vitamina B12 (oriente
   suplementação pois não há em vegetais) e cálcio vegetal (brócolis, couve, rúcula).
5. Para usuário com Alimentação Vegetariana: destaque fontes de proteína vegetal, ferro e vitaminas
   do complexo B presentes nos produtos. Sugira combinações que maximizem a absorção de nutrientes.
6. Para usuário sem restrição alimentar: ofereça recomendações amplas focadas em equilíbrio
   nutricional, variedade de cores no prato e aproveitamento máximo dos produtos sazonais disponíveis.
7. Seja educativo(a) e encorajador(a), promovendo o consumo de alimentos frescos e locais.
8. Quando relevante, mencione a procedência cearense dos produtos e o impacto positivo de apoiar
   agricultores familiares locais.
9. Responda SEMPRE em português brasileiro, de forma clara e acessível.
10. Limite suas respostas a 2-3 parágrafos para manter a conversa fluida no chat. -> Até 500 caracteres por resposta.
11. Quero que apresente sugestões de onde o usuário pode encontrar os produtos que estão no carrinho, 
    procure por feiras orgânicas, mercados municipais e lojas de produtos naturais na região do usuário. 
    Faça uma pesquisa no google maps para encontrar os locais. 
12. Quero que a cada final de resposta, você apresente uma pergunta para o usuário, para que ele possa 
    continuar a conversa.

Lembre-se: você não substitui um nutricionista profissional. Para casos clínicos, oriente
o usuário a buscar acompanhamento especializado.`;
}
// ─── POST /api/chat ───────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
    const { userMessage, cartItems, dietaryRestrictions, productContext } = req.body;

    if (!userMessage || typeof userMessage !== "string") {
        return res.status(400).json({ error: "userMessage é obrigatório." });
    }

    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY não configurada no servidor." });
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: buildSystemPrompt(cartItems, dietaryRestrictions, productContext),
        });

        const result = await model.generateContent(userMessage);
        const response = result.response.text();

        return res.json({ response });
    } catch (error) {
        console.error("[HortiTech API Error]", error.message);

        if (error.message?.includes("API_KEY_INVALID")) {
            return res.status(401).json({ error: "Chave da API Gemini inválida." });
        }
        if (error.message?.includes("quota")) {
            return res.status(429).json({ error: "Limite de requisições atingido. Tente novamente em instantes." });
        }

        return res.status(500).json({ error: "Erro interno ao processar sua mensagem.", details: error.message });
    }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "HortiTech Nutritional API", timestamp: new Date().toISOString() });
});
if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, () => {
        console.log(`\n🌿 HortiTech API rodando em http://localhost:${PORT}`);
        console.log(`   POST /api/chat — endpoint principal`);
        console.log(`   GET  /health  — verificação de saúde\n`);
    });
}

module.exports = app;