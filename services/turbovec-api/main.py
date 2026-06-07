from __future__ import annotations

import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from config import settings
from embeddings import embed_query, embed_texts
from index_manager import chunk_text, index_manager

app = FastAPI(title="LexIA TurboVec API", version="1.0.0")


def verify_secret(authorization: str | None = Header(default=None)) -> None:
    secret = settings.turbovec_api_secret
    if not secret:
        return
    if authorization != f"Bearer {secret}":
        raise HTTPException(status_code=401, detail="Unauthorized")


class UpsertItem(BaseModel):
    vector_id: int = Field(..., ge=1)
    text: str = Field(..., min_length=1)


class UpsertRequest(BaseModel):
    organization_id: str
    items: list[UpsertItem]


class UpsertFromTextRequest(BaseModel):
    organization_id: str
    vector_id_start: int = Field(..., ge=1)
    text: str = Field(..., min_length=1)


class RemoveRequest(BaseModel):
    organization_id: str
    vector_ids: list[int]


class SearchRequest(BaseModel):
    organization_id: str
    query: str = Field(..., min_length=1)
    k: int = Field(default=8, ge=1, le=50)
    allowlist: list[int] | None = None


@app.get("/health")
async def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "embedding_model": settings.huggingface_embedding_model,
        "hf_configured": bool(settings.huggingface_api_key),
    }


@app.get("/v1/stats/{organization_id}", dependencies=[Depends(verify_secret)])
async def stats(organization_id: str) -> dict:
    return index_manager.stats(organization_id)


@app.post("/v1/upsert", dependencies=[Depends(verify_secret)])
async def upsert(body: UpsertRequest) -> dict:
    if not body.items:
        return {"indexed": 0}

    texts = [item.text for item in body.items]
    vector_ids = np.array([item.vector_id for item in body.items], dtype=np.uint64)
    vectors = await embed_texts(texts)
    indexed = index_manager.upsert(body.organization_id, vector_ids, vectors)
    return {"indexed": indexed, "dim": int(vectors.shape[1]) if vectors.size else None}


@app.post("/v1/upsert-text", dependencies=[Depends(verify_secret)])
async def upsert_text(body: UpsertFromTextRequest) -> dict:
    chunks = chunk_text(body.text)
    if not chunks:
        return {"indexed": 0, "chunks": 0, "vector_ids": []}

    vector_ids = np.array(
        [body.vector_id_start + i for i in range(len(chunks))],
        dtype=np.uint64,
    )
    vectors = await embed_texts(chunks)
    indexed = index_manager.upsert(body.organization_id, vector_ids, vectors)
    return {
        "indexed": indexed,
        "chunks": len(chunks),
        "vector_ids": [int(v) for v in vector_ids],
        "dim": int(vectors.shape[1]) if vectors.size else None,
    }


@app.post("/v1/remove", dependencies=[Depends(verify_secret)])
async def remove(body: RemoveRequest) -> dict:
    if not body.vector_ids:
        return {"removed": 0}
    removed = index_manager.remove(
        body.organization_id,
        np.array(body.vector_ids, dtype=np.uint64),
    )
    return {"removed": removed}


@app.post("/v1/search", dependencies=[Depends(verify_secret)])
async def search(body: SearchRequest) -> dict:
    query_vector = await embed_query(body.query)
    allowlist = np.array(body.allowlist, dtype=np.uint64) if body.allowlist else None
    scores, ids = index_manager.search(body.organization_id, query_vector, body.k, allowlist)

    row_scores = scores[0].tolist() if scores.size else []
    row_ids = [int(x) for x in ids[0].tolist()] if ids.size else []

    return {
        "results": [
            {"vector_id": vid, "score": float(score)}
            for vid, score in zip(row_ids, row_scores, strict=True)
        ],
    }
