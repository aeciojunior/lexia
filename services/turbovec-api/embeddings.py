import httpx
import numpy as np

from config import settings

HF_FEATURE_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction"


def _normalize_rows(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    return (vectors / norms).astype(np.float32)


def _parse_hf_embedding(payload: object) -> list[float]:
    if isinstance(payload, list):
        if payload and isinstance(payload[0], (int, float)):
            return [float(x) for x in payload]
        if payload and isinstance(payload[0], list):
            if payload[0] and isinstance(payload[0][0], (int, float)):
                return [float(x) for x in payload[0]]
            if payload[0] and isinstance(payload[0][0], list):
                return [float(x) for x in payload[0][0]]
    raise ValueError("Unexpected Hugging Face embedding response")


async def embed_texts(texts: list[str]) -> np.ndarray:
    if not texts:
        return np.empty((0, 0), dtype=np.float32)

    if not settings.huggingface_api_key:
        raise RuntimeError("HUGGINGFACE_API_KEY is not configured")

    url = f"{HF_FEATURE_URL}/{settings.huggingface_embedding_model}"
    headers = {"Authorization": f"Bearer {settings.huggingface_api_key}"}

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, headers=headers, json={"inputs": texts})

        if response.status_code == 503:
            raise RuntimeError("Embedding model is loading on Hugging Face; retry shortly")

        response.raise_for_status()
        payload = response.json()

    if isinstance(payload, list) and payload and isinstance(payload[0], list):
        if payload and isinstance(payload[0][0], (int, float)):
            vectors = np.array([_parse_hf_embedding(item) for item in payload], dtype=np.float32)
        else:
            vectors = np.array([_parse_hf_embedding(item) for item in payload], dtype=np.float32)
    else:
        vectors = np.array([_parse_hf_embedding(payload)], dtype=np.float32)

    return _normalize_rows(vectors)


async def embed_query(text: str) -> np.ndarray:
    vectors = await embed_texts([text])
    return vectors[0]
