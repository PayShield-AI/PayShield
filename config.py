import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

env_file = BASE_DIR / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))

# Server settings (Dynamic Port Binding for Render & Local Environments)
IS_RENDER = bool(os.getenv("RENDER") or os.getenv("PORT"))
SERVER_HOST = os.getenv("SERVER_HOST", "0.0.0.0" if IS_RENDER else "127.0.0.1")
SERVER_PORT = int(os.getenv("PORT", os.getenv("SERVER_PORT", "5000")))
DEBUG = os.getenv("DEBUG", "false" if IS_RENDER else "true").lower() == "true"

# PayPal Developer Platform Sandbox credentials
PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "sb")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "")
PAYPAL_MODE = os.getenv("PAYPAL_MODE", "sandbox").lower()

if PAYPAL_MODE == "live":
    PAYPAL_API_BASE = "https://api-m.paypal.com"
else:
    PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com"

# Optional: Google Gemini API integration for natural language reasoning
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

# Risk classification thresholds:
# 0 - 30: Low risk (Safe - direct checkout unlocked)
# 31 - 65: Medium risk (Caution - user confirmation required)
# 66 - 100: High risk (Dangerous scam - checkout locked)
RISK_THRESHOLD_LOW = 30
RISK_THRESHOLD_MEDIUM = 65
