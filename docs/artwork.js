/* Original Copyright-Safe Basketball Merchandise SVG Art Generator for NBASHOP
 * Authored specifically for this portfolio showcase. Contains ZERO NBA, Nike,
 * Under Armour, New Era, or real-franchise trademarks or copied retail photography.
 */
window.NBASHOP_ART = (function () {
  "use strict";

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderProductSvg(art, idSuffix) {
    const p = art.primary || "#1C1C1C";
    const s = art.secondary || "#B25D55";
    const t = art.trim || "#FFFFFF";
    const num = esc(art.number || "");
    const lbl = esc(art.label || "");
    const gid = "g_" + esc(idSuffix || Math.random().toString(36).slice(2, 8));

    let shape = "";

    if (art.type === "jersey") {
      shape = `
        <path d="M88 44 L112 44 C118 66 142 66 148 44 L172 44 L186 78 C174 96 172 118 178 134 L184 222 L76 222 L82 134 C88 118 86 96 74 78 Z"
              fill="url(#${gid})" stroke="${s}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M110 44 C118 70 142 70 150 44" fill="none" stroke="${t}" stroke-width="4.5"/>
        <path d="M74 78 C88 98 88 118 82 134 M186 78 C172 98 172 118 178 134" fill="none" stroke="${t}" stroke-width="4"/>
        <rect x="78" y="138" width="9" height="82" fill="${s}" opacity="0.85"/>
        <rect x="173" y="138" width="9" height="82" fill="${s}" opacity="0.85"/>
        <text x="130" y="106" text-anchor="middle" fill="${t}" font-family="Poppins, sans-serif" font-weight="700" font-size="14" letter-spacing="2.2">${lbl}</text>
        <text x="130" y="166" text-anchor="middle" fill="${t}" stroke="${s}" stroke-width="2" font-family="Poppins, sans-serif" font-weight="800" font-size="50">${num}</text>
      `;
    } else if (art.type === "tee") {
      shape = `
        <path d="M96 46 C110 60 150 60 164 46 L208 68 L194 114 L174 104 L174 220 L86 220 L86 104 L66 114 L52 68 Z"
              fill="url(#${gid})" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M98 48 C112 63 148 63 162 48" fill="none" stroke="${s}" stroke-width="3.5"/>
        <circle cx="130" cy="126" r="24" fill="none" stroke="${s}" stroke-width="2.5"/>
        <path d="M106 126 H154 M130 102 V150 M113 109 C125 120 125 132 113 143 M147 109 C135 120 135 132 147 143" fill="none" stroke="${s}" stroke-width="1.8"/>
        <text x="130" y="178" text-anchor="middle" fill="${t}" font-family="Poppins, sans-serif" font-weight="700" font-size="13" letter-spacing="2.5">${lbl}</text>
      `;
    } else if (art.type === "hoodie") {
      shape = `
        <path d="M92 54 C96 32 164 32 168 54 L204 82 L212 190 L188 194 L178 122 L176 222 L84 222 L82 122 L72 194 L48 190 L56 82 Z"
              fill="url(#${gid})" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M102 52 C110 74 150 74 158 52" fill="${s}" opacity="0.28" stroke="${s}" stroke-width="2.5"/>
        <line x1="120" y1="68" x2="118" y2="104" stroke="${t}" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="140" y1="68" x2="142" y2="104" stroke="${t}" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M100 162 L160 162 L166 204 L94 204 Z" fill="rgba(255,255,255,0.06)" stroke="${s}" stroke-width="2"/>
        <text x="130" y="134" text-anchor="middle" fill="${t}" font-family="Poppins, sans-serif" font-weight="700" font-size="14" letter-spacing="2.5">${lbl}</text>
      `;
    } else if (art.type === "shorts") {
      shape = `
        <rect x="74" y="54" width="112" height="22" rx="4" fill="${s}"/>
        <path d="M74 76 L186 76 L196 206 L142 206 L130 144 L118 206 L64 206 Z"
              fill="url(#${gid})" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M74 76 L68 206 M186 76 L192 206" stroke="${t}" stroke-width="5"/>
        <line x1="126" y1="65" x2="122" y2="92" stroke="${t}" stroke-width="2.2" stroke-linecap="round"/>
        <line x1="134" y1="65" x2="138" y2="92" stroke="${t}" stroke-width="2.2" stroke-linecap="round"/>
      `;
    } else if (art.type === "tracksuit") {
      shape = `
        <path d="M76 50 L108 42 L130 56 L152 42 L184 50 L206 106 L186 116 L172 84 L172 152 L88 152 L88 84 L74 116 L54 106 Z"
              fill="url(#${gid})" stroke="${s}" stroke-width="2.5" stroke-linejoin="round"/>
        <line x1="130" y1="56" x2="130" y2="152" stroke="${t}" stroke-width="2.2"/>
        <path d="M88 156 L172 156 L178 228 L140 228 L130 182 L120 228 L82 228 Z"
              fill="${p}" stroke="${s}" stroke-width="2.2" stroke-linejoin="round"/>
        <line x1="90" y1="158" x2="86" y2="226" stroke="${s}" stroke-width="4"/>
        <line x1="170" y1="158" x2="174" y2="226" stroke="${s}" stroke-width="4"/>
      `;
    } else if (art.type === "cap") {
      shape = `
        <path d="M62 152 C62 94 92 66 132 66 C172 66 196 96 196 152 Z"
              fill="url(#${gid})" stroke="${t}" stroke-width="2.5"/>
        <path d="M128 66 C116 98 114 128 114 152" fill="none" stroke="rgba(0,0,0,0.14)" stroke-width="2"/>
        <path d="M54 152 C92 140 166 140 218 164 C194 182 110 186 52 168 Z"
              fill="${s}" stroke="${t}" stroke-width="2.2"/>
        <circle cx="132" cy="116" r="18" fill="${s}" stroke="${t}" stroke-width="2.2"/>
        <text x="132" y="121" text-anchor="middle" fill="#FFFFFF" font-family="Poppins, sans-serif" font-weight="700" font-size="13">${lbl}</text>
      `;
    } else if (art.type === "sneaker") {
      shape = `
        <path d="M50 162 L66 108 L98 92 L124 114 C146 124 186 128 208 148 C214 156 214 168 206 174 L54 174 C48 172 48 166 50 162 Z"
              fill="url(#${gid})" stroke="#0F172A" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M46 170 L212 170 C214 182 204 192 186 192 L60 192 C48 192 44 182 46 170 Z"
              fill="${t}" stroke="#1E293B" stroke-width="2.5"/>
        <path d="M84 152 L144 134 L178 152" fill="none" stroke="${s}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="112" y1="106" x2="126" y2="118" stroke="${t}" stroke-width="3" stroke-linecap="round"/>
        <line x1="122" y1="114" x2="136" y2="124" stroke="${t}" stroke-width="3" stroke-linecap="round"/>
        <line x1="134" y1="121" x2="148" y2="130" stroke="${t}" stroke-width="3" stroke-linecap="round"/>
      `;
    } else if (art.type === "accessory") {
      shape = `
        <rect x="64" y="68" width="132" height="36" rx="18" fill="url(#${gid})" stroke="${s}" stroke-width="3"/>
        <line x1="82" y1="86" x2="178" y2="86" stroke="${s}" stroke-width="3" stroke-dasharray="10 6"/>
        <rect x="74" y="132" width="44" height="58" rx="10" fill="${p}" stroke="${s}" stroke-width="3"/>
        <rect x="142" y="132" width="44" height="58" rx="10" fill="${p}" stroke="${s}" stroke-width="3"/>
        <rect x="74" y="154" width="44" height="12" fill="${s}"/>
        <rect x="142" y="154" width="44" height="12" fill="${s}"/>
        <text x="130" y="90" text-anchor="middle" fill="${t}" font-family="Poppins, sans-serif" font-weight="700" font-size="11" letter-spacing="2">${lbl}</text>
      `;
    } else if (art.type === "duffel") {
      shape = `
        <path d="M96 92 C96 64 164 64 164 92" fill="none" stroke="${s}" stroke-width="6" stroke-linecap="round"/>
        <rect x="46" y="92" width="168" height="96" rx="22" fill="url(#${gid})" stroke="${s}" stroke-width="3"/>
        <line x1="78" y1="92" x2="78" y2="188" stroke="${s}" stroke-width="4"/>
        <line x1="182" y1="92" x2="182" y2="188" stroke="${s}" stroke-width="4"/>
        <rect x="102" y="122" width="56" height="36" rx="6" fill="rgba(255,255,255,0.08)" stroke="${t}" stroke-width="1.8"/>
        <text x="130" y="145" text-anchor="middle" fill="${t}" font-family="Poppins, sans-serif" font-weight="700" font-size="14">${lbl}</text>
      `;
    } else {
      // socks
      shape = `
        <path d="M84 48 L116 48 L116 146 L146 172 C154 180 148 198 134 198 L94 198 C84 198 80 186 84 168 Z"
              fill="${p}" stroke="${s}" stroke-width="2.8" stroke-linejoin="round"/>
        <rect x="84" y="64" width="32" height="7" fill="${t}"/>
        <rect x="84" y="76" width="32" height="5" fill="${s}"/>
        <path d="M126 58 L158 58 L158 156 L188 182 C196 190 190 208 176 208 L136 208 C126 208 122 196 126 178 Z"
              fill="${p}" stroke="${s}" stroke-width="2.8" stroke-linejoin="round"/>
        <rect x="126" y="74" width="32" height="7" fill="${t}"/>
        <rect x="126" y="86" width="32" height="5" fill="${s}"/>
      `;
    }

    return `<svg viewBox="0 0 260 260" width="260" height="260" role="img" aria-hidden="true" class="product-svg">
      <defs>
        <linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${p}"/>
          <stop offset="100%" stop-color="${p}" stop-opacity="0.82"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="260" height="260" fill="#F6F7FB"/>
      <circle cx="130" cy="134" r="96" fill="#EDF1FF" opacity="0.8"/>
      <ellipse cx="130" cy="232" rx="64" ry="8" fill="#1C1C1C" opacity="0.08"/>
      ${shape}
    </svg>`;
  }

  return { renderProductSvg };
})();
