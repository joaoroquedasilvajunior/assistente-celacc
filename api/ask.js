// Vercel serverless function: POST /api/ask  { messages: [{role, content}, ...] }
// Holds the API key and the FAQ; the browser never sees either.
import fs from "node:fs";
import path from "node:path";

const FAQ = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "celacc_faq.json"), "utf8")
);

const SYSTEM = `Você é o assistente de dúvidas do Celacc (ECA-USP) para candidatos e alunos dos cursos de pós-graduação lato sensu.
Responda em português do Brasil, de forma cordial e direta, USANDO EXCLUSIVAMENTE a base de FAQ abaixo.
Regras:
- Se uma ou mais entradas respondem à pergunta, reformule a resposta em tom conversacional, sem inventar detalhes que não estejam na base. Mantenha valores, datas, links e e-mails exatamente como estão.
- Nunca afirme uma negativa que a base não declara. Se a base descreve uma condição (ex.: 18 parcelas) mas não diz que outras são impossíveis, apresente o que a base diz e encaminhe o restante para celacc@usp.br, sem dizer "não".
- Se nenhuma entrada responde (ou responde só parcialmente ao ponto central), NÃO improvise: diga que essa informação não está na FAQ e oriente a escrever para celacc@usp.br.
- Se a pergunta for ambígua entre cursos, pergunte qual curso (GESTCULT, MIDCULT ou ETNOCULT).
- Perguntas fora do tema (não relacionadas ao Celacc) recebem "não encontrei".
Responda SOMENTE com um objeto JSON válido, sem markdown, no formato:
{"matched_ids": ["id1"], "answer": "texto", "found": true}
Use "found": false e matched_ids vazio quando não houver correspondência.

BASE DE FAQ (JSON):
${JSON.stringify(
  FAQ.entries.map((e) => ({
    id: e.id, category: e.category, question: e.question, variants: e.variants, answer: e.answer,
  }))
)}`;

const MAX_TURNS = 12; // keep context small; it's a FAQ, not a long conversation

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-MAX_TURNS) : [];
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || typeof last.content !== "string" || !last.content.trim())
    return res.status(400).json({ error: "messages must end with a non-empty user turn" });
  if (last.content.length > 1000) return res.status(400).json({ error: "question too long" });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
        max_tokens: 800,
        system: SYSTEM,
        messages,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data?.error?.message || "upstream error" });

    const raw = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    let out;
    try {
      out = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      out = { found: false, matched_ids: [], answer: "Não consegui interpretar a resposta. Tente reformular a pergunta." };
    }

    if (!out.found) {
      // Roadmap for new FAQ entries. Vercel logs are enough to start; swap for KV/Postgres when needed.
      console.log(JSON.stringify({ event: "unanswered", q: last.content, at: new Date().toISOString() }));
    }
    return res.status(200).json({ ...out, raw });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "request failed" });
  }
}
