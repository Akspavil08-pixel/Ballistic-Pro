from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Ballistic Calculator"
    database_url: str = "sqlite:///./app.db"
    allow_origins: list[str] = ["*"]


settings = Settings()
