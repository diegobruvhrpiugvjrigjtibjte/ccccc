const cookieBanner = document.getElementById("cookieBanner");
const acceptCookies = document.getElementById("acceptCookies");
const startButton = document.getElementById("startButton");
const introScreen = document.getElementById("introScreen");
const loginScreen = document.getElementById("loginScreen");
const appScreen = document.getElementById("appScreen");
const openPrivacy = document.getElementById("openPrivacy");
const openPrivacyFromApp = document.getElementById("openPrivacyFromApp");
const privacyModal = document.getElementById("privacyModal");
const closePrivacy = document.getElementById("closePrivacy");
const forensicModal = document.getElementById("forensicModal");
const technicalModal = document.getElementById("technicalModal");
const openForensic = document.getElementById("openForensic");
const openTechnical = document.getElementById("openTechnical");
const closeForensic = document.getElementById("closeForensic");
const closeTechnical = document.getElementById("closeTechnical");
const loginButton = document.getElementById("loginButton");
const googleButton = document.getElementById("googleButton");
const skipButton = document.getElementById("skipButton");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const accountStatus = document.getElementById("accountStatus");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const results = document.getElementById("results");
const historyList = document.getElementById("historyList");
const compareA = document.getElementById("compareA");
const compareB = document.getElementById("compareB");
const compareButton = document.getElementById("compareButton");
const compareResult = document.getElementById("compareResult");
const licenseInput = document.getElementById("licenseInput");
const unlockButton = document.getElementById("unlockButton");
const proStatus = document.getElementById("proStatus");

const cookieKey = "filecheck_cookie";
const accountKey = "filecheck_account";
const proKey = "filecheck_pro";
const dbName = "filecheck_history";

let worker;
let db;

const init = () => {
  const cookieAccepted = localStorage.getItem(cookieKey) === "accepted";
  cookieBanner.hidden = cookieAccepted;
  startButton.disabled = !cookieAccepted;
  const account = JSON.parse(localStorage.getItem(accountKey) || "null");
  if (account) {
    accountStatus.textContent = `Sessione locale: ${account.email}`;
  }
  proStatus.textContent = isProEnabled()
    ? "Versione avanzata attiva"
    : "Versione gratuita attiva";
  openDatabase();
  setupWorker();
};

const setupWorker = () => {
  worker = new Worker("worker.js");
};

const openDatabase = () => {
  const request = indexedDB.open(dbName, 1);
  request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains("history")) {
      db.createObjectStore("history", { keyPath: "id", autoIncrement: true });
    }
  };
  request.onsuccess = (event) => {
    db = event.target.result;
    loadHistory();
  };
};

const addHistoryEntry = (entry) => {
  if (!db) return;
  const transaction = db.transaction(["history"], "readwrite");
  transaction.objectStore("history").add(entry);
  transaction.oncomplete = loadHistory;
};

const loadHistory = () => {
  if (!db) return;
  const transaction = db.transaction(["history"], "readonly");
  const store = transaction.objectStore("history");
  const request = store.getAll();
  request.onsuccess = () => {
    const items = request.result || [];
    historyList.innerHTML = items
      .slice(-8)
      .reverse()
      .map(
        (item) => `
        <div class="history-item">
          <strong>${item.name}</strong>
          <div class="muted">${new Date(item.date).toLocaleString()}</div>
          <div>Trust Score: <strong>${item.score}%</strong></div>
          <div class="muted">${item.status} · SHA-256 ${item.sha256.slice(0, 12)}...</div>
        </div>
      `
      )
      .join("");
  };
};

const showModal = (modal) => {
  modal.hidden = false;
};

const hideModal = (modal) => {
  modal.hidden = true;
};

const setScreen = (screen) => {
  [introScreen, loginScreen, appScreen].forEach((s) => (s.hidden = true));
  screen.hidden = false;
};

const acceptCookiePolicy = () => {
  localStorage.setItem(cookieKey, "accepted");
  cookieBanner.hidden = true;
  startButton.disabled = false;
};

const handleStart = () => {
  setScreen(loginScreen);
};

const handleLogin = (method) => {
  const email =
    emailInput.value.trim() ||
    (method === "google" ? "utente.google@local" : "utente@locale");
  const account = {
    email,
    createdAt: new Date().toISOString(),
    localOnly: true,
  };
  localStorage.setItem(accountKey, JSON.stringify(account));
  accountStatus.textContent = `Sessione locale: ${email}`;
  setScreen(appScreen);
};

const handleSkip = () => {
  accountStatus.textContent = "Sessione locale anonima";
  setScreen(appScreen);
};

const isProEnabled = () => localStorage.getItem(proKey) === "enabled";

const unlockPro = () => {
  if (licenseInput.value.trim() === "FILECHECK-PRO") {
    localStorage.setItem(proKey, "enabled");
    proStatus.textContent = "Versione avanzata attiva";
    proStatus.classList.add("success");
  } else {
    proStatus.textContent = "Licenza non valida. Resti in versione gratuita";
  }
};

const handleFiles = async (files) => {
  for (const file of files) {
    const result = await analyzeFile(file);
    renderResult(result);
    addHistoryEntry({
      name: file.name,
      size: file.size,
      date: Date.now(),
      score: result.trustScore,
      status: result.statusLabel,
      sha256: result.hashes.sha256,
    });
  }
};

const analyzeFile = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result;
      worker.onmessage = (event) => {
        resolve(event.data);
      };
      worker.postMessage({
        buffer,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    };
    reader.readAsArrayBuffer(file);
  });

const renderResult = (analysis) => {
  const statusClass =
    analysis.statusLabel === "File integro"
      ? "success"
      : analysis.statusLabel === "File a rischio"
      ? "warning"
      : "danger";
  const div = document.createElement("div");
  div.className = "result-card";
  div.innerHTML = `
    <div class="result-header">
      <div>
        <strong>${analysis.name}</strong>
        <div class="muted">Tipo rilevato: ${analysis.detectedType}</div>
      </div>
      <div class="status-chip ${statusClass}">${analysis.statusLabel}</div>
    </div>
    <p class="trust-score">Trust Score: ${analysis.trustScore}%</p>
    <p>${analysis.humanSummary}</p>
    <details>
      <summary>Dettagli tecnici</summary>
      <ul>
        <li>Header valido: ${analysis.headerValid ? "Sì" : "No"}</li>
        <li>Footer valido: ${analysis.footerValid ? "Sì" : "No"}</li>
        <li>Dimensione coerente: ${analysis.sizeValid ? "Sì" : "No"}</li>
        <li>Metadati sensibili: ${analysis.metadataRisks.join(", ") || "Nessuno"}</li>
        <li>Estensione mascherata: ${analysis.extensionMismatch ? "Sì" : "No"}</li>
      </ul>
      <p>SHA-256: ${analysis.hashes.sha256}</p>
      <p>MD5: ${analysis.hashes.md5}</p>
    </details>
    <div class="actions">
      <button class="ghost" data-action="clean" data-id="${analysis.id}">Pulisci metadati</button>
      <button class="ghost" data-action="recover" data-id="${analysis.id}">Recupera contenuto</button>
      <button class="primary" data-action="report" data-id="${analysis.id}">Genera report PDF</button>
    </div>
    <div class="recovery" id="recovery-${analysis.id}"></div>
  `;
  div.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => handleAction(btn.dataset.action, analysis));
  });
  results.prepend(div);
};

const handleAction = async (action, analysis) => {
  if (action === "clean") {
    const cleaned = await cleanMetadata(analysis);
    downloadBlob(cleaned.blob, cleaned.filename);
  }
  if (action === "recover") {
    const recovery = await recoverContent(analysis);
    const target = document.getElementById(`recovery-${analysis.id}`);
    target.innerHTML = recovery.html;
  }
  if (action === "report") {
    const blob = generatePdfReport(analysis);
    downloadBlob(blob, `${analysis.name}-report.pdf`);
  }
};

const cleanMetadata = async (analysis) => {
  if (analysis.preview?.imageDataUrl) {
    const img = new Image();
    img.src = analysis.preview.imageDataUrl;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    return { blob, filename: `${analysis.name}-clean.png` };
  }
  const blob = new Blob([analysis.rawText || ""], { type: "text/plain" });
  return { blob, filename: `${analysis.name}-clean.txt` };
};

const recoverContent = async (analysis) => {
  if (analysis.preview?.imageDataUrl) {
    return {
      html: `<p class="muted">Recuperabilità stimata: ${analysis.recoverablePercent}%</p><img src="${analysis.preview.imageDataUrl}" alt="Preview recupero" style="max-width:100%; border-radius:12px;" />`,
    };
  }
  return {
    html: `<p class="muted">Recuperabilità stimata: ${analysis.recoverablePercent}%</p><pre>${analysis.preview.textSnippet}</pre>`,
  };
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const compareFiles = async () => {
  if (!compareA.files[0] || !compareB.files[0]) {
    compareResult.textContent = "Seleziona entrambi i file per il confronto.";
    return;
  }
  const [file1, file2] = [compareA.files[0], compareB.files[0]];
  const [text1, text2] = await Promise.all([
    file1.text(),
    file2.text(),
  ]);
  const lines1 = text1.split("\n");
  const lines2 = text2.split("\n");
  const max = Math.max(lines1.length, lines2.length);
  const diffLines = [];
  for (let i = 0; i < max; i += 1) {
    if (lines1[i] !== lines2[i]) {
      if (lines1[i]) {
        diffLines.push(`<div class="diff-removed">- ${lines1[i]}</div>`);
      }
      if (lines2[i]) {
        diffLines.push(`<div class="diff-added">+ ${lines2[i]}</div>`);
      }
    } else {
      diffLines.push(`<div>  ${lines1[i] || ""}</div>`);
    }
  }
  compareResult.innerHTML = diffLines.join("");
};

const generatePdfReport = (analysis) => {
  const lines = [
    "FileCheck Report",
    "=================",
    `Nome file: ${analysis.name}`,
    `Data analisi: ${new Date().toLocaleString()}`,
    `Hash SHA-256: ${analysis.hashes.sha256}`,
    `Hash MD5: ${analysis.hashes.md5}`,
    `Stato: ${analysis.statusLabel}`,
    `Trust Score: ${analysis.trustScore}%`,
    `Note tecniche: ${analysis.technicalSummary}`,
    "Disclaimer: FileCheck non è un antivirus né uno strumento forense certificato.",
  ];
  if (!isProEnabled()) {
    lines.push("WATERMARK: FileCheck Free Edition");
  }
  const text = lines.join("\n");
  const pdf = createSimplePdf(text);
  return new Blob([pdf], { type: "application/pdf" });
};

const createSimplePdf = (text) => {
  const content = text.replace(/\n/g, "\\n");
  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n";
  const obj2 = "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n";
  const obj3 = "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n";
  const stream = `BT /F1 12 Tf 50 740 Td (${content}) Tj ET`;
  const obj4 = `4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream endobj\n`;
  const obj5 = "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n";
  const xrefPosition =
    header.length + obj1.length + obj2.length + obj3.length + obj4.length + obj5.length;
  const xref =
    "xref\n0 6\n0000000000 65535 f \n" +
    "0000000010 00000 n \n" +
    "0000000074 00000 n \n" +
    "0000000137 00000 n \n" +
    "0000000233 00000 n \n" +
    "0000000364 00000 n \n";
  const trailer = `trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;
  return header + obj1 + obj2 + obj3 + obj4 + obj5 + xref + trailer;
};

acceptCookies.addEventListener("click", acceptCookiePolicy);
openPrivacy.addEventListener("click", () => showModal(privacyModal));
openPrivacyFromApp.addEventListener("click", () => showModal(privacyModal));
closePrivacy.addEventListener("click", () => hideModal(privacyModal));
openForensic.addEventListener("click", () => showModal(forensicModal));
openTechnical.addEventListener("click", () => showModal(technicalModal));
closeForensic.addEventListener("click", () => hideModal(forensicModal));
closeTechnical.addEventListener("click", () => hideModal(technicalModal));
startButton.addEventListener("click", handleStart);
loginButton.addEventListener("click", () => handleLogin("email"));
googleButton.addEventListener("click", () => handleLogin("google"));
skipButton.addEventListener("click", handleSkip);
unlockButton.addEventListener("click", unlockPro);

if (dropzone) {
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.style.borderColor = "var(--primary)";
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.style.borderColor = "#cbd5f5";
  });
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.style.borderColor = "#cbd5f5";
    handleFiles(event.dataTransfer.files);
  });
  fileInput.addEventListener("change", () => handleFiles(fileInput.files));
}

compareButton.addEventListener("click", compareFiles);

window.addEventListener("load", init);
