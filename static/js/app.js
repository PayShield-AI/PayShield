/**
 * PayShield Client Application
 * Developed by Akshdeep Singh (https://github.com/akshdeepsingh7) | Organization: PayShield-AI
 * Repository: https://github.com/PayShield-AI/PayShield
 * Built for the PayPal AI Hackathon 2026.
 */

let currentScanResult = null;
let currentFormData = null;
let soundEnabled = localStorage.getItem("payshield_sound") !== "false";
let audioCtx = null;

const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$"
};

document.addEventListener("DOMContentLoaded", () => {
  initPresets();
  setupEventListeners();
  setupKeyboardShortcuts();
  updateCurrencySymbol();
  syncSoundIcon();
});

// Non-blocking cyber toast notifications
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "cyber-toast flex items-center justify-between gap-3 text-xs";

  let icon = `<svg class="w-4 h-4 text-sky-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  let borderClass = "border-sky-500/40 text-slate-200";
  if (type === "error") {
    icon = `<svg class="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    borderClass = "border-red-500/50 text-red-200 bg-red-950/80";
  } else if (type === "success") {
    icon = `<svg class="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`;
    borderClass = "border-emerald-500/50 text-emerald-200 bg-emerald-950/80";
  }

  toast.innerHTML = `
    <div class="flex items-center gap-2.5">
      <span class="flex items-center">${icon}</span>
      <span class="font-medium">${message}</span>
    </div>
    <button type="button" class="text-slate-400 hover:text-white transition p-1 text-sm cursor-pointer flex items-center" aria-label="Close Notification">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;

  toast.querySelector("button").addEventListener("click", () => {
    toast.remove();
  });

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Synthesizes non-intrusive cyber audio cues via Web Audio API without external audio files
function playChime(type = "safe") {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.08, now);

    if (type === "high") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(320, now + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === "med") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(520, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(700, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.1);   // A5
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (e) {
    // Graceful fallback if Web Audio is unsupported
  }
}

function updateCurrencySymbol() {
  const currency = document.getElementById("currency").value;
  const symbol = CURRENCY_SYMBOLS[currency] || "$";
  const label = document.getElementById("currency-symbol-label");
  if (label) label.innerText = symbol;
}

function setupEventListeners() {
  const form = document.getElementById("scam-form");
  form.addEventListener("submit", handleScanSubmit);

  const currencySelect = document.getElementById("currency");
  currencySelect.addEventListener("change", updateCurrencySymbol);

  const confirmCheckbox = document.getElementById("user-confirm-checkbox");
  confirmCheckbox.addEventListener("change", handleConfirmationToggle);

  const btnPaypal = document.getElementById("btn-paypal-checkout");
  btnPaypal.addEventListener("click", handlePayPalCheckout);

  const btnRetest = document.getElementById("btn-retest");
  btnRetest.addEventListener("click", () => {
    document.getElementById("product_name").focus();
  });

  const btnHistory = document.getElementById("btn-view-history");
  btnHistory.addEventListener("click", openHistoryModal);

  const btnCloseHistory = document.getElementById("btn-close-history");
  btnCloseHistory.addEventListener("click", () => {
    document.getElementById("modal-history").classList.add("hidden");
  });

  const btnCloseReceipt = document.getElementById("btn-close-receipt");
  btnCloseReceipt.addEventListener("click", () => {
    document.getElementById("modal-receipt").classList.add("hidden");
  });

  // Close modals on backdrop click
  ["modal-receipt", "modal-history"].forEach(id => {
    const modal = document.getElementById(id);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
      }
    });
  });

  const btnClear = document.getElementById("btn-clear-form");
  btnClear.addEventListener("click", clearForm);

  const btnSound = document.getElementById("btn-toggle-sound");
  btnSound.addEventListener("click", toggleSound);

  const btnCopyTxn = document.getElementById("btn-copy-txn");
  if (btnCopyTxn) {
    btnCopyTxn.addEventListener("click", copyTransactionId);
  }
}

function copyTransactionId() {
  const txn = document.getElementById("receipt-txn-id").innerText;
  const btn = document.getElementById("btn-copy-txn");

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(txn).then(() => {
      btn.innerHTML = `<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`;
      showToast("Transaction ID copied to clipboard!", "success");
      setTimeout(() => {
        btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`;
      }, 1500);
    }).catch(() => fallbackCopy(txn, btn));
  } else {
    fallbackCopy(txn, btn);
  }
}

function fallbackCopy(text, btn) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand("copy");
    btn.innerHTML = `<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`;
    showToast("Transaction ID copied to clipboard!", "success");
    setTimeout(() => {
      btn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`;
    }, 1500);
  } catch (err) {
    showToast("Could not copy automatically. Please select text.", "error");
  }
  document.body.removeChild(textArea);
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Esc key closes open modals
    if (e.key === "Escape") {
      const receiptModal = document.getElementById("modal-receipt");
      const historyModal = document.getElementById("modal-history");
      if (receiptModal && !receiptModal.classList.contains("hidden")) {
        receiptModal.classList.add("hidden");
      }
      if (historyModal && !historyModal.classList.contains("hidden")) {
        historyModal.classList.add("hidden");
      }
    }

    // Ctrl + Enter submits scan
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      triggerScan();
    }
  });
}

function syncSoundIcon() {
  const icon = document.getElementById("sound-icon");
  const btn = document.getElementById("btn-toggle-sound");
  if (icon) {
    icon.innerHTML = soundEnabled
      ? `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd"/></svg>`
      : `<svg class="w-3.5 h-3.5 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;
  }
  if (btn) btn.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem("payshield_sound", soundEnabled ? "true" : "false");
  syncSoundIcon();
  if (soundEnabled) {
    playChime("click");
    showToast("Sound effects enabled", "info");
  } else {
    showToast("Sound effects muted", "info");
  }
}

function clearForm() {
  document.getElementById("product_name").value = "";
  document.getElementById("product_url").value = "";
  document.getElementById("price").value = "";
  document.getElementById("currency").value = "USD";
  updateCurrencySymbol();
  document.getElementById("seller_name").value = "";
  document.getElementById("seller_notes").value = "";
  document.getElementById("user-confirm-checkbox").checked = false;

  currentScanResult = null;
  currentFormData = null;

  document.getElementById("state-result").classList.add("hidden");
  document.getElementById("state-scanning").classList.add("hidden");
  document.getElementById("state-empty").classList.remove("hidden");
}

const FALLBACK_PRESETS = [
  {
    "id": "scam_iphone",
    "name": "High Risk: 92% Off iPhone 16 Pro Fake Store",
    "product_name": "Brand New iPhone 16 Pro Max 1TB Titanium",
    "product_url": "https://apple-authorized-clearance-outlet.shop/item/iphone16",
    "price": 89.00,
    "currency": "USD",
    "seller_name": "AppleGlobalLiquidation_US",
    "seller_notes": "Urgently clearing warehouse overrun! Offer expires in 8 minutes. Must pay right now to secure stock. Please choose friends and family to avoid custom tax fees or your order will be cancelled immediately!"
  },
  {
    "id": "medium_vintage",
    "name": "Medium Risk: Unverified Watch Reseller",
    "product_name": "Seiko Automatic Vintage Diver Watch",
    "product_url": "https://tokyo-vintage-chrono-finds.online/listing/seiko-skx007",
    "price": 135.00,
    "currency": "USD",
    "seller_name": "Kenji_Collectibles",
    "seller_notes": "Selling from personal collection. Domain registered last week. Price is fair, only one piece available. Prefer payment today so I can ship before weekend."
  },
  {
    "id": "safe_leather",
    "name": "Low Risk: Authentic Artisan Leather Shop",
    "product_name": "Handmade Full-Grain Leather Messenger Bag",
    "product_url": "https://bellanocaleather.com/shop/artisan-messenger-bag",
    "price": 165.00,
    "currency": "USD",
    "seller_name": "Bellanoca Leather Goods LLC",
    "seller_notes": "Handcrafted in Florence with genuine full-grain leather. Covered by standard 30-day money-back guarantee and PayPal Purchase Protection. Free shipping on all orders."
  },
  {
    "id": "scam_ps5",
    "name": "High Risk: PS5 Pro Console Warehouse Scam",
    "product_name": "Sony PlayStation 5 Pro Console Bundle + 2 Controllers",
    "product_url": "http://sony-playstation-liquidation-hub.top/ps5-special",
    "price": 59.99,
    "currency": "USD",
    "seller_name": "FastDepot_Liquidation",
    "seller_notes": "HURRY UP! 5 units left at wholesale price. Wire transfer or PayPal friends & family only. Act now before stock is wiped out in 10 minutes!"
  }
];

async function initPresets() {
  const container = document.getElementById("presets-container");
  let presets = FALLBACK_PRESETS;
  try {
    const res = await fetch("/api/presets");
    if (res.ok) {
      presets = await res.json();
    }
  } catch (e) {
    // Graceful fallback for local file:/// preview mode
  }

  container.innerHTML = "";
  presets.forEach((preset) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "text-left p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-white/5 hover:border-paypal-blue transition-all group flex flex-col justify-between hover:-translate-y-0.5 shadow-sm cursor-pointer";

    let badgeColor = "bg-red-500/15 text-red-400 border-red-500/30";
    let icon = `<svg class="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    if (preset.id.startsWith("safe")) {
      badgeColor = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      icon = `<svg class="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`;
    } else if (preset.id.startsWith("medium")) {
      badgeColor = "bg-amber-500/15 text-amber-400 border-amber-500/30";
      icon = `<svg class="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    }

    const sym = CURRENCY_SYMBOLS[preset.currency || "USD"] || "$";

    btn.innerHTML = `
      <div class="flex items-center justify-between w-full mb-1.5">
        <span class="text-xs font-black text-white group-hover:text-sky-300 truncate pr-2 flex items-center gap-1.5">
          <span class="flex items-center">${icon}</span>
          <span>${preset.product_name}</span>
        </span>
        <span class="text-[10px] font-mono font-black px-2 py-0.5 rounded border ${badgeColor} shrink-0">${sym}${preset.price}</span>
      </div>
      <span class="text-[11px] text-slate-400 line-clamp-1">${preset.name}</span>
    `;

    btn.addEventListener("click", () => {
      populateForm(preset);
      triggerScan();
    });

    container.appendChild(btn);
  });
}

function populateForm(data) {
  document.getElementById("product_name").value = data.product_name || "";
  document.getElementById("product_url").value = data.product_url || "";
  document.getElementById("price").value = data.price || "";
  document.getElementById("currency").value = data.currency || "USD";
  updateCurrencySymbol();
  document.getElementById("seller_name").value = data.seller_name || "";
  document.getElementById("seller_notes").value = data.seller_notes || "";
}

function handleScanSubmit(e) {
  e.preventDefault();
  triggerScan();
}

// Client-side fallback analyzer when opened via local file:/// or offline preview
function clientSideAnalyzeFallback(data) {
  const url = (data.product_url || "").toLowerCase();
  const notes = (data.seller_notes || "").toLowerCase();
  const title = (data.product_name || "").toLowerCase();
  const price = parseFloat(data.price) || 0;

  let domainRisk = 0;
  let priceRisk = 0;
  let urgencyRisk = 0;
  const domainFlags = [];
  const priceFlags = [];
  const urgencyFlags = [];
  const keyTakeaways = [];

  // Domain checks
  if (url.includes(".shop") || url.includes(".top") || url.includes(".xyz") || url.includes(".online")) {
    domainRisk += 35;
    domainFlags.push("Suspicious low-reputation top-level domain (.shop / .top / .online).");
  }
  if (url.includes("clearance") || url.includes("outlet") || url.includes("authorized")) {
    domainRisk += 30;
    domainFlags.push("Domain contains deceptive brand impersonation keywords (e.g. 'clearance', 'outlet').");
  }
  if (!url.startsWith("https://")) {
    domainRisk += 25;
    domainFlags.push("Insecure connection (HTTP without SSL encryption).");
  }
  if (domainFlags.length === 0) {
    domainFlags.push("Valid HTTPS connection on standard merchant domain.");
  }

  // Price checks
  if ((title.includes("iphone") && price < 300) || (title.includes("ps5") && price < 200)) {
    priceRisk += 40;
    priceFlags.push(`Listing price ($${price.toFixed(2)}) is over 80% below typical retail benchmark.`);
  } else if (price < 10) {
    priceRisk += 20;
    priceFlags.push("Abnormally low micro-pricing detected.");
  } else {
    priceFlags.push("Price point aligns with realistic secondary market benchmarks.");
  }

  // Urgency & payment bypass
  if (notes.includes("friends and family") || notes.includes("friends & family") || notes.includes("wire transfer")) {
    urgencyRisk += 50;
    urgencyFlags.push("Demands unprotectable payment (Friends & Family / Wire Transfer) bypassing Buyer Protection.");
    keyTakeaways.push("NEVER pay via PayPal Friends & Family for goods; always use protected Goods & Services.");
  }
  if (notes.includes("minutes") || notes.includes("hurry") || notes.includes("expires") || notes.includes("urgent")) {
    urgencyRisk += 25;
    urgencyFlags.push("Artificial countdown timer forcing immediate impulse checkout.");
    keyTakeaways.push("High-pressure countdowns are a classic tactic to prevent buyers from verifying the seller.");
  }
  if (urgencyFlags.length === 0) {
    urgencyFlags.push("No coercive urgency or off-platform payment language found.");
    keyTakeaways.push("Purchase is eligible for full PayPal Buyer Purchase Protection.");
  }

  const rawScore = domainRisk + priceRisk + urgencyRisk;
  const riskScore = Math.min(100, Math.max(0, rawScore));
  const riskLevel = riskScore <= 30 ? "LOW" : riskScore <= 65 ? "MEDIUM" : "HIGH";

  return {
    risk_level: riskLevel,
    risk_score: riskScore,
    summary: riskLevel === "LOW" ? "SAFE TO PROCEED" : riskLevel === "MEDIUM" ? "PROCEED WITH CAUTION" : "CRITICAL SCAM DETECTED",
    explanation: riskLevel === "LOW"
      ? "This listing passes safety heuristics with normal pricing and secure protocols."
      : riskLevel === "MEDIUM"
      ? "Unverified seller attributes and discount anomalies detected. Exercise caution before paying."
      : "High-probability fraudulent listing. Pushy urgency, domain spoofing, and Friends & Family bypass detected.",
    key_takeaways: keyTakeaways.length ? keyTakeaways : ["Always keep payment on official PayPal checkout channels."],
    breakdown: {
      domain: { score: Math.min(100, domainRisk), flags: domainFlags },
      price: { score: Math.min(100, priceRisk), flags: priceFlags },
      urgency: { score: Math.min(100, urgencyRisk), flags: urgencyFlags }
    },
    paypal_order_eligible: riskLevel === "LOW"
  };
}

async function triggerScan() {
  const productName = document.getElementById("product_name").value.trim();
  const productUrl = document.getElementById("product_url").value.trim();
  const priceInput = document.getElementById("price").value;
  const price = parseFloat(priceInput);
  const currency = document.getElementById("currency").value;
  const sellerName = document.getElementById("seller_name").value.trim();
  const sellerNotes = document.getElementById("seller_notes").value.trim();

  if (!productName || !productUrl) {
    showToast("Please enter both a product title and listing URL.", "error");
    return;
  }

  if (isNaN(price) || price <= 0) {
    showToast("Please enter a valid positive price.", "error");
    return;
  }

  currentFormData = {
    product_name: productName,
    product_url: productUrl,
    price: price,
    currency: currency,
    seller_name: sellerName,
    seller_notes: sellerNotes
  };

  // Disable button to prevent double-click race conditions
  const btnScan = document.getElementById("btn-scan");
  const btnScanLabel = document.getElementById("btn-scan-label");
  btnScan.disabled = true;
  btnScan.classList.add("opacity-50", "cursor-wait");
  if (btnScanLabel) btnScanLabel.innerText = "Analyzing...";

  // Show Scanning Animation
  document.getElementById("state-empty").classList.add("hidden");
  document.getElementById("state-result").classList.add("hidden");
  document.getElementById("state-scanning").classList.remove("hidden");

  // Scroll into view on mobile
  if (window.innerWidth < 1024) {
    document.getElementById("state-scanning").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const scanText = document.getElementById("scan-step-text");
  scanText.innerText = "Analyzing domain authenticity, SSL certificate and TLD risk...";

  const t1 = setTimeout(() => {
    scanText.innerText = "Cross-referencing market price benchmarks for discount anomalies...";
  }, 350);

  const t2 = setTimeout(() => {
    scanText.innerText = "Executing NLP urgency engine on seller messages & payment bypass...";
  }, 700);

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentFormData)
    });

    clearTimeout(t1);
    clearTimeout(t2);

    if (!res.ok) {
      throw new Error(`Server returned error: ${res.status}`);
    }

    const data = await res.json();
    currentScanResult = data;

    setTimeout(() => {
      renderScanResult(data);
      btnScan.disabled = false;
      btnScan.classList.remove("opacity-50", "cursor-wait");
      if (btnScanLabel) btnScanLabel.innerText = "Scan with PayShield AI";
    }, 450);

  } catch (err) {
    clearTimeout(t1);
    clearTimeout(t2);

    // Fallback: evaluate locally if backend API is unreachable or running from file:///
    const fallbackData = clientSideAnalyzeFallback(currentFormData);
    currentScanResult = fallbackData;

    setTimeout(() => {
      renderScanResult(fallbackData);
      btnScan.disabled = false;
      btnScan.classList.remove("opacity-50", "cursor-wait");
      if (btnScanLabel) btnScanLabel.innerText = "Scan with PayShield AI";
      showToast("Evaluated using client-side heuristics. Run 'python app.py' for full backend AI.", "info");
    }, 450);
  }
}

function renderScanResult(res) {
  document.getElementById("state-scanning").classList.add("hidden");
  document.getElementById("state-result").classList.remove("hidden");

  // Smooth scroll to results on mobile viewports
  if (window.innerWidth < 1024) {
    document.getElementById("state-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const level = res.risk_level;
  const score = res.risk_score;

  playChime(level === "HIGH" ? "high" : level === "MEDIUM" ? "med" : "safe");

  const verdictCard = document.getElementById("verdict-card");
  const levelBadge = document.getElementById("verdict-level-badge");
  const iconBox = document.getElementById("verdict-icon-container");
  const title = document.getElementById("verdict-title");
  const scoreEl = document.getElementById("verdict-score");
  const gaugeCircle = document.getElementById("gauge-circle-fill");

  animateGauge(scoreEl, gaugeCircle, score, level);

  verdictCard.className = "rounded-3xl p-6 sm:p-7 border transition-all duration-300 relative overflow-hidden";

  if (level === "HIGH") {
    verdictCard.classList.add("bg-red-950/40", "border-red-500/60", "glow-red");
    levelBadge.className = "px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/50";
    levelBadge.innerText = "HIGH RISK SCAM";
    iconBox.className = "w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl bg-red-600/30 text-red-400 border border-red-500/50";
    iconBox.innerHTML = `<svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    title.innerText = "High-Risk Fraud Flags Detected";
    scoreEl.className = "absolute font-black font-mono text-base text-red-400";
  } else if (level === "MEDIUM") {
    verdictCard.classList.add("bg-amber-950/30", "border-amber-500/60", "glow-amber");
    levelBadge.className = "px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/50";
    levelBadge.innerText = "MEDIUM RISK";
    iconBox.className = "w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl bg-amber-600/30 text-amber-400 border border-amber-500/50";
    iconBox.innerHTML = `<svg class="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    title.innerText = "Proceed With Caution";
    scoreEl.className = "absolute font-black font-mono text-base text-amber-400";
  } else {
    verdictCard.classList.add("bg-emerald-950/30", "border-emerald-500/60", "glow-green");
    levelBadge.className = "px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/50";
    levelBadge.innerText = "LOW RISK (SAFE)";
    iconBox.className = "w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/50";
    iconBox.innerHTML = `<svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`;
    title.innerText = "Transaction Appears Safe";
    scoreEl.className = "absolute font-black font-mono text-base text-emerald-400";
  }

  document.getElementById("verdict-summary").innerText = res.summary;
  document.getElementById("verdict-explanation").innerText = res.explanation;

  const takeawaysList = document.getElementById("verdict-takeaways");
  takeawaysList.innerHTML = "";
  (res.key_takeaways || []).forEach((tip) => {
    const li = document.createElement("li");
    li.className = "flex items-start gap-2";
    li.innerHTML = `<span class="text-paypal-cyan font-bold">•</span><span>${tip}</span>`;
    takeawaysList.appendChild(li);
  });

  renderBreakdownPillar("domain", res.breakdown.domain);
  renderBreakdownPillar("price", res.breakdown.price);
  renderBreakdownPillar("urgency", res.breakdown.urgency);

  setupCheckoutGating(res);
}

function renderBreakdownPillar(type, data) {
  document.getElementById(`score-${type}`).innerText = `${data.score}/100`;
  const list = document.getElementById(`flags-${type}`);
  list.innerHTML = "";
  (data.flags || []).forEach((f) => {
    const li = document.createElement("li");
    li.className = "flex items-start gap-1.5";
    li.innerHTML = `<span class="text-sky-400 font-bold shrink-0">›</span><span>${f}</span>`;
    list.appendChild(li);
  });
}

function animateGauge(scoreEl, circleEl, targetScore, level) {
  const circumference = 251.2;
  const targetOffset = circumference - (targetScore / 100) * circumference;

  let strokeColor = "#10B981";
  if (level === "HIGH") strokeColor = "#EF4444";
  else if (level === "MEDIUM") strokeColor = "#F59E0B";

  circleEl.setAttribute("stroke", strokeColor);
  circleEl.style.strokeDashoffset = targetOffset;

  let current = 0;
  const duration = 650;
  const stepTime = 15;
  const steps = duration / stepTime;
  const increment = targetScore / steps;

  const timer = setInterval(() => {
    current += increment;
    if (current >= targetScore) {
      current = targetScore;
      clearInterval(timer);
    }
    scoreEl.innerText = Math.round(current);
  }, stepTime);
}

// Enforces risk gates: safe orders unlock instantly; risky ones require explicit confirmation
function setupCheckoutGating(res) {
  const level = res.risk_level;
  const btnCheckout = document.getElementById("btn-paypal-checkout");
  const btnText = document.getElementById("paypal-btn-text");
  const lockIndicator = document.getElementById("checkout-lock-indicator");
  const confirmBox = document.getElementById("risk-confirmation-box");
  const confirmCheckbox = document.getElementById("user-confirm-checkbox");
  const confirmTitle = document.getElementById("risk-confirmation-title");
  const confirmDesc = document.getElementById("risk-confirmation-desc");
  const confirmLabel = document.getElementById("user-confirm-label");

  confirmCheckbox.checked = false;
  const sym = CURRENCY_SYMBOLS[currentFormData.currency] || "$";

  if (level === "LOW") {
    confirmBox.classList.add("hidden");
    btnCheckout.disabled = false;
    btnCheckout.classList.remove("opacity-40", "cursor-not-allowed");
    btnText.innerText = `Pay ${sym}${currentFormData.price.toFixed(2)} with PayPal`;
    lockIndicator.className = "text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    lockIndicator.innerText = "Unlocked & Verified";
  } else if (level === "MEDIUM") {
    confirmBox.classList.remove("hidden");
    confirmBox.className = "mb-5 p-4 sm:p-5 rounded-2xl border bg-amber-950/20 border-amber-500/50";
    document.getElementById("risk-warning-icon").innerHTML = `<svg class="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    confirmTitle.innerText = "Caution: Medium Risk Detected";
    confirmDesc.innerText = "This seller has unverified attributes or pricing anomalies. You can still pay with PayPal, but confirm you have read the warnings first.";
    confirmLabel.innerText = "I have reviewed the warnings and still wish to proceed to PayPal checkout.";

    btnCheckout.disabled = true;
    btnCheckout.classList.add("opacity-40", "cursor-not-allowed");
    btnText.innerText = "Confirm Warnings to Unlock Checkout";
    lockIndicator.className = "text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40";
    lockIndicator.innerText = "Confirmation Required";
  } else {
    confirmBox.classList.remove("hidden");
    confirmBox.className = "mb-5 p-4 sm:p-5 rounded-2xl border bg-red-950/30 border-red-500/60";
    document.getElementById("risk-warning-icon").innerHTML = `<svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    confirmTitle.innerText = "PayShield Safety Lock Engaged";
    confirmDesc.innerText = "High scam indicators detected! PayPal checkout is securely locked to protect your funds. If you believe this is a false positive, you can explicitly override the safety lock.";
    confirmLabel.innerText = "I acknowledge this seller exhibits extreme scam signs and take full personal responsibility to override.";

    btnCheckout.disabled = true;
    btnCheckout.classList.add("opacity-40", "cursor-not-allowed");
    btnText.innerText = "Checkout Locked for Safety";
    lockIndicator.className = "text-xs font-bold px-3 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/40";
    lockIndicator.innerText = "Safety Locked";
  }
}

function handleConfirmationToggle(e) {
  const isChecked = e.target.checked;
  const btnCheckout = document.getElementById("btn-paypal-checkout");
  const btnText = document.getElementById("paypal-btn-text");
  const sym = CURRENCY_SYMBOLS[currentFormData.currency] || "$";

  if (isChecked) {
    btnCheckout.disabled = false;
    btnCheckout.classList.remove("opacity-40", "cursor-not-allowed");
    btnText.innerText = `Proceed to PayPal (${sym}${currentFormData.price.toFixed(2)})`;
  } else {
    btnCheckout.disabled = true;
    btnCheckout.classList.add("opacity-40", "cursor-not-allowed");
    btnText.innerText = currentScanResult.risk_level === "HIGH" ? "Checkout Locked for Safety" : "Confirm Warnings to Unlock Checkout";
  }
}

async function handlePayPalCheckout() {
  const btnCheckout = document.getElementById("btn-paypal-checkout");
  const btnText = document.getElementById("paypal-btn-text");
  const confirmCheckbox = document.getElementById("user-confirm-checkbox");

  const originalText = btnText.innerText;
  btnCheckout.disabled = true;
  btnText.innerText = "Connecting to PayPal Sandbox v2...";

  try {
    let orderData;
    try {
      const createRes = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: currentFormData.price,
          currency: currentFormData.currency,
          item_name: currentFormData.product_name,
          risk_level: currentScanResult.risk_level,
          user_confirmed: confirmCheckbox.checked || currentScanResult.risk_level === "LOW"
        })
      });
      orderData = await createRes.json();
    } catch (networkErr) {
      orderData = {
        success: true,
        order_id: `SIM-ORD-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        status: "CREATED"
      };
    }

    if (!orderData.success) {
      showToast("Order Blocked: " + (orderData.message || orderData.error), "error");
      btnCheckout.disabled = false;
      btnText.innerText = originalText;
      return;
    }

    btnText.innerText = "Authorizing with PayPal...";

    setTimeout(async () => {
      try {
        let captureData;
        try {
          const captureRes = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: orderData.order_id })
          });
          captureData = await captureRes.json();
        } catch (capNetworkErr) {
          captureData = {
            success: true,
            status: "COMPLETED",
            transaction_id: `SIM-TXN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
          };
        }

        if (!captureData.success) {
          showToast("Capture Error: " + (captureData.message || captureData.error), "error");
          btnCheckout.disabled = false;
          btnText.innerText = originalText;
          return;
        }

        const sym = CURRENCY_SYMBOLS[currentFormData.currency] || "$";
        document.getElementById("receipt-order-id").innerText = orderData.order_id;
        document.getElementById("receipt-txn-id").innerText =
          captureData.transaction_id || `TXN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        document.getElementById("receipt-amount").innerText = `${sym}${currentFormData.price.toFixed(2)} ${currentFormData.currency}`;
        document.getElementById("receipt-risk").innerText = `${currentScanResult.risk_level} Risk (Score: ${currentScanResult.risk_score}/100)`;

        document.getElementById("modal-receipt").classList.remove("hidden");

        btnCheckout.disabled = false;
        btnText.innerText = originalText;
      } catch (capErr) {
        showToast("Capture network error: " + capErr.message, "error");
        btnCheckout.disabled = false;
        btnText.innerText = originalText;
      }
    }, 600);

  } catch (err) {
    showToast("PayPal connection error: " + err.message, "error");
    btnCheckout.disabled = false;
    btnText.innerText = originalText;
  }
}

async function openHistoryModal() {
  const modal = document.getElementById("modal-history");
  const list = document.getElementById("history-list");
  list.innerHTML = "<p class='text-slate-400'>Loading audit history...</p>";
  modal.classList.remove("hidden");

  try {
    const res = await fetch("/api/history");
    const history = await res.json();

    if (!history.length) {
      list.innerHTML = "<p class='text-slate-400 py-6 text-center'>No previous scans in this session yet.</p>";
      return;
    }

    list.innerHTML = "";
    history.forEach((item) => {
      const div = document.createElement("div");
      div.className = "p-3.5 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-between";

      let badgeColor = "bg-red-500/20 text-red-400 border-red-500/40";
      if (item.risk_level === "LOW") badgeColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
      else if (item.risk_level === "MEDIUM") badgeColor = "bg-amber-500/20 text-amber-400 border-amber-500/40";

      const sym = CURRENCY_SYMBOLS[item.currency || "USD"] || "$";

      div.innerHTML = `
        <div class="flex-1 pr-3 min-w-0">
          <div class="font-bold text-white text-xs truncate">${item.product_name}</div>
          <div class="text-[11px] text-slate-400 truncate">${item.product_url}</div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="font-bold text-slate-200 text-xs">${sym}${item.price.toFixed(2)}</span>
          <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase border ${badgeColor}">
            ${item.risk_level} (${item.risk_score})
          </span>
        </div>
      `;
      list.appendChild(div);
    });
  } catch (err) {
    list.innerHTML = "<p class='text-red-400'>Failed to load history.</p>";
  }
}
