from pydantic_settings import BaseSettings
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    market_data_provider: str = "polygon"
    polygon_api_key: str = ""
    anthropic_api_key: str = ""
    tushare_token: str = ""
    database_path: str = str(PROJECT_ROOT / "pokieticker.db")

    model_config = {"env_file": str(PROJECT_ROOT / ".env"), "env_file_encoding": "utf-8"}


settings = Settings()
