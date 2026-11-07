import math
import json
from pathlib import Path

DICT_PATH = Path(__file__).resolve().parent.parent / "data" / "scam_dictionary.json"
try:
    with open(DICT_PATH, "r", encoding="utf-8") as f:
        SCAM_DATA = json.load(f)
except Exception:
    SCAM_DATA = {}

PRICE_BENCHMARKS = SCAM_DATA.get("reference_price_benchmarks", {
    "iphone 16 pro": 1099,
    "iphone 16": 799,
    "iphone 15 pro": 999,
    "iphone 15": 799,
    "playstation 5 pro": 699,
    "playstation 5": 499,
    "ps5": 499,
    "macbook pro": 1599,
    "macbook air": 1099,
    "ipad pro": 999,
    "nintendo switch": 299,
    "airpods pro": 249,
    "rtx 4090": 1599,
    "rolex submariner": 9000,
    "dyson airwrap": 599
})

# Words that indicate an accessory rather than the actual high-value flagship unit
ACCESSORY_EXCLUSIONS = {
    "case", "cover", "protector", "glass", "cable", "charger", "adapter",
    "band", "strap", "skin", "stand", "holder", "box only", "replacement part"
}


class PriceAnalyzer:
    """Detects 'too good to be true' pricing anomalies and discount red flags."""

    @staticmethod
    def analyze(product_name: str, price: float, currency: str = "USD") -> dict:
        flags = []
        score = 0
        details = {
            "price": price,
            "currency": currency,
            "benchmark_match": None,
            "discount_percentage": None
        }

        # Validate against non-finite floats (NaN, +Inf, -Inf), non-numbers, or zero/negative prices
        try:
            numeric_price = float(price)
            if not math.isfinite(numeric_price) or numeric_price <= 0:
                return {
                    "score": 90,
                    "flags": ["The stated price is invalid, zero, or non-finite. Legitimate transactions require a valid positive number."],
                    "details": details
                }
        except (ValueError, TypeError):
            return {
                "score": 90,
                "flags": ["The stated price is not a valid numeric value."],
                "details": details
            }

        price = numeric_price

        # Sanitize product name
        if not product_name or not isinstance(product_name, str):
            clean_name = "unnamed item"
        else:
            clean_name = product_name.lower().strip()

        # Check if this listing is an accessory rather than the actual flagship unit
        is_accessory = any(acc in clean_name for acc in ACCESSORY_EXCLUSIONS)

        # Compare against retail benchmark models if not an accessory
        matched_benchmark = None
        benchmark_price = None

        if not is_accessory:
            for item_key, standard_val in PRICE_BENCHMARKS.items():
                tokens = item_key.split()
                if all(t in clean_name for t in tokens):
                    matched_benchmark = item_key
                    benchmark_price = standard_val
                    break

        if matched_benchmark and benchmark_price:
            details["benchmark_match"] = matched_benchmark
            details["expected_price"] = benchmark_price
            discount_pct = round(((benchmark_price - price) / benchmark_price) * 100, 1)
            details["discount_percentage"] = discount_pct

            # Deep discounts over 80% on brand-name items strongly correlate with non-delivery scams
            if discount_pct >= 80:
                score += 85
                flags.append(
                    f"Extreme price anomaly: ${price:.2f} is {discount_pct}% below the typical market retail price (~${benchmark_price}). This is a classic scam indicator for counterfeit goods or non-delivery."
                )
            elif discount_pct >= 55:
                score += 50
                flags.append(
                    f"Suspiciously steep discount ({discount_pct}% off standard price of ~${benchmark_price}). Proceed with caution and verify condition."
                )
            elif discount_pct < -50:
                score += 20
                flags.append(
                    f"Price is significantly higher than typical retail value (${benchmark_price}). May be scalping or price gouging."
                )
            else:
                score += 5
                flags.append(f"Price aligns realistically with market benchmarks for {matched_benchmark}.")

        else:
            # Catch luxury / electronics keywords priced suspiciously low when exact model isn't in benchmarks
            expensive_keywords = ["iphone", "macbook", "laptop", "rolex", "console", "playstation", "gpu", "graphics card"]
            has_expensive_term = any(k in clean_name for k in expensive_keywords)

            if has_expensive_term and not is_accessory and price < 50:
                score += 75
                flags.append(
                    f"Product title suggests a high-value electronics/luxury item, but price is only ${price:.2f}. High probability of fraud or counterfeit."
                )
            elif price < 5:
                score += 35
                flags.append(
                    f"Unusually low checkout price (${price:.2f}). Often used to test stolen cards or mask recurring subscription charges."
                )
            else:
                flags.append("Price appears within standard e-commerce ranges.")

        return {
            "score": min(100, score),
            "flags": flags,
            "details": details
        }
