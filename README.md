# Assistente Celacc

Chatbot de FAQ para embutir no Moodle. Responde **só** com base em `data/celacc_faq.json`;
quando não encontra, encaminha para celacc@usp.br.

```
public/index.html   – a janela de chat (estática)
api/ask.js          – função serverless: guarda a chave, monta o prompt, chama a Claude API
data/celacc_faq.json – a base de perguntas e respostas (edite aqui, sem mexer no código)
```

## Deploy (Vercel)

1. Crie um repositório com estes arquivos e importe no Vercel (New Project → Import).
2. Em *Settings → Environment Variables*, adicione `ANTHROPIC_API_KEY`.
3. Deploy. A URL final fica algo como `https://assistente-celacc.vercel.app`.

Teste local: `npm i -g vercel && cp .env.example .env && vercel dev`.

## Embutir no Moodle

Como professor/editor do curso, adicione um recurso **Página** (ou um rótulo) e, no editor HTML, cole:

```html
<iframe
  src="https://assistente-celacc.vercel.app"
  title="Assistente Celacc"
  style="width:100%;max-width:600px;height:640px;border:1px solid #d6dae6;border-radius:12px"
  loading="lazy"></iframe>
```

Se o Moodle remover o `<iframe>` ao salvar, o administrador precisa liberar a tag no filtro
HTML (Site administration → Plugins → Filters) — ou use o recurso **URL** com exibição "embed".

O `vercel.json` só permite embutir a página em domínios `*.usp.br` e `*.moodle.com`
(`frame-ancestors`). Ajuste se o Moodle estiver em outro domínio.

## Manter a FAQ

- Cada entrada tem `question` (canônica) e `variants` (outras formulações). Quanto mais
  variantes reais, melhor o casamento.
- Entradas com `volatile: true` têm datas ou valores que expiram — revise a cada edital.
- Perguntas sem resposta aparecem nos logs do Vercel como `{"event":"unanswered", ...}`.
  É a lista do que falta na FAQ.

## Próximos passos possíveis

- Guardar `unanswered` em Vercel KV ou Postgres em vez de logs.
- Passar de "FAQ inteira no prompt" para busca vetorial (pgvector) quando a base passar de
  algumas centenas de entradas.
- Versão em francês: mesma estrutura, `data/faq_fr.json` + tradução do prompt de sistema.
