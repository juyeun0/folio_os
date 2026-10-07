(() => {
  const config = window.FOLIO_SUPABASE_CONFIG;
  const storagePrefix = 'folio-';
  const root = document.createElement('div');
  root.id = 'auth-gate';
  root.innerHTML = `
    <section class="auth-card">
      <div class="auth-brand"><span>✦</span> folio</div>
      <p class="eyebrow">YOUR PERSONAL LIFE OS</p>
      <h1 id="auth-title">다시 만나 반가워요</h1>
      <p class="auth-copy" id="auth-copy">아이디와 비밀번호로 기록을 안전하게 열어보세요.</p>
      <div class="auth-tabs" role="tablist">
        <button type="button" class="active" data-auth-mode="login">로그인</button>
        <button type="button" data-auth-mode="signup">회원가입</button>
      </div>
      <form id="auth-form">
        <label id="username-label">아이디<input type="text" name="username" autocomplete="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9._-]+" required placeholder="영문, 숫자, . _ - 사용"></label>
        <label id="email-label" hidden>인증 이메일<input type="email" name="email" autocomplete="email" placeholder="name@example.com"></label>
        <label>비밀번호<input type="password" name="password" autocomplete="current-password" minlength="8" required placeholder="8자 이상"></label>
        <button class="auth-submit" type="submit" id="auth-submit">로그인</button>
      </form>
      <p class="auth-message" id="auth-message" role="status" aria-live="polite"></p>
      <p class="auth-footnote">회원가입 때 입력한 이메일로 인증한 뒤, 설정한 아이디와 비밀번호로 로그인해요.</p>
    </section>`;
  document.body.append(root);
  document.body.classList.add('folio-auth-locked');

  const style = document.createElement('style');
  style.textContent = `
    .auth-signout{border:1px solid var(--line);background:#fffdfa;border-radius:999px;padding:8px 13px;color:#706a74;font-size:11px;cursor:pointer}
    #auth-gate{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0%,#f3eef8 0%,#fcfbf8 58%)}
    .auth-card{width:min(100%,420px);padding:42px;border:1px solid #e9e4dd;border-radius:26px;background:rgba(255,254,251,.96);box-shadow:0 24px 70px #443d4b12}
    .auth-brand{display:flex;align-items:center;gap:9px;font:600 22px Manrope,sans-serif;color:#332f36}.auth-brand span{color:#a18fb8;font-size:24px}
    .auth-card>.eyebrow{margin:30px 0 8px;color:#a295b0}.auth-card h1{margin:0;font:600 25px 'Noto Serif KR',serif;color:#39343d}.auth-copy{margin:10px 0 24px;color:#827d84;font-size:13px;line-height:1.7}
    .auth-tabs{display:grid;grid-template-columns:1fr 1fr;padding:4px;border-radius:13px;background:#f4f1f5;margin-bottom:22px}.auth-tabs button{border:0;border-radius:10px;background:transparent;padding:10px;color:#88818d;font:inherit;font-size:13px;cursor:pointer}.auth-tabs button.active{background:white;color:#51445f;box-shadow:0 2px 8px #322b3912}
    #auth-form{display:grid;gap:15px}#auth-form label{display:grid;gap:7px;color:#5a555e;font-size:12px}#auth-form label span{display:inline;color:#a09aa2;font-size:11px}#auth-form input{box-sizing:border-box;width:100%;border:1px solid #e6e1e8;border-radius:12px;background:#fff;padding:13px 14px;font:14px Manrope,'Noto Sans KR',sans-serif;outline:none}#auth-form input:focus{border-color:#b5a6c6;box-shadow:0 0 0 3px #e9e1f0}
    .auth-submit{margin-top:5px;border:0;border-radius:12px;background:#40374a;color:white;padding:14px;font:500 14px Manrope,'Noto Sans KR',sans-serif;cursor:pointer}.auth-submit:disabled{opacity:.6;cursor:wait}.auth-message{min-height:20px;margin:13px 0 0;color:#756786;font-size:12px;line-height:1.6}.auth-message.error{color:#b34b55}.auth-footnote{margin:13px 0 0;color:#a09aa2;font-size:11px;line-height:1.7}
    @media(max-width:520px){.auth-card{padding:30px 24px;border-radius:22px}}
  `;
  document.head.append(style);

  const form = root.querySelector('#auth-form');
  const message = root.querySelector('#auth-message');
  const submit = root.querySelector('#auth-submit');
  let mode = 'login';
  let activeUser = null;
  let syncReady = false;
  let suppressStorageSync = false;
  let saveTimer = 0;
  let lastLocalChangeAt = 0;
  let lastPushedAt = '';
  let lastCloudAt = '';

  const setMessage = (text, error = false) => {
    message.textContent = text;
    message.classList.toggle('error', error);
  };
  const setMode = (nextMode) => {
    mode = nextMode;
    root.querySelectorAll('[data-auth-mode]').forEach((button) => button.classList.toggle('active', button.dataset.authMode === mode));
    root.querySelector('#auth-title').textContent = mode === 'login' ? '다시 만나 반가워요' : '나만의 folio 만들기';
    root.querySelector('#auth-copy').textContent = mode === 'login' ? '아이디와 비밀번호로 기록을 안전하게 열어보세요.' : '이메일 인증 후 여러 기기에서 기록을 이어갈 수 있어요.';
    root.querySelector('#auth-submit').textContent = mode === 'login' ? '로그인' : '인증 메일 보내기';
    root.querySelector('#email-label').hidden = mode !== 'signup';
    form.elements.email.required = mode === 'signup';
    form.elements.username.required = true;
    form.querySelector('[name="password"]').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    setMessage('');
  };
  root.querySelectorAll('[data-auth-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.authMode)));

  const snapshot = () => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith(storagePrefix)));
  const replaceSnapshot = (data) => {
    suppressStorageSync = true;
    try {
      Object.keys(localStorage).filter((key) => key.startsWith(storagePrefix)).forEach((key) => localStorage.removeItem(key));
      Object.entries(data || {}).forEach(([key, value]) => {
        if (key.startsWith(storagePrefix) && typeof value === 'string') localStorage.setItem(key, value);
      });
    } finally {
      suppressStorageSync = false;
    }
  };
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (key, value) {
    originalSetItem.call(this, key, value);
    if (this === localStorage && String(key).startsWith(storagePrefix) && syncReady && !suppressStorageSync) scheduleSave();
  };
  Storage.prototype.removeItem = function (key) {
    originalRemoveItem.call(this, key);
    if (this === localStorage && String(key).startsWith(storagePrefix) && syncReady && !suppressStorageSync) scheduleSave();
  };

  async function saveSnapshot() {
    if (!syncReady || !activeUser) return;
    lastLocalChangeAt = Date.now();
    lastPushedAt = new Date().toISOString();
    lastCloudAt = lastPushedAt;
    const { error } = await window.folioSupabase
      .from('folio_data')
      .upsert({ user_id: activeUser.id, data: snapshot(), updated_at: lastPushedAt }, { onConflict: 'user_id' });
    if (error) setMessage(`클라우드 저장에 실패했어요: ${error.message}`, true);
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveSnapshot, 350);
  }

  async function startApp(user) {
    activeUser = user;
    const { data: row, error } = await window.folioSupabase.from('folio_data').select('data,updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (row?.data && typeof row.data === 'object') {
      replaceSnapshot(row.data);
      lastCloudAt = row.updated_at || '';
    } else {
      const localData = snapshot();
      lastPushedAt = new Date().toISOString();
      lastCloudAt = lastPushedAt;
      const { error: insertError } = await window.folioSupabase
        .from('folio_data')
        .upsert({ user_id: user.id, data: localData, updated_at: lastPushedAt }, { onConflict: 'user_id' });
      if (insertError) throw insertError;
    }
    syncReady = true;
    root.remove();
    document.body.classList.remove('folio-auth-locked');
    await loadAppScripts();
    window.folioSupabase.channel(`folio-sync-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'folio_data', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.new?.updated_at === lastPushedAt || payload.new?.updated_at === lastCloudAt || Date.now() - lastLocalChangeAt < 1500) return;
        lastCloudAt = payload.new?.updated_at || '';
        if (payload.eventType === 'DELETE') replaceSnapshot({});
        else if (payload.new?.data) replaceSnapshot(payload.new.data);
        window.location.reload();
      })
      .subscribe();
    window.addEventListener('focus', async () => {
      const { data } = await window.folioSupabase.from('folio_data').select('data,updated_at').eq('user_id', user.id).maybeSingle();
      if (data?.updated_at && data.updated_at !== lastCloudAt && Date.now() - lastLocalChangeAt > 1500) {
        lastCloudAt = data.updated_at;
        replaceSnapshot(data.data);
        window.location.reload();
      }
    });
    document.querySelector('#auth-signout')?.addEventListener('click', async () => {
      syncReady = false;
      await window.folioSupabase.auth.signOut();
      replaceSnapshot({});
      window.location.reload();
    });
  }

  async function loadAppScripts() {
    const preferredView=localStorage.getItem('planner-last-view');
    for (const src of ['app.js', 'monthly.js', 'weekly-enhancements.js?v=weekly-edit2-20261002', 'planner-history.js?v=1', 'ui-polish.js?v=1', 'schedule.js?v=1']) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`앱 파일을 불러오지 못했어요: ${src}`));
        document.body.append(script);
      });
    }
    window.dispatchEvent(new CustomEvent('folio-app-ready',{detail:{preferredView}}));
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = form.elements.username.value.trim().toLowerCase();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    submit.disabled = true;
    setMessage(mode === 'login' ? '로그인 중…' : '인증 메일을 보내는 중…');
    try {
      if (!config?.url || !config?.publishableKey || !window.supabase?.createClient) throw new Error('Supabase 설정을 확인하지 못했어요. 새로고침해 주세요.');
      if (mode === 'signup') {
        const { error } = await window.folioSupabase.auth.signUp({
          email,
          password,
          options: { data: { username }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage('인증 메일을 보냈어요. 이메일 인증을 마친 뒤 로그인 탭에서 설정한 아이디와 비밀번호를 입력해 주세요.');
      } else {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || '아이디 또는 비밀번호를 확인해 주세요.');
        const { data, error } = await window.folioSupabase.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
        if (error) throw error;
        await startApp(data.user);
      }
    } catch (error) {
      const text = error?.message || '잠시 후 다시 시도해 주세요.';
      setMessage(text.includes('folio_data') || text.includes('schema cache')
        ? '데이터 테이블 설정이 아직 안 됐어요. Supabase SQL Editor에서 supabase-schema.sql을 실행해 주세요.'
        : text, true);
    } finally {
      submit.disabled = false;
    }
  });

  if (config?.url && config?.publishableKey && window.supabase?.createClient) {
    window.folioSupabase = window.supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    window.folioSupabase.auth.getSession().then(async ({ data, error }) => {
      if (error) return setMessage(error.message, true);
      if (data.session?.user) {
        try { await startApp(data.session.user); }
        catch (startError) { setMessage(`연결 설정을 확인해 주세요: ${startError.message}`, true); }
      }
    });
  } else {
    setMessage('Supabase 연결 파일을 불러오지 못했어요. 네트워크를 확인하고 다시 열어주세요.', true);
  }
})();
