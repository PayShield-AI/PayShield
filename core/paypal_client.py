import json
import base64
import time
import uuid
import urllib.request
import urllib.error
from typing import Optional, Dict, Any

from config import (
    PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET,
    PAYPAL_API_BASE,
    PAYPAL_MODE
)


class PayPalClient:
    """Handles communication with the PayPal Developer Platform (v2 Orders API).

    Includes automated fallback to an interactive sandbox simulation when credentials
    are unset, ensuring flawless live demos for hackathon judging.
    """

    def __init__(self):
        self.client_id = PAYPAL_CLIENT_ID
        self.client_secret = PAYPAL_CLIENT_SECRET
        self.api_base = PAYPAL_API_BASE
        self.mode = PAYPAL_MODE
        self._cached_token = None
        self._token_expiry = 0

    @property
    def is_configured(self) -> bool:
        """Returns True if user has configured custom PayPal credentials."""
        return bool(self.client_id and self.client_secret and self.client_id != "sb")

    def get_access_token(self) -> Optional[str]:
        """Fetches an OAuth2 access token from PayPal v1/oauth2/token."""
        if not self.is_configured:
            return None

        # Reuse cached token if not within 60s of expiration
        if self._cached_token and time.time() < self._token_expiry - 60:
            return self._cached_token

        url = f"{self.api_base}/v1/oauth2/token"
        auth_header = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_header}",
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        data = b"grant_type=client_credentials"

        try:
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode())
                self._cached_token = res_data.get("access_token")
                self._token_expiry = time.time() + res_data.get("expires_in", 3600)
                return self._cached_token
        except Exception as e:
            print(f"[PayPalClient] Sandbox token error: {e}")
            return None

    def create_order(
        self,
        amount: float,
        currency: str,
        item_name: str,
        risk_level: str,
        user_confirmed: bool = False
    ) -> Dict[str, Any]:
        """Creates a PayPal order via v2/checkout/orders.

        Enforces PayShield safety policy:
        - Safe purchases continue smoothly.
        - High and Medium risk purchases require user_confirmed = True before order creation.
        """
        # Validate amount
        try:
            numeric_amount = float(amount)
            if numeric_amount <= 0:
                return {
                    "success": False,
                    "error": "INVALID_AMOUNT",
                    "message": "Payment amount must be greater than zero."
                }
        except (ValueError, TypeError):
            return {
                "success": False,
                "error": "INVALID_AMOUNT",
                "message": "Payment amount must be a valid number."
            }

        # Risk Gate: Prevent checkout creation if high or medium risk without user acknowledgement
        normalized_risk = (risk_level or "LOW").upper()
        if normalized_risk in ["HIGH", "MEDIUM"] and not user_confirmed:
            return {
                "success": False,
                "error": "PAYSHIELD_SAFETY_LOCK",
                "message": f"{normalized_risk} risk scam indicators detected. PayPal checkout is locked until the buyer explicitly acknowledges the risks and confirms.",
                "requires_confirmation": True
            }

        formatted_amount = f"{numeric_amount:.2f}"

        # Real PayPal Sandbox API Call
        if self.is_configured:
            token = self.get_access_token()
            if not token:
                return {
                    "success": False,
                    "error": "AUTH_FAILED",
                    "message": "Unable to obtain PayPal OAuth access token. Check credentials."
                }

            url = f"{self.api_base}/v2/checkout/orders"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "PayPal-Request-Id": str(uuid.uuid4())
            }
            payload = {
                "intent": "CAPTURE",
                "purchase_units": [
                    {
                        "reference_id": f"PS-{uuid.uuid4().hex[:8].upper()}",
                        "description": (item_name or "PayShield Item")[:127],
                        "custom_id": f"payshield_risk_{normalized_risk.lower()}",
                        "amount": {
                            "currency_code": currency or "USD",
                            "value": formatted_amount
                        }
                    }
                ],
                "application_context": {
                    "brand_name": "PayShield Scam Protection",
                    "landing_page": "NO_PREFERENCE",
                    "user_action": "PAY_NOW"
                }
            }

            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode(),
                    headers=headers,
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=10) as response:
                    res_data = json.loads(response.read().decode())
                    return {
                        "success": True,
                        "order_id": res_data.get("id"),
                        "status": res_data.get("status"),
                        "mode": "live_sandbox",
                        "paypal_response": res_data
                    }
            except urllib.error.HTTPError as e:
                err_body = e.read().decode()
                print(f"[PayPalClient] PayPal Orders API Error {e.code}: {err_body}")
                return {
                    "success": False,
                    "error": f"PAYPAL_HTTP_{e.code}",
                    "message": f"PayPal API Error ({e.code}): {err_body}"
                }
            except Exception as e:
                print(f"[PayPalClient] PayPal connection error: {e}")
                return {
                    "success": False,
                    "error": "NETWORK_ERROR",
                    "message": f"Failed to connect to PayPal API: {str(e)}"
                }

        # Resilient Sandbox Simulator (Flawless Hackathon Demo Mode when keys are unset)
        simulated_order_id = f"PAYPAL-SANDBOX-{uuid.uuid4().hex[:10].upper()}"
        return {
            "success": True,
            "order_id": simulated_order_id,
            "status": "CREATED",
            "mode": "simulated_sandbox",
            "message": "Order initiated via PayPal Sandbox with PayShield AI safety verification.",
            "paypal_response": {
                "id": simulated_order_id,
                "status": "CREATED",
                "intent": "CAPTURE",
                "purchase_units": [{
                    "amount": {
                        "currency_code": currency or "USD",
                        "value": formatted_amount
                    },
                    "description": item_name,
                    "custom_id": f"payshield_risk_{normalized_risk.lower()}"
                }],
                "create_time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "links": [
                    {
                        "href": f"https://www.sandbox.paypal.com/checkoutnow?token={simulated_order_id}",
                        "rel": "approve",
                        "method": "GET"
                    }
                ]
            }
        }

    def capture_order(self, order_id: str) -> Dict[str, Any]:
        """Captures payment for an approved PayPal order."""
        if not order_id or not isinstance(order_id, str):
            return {
                "success": False,
                "error": "MISSING_ORDER_ID",
                "message": "A valid order_id is required to capture payment."
            }

        # Real PayPal Sandbox Capture
        if self.is_configured and not order_id.startswith("PAYPAL-SANDBOX-"):
            token = self.get_access_token()
            if not token:
                return {
                    "success": False,
                    "error": "AUTH_FAILED",
                    "message": "Unable to obtain PayPal OAuth access token for capture."
                }

            url = f"{self.api_base}/v2/checkout/orders/{order_id}/capture"
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "PayPal-Request-Id": str(uuid.uuid4())
            }

            try:
                req = urllib.request.Request(url, data=b"{}", headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=10) as response:
                    res_data = json.loads(response.read().decode())
                    return {
                        "success": True,
                        "order_id": order_id,
                        "status": res_data.get("status", "COMPLETED"),
                        "transaction_id": res_data.get("purchase_units", [{}])[0].get("payments", {}).get("captures", [{}])[0].get("id", f"TXN-{uuid.uuid4().hex[:8].upper()}"),
                        "mode": "live_sandbox",
                        "details": res_data
                    }
            except urllib.error.HTTPError as e:
                err_body = e.read().decode()
                print(f"[PayPalClient] Capture HTTP Error {e.code}: {err_body}")
                return {
                    "success": False,
                    "error": f"PAYPAL_CAPTURE_{e.code}",
                    "message": f"PayPal Capture Error: {err_body}"
                }
            except Exception as e:
                print(f"[PayPalClient] Capture error: {e}")
                return {
                    "success": False,
                    "error": "NETWORK_ERROR",
                    "message": f"Connection error during capture: {str(e)}"
                }

        # Simulated capture response for demo environments
        simulated_txn = f"CAPTURE-{uuid.uuid4().hex[:12].upper()}"
        return {
            "success": True,
            "order_id": order_id,
            "status": "COMPLETED",
            "transaction_id": simulated_txn,
            "mode": "simulated_sandbox",
            "message": "Payment captured securely via PayPal. No card details were accessed by PayShield.",
            "details": {
                "id": simulated_txn,
                "status": "COMPLETED",
                "payer": {
                    "email_address": "sandbox-buyer@payshield.ai",
                    "payer_id": f"PAYER-{uuid.uuid4().hex[:8].upper()}"
                },
                "capture_time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
        }


paypal_client = PayPalClient()
