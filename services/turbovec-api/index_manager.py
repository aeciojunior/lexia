from __future__ import annotations

import re
import threading
from pathlib import Path

import numpy as np
from turbovec import IdMapIndex

from config import settings


def chunk_text(text: str, chunk_size: int | None = None, overlap: int | None = None) -> list[str]:
    size = chunk_size or settings.chunk_size
    ov = overlap or settings.chunk_overlap
    cleaned = re.sub(r"\s+", " ", text.strip())
    if not cleaned:
        return []

    if len(cleaned) <= size:
        return [cleaned]

    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(start + size, len(cleaned))
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(cleaned):
            break
        start = max(end - ov, start + 1)
    return chunks


class OrgIndexManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._indices: dict[str, IdMapIndex] = {}
        self._index_dir = Path(settings.index_dir)
        self._index_dir.mkdir(parents=True, exist_ok=True)

    def _path_for_org(self, organization_id: str) -> Path:
        safe = organization_id.replace("/", "_")
        return self._index_dir / f"{safe}.tvim"

    def _load_or_create(self, organization_id: str) -> IdMapIndex:
        if organization_id in self._indices:
            return self._indices[organization_id]

        path = self._path_for_org(organization_id)
        if path.exists():
            index = IdMapIndex.load(str(path))
        else:
            index = IdMapIndex(bit_width=settings.turbovec_bit_width)

        self._indices[organization_id] = index
        return index

    def _persist(self, organization_id: str, index: IdMapIndex) -> None:
        path = self._path_for_org(organization_id)
        index.write(str(path))

    def upsert(
        self,
        organization_id: str,
        vector_ids: np.ndarray,
        vectors: np.ndarray,
    ) -> int:
        if len(vector_ids) == 0:
            return 0

        vector_ids = vector_ids.astype(np.uint64)
        vectors = np.ascontiguousarray(vectors, dtype=np.float32)

        with self._lock:
            index = self._load_or_create(organization_id)

            to_add_ids: list[int] = []
            to_add_vectors: list[np.ndarray] = []

            for vid, vec in zip(vector_ids, vectors, strict=True):
                vid_int = int(vid)
                if vid_int in index:
                    index.remove(vid_int)
                to_add_ids.append(vid_int)
                to_add_vectors.append(vec)

            batch = np.vstack(to_add_vectors)
            ids_array = np.array(to_add_ids, dtype=np.uint64)
            index.add_with_ids(batch, ids_array)
            self._persist(organization_id, index)
            return len(to_add_ids)

    def remove(self, organization_id: str, vector_ids: np.ndarray) -> int:
        if len(vector_ids) == 0:
            return 0

        removed = 0
        with self._lock:
            index = self._load_or_create(organization_id)
            for vid in vector_ids.astype(np.uint64):
                if index.remove(int(vid)):
                    removed += 1
            if removed:
                self._persist(organization_id, index)
        return removed

    def search(
        self,
        organization_id: str,
        query_vector: np.ndarray,
        k: int,
        allowlist: np.ndarray | None = None,
    ) -> tuple[np.ndarray, np.ndarray]:
        query = np.ascontiguousarray(query_vector.reshape(1, -1), dtype=np.float32)

        with self._lock:
            index = self._load_or_create(organization_id)
            if len(index) == 0:
                return np.empty((1, 0), dtype=np.float32), np.empty((1, 0), dtype=np.uint64)

            if allowlist is not None and len(allowlist) == 0:
                return np.empty((1, 0), dtype=np.float32), np.empty((1, 0), dtype=np.uint64)

            allow = allowlist.astype(np.uint64) if allowlist is not None else None
            scores, ids = index.search(query, k=k, allowlist=allow)

        return scores, ids

    def stats(self, organization_id: str) -> dict[str, int | None]:
        with self._lock:
            index = self._load_or_create(organization_id)
            return {
                "vectors": len(index),
                "dim": index.dim,
                "bit_width": index.bit_width,
            }


index_manager = OrgIndexManager()
