import re
import json
from pathlib import Path

DICT_PATH = Path(__file__).resolve().parent.parent / "data" / "scam_dictionary.json"
try:
    with open(DICT_PATH, "r", encoding="utf-8") as f:
        SCAM_DATA = json.load(f)
except Exception:
    SCAM_DATA = {}

HIGH_RISK_KEYWORDS = SCAM_DATA.get("high_risk_keywords", [
    "friends and family", "friends & family", "wire transfer", "western union",
    "moneygram", "gift card", "steam card", "apple card", "crypto only", "bitcoin",
    "pay via zelle", "cashapp only", "no refund", "no buyer protection",
    "avoid fees", "pay off platform", "telegram me", "whatsapp only",
    "apple gift card", "amazon gift card", "venmo friends", "no chargeback"
])

URGENCY_KEYWORDS = SCAM_DATA.get("urgency_keywords", [
    "act now", "offer expires in", "hurry up", "last chance", "limited time only",
    "urgent", "only 5 minutes left", "in 10 minutes", "immediate payment",
    "hold for 15 minutes", "deal of a lifetime", "selling fast", "pay right now",
    "first come first served", "ending soon", "only 1 left"
])


class UrgencyDetector:
    """Analyzes seller notes, chat communication, and listing descriptions for manipulation, fake urgency, and payment bypass attempts."""

    @staticmethod
    def analyze(seller_notes: str, seller_name: str = "") -> dict:
        flags = []
        score = 0
        detected_diversions = []
        detected_urgency = []

        safe_seller_name = str(seller_name or "").strip()
        safe_seller_notes = str(seller_notes or "").strip()

        combined_text = f"{safe_seller_name} {safe_seller_notes}".strip()
        if not combined_text:
            return {
                "score": 20,
                "flags": ["No seller communication or listing details provided for tone and policy verification."],
                "details": {"notes_length": 0}
            }

        lower_text = combined_text.lower()

        # Identify attempts to divert payment to methods that waive buyer protection
        for kw in HIGH_RISK_KEYWORDS:
            if kw in lower_text:
                score += 45
                detected_diversions.append(kw)

        if detected_diversions:
            flags.append(
                f"Critical payment warning: Seller specifically requests '{', '.join(detected_diversions)}'. "
                f"Legitimate commerce sellers on PayPal will never ask you to waive PayPal Purchase Protection or use Friends & Family."
            )

        # Flag artificial scarcity and time pressure tactics used to prevent due diligence
        for kw in URGENCY_KEYWORDS:
            if kw in lower_text:
                score += 25
                detected_urgency.append(kw)

        if detected_urgency:
            flags.append(
                f"High-pressure tactic: Seller creates artificial urgency using phrases like '{', '.join(detected_urgency)}'. "
                f"Scammers frequently rush buyers into paying before they can research the listing."
            )

        # Check for aggressive capitalization shouting (stripping punctuation first)
        words = safe_seller_notes.split()
        if len(words) >= 5:
            caps_words = []
            for w in words:
                cleaned_w = w.strip("!?,.:;\"'()")
                if cleaned_w.isupper() and len(cleaned_w) > 2 and cleaned_w.isalpha():
                    caps_words.append(cleaned_w)

            caps_ratio = len(caps_words) / len(words)
            if caps_ratio > 0.35:
                score += 15
                flags.append("Seller message uses heavy capitalized shouting/aggressive formatting.")

        exclamation_count = safe_seller_notes.count("!")
        if exclamation_count >= 4:
            score += 10
            flags.append("Excessive exclamation marks indicate high-stress persuasion tactics.")

        contact_red_flags = ["whatsapp", "telegram", "dm me", "inbox me", "text me at"]
        matched_contacts = [c for c in contact_red_flags if c in lower_text]
        if matched_contacts:
            score += 25
            flags.append(
                f"Seller attempts off-platform steering ({', '.join(matched_contacts)}). Always keep transactions inside PayPal's secure checkout."
            )

        if not flags:
            flags.append("Communication tone is professional and contains no aggressive payment demands or artificial timers.")

        return {
            "score": min(100, score),
            "flags": flags,
            "details": {
                "detected_diversions": detected_diversions,
                "detected_urgency": detected_urgency,
                "word_count": len(words)
            }
        }
