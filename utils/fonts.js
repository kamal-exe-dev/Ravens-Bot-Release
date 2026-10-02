const SMALL_CAPS = { a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ' };
const UPSIDE_DOWN = { a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z' };

const FONTS = {
  bold: {
    label: 'Bold', preview: '𝐠𝐞𝐧𝐞𝐫𝐚𝐥',
    upper: 0x1D400, lower: 0x1D41A, digit: 0x1D7CE,
  },
  italic: {
    label: 'Italic', preview: '𝘨𝘦𝘯𝘦𝘳𝘢𝘭',
    upper: 0x1D608, lower: 0x1D622,
  },
  boldItalic: {
    label: 'Bold Italic', preview: '𝙜𝙚𝙣𝙚𝙧𝙖𝙡',
    upper: 0x1D63C, lower: 0x1D656,
  },
  script: {
    label: 'Script', preview: '𝓰𝓮𝓷𝓮𝓻𝓪𝓵',
    upper: 0x1D4D0, lower: 0x1D4EA,
  },
  fraktur: {
    label: 'Fraktur', preview: '𝖌𝖊𝖓𝖊𝖗𝖆𝖑',
    upper: 0x1D56C, lower: 0x1D586,
  },
  double: {
    label: 'Double Struck', preview: '𝕘𝕖𝕟𝕖𝕣𝕒𝕝',
    upper: 0x1D538, lower: 0x1D552,
    exceptions: { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' },
  },
  mono: {
    label: 'Monospace', preview: '𝚐𝚎𝚗𝚎𝚛𝚊𝚕',
    upper: 0x1D670, lower: 0x1D68A, digit: 0x1D7F6,
  },
  sansBold: {
    label: 'Sans Bold', preview: '𝗴𝗲𝗻𝗲𝗿𝗮𝗹',
    upper: 0x1D5D4, lower: 0x1D5EE, digit: 0x1D7EC,
  },
  circled: {
    label: 'Circled', preview: 'ⓖⓔⓝⓔⓡⓐⓛ',
    upper: 0x24B6, lower: 0x24D0,
  },
  fullwidth: {
    label: 'Fullwidth', preview: 'ｇｅｎｅｒａｌ',
    upper: 0xFF21, lower: 0xFF41, digit: 0xFF10,
  },
  smallCaps: {
    label: 'Small Caps', preview: 'ɢᴇɴᴇʀᴀʟ',
    charMap: SMALL_CAPS,
  },
  upsideDown: {
    label: 'Upside Down', preview: 'lɐɹǝuǝƃ',
    charMap: UPSIDE_DOWN, reverse: true,
  },
  spaced: {
    label: 'S p a c e d', preview: 'g e n e r a l',
    custom: (text) => [...text].join(' '),
  },
  upperSpaced: {
    label: 'S P A C E D', preview: 'G E N E R A L',
    custom: (text) => [...text.toUpperCase()].join(' '),
  },
};

function convertChar(ch, font) {
  if (font.exceptions && font.exceptions[ch]) return font.exceptions[ch];
  if (font.charMap) {
    const lower = ch.toLowerCase();
    return font.charMap[lower] || ch;
  }
  const code = ch.codePointAt(0);
  if (code >= 65 && code <= 90 && font.upper) return String.fromCodePoint(font.upper + code - 65);
  if (code >= 97 && code <= 122 && font.lower) return String.fromCodePoint(font.lower + code - 97);
  if (code >= 48 && code <= 57 && font.digit) return String.fromCodePoint(font.digit + code - 48);
  return ch;
}

function applyFont(text, fontKey) {
  const font = FONTS[fontKey];
  if (!font) return text;
  if (font.custom) return font.custom(text);
  const converted = [...text].map(ch => convertChar(ch, font)).join('');
  return font.reverse ? [...converted].reverse().join('') : converted;
}

function getFontList() {
  return Object.entries(FONTS).map(([key, f]) => ({ key, label: f.label, preview: f.preview }));
}

module.exports = { FONTS, applyFont, getFontList };
