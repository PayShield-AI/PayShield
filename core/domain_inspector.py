import re
import json
import ipaddress
from urllib.parse import urlparse
from pathlib import Path

DICT_PATH = Path(__file__).resolve().parent.parent / "data" / "scam_dictionary.json"
try:
    with open(DICT_PATH, "r", encoding="utf-8") as f:
        SCAM_DATA = json.load(f)
except Exception:
    SCAM_DATA = {}

SKETCHY_TLDS = set(SCAM_DATA.get("sketchy_tlds", [
    ".top", ".xyz", ".buzz", ".click", ".shop", ".online", ".site", ".club", ".vip", ".icu",
    ".tk", ".ml", ".ga", ".cf", ".gq", ".live", ".store", ".loan", ".bid"
]))

BRAND_TARGETS = SCAM_DATA.get("brand_spoof_targets", [
    "paypal", "apple", "amazon", "ebay", "walmart", "bestbuy", "nike", "rolex", "playstation", "sony"
])

TRUSTED_DOMAINS = {
    "paypal.com", "apple.com", "amazon.com", "ebay.com", "walmart.com",
    "bestbuy.com", "nike.com", "target.com", "etsy.com"
}


class DomainInspector:
    """Analyzes product URLs for phishing, brand impersonation, and fraudulent storefront markers."""

    @staticmethod
    def inspect(url: str) -> dict:
        if not url or not isinstance(url, str) or not url.strip():
            return {
                "score": 50,
                "flags": ["No product link provided for domain reputation verification."],
                "details": {"status": "missing_url"}
            }

        clean_url = url.strip()

        # Reject unsupported or malicious schemes
        lower_url = clean_url.lower()
        if lower_url.startswith(("javascript:", "data:", "file:", "vbscript:", "ftp:")):
            return {
                "score": 95,
                "flags": ["Dangerous or unsupported URL protocol detected. Legitimate e-commerce requires HTTP or HTTPS."],
                "details": {"error": "malicious_scheme"}
            }

        if not clean_url.startswith(("http://", "https://")):
            clean_url = "https://" + clean_url

        try:
            parsed = urlparse(clean_url)
            raw_hostname = (parsed.hostname or "").lower().strip()
        except Exception:
            return {
                "score": 80,
                "flags": ["Invalid or unparseable URL structure."],
                "details": {"error": "unparseable_url"}
            }

        if not raw_hostname or len(raw_hostname) < 3:
            return {
                "score": 75,
                "flags": ["URL is missing a valid domain hostname."],
                "details": {"error": "missing_hostname"}
            }

        score = 0
        flags = []

        # 1. Unicode Homograph & Punycode Phishing Detection
        is_punycode = False
        try:
            ascii_hostname = raw_hostname.encode("idna").decode("ascii")
            if ascii_hostname.startswith("xn--") or ".xn--" in ascii_hostname:
                is_punycode = True
        except Exception:
            is_punycode = True

        if is_punycode:
            score += 70
            flags.append("Internationalized domain name (Punycode / Cyrillic homoglyph) detected. Commonly used to spoof authentic brand domains.")

        hostname = ascii_hostname if not is_punycode else raw_hostname

        # 2. Insecure connection check
        if parsed.scheme == "http":
            score += 25
            flags.append("Insecure connection (HTTP instead of HTTPS). Legitimate sellers always use HTTPS.")

        # 3. IP host check (both IPv4 and IPv6)
        is_ip = False
        try:
            clean_ip_host = hostname.strip("[]")
            ipaddress.ip_address(clean_ip_host)
            is_ip = True
        except ValueError:
            is_ip = False

        if is_ip:
            score += 65
            flags.append(f"Host uses a raw numerical IP address ({hostname}) rather than an authenticated domain name.")

        # 4. Known trusted domain verification (exact or authentic subdomains)
        is_trusted = False
        for trusted in TRUSTED_DOMAINS:
            if hostname == trusted or hostname.endswith("." + trusted):
                is_trusted = True
                break

        if is_trusted and not is_punycode:
            return {
                "score": max(0, score),
                "flags": ["Domain verified as a recognized trusted merchant platform."] if not flags else flags,
                "details": {
                    "hostname": hostname,
                    "scheme": parsed.scheme,
                    "is_trusted": True
                }
            }

        # 5. Targeted brand spoofing check using boundary delimiters
        # Avoids false positives on words like 'pineapple.com' or 'persony.com'
        for brand in BRAND_TARGETS:
            brand_pattern = re.compile(rf"(^|[\.\-_]){re.escape(brand)}([\.\-_]|$)")
            if brand_pattern.search(hostname):
                official_domain = f"{brand}.com"
                if not (hostname == official_domain or hostname.endswith("." + official_domain)):
                    score += 55
                    flags.append(
                        f"Potential brand impersonation: Domain contains '{brand}' but is not an official {brand}.com property."
                    )
                    break

        # 6. Check for high-risk top-level domains frequently abused in disposable storefronts
        for tld in SKETCHY_TLDS:
            if hostname.endswith(tld):
                score += 30
                flags.append(
                    f"Uses a high-risk top-level domain ({tld}) frequently abused in disposable storefront scams."
                )
                break

        # 7. Phishing hyphen density check
        hyphen_count = hostname.count("-")
        if hyphen_count >= 3:
            score += 25
            flags.append(
                f"Domain contains {hyphen_count} hyphens, a common pattern in auto-generated fake storefronts."
            )

        # 8. Commercial bait clustering in subdomains
        suspicious_words = ["discount", "clearance", "outlet", "sale", "cheap", "liquidation", "urgent", "secure", "verify"]
        matched_words = [w for w in suspicious_words if w in hostname]
        if len(matched_words) >= 2:
            score += 20
            flags.append(
                f"Domain name clusters commercial lure terms ({', '.join(matched_words)})."
            )

        score = min(100, score)

        if not flags:
            flags.append("Domain structure shows standard e-commerce naming patterns.")

        return {
            "score": score,
            "flags": flags,
            "details": {
                "hostname": hostname,
                "scheme": parsed.scheme,
                "hyphen_count": hyphen_count,
                "is_trusted": False
            }
        }
