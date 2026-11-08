import { inject } from '@vercel/analytics';
import { Platform } from 'react-native';

// Vercel 웹 분석으로 방문자·페이지 수를 센다. (Vercel 프로젝트의 Analytics에서 Web Analytics를 켜야 기록된다)
// 앱 주소는 늘 `/` 하나라서, 어떤 링크로 들어왔는지 보이도록 쿼리를 보고 경로를 나눠 기록한다.
// 퍼즐 번호나 사용자 아이디 같은 값은 보내지 않는다.
function getVisitPath(url: URL) {
  if (url.searchParams.has('puzzleId')) {
    return '/puzzle-link';
  }
  if (url.searchParams.has('user')) {
    return '/profile-link';
  }
  return url.pathname;
}

export function startAnalytics() {
  if (Platform.OS !== 'web') {
    return;
  }

  inject({
    beforeSend: (event) => {
      const url = new URL(event.url);
      return { ...event, url: `${url.origin}${getVisitPath(url)}` };
    },
  });
}
