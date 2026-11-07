import unittest
import math
from core.domain_inspector import DomainInspector
from core.price_analyzer import PriceAnalyzer
from core.urgency_detector import UrgencyDetector
from core.ai_engine import ai_engine
from core.paypal_client import paypal_client


class TestPayShield(unittest.TestCase):

    # --- Domain Inspector Tests ---

    def test_domain_inspector_brand_spoof(self):
        result = DomainInspector.inspect("https://apple-authorized-clearance-outlet.shop/item/1")
        self.assertGreaterEqual(result["score"], 50)
        self.assertTrue(any("impersonation" in f.lower() or "tld" in f.lower() for f in result["flags"]))

    def test_domain_inspector_trusted(self):
        result = DomainInspector.inspect("https://www.paypal.com/checkout")
        self.assertEqual(result["score"], 0)
        self.assertTrue(result["details"]["is_trusted"])

    def test_domain_inspector_homograph_punycode(self):
        # Cyrillic small letter 'er' replaces 'p' in paypal.com -> xn--aypal-e1a.com
        result = DomainInspector.inspect("https://\u0440aypal.com/login")
        self.assertGreaterEqual(result["score"], 70)
        self.assertTrue(any("punycode" in f.lower() or "homoglyph" in f.lower() for f in result["flags"]))

    def test_domain_inspector_malicious_schemes(self):
        result = DomainInspector.inspect("javascript:alert(1)")
        self.assertGreaterEqual(result["score"], 90)

    def test_domain_inspector_legitimate_brand_substring(self):
        # 'pineapple.com' contains 'apple', but is NOT an Apple brand impersonation
        result = DomainInspector.inspect("https://www.pineapple.com/store")
        self.assertFalse(any("apple" in f.lower() and "impersonation" in f.lower() for f in result["flags"]))

    def test_domain_inspector_ip_address(self):
        result = DomainInspector.inspect("http://192.168.1.100/checkout")
        self.assertGreaterEqual(result["score"], 60)
        self.assertTrue(any("ip address" in f.lower() for f in result["flags"]))

    # --- Price Analyzer Tests ---

    def test_price_analyzer_extreme_discount(self):
        # iPhone 16 Pro retail is ~$1099, selling for $89 is a ~92% discount anomaly
        result = PriceAnalyzer.analyze("Brand New iPhone 16 Pro Max", 89.0, "USD")
        self.assertGreaterEqual(result["score"], 80)
        self.assertTrue(any("extreme price anomaly" in f.lower() for f in result["flags"]))

    def test_price_analyzer_realistic_price(self):
        result = PriceAnalyzer.analyze("Handmade Full-Grain Leather Bag", 165.0, "USD")
        self.assertLessEqual(result["score"], 10)

    def test_price_analyzer_accessory_exclusion(self):
        # A $29 iPhone 15 Pro case should NOT be compared against the $999 phone benchmark
        result = PriceAnalyzer.analyze("iPhone 15 Pro Max Silicone Case", 29.0, "USD")
        self.assertLessEqual(result["score"], 10)
        self.assertIsNone(result["details"]["benchmark_match"])

    def test_price_analyzer_invalid_non_finite_prices(self):
        result_nan = PriceAnalyzer.analyze("Laptop", float("nan"), "USD")
        self.assertGreaterEqual(result_nan["score"], 80)

        result_inf = PriceAnalyzer.analyze("Laptop", float("inf"), "USD")
        self.assertGreaterEqual(result_inf["score"], 80)

        result_zero = PriceAnalyzer.analyze("Laptop", 0.0, "USD")
        self.assertGreaterEqual(result_zero["score"], 80)

        result_negative = PriceAnalyzer.analyze("Laptop", -15.0, "USD")
        self.assertGreaterEqual(result_negative["score"], 80)

    # --- Urgency Detector Tests ---

    def test_urgency_detector_diversion_and_countdown(self):
        notes = "Urgently clearing out! Offer expires in 8 minutes. Must pay via friends and family right now or cancelled!"
        result = UrgencyDetector.analyze(notes, "AppleScamSeller")
        self.assertGreaterEqual(result["score"], 60)
        self.assertTrue(any("friends and family" in f.lower() for f in result["flags"]))

    def test_urgency_detector_none_inputs(self):
        # Must not crash when seller_notes or seller_name is None
        result = UrgencyDetector.analyze(None, None)
        self.assertIsInstance(result["score"], int)

    def test_urgency_detector_shouting_with_punctuation(self):
        notes = "PAY RIGHT NOW! HURRY UP! FINAL CHANCE! DEAL ENDS NOW!"
        result = UrgencyDetector.analyze(notes, "UrgentStore")
        self.assertGreaterEqual(result["score"], 25)

    # --- AI Engine Composite & Escalation Tests ---

    def test_ai_engine_high_risk_scam(self):
        result = ai_engine.analyze_transaction(
            product_name="Brand New iPhone 16 Pro Max 1TB",
            product_url="https://apple-clearance-outlet.shop/deal",
            price=89.0,
            currency="USD",
            seller_name="FlashSale_Clearance",
            seller_notes="Only 5 minutes left! Pay via friends & family or wire transfer right now!"
        )
        self.assertEqual(result["risk_level"], "HIGH")
        self.assertGreaterEqual(result["risk_score"], 70)
        self.assertFalse(result["can_instant_checkout"])
        self.assertTrue(result["requires_user_confirmation"])

    def test_ai_engine_safe_merchant(self):
        result = ai_engine.analyze_transaction(
            product_name="Handcrafted Leather Messenger Bag",
            product_url="https://bellanocaleather.com/bag",
            price=165.0,
            currency="USD",
            seller_name="Bellanoca Leather Goods",
            seller_notes="Standard 30-day money-back guarantee with PayPal Purchase Protection."
        )
        self.assertEqual(result["risk_level"], "LOW")
        self.assertLessEqual(result["risk_score"], 30)
        self.assertTrue(result["can_instant_checkout"])
        self.assertFalse(result["requires_user_confirmation"])

    # --- PayPal Client Risk Gates & Error Handling ---

    def test_paypal_safety_lock(self):
        # Verification: High-risk order without confirmation must be blocked
        blocked_order = paypal_client.create_order(
            amount=89.0,
            currency="USD",
            item_name="iPhone 16 Pro",
            risk_level="HIGH",
            user_confirmed=False
        )
        self.assertFalse(blocked_order["success"])
        self.assertEqual(blocked_order["error"], "PAYSHIELD_SAFETY_LOCK")

        # Medium-risk order without confirmation must also be blocked
        blocked_medium = paypal_client.create_order(
            amount=135.0,
            currency="USD",
            item_name="Vintage Watch",
            risk_level="MEDIUM",
            user_confirmed=False
        )
        self.assertFalse(blocked_medium["success"])
        self.assertEqual(blocked_medium["error"], "PAYSHIELD_SAFETY_LOCK")

        # Order with confirmation must proceed
        approved_order = paypal_client.create_order(
            amount=89.0,
            currency="USD",
            item_name="iPhone 16 Pro",
            risk_level="HIGH",
            user_confirmed=True
        )
        self.assertTrue(approved_order["success"])
        self.assertIn("order_id", approved_order)

        # Capture order
        capture = paypal_client.capture_order(approved_order["order_id"])
        self.assertTrue(capture["success"])
        self.assertEqual(capture["status"], "COMPLETED")

    def test_paypal_invalid_amount_rejected(self):
        res_zero = paypal_client.create_order(0.0, "USD", "Test Item", "LOW", True)
        self.assertFalse(res_zero["success"])
        self.assertEqual(res_zero["error"], "INVALID_AMOUNT")

        res_neg = paypal_client.create_order(-10.0, "USD", "Test Item", "LOW", True)
        self.assertFalse(res_neg["success"])


if __name__ == "__main__":
    unittest.main()
