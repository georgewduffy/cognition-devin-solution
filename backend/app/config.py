from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    devin_api_key: SecretStr = Field(..., alias="DEVIN_API_KEY")
    devin_org_id: str = Field(..., alias="DEVIN_ORG_ID")
    devin_api_base_url: str = Field(
        "https://api.devin.ai/v3", alias="DEVIN_API_BASE_URL"
    )

    github_token: SecretStr = Field(..., alias="GITHUB_TOKEN")
    github_owner: str = Field(..., alias="GITHUB_OWNER")
    github_repo: str = Field("superset", alias="GITHUB_REPO")
    github_webhook_secret: SecretStr = Field(..., alias="GITHUB_WEBHOOK_SECRET")

    log_level: str = Field("INFO", alias="LOG_LEVEL")


settings = Settings()


def get_settings() -> Settings:
    return settings
