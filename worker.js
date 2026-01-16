const magicSignatures = [
  { type: "PDF", bytes: [0x25, 0x50, 0x44, 0x46] },
  { type: "PNG", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: "JPEG", bytes: [0xff, 0xd8, 0xff] },
  { type: "GIF", bytes: [0x47, 0x49, 0x46, 0x38] },
  { type: "ZIP/DOCX", bytes: [0x50, 0x4b, 0x03, 0x04] },
];

const footerSignatures = {
  PDF: [0x25, 0x25, 0x45, 0x4f, 0x46],
  PNG: [0x49, 0x45, 0x4e, 0x44],
  JPEG: [0xff, 0xd9],
  GIF: [0x00, 0x3b],
  "ZIP/DOCX": [0x50, 0x4b, 0x05, 0x06],
};

const md5 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  const toHex = (num) => num.toString(16).padStart(2, "0");
  const md5cycle = (x, k) => {
    let a = x[0];
    let b = x[1];
    let c = x[2];
    let d = x[3];

    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  };

  const cmn = (q, a, b, x, s, t) => add32((a + q + x + t) << s | (a + q + x + t) >>> (32 - s), b);
  const ff = (a, b, c, d, x, s, t) => cmn((b & c) | (~b & d), a, b, x, s, t);
  const gg = (a, b, c, d, x, s, t) => cmn((b & d) | (c & ~d), a, b, x, s, t);
  const hh = (a, b, c, d, x, s, t) => cmn(b ^ c ^ d, a, b, x, s, t);
  const ii = (a, b, c, d, x, s, t) => cmn(c ^ (b | ~d), a, b, x, s, t);
  const add32 = (a, b) => (a + b) & 0xffffffff;

  const md5blk = (array) => {
    const blocks = [];
    for (let i = 0; i < 64; i += 4) {
      blocks[i >> 2] =
        array[i] +
        (array[i + 1] << 8) +
        (array[i + 2] << 16) +
        (array[i + 3] << 24);
    }
    return blocks;
  };

  const md51 = (arr) => {
    let n = arr.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i;
    for (i = 64; i <= n; i += 64) {
      md5cycle(state, md5blk(arr.subarray(i - 64, i)));
    }
    arr = arr.subarray(i - 64);
    const tail = new Uint8Array(64);
    tail.set(arr);
    tail[arr.length] = 0x80;
    if (arr.length > 55) {
      md5cycle(state, md5blk(tail));
      tail.fill(0);
    }
    const bits = n * 8;
    tail[56] = bits & 0xff;
    tail[57] = (bits >>> 8) & 0xff;
    tail[58] = (bits >>> 16) & 0xff;
    tail[59] = (bits >>> 24) & 0xff;
    md5cycle(state, md5blk(tail));
    return state;
  };

  const digest = md51(bytes);
  const result = new Uint8Array(16);
  for (let i = 0; i < 4; i += 1) {
    result[i * 4] = digest[i] & 0xff;
    result[i * 4 + 1] = (digest[i] >>> 8) & 0xff;
    result[i * 4 + 2] = (digest[i] >>> 16) & 0xff;
    result[i * 4 + 3] = (digest[i] >>> 24) & 0xff;
  }
  return Array.from(result).map(toHex).join("");
};

const detectType = (bytes) => {
  for (const signature of magicSignatures) {
    if (signature.bytes.every((b, i) => bytes[i] === b)) {
      return signature.type;
    }
  }
  return "Testo/Binario";
};

const checkFooter = (bytes, type) => {
  const footer = footerSignatures[type];
  if (!footer) return false;
  return footer.every((b, i) => bytes[bytes.length - footer.length + i] === b);
};

const buildPreview = (bytes) => {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const text = decoder.decode(bytes);
  const printable = text.replace(/\s/g, "").length;
  const ratio = Math.min(100, Math.round((printable / Math.max(1, text.length)) * 100));
  return {
    textSnippet: text.slice(0, 400),
    recoverablePercent: ratio,
    rawText: text,
  };
};

self.onmessage = async (event) => {
  const { buffer, name, size, type } = event.data;
  const bytes = new Uint8Array(buffer);
  const detectedType = detectType(bytes);
  const headerValid = detectedType !== "Testo/Binario";
  const footerValid = checkFooter(bytes, detectedType);
  const sizeValid = size > 0 && bytes.length === size;
  const extension = name.split(".").pop()?.toLowerCase();
  const extensionMismatch =
    detectedType === "PDF" && extension !== "pdf" ? true : false;

  const sha256 = await crypto.subtle.digest("SHA-256", buffer);
  const sha256Hex = Array.from(new Uint8Array(sha256))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const md5Hex = md5(buffer);

  const metadataRisks = [];
  if (detectedType === "JPEG") metadataRisks.push("EXIF potenziale");
  if (detectedType === "PDF") metadataRisks.push("Metadata PDF");

  let trustScore = 80;
  if (!footerValid) trustScore -= 20;
  if (!sizeValid) trustScore -= 10;
  if (extensionMismatch) trustScore -= 15;
  if (metadataRisks.length > 0) trustScore -= 5;
  trustScore = Math.max(5, trustScore);

  const statusLabel =
    trustScore > 70
      ? "File integro"
      : trustScore > 40
      ? "File a rischio"
      : "File compromesso";

  const preview = buildPreview(bytes);
  const imageDataUrl =
    detectedType === "PNG" || detectedType === "JPEG" || detectedType === "GIF"
      ? `data:${type || "image/png"};base64,${btoa(
          String.fromCharCode(...bytes.slice(0, 200000))
        )}`
      : null;

  self.postMessage({
    id: crypto.randomUUID(),
    name,
    detectedType,
    headerValid,
    footerValid,
    sizeValid,
    extensionMismatch,
    metadataRisks,
    trustScore,
    statusLabel,
    hashes: {
      sha256: sha256Hex,
      md5: md5Hex,
    },
    humanSummary:
      trustScore > 70
        ? "Il file appare coerente e integro. Puoi inviarlo con fiducia, dopo aver verificato eventuali metadati sensibili."
        : trustScore > 40
        ? "Il file mostra anomalie. Consigliata la pulizia dei metadati e un controllo prima dell'invio."
        : "Il file presenta segnali di corruzione o incoerenza. Meglio procedere con recupero o sostituzione.",
    technicalSummary: `Header:${headerValid} Footer:${footerValid} Size:${sizeValid} ExtensionMismatch:${extensionMismatch}`,
    preview: {
      textSnippet: preview.textSnippet,
      imageDataUrl,
    },
    recoverablePercent: preview.recoverablePercent,
    rawText: preview.rawText,
  });
};
