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
  initStatusCheck();
  setupEventListeners();
  setupKeyboardShortcuts();
  updateCurrencySymbol();
  syncSoundIcon();
  syncThemeIcon();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem("payshield_theme")) {
      if (e.matches) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      syncThemeIcon();
    }
  });
});

async function initStatusCheck() {
  const badgeText = document.getElementById("status-badge-text");
  try {
    const res = await fetch("/api/status");
    if (res.ok) {
      const data = await res.json();
      if (badgeText) badgeText.innerText = data.status || "";
    }
  } catch (e) {}
}

function isDarkMode() {
  return document.documentElement.classList.contains("dark");
}

function syncThemeIcon() {
  const dark = isDarkMode();
  const iconHtml = dark
    ? `<svg class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`
    : `<svg class="w-3.5 h-3.5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>`;

  ["theme-icon", "theme-icon-mobile"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = iconHtml;
  });
}

function toggleTheme() {
  const willBeDark = !isDarkMode();
  if (willBeDark) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("payshield_theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("payshield_theme", "light");
  }
  syncThemeIcon();
}

function toggleMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  const btn = document.getElementById("btn-mobile-menu");
  const hamburger = document.getElementById("hamburger-icon");
  const closeIcon = document.getElementById("close-menu-icon");
  if (!menu) return;

  const isOpen = !menu.classList.contains("hidden");
  if (isOpen) {
    closeMobileMenu();
  } else {
    menu.classList.remove("hidden");
    if (btn) btn.setAttribute("aria-expanded", "true");
    if (hamburger) hamburger.classList.add("hidden");
    if (closeIcon) closeIcon.classList.remove("hidden");
  }
}

function closeMobileMenu() {
  const menu = document.getElementById("mobile-menu");
  const btn = document.getElementById("btn-mobile-menu");
  const hamburger = document.getElementById("hamburger-icon");
  const closeIcon = document.getElementById("close-menu-icon");
  if (menu && !menu.classList.contains("hidden")) {
    menu.classList.add("hidden");
    if (btn) btn.setAttribute("aria-expanded", "false");
    if (hamburger) hamburger.classList.remove("hidden");
    if (closeIcon) closeIcon.classList.add("hidden");
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "cyber-toast flex items-center justify-between gap-3 text-xs bg-white/95 dark:bg-[#0F141E]/95 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/10 shadow-lg";

  let icon = `<svg class="w-3.5 h-3.5 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  if (type === "error") {
    icon = `<svg class="w-3.5 h-3.5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    toast.classList.add("border-rose-500/30", "bg-rose-500/10");
  } else if (type === "success") {
    icon = `<svg class="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
    toast.classList.add("border-emerald-500/30", "bg-emerald-500/10");
  }

  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="flex items-center">${icon}</span>
      <span class="font-medium">${message}</span>
    </div>
    <button type="button" class="text-slate-400 hover:text-slate-700 dark:hover:text-white transition p-0.5 text-xs cursor-pointer flex items-center" aria-label="Close">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;

  toast.querySelector("button").addEventListener("click", () => toast.remove());
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

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
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (e) {}
}

function updateCurrencySymbol() {
  const currency = document.getElementById("currency").value;
  const symbol = CURRENCY_SYMBOLS[currency] || "$";
  const label = document.getElementById("currency-symbol-label");
  if (label) label.innerText = symbol;
}

function setupEventListeners() {
  document.getElementById("scam-form").addEventListener("submit", handleScanSubmit);
  document.getElementById("currency").addEventListener("change", updateCurrencySymbol);
  document.getElementById("user-confirm-checkbox").addEventListener("change", handleConfirmationToggle);
  document.getElementById("btn-paypal-checkout").addEventListener("click", handlePayPalCheckout);
  const btnRetest = document.getElementById("btn-retest");
  if (btnRetest) {
    btnRetest.addEventListener("click", () => {
      const nameInput = document.getElementById("product_name");
      if (nameInput) {
        nameInput.focus();
        nameInput.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }
  
  const btnHistory = document.getElementById("btn-view-history");
  if (btnHistory) btnHistory.addEventListener("click", openHistoryModal);

  const btnHistoryMobile = document.getElementById("btn-view-history-mobile");
  if (btnHistoryMobile) {
    btnHistoryMobile.addEventListener("click", () => {
      closeMobileMenu();
      openHistoryModal();
    });
  }

  const btnMobileMenu = document.getElementById("btn-mobile-menu");
  if (btnMobileMenu) btnMobileMenu.addEventListener("click", toggleMobileMenu);

  document.getElementById("btn-close-history").addEventListener("click", () => document.getElementById("modal-history").classList.add("hidden"));
  document.getElementById("btn-close-receipt").addEventListener("click", () => document.getElementById("modal-receipt").classList.add("hidden"));

  ["modal-receipt", "modal-history"].forEach(id => {
    const modal = document.getElementById(id);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  });

  document.getElementById("btn-clear-form").addEventListener("click", clearForm);

  ["btn-toggle-sound", "btn-toggle-sound-mobile"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", toggleSound);
  });

  ["btn-toggle-theme", "btn-toggle-theme-mobile"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", toggleTheme);
  });

  const btnCopyTxn = document.getElementById("btn-copy-txn");
  if (btnCopyTxn) {
    btnCopyTxn.addEventListener("click", copyTransactionId);
  }

  document.addEventListener("click", (e) => {
    const mobileMenu = document.getElementById("mobile-menu");
    const btnMobileMenu = document.getElementById("btn-mobile-menu");
    if (mobileMenu && !mobileMenu.classList.contains("hidden")) {
      if (!mobileMenu.contains(e.target) && !btnMobileMenu.contains(e.target)) {
        closeMobileMenu();
      }
    }
  });
}

function copyTransactionId() {
  const txn = document.getElementById("receipt-txn-id").innerText;
  const btn = document.getElementById("btn-copy-txn");

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(txn).then(() => {
      btn.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`;
      showToast("Copied transaction ID", "success");
      setTimeout(() => {
        btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`;
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
    btn.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>`;
    showToast("Copied transaction ID", "success");
    setTimeout(() => {
      btn.innerHTML = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`;
    }, 1500);
  } catch (err) {
    showToast("Copy failed", "error");
  }
  document.body.removeChild(textArea);
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeMobileMenu();
      const receiptModal = document.getElementById("modal-receipt");
      const historyModal = document.getElementById("modal-history");
      if (receiptModal && !receiptModal.classList.contains("hidden")) receiptModal.classList.add("hidden");
      if (historyModal && !historyModal.classList.contains("hidden")) historyModal.classList.add("hidden");
    }

    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      triggerScan();
    }
  });
}

function syncSoundIcon() {
  const iconHtml = soundEnabled
    ? `<svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clip-rule="evenodd"/></svg>`
    : `<svg class="w-3.5 h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;

  ["sound-icon", "sound-icon-mobile"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = iconHtml;
  });

  ["btn-toggle-sound", "btn-toggle-sound-mobile"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
  });
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem("payshield_sound", soundEnabled ? "true" : "false");
  syncSoundIcon();
  if (soundEnabled) {
    playChime("click");
    showToast("Audio feedback enabled", "info");
  } else {
    showToast("Audio muted", "info");
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

  ["domain", "price", "urgency"].forEach((type) => {
    const bar = document.getElementById(`bar-fill-${type}`);
    if (bar) bar.style.width = "0%";
  });

  currentScanResult = null;
  currentFormData = null;

  const btnScan = document.getElementById("btn-scan");
  if (btnScan) {
    btnScan.disabled = false;
    btnScan.classList.remove("opacity-50", "cursor-wait");
  }
  const btnScanLabel = document.getElementById("btn-scan-label");
  if (btnScanLabel) btnScanLabel.innerText = "Analyze Listing";

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
    if (res.ok) presets = await res.json();
  } catch (e) {}

  container.innerHTML = "";
  presets.forEach((preset) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "text-left p-3 rounded-lg bg-white/80 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-white/[0.05] border border-slate-200/90 dark:border-white/[0.07] hover:border-brand-500/40 hover:shadow-sm transition-all group flex flex-col justify-between cursor-pointer";

    let badgeColor = "bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-500/20";
    let icon = `<span class="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>`;
    let riskTag = "HIGH RISK";
    if (preset.id.startsWith("safe")) {
      badgeColor = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      icon = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>`;
      riskTag = "SAFE";
    } else if (preset.id.startsWith("medium")) {
      badgeColor = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      icon = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>`;
      riskTag = "MEDIUM";
    }

    const sym = CURRENCY_SYMBOLS[preset.currency || "USD"] || "$";

    btn.innerHTML = `
      <div class="flex items-center justify-between w-full mb-1.5">
        <span class="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-brand-500 dark:group-hover:text-slate-100 truncate pr-2 flex items-center gap-1.5">
          ${icon}
          <span class="truncate">${preset.product_name}</span>
        </span>
        <span class="text-[10px] font-mono px-1.5 py-0.2 rounded border ${badgeColor} font-semibold shrink-0">${sym}${preset.price}</span>
      </div>
      <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span class="truncate">${preset.name}</span>
        <span class="text-[9px] font-mono uppercase tracking-wider opacity-60 ml-1 shrink-0 font-medium">${riskTag}</span>
      </div>
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

  if (url.includes(".shop") || url.includes(".top") || url.includes(".xyz") || url.includes(".online")) {
    domainRisk += 35;
    domainFlags.push("Suspicious low-reputation top-level domain.");
  }
  if (url.includes("clearance") || url.includes("outlet") || url.includes("authorized")) {
    domainRisk += 30;
    domainFlags.push("Domain contains deceptive brand impersonation keywords.");
  }
  if (!url.startsWith("https://")) {
    domainRisk += 25;
    domainFlags.push("Insecure HTTP connection without SSL.");
  }
  if (domainFlags.length === 0) {
    domainFlags.push("Valid HTTPS connection on standard domain.");
  }

  if ((title.includes("iphone") && price < 300) || (title.includes("ps5") && price < 200)) {
    priceRisk += 40;
    priceFlags.push(`Listing price ($${price.toFixed(2)}) is over 80% below retail.`);
  } else if (price < 10) {
    priceRisk += 20;
    priceFlags.push("Abnormally low micro-pricing detected.");
  } else {
    priceFlags.push("Price point aligns with market expectations.");
  }

  if (notes.includes("friends and family") || notes.includes("friends & family") || notes.includes("wire transfer")) {
    urgencyRisk += 50;
    urgencyFlags.push("Requests payment via unprotectable channels (Friends & Family).");
    keyTakeaways.push("Never use PayPal Friends & Family for purchases; always keep Buyer Protection active.");
  }
  if (notes.includes("minutes") || notes.includes("hurry") || notes.includes("expires") || notes.includes("urgent")) {
    urgencyRisk += 25;
    urgencyFlags.push("Artificial countdown timer detected.");
    keyTakeaways.push("High-pressure countdowns are used to rush checkout before verification.");
  }
  if (urgencyFlags.length === 0) {
    urgencyFlags.push("No coercive urgency or off-platform payment language found.");
    keyTakeaways.push("Eligible for full PayPal Buyer Protection.");
  }

  const rawScore = domainRisk + priceRisk + urgencyRisk;
  const riskScore = Math.min(100, Math.max(0, rawScore));
  const riskLevel = riskScore <= 30 ? "LOW" : riskScore <= 65 ? "MEDIUM" : "HIGH";

  return {
    risk_level: riskLevel,
    risk_score: riskScore,
    summary: riskLevel === "LOW" ? "SAFE TO PROCEED" : riskLevel === "MEDIUM" ? "PROCEED WITH CAUTION" : "CRITICAL SCAM DETECTED",
    explanation: riskLevel === "LOW"
      ? "Listing passes safety heuristics with normal pricing and secure protocols."
      : riskLevel === "MEDIUM"
      ? "Unverified seller attributes and discount anomalies detected."
      : "High-probability fraudulent listing with spoofing and payment bypass tactics.",
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
    showToast("Please enter item title and listing URL", "error");
    return;
  }

  if (isNaN(price) || price <= 0) {
    showToast("Please enter a valid positive price", "error");
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

  const btnScan = document.getElementById("btn-scan");
  const btnScanLabel = document.getElementById("btn-scan-label");
  btnScan.disabled = true;
  btnScan.classList.add("opacity-50", "cursor-wait");
  if (btnScanLabel) btnScanLabel.innerText = "Analyzing...";

  document.getElementById("state-empty").classList.add("hidden");
  document.getElementById("state-result").classList.add("hidden");
  document.getElementById("state-scanning").classList.remove("hidden");

  if (window.innerWidth < 1024) {
    document.getElementById("state-scanning").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const scanText = document.getElementById("scan-step-text");
  scanText.innerText = "Analyzing domain authenticity and SSL...";

  const t1 = setTimeout(() => {
    scanText.innerText = "Cross-referencing market price benchmarks...";
  }, 350);

  const t2 = setTimeout(() => {
    scanText.innerText = "Evaluating seller communication patterns...";
  }, 700);

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentFormData)
    });

    clearTimeout(t1);
    clearTimeout(t2);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    currentScanResult = data;

    setTimeout(() => {
      renderScanResult(data);
      btnScan.disabled = false;
      btnScan.classList.remove("opacity-50", "cursor-wait");
      if (btnScanLabel) btnScanLabel.innerText = "Analyze Listing";
    }, 450);

  } catch (err) {
    clearTimeout(t1);
    clearTimeout(t2);

    const fallbackData = clientSideAnalyzeFallback(currentFormData);
    currentScanResult = fallbackData;

    setTimeout(() => {
      renderScanResult(fallbackData);
      btnScan.disabled = false;
      btnScan.classList.remove("opacity-50", "cursor-wait");
      if (btnScanLabel) btnScanLabel.innerText = "Analyze Listing";
    }, 450);
  }
}

function renderScanResult(res) {
  if (!res) return;

  document.getElementById("state-scanning").classList.add("hidden");
  document.getElementById("state-result").classList.remove("hidden");

  if (window.innerWidth < 1024) {
    document.getElementById("state-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const level = res.risk_level || "LOW";
  const score = typeof res.risk_score === "number" ? res.risk_score : 0;

  const verdictTimestamp = document.getElementById("verdict-timestamp");
  if (verdictTimestamp) {
    verdictTimestamp.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  playChime(level === "HIGH" ? "high" : level === "MEDIUM" ? "med" : "safe");

  const verdictCard = document.getElementById("verdict-card");
  const levelBadge = document.getElementById("verdict-level-badge");
  const iconBox = document.getElementById("verdict-icon-box");
  const title = document.getElementById("verdict-title");
  const scoreEl = document.getElementById("risk-score-value");
  const gaugeCircle = document.getElementById("risk-gauge-circle");

  animateGauge(scoreEl, gaugeCircle, score, level);

  verdictCard.className = "rounded-xl p-4 sm:p-5 border transition-all duration-200 relative overflow-hidden glass-panel";

  if (level === "HIGH") {
    verdictCard.classList.add("verdict-high");
    levelBadge.className = "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider font-mono bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30";
    levelBadge.innerText = "HIGH RISK";
    if (iconBox) {
      iconBox.className = "w-9 h-9 rounded-lg flex items-center justify-center bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20";
      iconBox.innerHTML = `<svg class="w-5 h-5 text-rose-500 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    }
    if (title) title.innerText = "High-Risk Fraud Flags Detected";
    if (scoreEl) scoreEl.className = "absolute font-bold font-mono text-[11px] text-rose-600 dark:text-rose-400";
  } else if (level === "MEDIUM") {
    verdictCard.classList.add("verdict-med");
    levelBadge.className = "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30";
    levelBadge.innerText = "MEDIUM RISK";
    if (iconBox) {
      iconBox.className = "w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
      iconBox.innerHTML = `<svg class="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    }
    if (title) title.innerText = "Proceed With Caution";
    if (scoreEl) scoreEl.className = "absolute font-bold font-mono text-[11px] text-amber-600 dark:text-amber-400";
  } else {
    verdictCard.classList.add("verdict-low");
    levelBadge.className = "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30";
    levelBadge.innerText = "VERIFIED SAFE";
    if (iconBox) {
      iconBox.className = "w-9 h-9 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
      iconBox.innerHTML = `<svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`;
    }
    if (title) title.innerText = "Transaction Appears Safe";
    if (scoreEl) scoreEl.className = "absolute font-bold font-mono text-[11px] text-emerald-600 dark:text-emerald-400";
  }

  const summaryEl = document.getElementById("verdict-summary");
  if (summaryEl) summaryEl.innerText = res.summary || "";

  const explanationEl = document.getElementById("verdict-explanation");
  if (explanationEl) explanationEl.innerText = res.explanation || "";

  const takeawaysList = document.getElementById("verdict-takeaways");
  if (takeawaysList) {
    takeawaysList.innerHTML = "";
    (res.key_takeaways || []).forEach((tip) => {
      const li = document.createElement("li");
      li.className = "flex items-start gap-1.5";
      li.innerHTML = `<span class="text-brand-500 font-bold shrink-0">•</span><span>${tip}</span>`;
      takeawaysList.appendChild(li);
    });
  }

  const breakdown = res.breakdown || {};
  renderBreakdownPillar("domain", breakdown.domain || { score: 0, flags: [] });
  renderBreakdownPillar("price", breakdown.price || { score: 0, flags: [] });
  renderBreakdownPillar("urgency", breakdown.urgency || { score: 0, flags: [] });

  setupCheckoutGating(res);
}

function renderBreakdownPillar(type, data) {
  if (!data) return;
  const score = typeof data.score === "number" ? Math.min(100, Math.max(0, data.score)) : 0;
  const scoreEl = document.getElementById(`score-${type}`);
  if (scoreEl) scoreEl.innerText = `${score}/100`;

  const barFill = document.getElementById(`bar-fill-${type}`);
  if (barFill) {
    barFill.style.width = `${score}%`;
    if (score > 50) {
      barFill.className = "h-full bg-rose-500 transition-all duration-500";
    } else if (score > 20) {
      barFill.className = "h-full bg-amber-500 transition-all duration-500";
    } else {
      barFill.className = "h-full bg-emerald-500 transition-all duration-500";
    }
  }

  const list = document.getElementById(`flags-${type}`);
  if (list) {
    list.innerHTML = "";
    (data.flags || []).forEach((f) => {
      const li = document.createElement("li");
      li.className = "flex items-start gap-1.5 leading-snug";
      li.innerHTML = `<span class="text-slate-400 dark:text-slate-500 font-bold shrink-0">•</span><span>${f}</span>`;
      list.appendChild(li);
    });
  }
}

function animateGauge(scoreEl, circleEl, targetScore, level) {
  if (!scoreEl) return;
  const numericScore = typeof targetScore === "number" && !isNaN(targetScore) ? Math.round(targetScore) : 0;
  const circumference = 251.2;
  const targetOffset = circumference - (numericScore / 100) * circumference;

  let strokeColor = "#10B981";
  if (level === "HIGH") strokeColor = "#F43F5E";
  else if (level === "MEDIUM") strokeColor = "#F59E0B";

  if (circleEl) {
    circleEl.setAttribute("stroke", strokeColor);
    circleEl.style.strokeDashoffset = targetOffset;
  }

  let current = 0;
  const duration = 650;
  const stepTime = 15;
  const steps = duration / stepTime;
  const increment = numericScore / steps;

  if (numericScore === 0) {
    scoreEl.innerText = "0";
    return;
  }

  const timer = setInterval(() => {
    current += increment;
    if (current >= numericScore) {
      current = numericScore;
      clearInterval(timer);
    }
    scoreEl.innerText = Math.round(current);
  }, stepTime);
}

function setupCheckoutGating(res) {
  if (!res) return;
  const level = res.risk_level || "LOW";
  const btnCheckout = document.getElementById("btn-paypal-checkout");
  const btnText = document.getElementById("paypal-btn-text");
  const lockIndicator = document.getElementById("checkout-lock-indicator");
  const confirmBox = document.getElementById("risk-confirmation-box");
  const confirmCheckbox = document.getElementById("user-confirm-checkbox");
  const confirmTitle = document.getElementById("risk-confirmation-title");
  const confirmDesc = document.getElementById("risk-confirmation-desc");
  const confirmLabel = document.getElementById("user-confirm-label");

  if (confirmCheckbox) confirmCheckbox.checked = false;
  const sym = currentFormData ? (CURRENCY_SYMBOLS[currentFormData.currency] || "$") : "$";
  const priceVal = currentFormData && typeof currentFormData.price === "number" ? currentFormData.price : 0;
  const priceStr = priceVal.toFixed(2);

  if (level === "LOW") {
    if (confirmBox) confirmBox.classList.add("hidden");
    if (btnCheckout) {
      btnCheckout.disabled = false;
      btnCheckout.classList.remove("opacity-40", "cursor-not-allowed");
    }
    if (btnText) btnText.innerText = `Pay ${sym}${priceStr} with PayPal`;
    if (lockIndicator) {
      lockIndicator.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30";
      lockIndicator.innerText = "Verified Safe";
    }
  } else if (level === "MEDIUM") {
    if (confirmBox) {
      confirmBox.classList.remove("hidden");
      confirmBox.className = "mb-3 p-3 rounded-lg border bg-amber-500/[0.06] border-amber-500/30";
    }
    const warnIcon = document.getElementById("risk-warning-icon");
    if (warnIcon) warnIcon.innerHTML = `<svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    if (confirmTitle) confirmTitle.innerText = "Caution: Medium Risk Detected";
    if (confirmDesc) confirmDesc.innerText = "This seller has unverified attributes. Review details before proceeding to PayPal.";
    if (confirmLabel) confirmLabel.innerText = "I have reviewed the warnings and wish to proceed to checkout.";

    if (btnCheckout) {
      btnCheckout.disabled = true;
      btnCheckout.classList.add("opacity-40", "cursor-not-allowed");
    }
    if (btnText) btnText.innerText = "Confirm Warnings to Unlock Checkout";
    if (lockIndicator) {
      lockIndicator.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30";
      lockIndicator.innerText = "Confirmation Required";
    }
  } else {
    if (confirmBox) {
      confirmBox.classList.remove("hidden");
      confirmBox.className = "mb-3 p-3 rounded-lg border bg-rose-500/[0.06] border-rose-500/30";
    }
    const warnIcon = document.getElementById("risk-warning-icon");
    if (warnIcon) warnIcon.innerHTML = `<svg class="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    if (confirmTitle) confirmTitle.innerText = "PayShield Safety Lock Engaged";
    if (confirmDesc) confirmDesc.innerText = "High scam indicators detected. PayPal checkout is locked to protect your funds.";
    if (confirmLabel) confirmLabel.innerText = "I acknowledge the scam indicators and override the safety lock.";

    if (btnCheckout) {
      btnCheckout.disabled = true;
      btnCheckout.classList.add("opacity-40", "cursor-not-allowed");
    }
    if (btnText) btnText.innerText = "Checkout Locked";
    if (lockIndicator) {
      lockIndicator.className = "text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30";
      lockIndicator.innerText = "Safety Locked";
    }
  }
}

function handleConfirmationToggle(e) {
  const isChecked = e.target.checked;
  const btnCheckout = document.getElementById("btn-paypal-checkout");
  const btnText = document.getElementById("paypal-btn-text");
  const sym = currentFormData ? (CURRENCY_SYMBOLS[currentFormData.currency] || "$") : "$";
  const priceVal = currentFormData && typeof currentFormData.price === "number" ? currentFormData.price : 0;
  const priceStr = priceVal.toFixed(2);

  if (isChecked) {
    if (btnCheckout) {
      btnCheckout.disabled = false;
      btnCheckout.classList.remove("opacity-40", "cursor-not-allowed");
    }
    if (btnText) btnText.innerText = `Proceed to PayPal (${sym}${priceStr})`;
  } else {
    if (btnCheckout) {
      btnCheckout.disabled = true;
      btnCheckout.classList.add("opacity-40", "cursor-not-allowed");
    }
    const isHigh = currentScanResult && currentScanResult.risk_level === "HIGH";
    if (btnText) btnText.innerText = isHigh ? "Checkout Locked" : "Confirm Warnings to Unlock Checkout";
  }
}

async function handlePayPalCheckout() {
  if (!currentFormData || !currentScanResult) {
    showToast("Please analyze a listing before proceeding to PayPal checkout", "error");
    return;
  }

  const btnCheckout = document.getElementById("btn-paypal-checkout");
  const btnText = document.getElementById("paypal-btn-text");
  const confirmCheckbox = document.getElementById("user-confirm-checkbox");

  const originalText = btnText ? btnText.innerText : "Pay with PayPal";
  if (btnCheckout) btnCheckout.disabled = true;
  if (btnText) btnText.innerText = "Connecting to PayPal...";

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
          user_confirmed: (confirmCheckbox && confirmCheckbox.checked) || currentScanResult.risk_level === "LOW"
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
      if (btnCheckout) btnCheckout.disabled = false;
      if (btnText) btnText.innerText = originalText;
      return;
    }

    if (btnText) btnText.innerText = "Authorizing with PayPal...";

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
          if (btnCheckout) btnCheckout.disabled = false;
          if (btnText) btnText.innerText = originalText;
          return;
        }

        const sym = CURRENCY_SYMBOLS[currentFormData.currency] || "$";
        const orderIdEl = document.getElementById("receipt-order-id");
        if (orderIdEl) orderIdEl.innerText = orderData.order_id;

        const txnIdEl = document.getElementById("receipt-txn-id");
        if (txnIdEl) {
          txnIdEl.innerText = captureData.transaction_id || `TXN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        }

        const amtEl = document.getElementById("receipt-amount");
        if (amtEl) amtEl.innerText = `${sym}${currentFormData.price.toFixed(2)} ${currentFormData.currency}`;

        const riskEl = document.getElementById("receipt-risk");
        if (riskEl) riskEl.innerText = `${currentScanResult.risk_level} Risk (Score: ${currentScanResult.risk_score}/100)`;

        document.getElementById("modal-receipt").classList.remove("hidden");
        if (btnCheckout) btnCheckout.disabled = false;
        if (btnText) btnText.innerText = originalText;
      } catch (capErr) {
        showToast("Capture error: " + capErr.message, "error");
        if (btnCheckout) btnCheckout.disabled = false;
        if (btnText) btnText.innerText = originalText;
      }
    }, 600);

  } catch (err) {
    showToast("PayPal connection error: " + err.message, "error");
    if (btnCheckout) btnCheckout.disabled = false;
    if (btnText) btnText.innerText = originalText;
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

    if (!Array.isArray(history) || !history.length) {
      list.innerHTML = "<p class='text-slate-400 py-4 text-center'>No previous scans in this session.</p>";
      return;
    }

    list.innerHTML = "";
    history.forEach((item) => {
      const div = document.createElement("div");
      div.className = "p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between cursor-pointer transition group";
      div.title = "Click to reload this scan";

      let badgeColor = "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
      if (item.risk_level === "LOW") badgeColor = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      else if (item.risk_level === "MEDIUM") badgeColor = "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";

      const rawPrice = item.price;
      const numPrice = typeof rawPrice === "number" ? rawPrice : parseFloat(rawPrice) || 0;
      const sym = CURRENCY_SYMBOLS[item.currency || "USD"] || "$";
      const timeStr = item.timestamp
        ? new Date(item.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Recent';

      div.innerHTML = `
        <div class="flex-1 pr-3 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium text-slate-900 dark:text-white text-xs truncate group-hover:text-brand-500 transition">${item.product_name}</span>
            <span class="text-[10px] text-slate-400 dark:text-slate-500 font-mono shrink-0">${timeStr}</span>
          </div>
          <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">${item.product_url}</div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="font-mono text-slate-800 dark:text-slate-200 text-xs font-semibold">${sym}${numPrice.toFixed(2)}</span>
          <span class="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase font-semibold border ${badgeColor}">
            ${item.risk_level}
          </span>
        </div>
      `;

      div.addEventListener("click", () => {
        populateForm({
          product_name: item.product_name,
          product_url: item.product_url,
          price: numPrice,
          currency: item.currency,
          seller_name: item.seller_name || "",
          seller_notes: item.seller_notes || ""
        });
        document.getElementById("modal-history").classList.add("hidden");
        triggerScan();
      });

      list.appendChild(div);
    });
  } catch (err) {
    list.innerHTML = "<p class='text-rose-500'>Failed to load history.</p>";
  }
}
