import os
import json
import logging
import math
import time
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
            "timestamp": time.time()
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


def make_tornado_app():
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
        autoreload=False,
        static_path=str(STATIC_DIR)
    )


def wsgi_app(environ: Dict[str, Any], start_response) -> List[bytes]:
    """Native WSGI application providing high-performance routing for Gunicorn on Render."""
    method = environ.get("REQUEST_METHOD", "GET").upper()
    path = environ.get("PATH_INFO", "/")

    common_headers = [
        ("Access-Control-Allow-Origin", "*"),
        ("Access-Control-Allow-Headers", "x-requested-with, content-type, authorization"),
        ("Access-Control-Allow-Methods", "POST, GET, OPTIONS"),
        ("X-Content-Type-Options", "nosniff"),
        ("X-Frame-Options", "SAMEORIGIN"),
    ]

    if method == "OPTIONS":
        headers = common_headers + [("Content-Length", "0")]
        start_response("204 No Content", headers)
        return [b""]

    def respond_json(data: Any, status: int = 200) -> List[bytes]:
        body = json.dumps(data).encode("utf-8")
        status_lines = {
            200: "200 OK",
            204: "204 No Content",
            400: "400 Bad Request",
            403: "403 Forbidden",
            404: "404 Not Found",
            500: "500 Internal Server Error"
        }
        status_line = status_lines.get(status, f"{status} Status")
        headers = common_headers + [
            ("Content-Type", "application/json"),
            ("Content-Length", str(len(body)))
        ]
        start_response(status_line, headers)
        return [body]

    def get_json_body() -> Dict[str, Any]:
        try:
            content_length = int(environ.get("CONTENT_LENGTH", 0) or 0)
        except (ValueError, TypeError):
            content_length = 0
        if content_length > 0 and "wsgi.input" in environ:
            raw = environ["wsgi.input"].read(content_length)
            return json.loads(raw.decode("utf-8"))
        return {}

    # Status Healthcheck
    if path == "/api/status" and method == "GET":
        return respond_json({
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

    # Presets
    if path == "/api/presets" and method == "GET":
        presets_path = DATA_DIR / "presets.json"
        if presets_path.exists():
            with open(presets_path, "r", encoding="utf-8") as f:
                presets = json.load(f)
            return respond_json(presets)
        return respond_json([], 404)

    # Analyze Transaction
    if path == "/api/analyze" and method == "POST":
        try:
            body = get_json_body()
            if not isinstance(body, dict):
                return respond_json({"error": "Request body must be a JSON object"}, 400)
        except Exception:
            return respond_json({"error": "Invalid JSON body"}, 400)

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
            "timestamp": time.time()
        }
        SCAN_HISTORY.insert(0, history_item)
        if len(SCAN_HISTORY) > 20:
            SCAN_HISTORY.pop()

        return respond_json(result)

    # Create PayPal Order
    if path == "/api/paypal/create-order" and method == "POST":
        try:
            body = get_json_body()
            if not isinstance(body, dict):
                return respond_json({"error": "Request body must be a JSON object"}, 400)
        except Exception:
            return respond_json({"error": "Invalid JSON body"}, 400)

        try:
            raw_amount = body.get("amount", 0)
            amount = float(raw_amount)
            if not math.isfinite(amount) or amount <= 0:
                return respond_json({"error": "Amount must be a positive finite number"}, 400)
        except (ValueError, TypeError):
            return respond_json({"error": "Invalid amount value"}, 400)

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
        return respond_json(order_res, status=status_code)

    # Capture PayPal Order
    if path == "/api/paypal/capture-order" and method == "POST":
        try:
            body = get_json_body()
            if not isinstance(body, dict):
                return respond_json({"error": "Request body must be a JSON object"}, 400)
        except Exception:
            return respond_json({"error": "Invalid JSON body"}, 400)

        order_id = str(body.get("order_id", "") or "").strip()
        if not order_id:
            return respond_json({"error": "Missing or empty order_id"}, 400)

        capture_res = paypal_client.capture_order(order_id)
        status_code = 200 if capture_res.get("success") else 400
        return respond_json(capture_res, status=status_code)

    # History
    if path == "/api/history" and method == "GET":
        return respond_json(SCAN_HISTORY)

    # Static assets
    clean_path = path.lstrip("/")
    if not clean_path or clean_path == "index.html":
        file_path = STATIC_DIR / "index.html"
    else:
        file_path = (STATIC_DIR / clean_path).resolve()
        try:
            file_path.relative_to(STATIC_DIR)
        except ValueError:
            return respond_json({"error": "Forbidden"}, 403)

    if file_path.is_file():
        mime_types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".ico": "image/x-icon"
        }
        content_type = mime_types.get(file_path.suffix.lower(), "application/octet-stream")
        content_bytes = file_path.read_bytes()
        headers = common_headers + [
            ("Content-Type", content_type),
            ("Content-Length", str(len(content_bytes)))
        ]
        start_response("200 OK", headers)
        return [content_bytes]

    return respond_json({"error": "Not Found"}, 404)


class HybridApp:
    """Universal application runner supporting both Gunicorn WSGI on Render and native Tornado."""

    def __init__(self, tornado_app: tornado.web.Application, wsgi_handler):
        self._tornado_app = tornado_app
        self._wsgi_handler = wsgi_handler

    def __call__(self, *args, **kwargs):
        # WSGI standard interface: app(environ, start_response)
        if len(args) == 2 and callable(args[1]):
            return self._wsgi_handler(args[0], args[1])
        # Native Tornado connection delegate: app(request)
        return self._tornado_app(*args, **kwargs)

    def __getattr__(self, name: str):
        return getattr(self._tornado_app, name)


def make_app():
    return HybridApp(make_tornado_app(), wsgi_app)


app = make_app()


if __name__ == "__main__":
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
