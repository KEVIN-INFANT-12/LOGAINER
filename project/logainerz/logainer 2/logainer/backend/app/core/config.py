import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "LOGAINER - North Eastern Region Logistics Intelligence"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("JWT_SECRET", "logainer-dev-secret-key-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Weather API (OpenWeatherMap)
    WEATHER_API_KEY: str = os.getenv("OPENWEATHER_API_KEY", "")
    
    # OSRM Server (public or self-hosted)
    OSRM_BASE_URL: str = os.getenv("OSRM_BASE_URL", "https://router.project-osrm.org")
    
    # NER Bounding Box: [min_lat, min_lon, max_lat, max_lon]
    NER_BBOX: list = [21.5, 87.8, 29.5, 97.5]

settings = Settings()
