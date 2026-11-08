import { createClient } from '@supabase/supabase-js';

// 푸러봐가 쓰는 Supabase 프로젝트(puzzle, 서울).
// publishable 키는 원래 모든 방문자의 브라우저로 내려가는 공개 키라 코드에 둬도 된다.
// 데이터는 이 키가 아니라 RLS와 서버 함수 권한(supabase/migrations)으로 막는다.
// 비밀 키(sb_secret_..., service_role)는 절대 여기에 넣지 않는다.
const DEFAULT_SUPABASE_URL = 'https://ccztwprfxbfcrmtuxyzp.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_eTbuvEC0_rsRh5wz76NzRQ_4VmwBHTW';

// 다른 Supabase 프로젝트로 돌려보고 싶을 때만 .env.local이나 Vercel 환경 변수로 덮어쓴다.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || DEFAULT_SUPABASE_KEY;

export const PUZZLE_IMAGE_BUCKET = 'puzzles';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // 가입 확인 메일 링크로 돌아왔을 때 주소에 붙은 로그인 정보를 읽는다.
    detectSessionInUrl: true,
  },
});
