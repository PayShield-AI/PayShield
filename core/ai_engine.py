import json
import math
import urllib.request
import urllib.error
from typing import Dict, Any, List

from config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    RISK_THRESHOLD_LOW,
    RISK_THRESHOLD_MEDIUM
)
from core.domain_inspector import DomainInspector
from core.price_analyzer import PriceAnalyzer
from core.urgency_detector import UrgencyDetector


class PayShieldAIEngine:
    """The central intelligence engine of PayShield.

    Coordinates domain reputation heuristics, price anomaly analysis, pushy language
    detection, and optional LLM (Gemini) plain-words synthesis.
    """

    def __init__(self):
        self.gemini_key = GEMINI_API_KEY
        self.gemini_model = GEMINI_MODEL

    def analyze_transaction(
        self,
        product_name: str,
        product_url: str,
        price: float,
        currency: str = "USD",
        seller_name: str = "",
        seller_notes: str = ""
    ) -> Dict[str, Any]:
        """Runs multi-layered risk analysis across domain, price, and seller communication."""

        domain_analysis = DomainInspector.inspect(product_url)
        price_analysis = PriceAnalyzer.analyze(product_name, price, currency)
        urgency_analysis = UrgencyDetector.analyze(seller_notes, seller_name)

        domain_score = domain_analysis["score"]
        price_score = price_analysis["score"]
        urgency_score = urgency_analysis["score"]

        # Composite weighted risk calculation
        raw_composite = (domain_score * 0.30) + (price_score * 0.35) + (urgency_score * 0.35)

        # Critical single-factor escalation: if any category exhibits severe fraud flags,
        # ensure the overall score escalates into high risk so it cannot be masked by low sub-scores
        if price_score >= 80 or urgency_score >= 70 or domain_score >= 80:
            raw_composite = max(raw_composite, 72.0)

        composite_score = min(100, max(0, int(round(raw_composite))))

        if composite_score <= RISK_THRESHOLD_LOW:
            risk_level = "LOW"
            color = "#10B981"
            action_advice = "Safe purchase detected. You can proceed directly to PayPal checkout with full buyer protection."
        elif composite_score <= RISK_THRESHOLD_MEDIUM:
            risk_level = "MEDIUM"
            color = "#F59E0B"
            action_advice = "Potential warning signs detected. Review the highlighted checklist carefully before confirming payment."
        else:
            risk_level = "HIGH"
            color = "#EF4444"
            action_advice = "Dangerous scam indicators detected! PayPal checkout is locked to protect your funds. Do not proceed unless you have independently verified this seller."

        all_flags: List[str] = (
            domain_analysis["flags"] +
            price_analysis["flags"] +
            urgency_analysis["flags"]
        )

        plain_explanation = self._generate_plain_explanation(
            product_name=product_name,
            price=price,
            currency=currency,
            seller_name=seller_name,
            risk_level=risk_level,
            risk_score=composite_score,
            flags=all_flags,
            domain_details=domain_analysis,
            price_details=price_analysis,
            urgency_details=urgency_analysis
        )

        return {
            "risk_level": risk_level,
            "risk_score": composite_score,
            "color": color,
            "summary": plain_explanation["summary"],
            "explanation": plain_explanation["explanation"],
            "key_takeaways": plain_explanation["key_takeaways"],
            "using_ai_model": plain_explanation.get("using_ai_model", False),
            "action_advice": action_advice,
            "can_instant_checkout": (risk_level == "LOW"),
            "requires_user_confirmation": (risk_level in ["MEDIUM", "HIGH"]),
            "breakdown": {
                "domain": {
                    "score": domain_score,
                    "label": "Website & Domain Authenticity",
                    "flags": domain_analysis["flags"]
                },
                "price": {
                    "score": price_score,
                    "label": "Price Realism & Discount Anomaly",
                    "flags": price_analysis["flags"]
                },
                "urgency": {
                    "score": urgency_score,
                    "label": "Seller Language & Pressure Tactics",
                    "flags": urgency_analysis["flags"]
                }
            }
        }

    def _generate_plain_explanation(
        self,
        product_name: str,
        price: float,
        currency: str,
        seller_name: str,
        risk_level: str,
        risk_score: int,
        flags: List[str],
        domain_details: dict,
        price_details: dict,
        urgency_details: dict
    ) -> Dict[str, Any]:
        """Synthesizes human-friendly plain English reasoning."""

        if self.gemini_key:
            gemini_result = self._call_gemini_api(
                product_name, price, currency, seller_name, risk_level, risk_score, flags
            )
            if gemini_result:
                gemini_result["using_ai_model"] = True
                return gemini_result

        # Built-in fallback NLP explanation generator for offline or zero-config execution
        clean_item = product_name or "this item"
        clean_price = (
            f"${float(price):.2f}"
            if isinstance(price, (int, float)) and math.isfinite(price)
            else "the asking price"
        )

        if risk_level == "HIGH":
            summary = (
                f"PayShield detected serious warning signs for '{clean_item}'. "
                f"There is a very high likelihood this is a fraudulent storefront or payment scam."
            )
            explanation = (
                f"The offer exhibits multiple classic scam patterns: "
                f"The price ({clean_price}) appears unrealistic, the website structure contains suspicious markers, "
                f"and the seller communication attempts to bypass normal buyer protection mechanisms. "
                f"Sending funds to this seller carries an extreme risk of total loss."
            )
            takeaways = [
                "Never send money via PayPal 'Friends and Family' or wire transfers to commercial sellers.",
                "Legitimate retail outlets never slash top-tier tech or luxury goods by 80%+ without manufacturer authorization.",
                "PayShield has placed a safety lock on the checkout button to protect your money."
            ]

        elif risk_level == "MEDIUM":
            summary = (
                f"PayShield found potential concerns regarding '{clean_item}' from seller '{seller_name or 'Unknown'}'. "
                f"Caution is advised before you finalize payment."
            )
            explanation = (
                f"While this may be a valid independent seller, our AI flagged warning signs such as unusual pricing, "
                f"a non-standard web domain, or rushed communication. Please review the seller's return policy and confirm "
                f"that payment is processed as a protected commercial purchase under PayPal Purchase Protection."
            )
            takeaways = [
                "Verify the seller's external reviews and track record before proceeding.",
                "Ensure your transaction qualifies for PayPal Goods & Services coverage.",
                "Double check the domain address in your browser address bar."
            ]

        else:
            summary = (
                f"'{clean_item}' looks safe! No critical scam indicators or manipulative payment tactics were detected."
            )
            explanation = (
                f"The product price ({clean_price}) is in line with realistic market expectations, the domain is verified, "
                f"and seller notes contain no pushy or evasive language. You can proceed with standard PayPal checkout."
            )
            takeaways = [
                "Transaction is eligible for standard PayPal Buyer Protection.",
                "The web address follows authentic e-commerce security standards.",
                "PayShield has unlocked instant one-click PayPal checkout."
            ]

        return {
            "summary": summary,
            "explanation": explanation,
            "key_takeaways": takeaways,
            "using_ai_model": False
        }

    def _call_gemini_api(
        self,
        product_name: str,
        price: float,
        currency: str,
        seller_name: str,
        risk_level: str,
        risk_score: int,
        flags: List[str]
    ) -> dict:
        """Invokes Google Gemini API with header-based authorization and schema validation."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.gemini_model}:generateContent"
        prompt = f"""
You are PayShield, an AI payment safety assistant for PayPal. Explain this purchase evaluation to a buyer in simple, plain, friendly words without technical jargon.

Item: {product_name}
Price: {currency} {price}
Seller: {seller_name}
Calculated Risk Level: {risk_level} (Score: {risk_score}/100)
Detected Flags:
{chr(10).join('- ' + f for f in flags)}

Return a strict JSON object with these exact keys:
{{
  "summary": "1 concise sentence summarizing the safety verdict.",
  "explanation": "2-3 short sentences in simple plain words explaining why it is safe or risky.",
  "key_takeaways": ["tip 1", "tip 2", "tip 3"]
}}
Only output valid JSON.
"""
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.2,
                "response_mime_type": "application/json"
            }
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "x-goog-api-key": self.gemini_key
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                res = json.loads(response.read().decode())
                text_content = res["candidates"][0]["content"]["parts"][0]["text"].strip()
                if text_content.startswith("```"):
                    lines = text_content.splitlines()
                    if lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    text_content = "\n".join(lines).strip()
                parsed_json = json.loads(text_content)
                # Verify schema
                if (
                    isinstance(parsed_json, dict) and
                    "summary" in parsed_json and
                    "explanation" in parsed_json and
                    isinstance(parsed_json.get("key_takeaways"), list)
                ):
                    return parsed_json
                return None
        except Exception as e:
            print(f"[PayShieldAIEngine] Gemini API notice: {e}. Using built-in NLP engine.")
            return None


ai_engine = PayShieldAIEngine()
