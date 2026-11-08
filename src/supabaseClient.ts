import { createClient } from '@supabase/supabase-js';

// .env(.local)이나 Vercel 환경 변수에 넣은 값이 빌드할 때 그대로 들어간다.
// 이 키는 브라우저에 공개되는 키(publishable/anon)라서 앱 코드에 들어가도 괜찮다.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const PUZZLE_IMAGE_BUCKET = 'puzzles';
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.warn('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY가 없어서 퍼즐을 저장하거나 불러올 수 없어요. .env.example을 참고하세요.');
}

// 설정이 없어도 화면은 떠야 하므로, 빈 값 대신 요청만 실패하는 주소로 만든다.
export const supabase = createClient(supabaseUrl || 'http://localhost:54321', supabaseKey || 'missing-supabase-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // 가입 확인 메일 링크로 돌아왔을 때 주소에 붙은 로그인 정보를 읽는다.
    detectSessionInUrl: true,
  },
});
