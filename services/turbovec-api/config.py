from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    huggingface_api_key: str = ""
    huggingface_embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    turbovec_bit_width: int = 4
    turbovec_api_secret: str = ""
    index_dir: str = "./data/indices"
    chunk_size: int = 900
    chunk_overlap: int = 120


settings = Settings()
