import { WebFontDocument } from './types';

// Figma 디자인 서체: 본문은 Pretendard, 배너 제목은 A2Z(에이투지체) 5 Medium.
const PRETENDARD_CSS_URL =
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css';
const A2Z_MEDIUM_URL =
  'https://cdn.jsdelivr.net/gh/projectnoonnu/2601-6@1.0/%EC%97%90%EC%9D%B4%ED%88%AC%EC%A7%80%EC%B2%B4-5Medium.woff2';
const FONT_STYLE_ID = 'puzzlw-web-fonts';

const FONT_CSS = `@import url('${PRETENDARD_CSS_URL}');

@font-face {
  font-family: 'A2Z';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url('${A2Z_MEDIUM_URL}') format('woff2');
}`;

export const BODY_FONT_FAMILY = "'Pretendard Variable', Pretendard, sans-serif";
export const DISPLAY_FONT_FAMILY = "A2Z, 'Pretendard Variable', Pretendard, sans-serif";

export function loadWebFonts() {
  const webDocument = (globalThis as unknown as { document?: WebFontDocument }).document;

  if (!webDocument?.head || webDocument.getElementById(FONT_STYLE_ID)) {
    return;
  }

  const style = webDocument.createElement('style');
  style.id = FONT_STYLE_ID;
  style.textContent = FONT_CSS;
  webDocument.head.appendChild(style);
}
