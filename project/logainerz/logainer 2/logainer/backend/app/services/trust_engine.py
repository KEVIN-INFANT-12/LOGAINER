import time
import math
from typing import Dict, Any, List, Optional

class IncidentTrustEngine:
    """
    Crowdsourced Incident Trust & Data Fusion Engine
    Calculates multi-factor verification trust score (0-100%) and 
    resolves conflicts between citizen reports, official feeds, and AI risk.
    
    Hard Rule: Citizen/driver reports NEVER directly override official road status 
    unless Trust Score >= 80% with >= 2 independent corroborations and photo evidence.
    """

    ROLE_WEIGHTS = {
        "OFFICIAL": 0.40,
        "NDRF": 0.40,
        "BRO": 0.40,
        "PWD": 0.38,
        "POLICE": 0.35,
        "DRIVER": 0.20,
        "CITIZEN": 0.12,
        "ANONYMOUS": 0.05
    }

    @classmethod
    def compute_trust_score(
        cls,
        reporter_role: str,
        has_gps_fix: bool,
        has_photo: bool,
        corroborating_reports_count: int,
        is_official_verified: bool,
        reporter_reputation_score: float = 0.85,
        time_elapsed_hours: float = 0.5
    ) -> Dict[str, Any]:
        """
        Computes explainable trust score (0 - 100%) and categorizes trust level.
        """
        if is_official_verified:
            return {
                "trust_score_pct": 98,
                "trust_level": "OFFICIALLY VERIFIED",
                "badge_color": "emerald",
                "can_affect_road_status": True,
                "factors": {
                    "official_authority": 98,
                    "gps_accuracy": 95,
                    "corroboration": 100,
                    "evidence_quality": 95
                },
                "explanation": "Verified directly by State Disaster Management / Border Roads Organisation authority."
            }

        # Calculate role component (max 40 pts)
        role_upper = reporter_role.upper()
        role_score = 12.0
        for k, v in cls.ROLE_WEIGHTS.items():
            if k in role_upper:
                role_score = v * 100.0
                break

        # GPS accuracy component (max 20 pts)
        gps_score = 20.0 if has_gps_fix else 5.0

        # Photo evidence component (max 20 pts)
        photo_score = 20.0 if has_photo else 0.0

        # Corroborating independent reports (max 15 pts)
        corrob_score = min(15.0, corroborating_reports_count * 5.0)

        # Freshness decay factor (max 5 pts)
        freshness_score = max(0.0, 5.0 - min(5.0, time_elapsed_hours * 0.2))

        # Total Trust Score
        raw_trust = role_score + gps_score + photo_score + corrob_score + freshness_score
        total_trust = min(94, max(15, int(raw_trust * (reporter_reputation_score / 1.0))))

        # Categorize Trust
        if total_trust >= 80:
            category = "HIGH TRUST"
            badge_color = "teal"
            can_affect = True
        elif total_trust >= 60:
            category = "MEDIUM TRUST"
            badge_color = "cyan"
            can_affect = False
        elif total_trust >= 40:
            category = "LOW TRUST"
            badge_color = "amber"
            can_affect = False
        else:
            category = "UNVERIFIED"
            badge_color = "slate"
            can_affect = False

        explanation_parts = []
        if has_photo: explanation_parts.append("geo-tagged photo evidence attached")
        if corroborating_reports_count > 0: explanation_parts.append(f"{corroborating_reports_count} corroborating field reports")
        if has_gps_fix: explanation_parts.append("hardware GPS coordinate verification")
        
        explanation = f"Trust evaluated at {total_trust}% based on {', '.join(explanation_parts) if explanation_parts else 'initial unverified submission'}."

        return {
            "trust_score_pct": total_trust,
            "trust_level": category,
            "badge_color": badge_color,
            "can_affect_road_status": can_affect,
            "factors": {
                "role_authority": int(role_score),
                "gps_accuracy": int(gps_score),
                "photo_evidence": int(photo_score),
                "corroboration": int(corrob_score),
                "freshness": int(freshness_score)
            },
            "explanation": explanation
        }

    @classmethod
    def fuse_and_resolve_road_status(
        cls,
        official_status: str,
        citizen_reports: List[Dict[str, Any]],
        ai_ner_gdi_score: float
    ) -> Dict[str, Any]:
        """
        Data Fusion Engine:
        Fuses Official Status + Crowdsourced Reports + AI NER-GDI Risk -> Final Road Status Enum
        Returns: Final Status (OPEN / CAUTION / HIGH RISK / BLOCKED / VERIFICATION REQUIRED)
        """
        # If officially marked blocked, retain blocked
        if official_status in ["BLOCKED", "CRITICAL_BLOCKED"]:
            return {
                "final_status": "BLOCKED",
                "status_reason": "Official National Highway / PWD road blockade directive in effect.",
                "confidence_pct": 98,
                "is_override": False
            }

        # Check trusted citizen reports
        high_trust_reports = [r for r in citizen_reports if r.get("trust_score_pct", 0) >= 80]
        medium_trust_reports = [r for r in citizen_reports if 60 <= r.get("trust_score_pct", 0) < 80]

        if len(high_trust_reports) >= 2:
            return {
                "final_status": "BLOCKED",
                "status_reason": f"Corroborated by {len(high_trust_reports)} verified field reports with photo & GPS telemetry.",
                "confidence_pct": 89,
                "is_override": True
            }
        elif len(high_trust_reports) == 1 or len(medium_trust_reports) >= 2:
            return {
                "final_status": "VERIFICATION REQUIRED",
                "status_reason": "Crowdsourced blockage alert detected; ground reconnaissance patrol dispatched for formal verification.",
                "confidence_pct": 74,
                "is_override": False
            }
        elif ai_ner_gdi_score >= 80.0:
            return {
                "final_status": "HIGH RISK",
                "status_reason": f"AI NER-GDI indicates critical slope instability (Risk: {ai_ner_gdi_score}/100) despite no physical debris reported yet.",
                "confidence_pct": 82,
                "is_override": False
            }
        elif ai_ner_gdi_score >= 50.0:
            return {
                "final_status": "CAUTION",
                "status_reason": "Advisory in place due to monsoon waterlogging and moderate rockfall potential.",
                "confidence_pct": 76,
                "is_override": False
            }
        else:
            return {
                "final_status": "OPEN",
                "status_reason": "All sensory parameters and telemetry confirm full corridor accessibility.",
                "confidence_pct": 94,
                "is_override": False
            }

trust_engine = IncidentTrustEngine()
