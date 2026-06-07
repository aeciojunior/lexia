# TurboVec API — LexIA

Serviço Python que indexa e busca documentos jurídicos com [turbovec](https://github.com/RyanCodrai/turbovec) + embeddings Hugging Face.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Health check |
| POST | `/v1/upsert` | Indexa chunks com `vector_id` + texto |
| POST | `/v1/upsert-text` | Divide texto, indexa e devolve `vector_ids` |
| POST | `/v1/search` | Busca semântica (opcional `allowlist`) |
| POST | `/v1/remove` | Remove vetores por id |
| GET | `/v1/stats/{org_id}` | Estatísticas do índice da organização |

Todas as rotas `/v1/*` aceitam header `Authorization: Bearer <TURBOVEC_API_SECRET>` quando o secret estiver configurado.

## Variáveis de ambiente

```env
HUGGINGFACE_API_KEY=hf_...
HUGGINGFACE_EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
TURBOVEC_API_SECRET=...
INDEX_DIR=./data/indices
TURBOVEC_BIT_WIDTH=4
```

## Desenvolvimento local

```bash
cd services/turbovec-api
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8090
```

## Deploy no Render

O `render.yaml` na raiz inclui o serviço `lexia-turbovec`. Configure as env vars acima e anexe **Persistent Disk** em `/var/data/indices` (`INDEX_DIR=/var/data/indices`) para não perder índices entre deploys.

No Supabase, configure `TURBOVEC_API_URL` e `TURBOVEC_API_SECRET` nos secrets das edge functions.
