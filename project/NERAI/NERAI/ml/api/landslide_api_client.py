"""
Configurable client for an external landslide/disaster-information API.

The concrete provider/endpoint was NOT identifiable from the project files
supplied, so no endpoint is hard-coded here. Set the following environment
variables (e.g. in a local .env, loaded by python-dotenv or your process
manager -- never commit .env):

    LANDSLIDE_API_URL   -- base URL of the real API (INSERT THE REAL ENDPOINT HERE)
    LANDSLIDE_API_KEY   -- secret key, read from the environment only, never logged

The model trains and runs entirely on the historical datasets without this
API. When configured, this client can supply an ADDITIONAL real-time feature
(e.g. a live landslide alert flag for a region) to the inference pipeline;
it is not a hard dependency for training or inference.
"""
import os
import requests


class LandslideAPIClient:
    def __init__(self):
        self.base_url = os.environ.get("LANDSLIDE_API_URL")
        self.api_key = os.environ.get("LANDSLIDE_API_KEY")

    def is_configured(self):
        return bool(self.base_url and self.api_key)

    def get_recent_alerts(self, lat, lon, radius_km=50, timeout=10):
        if not self.is_configured():
            raise RuntimeError(
                "LANDSLIDE_API_URL / LANDSLIDE_API_KEY are not set. "
                "Live API alerts are unavailable; the model will run on historical "
                "features only. INSERT THE REAL ENDPOINT PATH BELOW once known."
            )
        # INSERT REAL ENDPOINT PATH HERE, e.g. f"{self.base_url}/v1/alerts"
        url = f"{self.base_url}/alerts"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        params = {"lat": lat, "lon": lon, "radius_km": radius_km}
        resp = requests.get(url, headers=headers, params=params, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
