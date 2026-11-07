import os
import json
import logging
import math
from typing import Dict, Any, List
import tornado.ioloop
import tornado.web
from pathlib import Path

from config import (
    SERVER_HOST,
    SERVER_PORT,
    DEBUG,
    PAYPAL_CLIENT_ID,
    PAYPAL_MODE,
    GEMINI_API_KEY
)
from core.ai_engine import ai_engine
from core.paypal_client import paypal_client

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("PayShield")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"

SCAN_HISTORY: List[Dict[str, Any]] = []


class BaseHandler(tornado.web.RequestHandler):
    """Base handler setting JSON headers, CORS, and security flags."""

    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "x-requested-with, content-type")
        self.set_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.set_header("X-Content-Type-Options", "nosniff")
        self.set_header("X-Frame-Options", "SAMEORIGIN")

    def options(self, *args, **kwargs):
        self.set_status(204)
        self.finish()

    def write_json(self, data: Any, status: int = 200):
        self.set_status(status)
        self.set_header("Content-Type", "application/json")
        self.write(json.dumps(data))


class StatusHandler(BaseHandler):
    """Health check and configuration status."""

    def get(self):
        self.write_json({
            "service": "PayShield AI Safety Gateway",
            "organization": "PayShield-AI",
            "developer": "Akshdeep Singh",
            "developer_github": "https://github.com/akshdeepsingh7",
            "repository": "https://github.com/PayShield-AI/PayShield",
            "version": "1.0.0",
            "platform": "Render Cloud" if os.getenv("RENDER") else "Local Server",
            "paypal_mode": PAYPAL_MODE,
            "paypal_client_id": PAYPAL_CLIENT_ID[:6] + "..." if PAYPAL_CLIENT_ID else "none",
            "has_gemini": bool(GEMINI_API_KEY),
            "status": "operational"
        })


class PresetsHandler(BaseHandler):
    """Returns pre-configured demo scenarios for instant hackathon testing."""

    def get(self):
        presets_path = DATA_DIR / "presets.json"
        if presets_path.exists():
            with open(presets_path, "r", encoding="utf-8") as f:
                presets = json.load(f)
            self.write_json(presets)
        else:
            self.write_json([], status=404)


class AnalyzeHandler(BaseHandler):
    """AI analysis endpoint checking product link, price, and seller details."""

    def post(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
            if not isinstance(body, dict):
                return self.write_json({"error": "Request body must be a JSON object"}, status=400)
        except Exception:
            return self.write_json({"error": "Invalid JSON body"}, status=400)

        product_name = str(body.get("product_name", "") or "").strip() or "Unnamed Product"
        product_url = str(body.get("product_url", "") or "").strip()
        seller_name = str(body.get("seller_name", "") or "").strip()
        seller_notes = str(body.get("seller_notes", "") or "").strip()

        try:
            raw_price = body.get("price", 0)
            price = float(raw_price)
            if not math.isfinite(price) or price < 0:
                price = 0.0
        except (ValueError, TypeError):
            price = 0.0

        currency = str(body.get("currency", "USD") or "USD").strip().upper()

        result = ai_engine.analyze_transaction(
            product_name=product_name,
            product_url=product_url,
            price=price,
            currency=currency,
            seller_name=seller_name,
            seller_notes=seller_notes
        )

        history_item = {
            "product_name": product_name,
            "product_url": product_url,
            "price": price,
            "currency": currency,
            "seller_name": seller_name,
            "risk_level": result["risk_level"],
            "risk_score": result["risk_score"],
            "timestamp": tornado.ioloop.IOLoop.current().time()
        }
        SCAN_HISTORY.insert(0, history_item)
        if len(SCAN_HISTORY) > 20:
            SCAN_HISTORY.pop()

        self.write_json(result)


class CreateOrderHandler(BaseHandler):
    """Initiates PayPal checkout order (v2 Orders API)."""

    def post(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
            if not isinstance(body, dict):
                return self.write_json({"error": "Request body must be a JSON object"}, status=400)
        except Exception:
            return self.write_json({"error": "Invalid JSON body"}, status=400)

        try:
            raw_amount = body.get("amount", 0)
            amount = float(raw_amount)
            if not math.isfinite(amount) or amount <= 0:
                return self.write_json({"error": "Amount must be a positive finite number"}, status=400)
        except (ValueError, TypeError):
            return self.write_json({"error": "Invalid amount value"}, status=400)

        currency = str(body.get("currency", "USD") or "USD").strip().upper()
        item_name = str(body.get("item_name", "PayShield Insured Item") or "PayShield Insured Item").strip()
        risk_level = str(body.get("risk_level", "LOW") or "LOW").strip().upper()
        user_confirmed = bool(body.get("user_confirmed", False))

        order_res = paypal_client.create_order(
            amount=amount,
            currency=currency,
            item_name=item_name,
            risk_level=risk_level,
            user_confirmed=user_confirmed
        )

        status_code = 200 if order_res.get("success") else 403
        self.write_json(order_res, status=status_code)


class CaptureOrderHandler(BaseHandler):
    """Captures an authorized PayPal payment."""

    def post(self):
        try:
            body = json.loads(self.request.body.decode("utf-8"))
            if not isinstance(body, dict):
                return self.write_json({"error": "Request body must be a JSON object"}, status=400)
        except Exception:
            return self.write_json({"error": "Invalid JSON body"}, status=400)

        order_id = str(body.get("order_id", "") or "").strip()
        if not order_id:
            return self.write_json({"error": "Missing or empty order_id"}, status=400)

        capture_res = paypal_client.capture_order(order_id)
        status_code = 200 if capture_res.get("success") else 400
        self.write_json(capture_res, status=status_code)


class HistoryHandler(BaseHandler):
    """Returns recent scans and safety audit log."""

    def get(self):
        self.write_json(SCAN_HISTORY)


def make_app():
    return tornado.web.Application(
        [
            (r"/api/status", StatusHandler),
            (r"/api/presets", PresetsHandler),
            (r"/api/analyze", AnalyzeHandler),
            (r"/api/paypal/create-order", CreateOrderHandler),
            (r"/api/paypal/capture-order", CaptureOrderHandler),
            (r"/api/history", HistoryHandler),
            (r"/css/(.*)", tornado.web.StaticFileHandler, {"path": str(STATIC_DIR / "css")}),
            (r"/js/(.*)", tornado.web.StaticFileHandler, {"path": str(STATIC_DIR / "js")}),
            (r"/(.*)", tornado.web.StaticFileHandler, {
                "path": str(STATIC_DIR),
                "default_filename": "index.html"
            }),
        ],
        debug=DEBUG,
        autoreload=DEBUG,
        static_path=str(STATIC_DIR)
    )


if __name__ == "__main__":
    app = make_app()
    app.listen(SERVER_PORT, address=SERVER_HOST)
    print("=" * 65)
    print("  [PAYSHIELD] AI Payment Safety Assistant for PayPal")
    print("  Organization: PayShield-AI | Developer: Akshdeep Singh (https://github.com/akshdeepsingh7)")
    print("  Repository: https://github.com/PayShield-AI/PayShield")
    print(f"  Server URL: http://{SERVER_HOST}:{SERVER_PORT}")
    print(f"  PayPal Mode: {PAYPAL_MODE.upper()}")
    print(f"  AI Engine: {'Gemini LLM + Heuristics' if GEMINI_API_KEY else 'Built-in NLP & Heuristics (Zero-Config)'}")
    print("=" * 65)
    tornado.ioloop.IOLoop.current().start()
