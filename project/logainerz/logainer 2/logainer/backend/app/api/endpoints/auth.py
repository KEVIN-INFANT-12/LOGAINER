from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from typing import Optional
from backend.app.core.security import create_access_token, verify_password, get_password_hash, decode_token

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    username: str
    full_name: str
    role: str
    department: str
    state: str
    access_token: str
    token_type: str = "bearer"

# Pre-registered Demo GovTech Accounts
DEMO_USERS = {
    "officer@logainer.gov.in": {
        "password_hash": "admin123",
        "full_name": "Dr. Anupam Sarma, IAS",
        "role": "State Logistics Director",
        "department": "Ministry of Development of North Eastern Region (MDoNER)",
        "state": "Assam"
    },
    "bro.commander@gov.in": {
        "password_hash": "bro123",
        "full_name": "Col. R. K. Thapa",
        "role": "Chief Engineer",
        "department": "Border Roads Organisation (Project Vartak / Pushpak)",
        "state": "Arunachal Pradesh"
    },
    "ndrf.commander@gov.in": {
        "password_hash": "ndrf123",
        "full_name": "Commander J. Sangma",
        "role": "Emergency Response Officer",
        "department": "National Disaster Response Force (1st Bn NDRF Guwahati)",
        "state": "Meghalaya"
    },
    "driver@nerlogistics.in": {
        "password_hash": "driver123",
        "full_name": "Tenzing Norbu",
        "role": "Fleet Driver / Ground Operator",
        "department": "NER Essential Cold-Chain Convoy",
        "state": "Sikkim"
    }
}

@router.post("/login", response_model=UserResponse)
def login(request: LoginRequest):
    user_info = DEMO_USERS.get(request.username)
    if not user_info or not verify_password(request.password, user_info["password_hash"]):
        # Allow default fallback demo login for any non-empty password
        if len(request.password) >= 4:
            token = create_access_token(
                subject=request.username,
                role="Logistics Officer",
                state="Assam"
            )
            return UserResponse(
                username=request.username,
                full_name=request.username.split("@")[0].capitalize(),
                role="Logistics Officer",
                department="NER Regional Transport Cell",
                state="Assam",
                access_token=token
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please enter a valid username and password."
        )

    token = create_access_token(
        subject=request.username,
        role=user_info["role"],
        state=user_info["state"]
    )
    return UserResponse(
        username=request.username,
        full_name=user_info["full_name"],
        role=user_info["role"],
        department=user_info["department"],
        state=user_info["state"],
        access_token=token
    )

@router.get("/me")
def get_current_user(token: Optional[str] = None):
    if not token:
        return {"authenticated": False, "role": "GUEST"}
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload
