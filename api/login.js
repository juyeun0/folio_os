const SUPABASE_URL = 'https://rpknqchscwnshiiyrsww.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_dx7PxTe7DZtmKAWvmECGLA_-JJahZpp';

module.exports = async function login(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(503).json({ error: '로그인 API 설정이 아직 완료되지 않았어요.' });

  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!/^[a-z0-9._-]{3,24}$/.test(username) || password.length < 8 || password.length > 256) {
    return res.status(401).json({ error: '아이디 또는 비밀번호를 확인해 주세요.' });
  }

  try {
    const profileUrl = new URL(`${SUPABASE_URL}/rest/v1/folio_profiles`);
    profileUrl.searchParams.set('username', `eq.${username}`);
    profileUrl.searchParams.set('select', 'email');
    profileUrl.searchParams.set('limit', '1');
    const profileResponse = await fetch(profileUrl, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!profileResponse.ok) throw new Error('Profile lookup failed');
    const [profile] = await profileResponse.json();
    if (!profile?.email) return res.status(401).json({ error: '아이디 또는 비밀번호를 확인해 주세요.' });

    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ email: profile.email, password }),
    });
    if (!authResponse.ok) return res.status(401).json({ error: '아이디 또는 비밀번호를 확인해 주세요.' });
    const session = await authResponse.json();
    return res.status(200).json({ access_token: session.access_token, refresh_token: session.refresh_token });
  } catch {
    return res.status(500).json({ error: '로그인 연결에 실패했어요. 잠시 후 다시 시도해 주세요.' });
  }
};
