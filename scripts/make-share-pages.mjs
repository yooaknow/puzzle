// 카톡 같은 메신저는 링크 미리보기를 만들 때 자바스크립트를 실행하지 않고 HTML의 og 태그만 읽는다.
// 그래서 `npx expo export -p web`이 만든 dist/index.html을 링크 종류별로 og 태그만 바꿔 복사해 두고,
// vercel.json에서 주소의 쿼리(?puzzleId=, ?user=)를 보고 맞는 파일을 내보낸다.
//
// Vercel은 실제 파일이 있는 주소에는 rewrites를 적용하지 않는다.
// `/`에 index.html이 있으면 쿼리와 상관없이 그 파일이 나가므로, 기본 화면은 app.html로 옮긴다.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const DIST = 'dist';
const SITE_URL = 'https://puzzle-theta-nine.vercel.app';

const SHARE_PAGES = [
  {
    // 받은 퍼즐 링크: 보낸 친구가 툭 던지듯
    file: 'share/puzzle.html',
    title: '야 ㅋㅋ 이거 풀어봐 🧩',
    description: '조각 다 맞춰야 내가 숨겨둔 말이 보여 👀',
    image: '/images/og-puzzle.jpg',
    imageAlt: '야 ㅋㅋ 이거 풀어봐',
  },
  {
    // 프로필 링크: "나한테 퍼즐 보내줘"
    file: 'share/profile.html',
    title: '나한테 하고 싶은 말, 퍼즐로 보내줘 🧩',
    description: '사진 한 장이면 돼요. 로그인 없이 바로 만들어서 보낼 수 있어요.',
    image: '/images/og-profile.jpg',
    imageAlt: '퍼즐로 보내줘',
  },
];

function escapeAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function setMeta(html, attribute, key, value) {
  const pattern = new RegExp(`(<meta ${attribute}="${key}" content=")[^"]*(")`);
  if (!pattern.test(html)) {
    throw new Error(`dist/index.html에 <meta ${attribute}="${key}">가 없어요. public/index.html을 확인하세요.`);
  }
  return html.replace(pattern, `$1${escapeAttribute(value)}$2`);
}

const indexPath = join(DIST, 'index.html');
const baseHtml = readFileSync(indexPath, 'utf8');

for (const page of SHARE_PAGES) {
  let html = baseHtml;
  html = setMeta(html, 'name', 'description', page.description);
  html = setMeta(html, 'property', 'og:title', page.title);
  html = setMeta(html, 'property', 'og:description', page.description);
  html = setMeta(html, 'property', 'og:image', `${SITE_URL}${page.image}`);
  html = setMeta(html, 'property', 'og:image:alt', page.imageAlt);

  const outPath = join(DIST, page.file);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  console.log(`made ${outPath}`);
}

renameSync(indexPath, join(DIST, 'app.html'));
console.log('moved dist/index.html -> dist/app.html');
