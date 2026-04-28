'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { GOALS, ACTIVITIES, CONCERNS, DIETS, FOOD_DB, SCAN_FOODS, MEAL_PLANS } from '../lib/data';
import { calcNutrition } from '../lib/calculations';
import {
  loadProfile, saveProfile, dbRowToProfile, dbRowToNutrition,
  loadFoodLogs, addFoodLog, deleteFoodLog,
  loadWater, saveWater,
} from '../lib/db';

// ─── INITIAL STATE ────────────────────────────
const INIT_PROFILE = {
  gender: null, goal: null, age: 25,
  heightUnit: 'ft', heightFt: 5, heightIn: 7, heightCm: 170,
  weightUnit: 'lbs', weightLbs: 165, weightKg: 75,
  targetWeightUnit: 'lbs', targetWeightLbs: 150, targetWeightKg: 68,
  activityLevel: null, healthConcerns: [], dietPrefs: [],
};

const ONBOARD_SCREENS = [
  'gender','goal','age','height','weight','target-weight','activity','concerns','diet','summary'
];

export default function NutriApp() {
  const [screen, setScreen]         = useState('loading');
  const [history, setHistory]       = useState(['loading']);
  const [profile, setProfile]       = useState(INIT_PROFILE);
  const [nutrition, setNutrition]   = useState(null);
  const [foodLog, setFoodLog]       = useState({ breakfast:[], lunch:[], dinner:[], snacks:[] });
  const [waterCups, setWaterCups]   = useState(0);
  const [user, setUser]             = useState(null);
  const [toast, setToast]           = useState({ msg:'', show:false });
  const [activeTab, setActiveTab]   = useState('home');
  const [planDay, setPlanDay]       = useState(0);
  const [authModal, setAuthModal]   = useState({ open:false, tab:'login' });
  const [foodModal, setFoodModal]   = useState({ open:false, meal:null });
  const [scannerOpen, setScannerOpen] = useState(false);
  const toastTimer = useRef(null);

  // ── TOAST ──
  const showToast = useCallback((msg) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, show: true });
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2500);
  }, []);

  // ── NAVIGATION ──
  const goTo = useCallback((s) => {
    setScreen(s);
    setHistory(h => [...h, s]);
  }, []);

  const goBack = useCallback(() => {
    if (scannerOpen) { setScannerOpen(false); return; }
    setHistory(h => {
      if (h.length <= 1) return h;
      const next = [...h];
      next.pop();
      setScreen(next[next.length - 1]);
      return next;
    });
  }, [scannerOpen]);

  // ── BOOT / AUTH ──
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadUserData(session.user);
        } else {
          setScreen('splash');
          setHistory(['splash']);
        }
      } catch (e) {
        console.error('Boot error:', e);
        setScreen('splash');
        setHistory(['splash']);
      }
    };
    setTimeout(init, 800);
  }, []);

  // ── LOAD ALL USER DATA FROM DB ──
  const loadUserData = async (authUser) => {
    const meta = authUser.user_metadata || {};
    const name = meta.full_name || meta.name || authUser.email.split('@')[0];
    setUser({ name, email: authUser.email, id: authUser.id });

    // Load profile from DB
    const dbProfile = await loadProfile(authUser.id);

    if (dbProfile?.onboarding_done) {
      // Returning user — restore everything
      const restoredProfile   = dbRowToProfile(dbProfile);
      const restoredNutrition = dbRowToNutrition(dbProfile);
      setProfile(restoredProfile);
      setNutrition(restoredNutrition);

      // Load today's food logs and water
      const [logs, cups] = await Promise.all([
        loadFoodLogs(authUser.id),
        loadWater(authUser.id),
      ]);
      setFoodLog(logs);
      setWaterCups(cups);

      setScreen('main');
      setHistory(['main']);
      setActiveTab('home');
    } else {
      // New user — go to splash → onboarding
      setScreen('splash');
      setHistory(['splash']);
    }
  };

  // ── NUTRITION CALC ──
  const computeNutrition = useCallback(() => {
    const n = calcNutrition(profile);
    setNutrition(n);
    return n;
  }, [profile]);

  const enterApp = useCallback(async () => {
    const n = computeNutrition();
    setNutrition(n);
    setScreen('main');
    setHistory(['main']);
    setActiveTab('home');
    // Save profile to DB if user is logged in
    if (user?.id) {
      await saveProfile(user.id, profile, n, user.name);
      showToast('✅ Profile saved!');
    }
  }, [computeNutrition, user, profile]);

  // ── SIGN OUT ──
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setNutrition(null);
    setProfile(INIT_PROFILE);
    setFoodLog({ breakfast:[], lunch:[], dinner:[], snacks:[] });
    setWaterCups(0);
    setScreen('splash');
    setHistory(['splash']);
    showToast('Signed out successfully');
  };

  // ── FOOD LOG HELPERS ──
  const addFood = async (meal, food) => {
    // Optimistic update
    setFoodLog(fl => ({ ...fl, [meal]: [...fl[meal], food] }));
    showToast(`✅ ${food.name || food.label} added!`);
    // Save to DB
    if (user?.id) {
      const dbId = await addFoodLog(user.id, meal, food);
      if (dbId) {
        // Attach dbId so we can delete it later
        setFoodLog(fl => ({
          ...fl,
          [meal]: fl[meal].map((f, i) =>
            i === fl[meal].length - 1 && !f.dbId ? { ...f, dbId } : f
          ),
        }));
      }
    }
  };

  const removeFood = async (meal, idx) => {
    const food = foodLog[meal][idx];
    setFoodLog(fl => ({ ...fl, [meal]: fl[meal].filter((_, i) => i !== idx) }));
    showToast('Food removed');
    if (food?.dbId) await deleteFoodLog(food.dbId);
  };
  const totalCals = Object.values(foodLog).flat().reduce((s, f) => s + f.cal, 0);
  const totalMacro = m => Object.values(foodLog).flat().reduce((s, f) => s + (f[m] || 0), 0);
  const mealCals = meal => (foodLog[meal] || []).reduce((s, f) => s + f.cal, 0);

  // ── RENDER ──
  const progress = ONBOARD_SCREENS.indexOf(screen) >= 0
    ? ((ONBOARD_SCREENS.indexOf(screen) + 1) / ONBOARD_SCREENS.length) * 100
    : 0;

  return (
    <div className="app-shell">

      {/* TOAST */}
      <div className={`toast ${toast.show ? 'show' : ''}`}>{toast.msg}</div>

      {/* AUTH MODAL */}
      {authModal.open && (
        <AuthModal
          tab={authModal.tab}
          onClose={() => setAuthModal({ open:false, tab:'login' })}
          onSwitchTab={tab => setAuthModal(a => ({ ...a, tab }))}
          onSuccess={async (u) => {
            setUser(u);
            setAuthModal({ open:false, tab:'login' });
            // Try loading existing profile from DB
            if (u.id) {
              const dbProfile = await loadProfile(u.id);
              if (dbProfile?.onboarding_done) {
                const restoredProfile   = dbRowToProfile(dbProfile);
                const restoredNutrition = dbRowToNutrition(dbProfile);
                setProfile(restoredProfile);
                setNutrition(restoredNutrition);
                const [logs, cups] = await Promise.all([
                  loadFoodLogs(u.id),
                  loadWater(u.id),
                ]);
                setFoodLog(logs);
                setWaterCups(cups);
                showToast(`Welcome back, ${u.name}! 👋`);
                setTimeout(() => { setScreen('main'); setHistory(['main']); setActiveTab('home'); }, 400);
                return;
              }
            }
            showToast(authModal.tab === 'login' ? `Welcome back, ${u.name}! 👋` : 'Account created! 🎉');
            setTimeout(() => { goTo('gender'); }, 500);
          }}
          showToast={showToast}
        />
      )}

      {/* FOOD MODAL */}
      {foodModal.open && (
        <FoodModal
          meal={foodModal.meal}
          onClose={() => setFoodModal({ open:false, meal:null })}
          onAdd={(food) => { addFood(foodModal.meal, food); setFoodModal({ open:false, meal:null }); }}
        />
      )}

      {/* SCANNER */}
      {scannerOpen && (
        <ScannerScreen
          onBack={() => setScannerOpen(false)}
          onLog={(food) => {
            const meal = food.meal || 'lunch';
            addFood(meal, { ...food, name: food.label || food.name });
            setScannerOpen(false);
            showToast(`✅ ${food.label || food.name} logged to ${meal}!`);
          }}
          showToast={showToast}
          userId={user?.id}
        />
      )}

      {/* SCREENS */}
      {!scannerOpen && (
        <>
          {screen === 'loading' && <LoadingScreen />}
          {screen === 'splash'  && (
            <SplashScreen
              onGetStarted={() => setAuthModal({ open:true, tab:'signup' })}
              onLogin={() => setAuthModal({ open:true, tab:'login' })}
            />
          )}
          {screen === 'gender' && (
            <OnboardScreen title="What's your gender?" progress={progress} onBack={goBack} onNext={() => goTo('goal')}>
              <GenderPicker value={profile.gender} onChange={g => setProfile(p => ({ ...p, gender:g }))} />
            </OnboardScreen>
          )}
          {screen === 'goal' && (
            <OnboardScreen title="What's your main goal?" progress={progress} onBack={goBack} onNext={() => goTo('age')}>
              <GoalPicker value={profile.goal} onChange={g => setProfile(p => ({ ...p, goal:g }))} />
            </OnboardScreen>
          )}
          {screen === 'age' && (
            <OnboardScreen title="How old are you?" progress={progress} onBack={goBack} onNext={() => goTo('height')}
              hint="With this, we can calculate your basal metabolic rate and customize a program that fits you.">
              <DrumPicker value={profile.age} min={8} max={90} unit="years old" onChange={v => setProfile(p => ({ ...p, age:v }))} />
            </OnboardScreen>
          )}
          {screen === 'height' && (
            <OnboardScreen title="What's your height?" progress={progress} onBack={goBack} onNext={() => goTo('weight')}
              hint="Body mass index (BMI) is a measure of body fat based on height and weight." hintLabel="Calculating your body mass index">
              <HeightPicker profile={profile} onChange={u => setProfile(p => ({ ...p, ...u }))} />
            </OnboardScreen>
          )}
          {screen === 'weight' && (
            <OnboardScreen title="What's your current weight?" progress={progress} onBack={goBack} onNext={() => goTo('target-weight')}
              hint={getBmiHint(profile)}>
              <WeightPicker profile={profile} isTarget={false} onChange={u => setProfile(p => ({ ...p, ...u }))} />
            </OnboardScreen>
          )}
          {screen === 'target-weight' && (
            <OnboardScreen title="What's your target weight?" progress={progress} onBack={goBack} onNext={() => goTo('activity')}
              hint="Set a realistic goal. We'll calculate a safe and sustainable plan to get you there.">
              <WeightPicker profile={profile} isTarget={true} onChange={u => setProfile(p => ({ ...p, ...u }))} />
            </OnboardScreen>
          )}
          {screen === 'activity' && (
            <OnboardScreen title="What's your activity level?" progress={progress} onBack={goBack} onNext={() => goTo('concerns')}>
              <ActivityPicker value={profile.activityLevel} onChange={a => setProfile(p => ({ ...p, activityLevel:a }))} />
            </OnboardScreen>
          )}
          {screen === 'concerns' && (
            <OnboardScreen title="Any health concerns?" progress={progress} onBack={goBack} onNext={() => goTo('diet')}>
              <ConcernsPicker value={profile.healthConcerns} onChange={c => setProfile(p => ({ ...p, healthConcerns:c }))} />
            </OnboardScreen>
          )}
          {screen === 'diet' && (
            <OnboardScreen title="Any dietary preferences?" progress={progress} onBack={goBack} onNext={() => { computeNutrition(); goTo('summary'); }}
              subtitle="Select all that apply">
              <DietPicker value={profile.dietPrefs} onChange={d => setProfile(p => ({ ...p, dietPrefs:d }))} />
            </OnboardScreen>
          )}
          {screen === 'summary' && nutrition && (
            <SummaryScreen profile={profile} nutrition={nutrition} onBack={goBack} onStart={enterApp} />
          )}
          {screen === 'main' && nutrition && (
            <MainApp
              user={user}
              profile={profile}
              nutrition={nutrition}
              foodLog={foodLog}
              waterCups={waterCups}
              totalCals={totalCals}
              totalMacro={totalMacro}
              mealCals={mealCals}
              activeTab={activeTab}
              planDay={planDay}
              onTabChange={setActiveTab}
              onPlanDayChange={setPlanDay}
              onRemoveFood={removeFood}
              onOpenFoodModal={(meal) => setFoodModal({ open:true, meal })}
              onOpenScanner={() => setScannerOpen(true)}
              onWaterToggle={async (i) => {
                const cups = i < waterCups ? i : i + 1;
                setWaterCups(cups);
                if (user?.id) await saveWater(user.id, cups);
              }}
              onSignOut={handleSignOut}
              showToast={showToast}
            />
          )}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
// LOADING
// ════════════════════════════════════════════════
function LoadingScreen() {
  return (
    <div className="screen loading-screen">
      <div className="loading-logo">🥗</div>
      <div className="loading-name">NutriAI</div>
      <div className="loading-spinner" />
      <div className="loading-text">Checking your session...</div>
    </div>
  );
}

// ════════════════════════════════════════════════
// SPLASH
// ════════════════════════════════════════════════
function SplashScreen({ onGetStarted, onLogin }) {
  return (
    <div className="screen splash-screen" style={{ background:'var(--bg)' }}>
      <div className="splash-hero" style={{ background:'radial-gradient(circle at 30% 50%, rgba(61,220,107,.1) 0%, transparent 50%)', padding:'40px 20px' }}>
        <div className="splash-badge">🤖 AI-Powered Nutrition</div>
        <h1 className="splash-title">Focused on<br/>You, Always First</h1>
      </div>
      <div className="splash-bottom">
        <div className="splash-stat">🏆 <span>1,000,000+</span></div>
        <div className="splash-stat-sub">Users Have Chosen NutriAI</div>
        <p className="splash-tagline">Let's start with a few questions to create your personalized nutrition plan.</p>
        <button className="btn-primary" onClick={onGetStarted}>Get Started — It's Free</button>
        <button className="btn-secondary" onClick={onLogin}>I already have an account — Log in</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// AUTH MODAL
// ════════════════════════════════════════════════
function AuthModal({ tab, onClose, onSwitchTab, onSuccess, showToast }) {
  const [loginEmail, setLoginEmail]   = useState('');
  const [loginPw, setLoginPw]         = useState('');
  const [signupName, setSignupName]   = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPw, setSignupPw]       = useState('');
  const [errors, setErrors]           = useState({});
  const [formError, setFormError]     = useState('');   // visible banner inside modal
  const [formInfo, setFormInfo]       = useState('');   // info banner (blue)
  const [loading, setLoading]         = useState(false);
  const [showPw, setShowPw]           = useState(false);
  const [pwStrength, setPwStrength]   = useState(0);

  const setErr = (k, v) => setErrors(e => ({ ...e, [k]: v }));
  const clearErr = (k) => setErrors(e => ({ ...e, [k]: '' }));
  const clearBanners = () => { setFormError(''); setFormInfo(''); };

  const pwStrengthColor = ['#e53935','#FF6B35','#FFC107','#4CAF50'][Math.min(pwStrength-1,3)] || 'transparent';
  const pwStrengthWidth = pwStrength > 0 ? ['25%','50%','75%','100%'][Math.min(pwStrength-1,3)] : '0%';

  const checkPw = (pw) => {
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    setPwStrength(s);
  };

  const handleLogin = async () => {
    clearBanners();
    let valid = true;
    if (!loginEmail.includes('@')) { setErr('loginEmail','Please enter a valid email'); valid=false; }
    if (!loginPw)                  { setErr('loginPw','Please enter your password');    valid=false; }
    if (!valid) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPw });
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid') || msg.includes('credentials')) {
          setFormError('Incorrect email or password. Please try again.');
        } else if (msg.includes('confirm') || msg.includes('verified')) {
          setFormInfo('Please check your inbox and confirm your email before logging in.');
        } else {
          setFormError(error.message);
        }
      } else {
        const meta = data.user?.user_metadata || {};
        onSuccess({ id: data.user.id, name: meta.full_name || meta.name || loginEmail.split('@')[0], email: loginEmail });
      }
    } catch (e) {
      setFormError('Something went wrong. Please check your connection and try again.');
      console.error(e);
    }
    setLoading(false);
  };

  const handleSignup = async () => {
    clearBanners();
    let valid = true;
    if (!signupName)                   { setErr('signupName','Please enter your full name'); valid=false; }
    if (!signupEmail.includes('@'))    { setErr('signupEmail','Please enter a valid email'); valid=false; }
    if (signupPw.length < 8)          { setErr('signupPw','Password must be at least 8 characters'); valid=false; }
    if (!valid) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail, password: signupPw,
        options: { data: { full_name: signupName } }
      });
      if (error) {
        if (error.message.includes('already registered')) {
          setErr('signupEmail','This email is already registered.');
          setFormInfo('Already have an account? Switch to Log In above.');
        } else {
          setFormError(error.message);
        }
      } else if (data.session) {
        onSuccess({ id: data.user.id, name: signupName, email: signupEmail });
      } else {
        // Email confirmation required
        setFormInfo('✉️ Almost there! Check your inbox and click the confirmation link, then log in here.');
        onSwitchTab('login');
      }
    } catch (e) {
      setFormError('Something went wrong. Please check your connection and try again.');
      console.error(e);
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    clearBanners();
    if (!loginEmail.includes('@')) { setErr('loginEmail','Enter your email above first'); return; }
    try {
      await supabase.auth.resetPasswordForEmail(loginEmail, { redirectTo: window.location.href });
      setFormInfo('✉️ Password reset email sent! Check your inbox.');
    } catch { setFormError('Could not send reset email. Try again.'); }
  };

  // Error/info banner shown inside the modal
  const ErrorBanner = () => formError ? (
    <div style={{background:'#1a0f0f',border:'1px solid rgba(255,71,87,.3)',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#ff6b7a',display:'flex',gap:8,alignItems:'flex-start'}}>
      <span>⚠️</span><span>{formError}</span>
    </div>
  ) : null;

  const InfoBanner = () => formInfo ? (
    <div style={{background:'#0f1a14',border:'1px solid rgba(61,220,107,.3)',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#3DDC6B',display:'flex',gap:8,alignItems:'flex-start'}}>
      <span>ℹ️</span><span>{formInfo}</span>
    </div>
  ) : null;

  return (
    <div className="auth-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal-sheet">
        <div className="auth-modal-handle" />
        <div className="auth-modal-scroll">
          <div className="auth-modal-tabs">
            <button className={`auth-modal-tab ${tab==='login'?'active':''}`} onClick={() => { onSwitchTab('login'); clearBanners(); }}>Log In</button>
            <button className={`auth-modal-tab ${tab==='signup'?'active':''}`} onClick={() => { onSwitchTab('signup'); clearBanners(); }}>Sign Up</button>
          </div>

          {tab === 'login' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div><div className="auth-title">Welcome back 👋</div><div className="auth-sub">Log in to continue your health journey</div></div>
              <ErrorBanner /><InfoBanner />
              <div className="input-group">
                <label className="input-label">Email Address</label>
                <div className="input-icon-wrap">
                  <span className="input-icon">✉️</span>
                  <input className={`auth-input ${errors.loginEmail?'error':''}`} type="email" placeholder="you@example.com"
                    value={loginEmail} onChange={e => { setLoginEmail(e.target.value); clearErr('loginEmail'); clearBanners(); }} />
                </div>
                {errors.loginEmail && <span className="field-error">{errors.loginEmail}</span>}
              </div>
              <div className="input-group">
                <label className="input-label">Password</label>
                <div className="input-icon-wrap">
                  <span className="input-icon">🔒</span>
                  <input className={`auth-input ${errors.loginPw?'error':''}`} type={showPw?'text':'password'} placeholder="Your password"
                    value={loginPw} onChange={e => { setLoginPw(e.target.value); clearErr('loginPw'); clearBanners(); }}
                    onKeyDown={e => e.key==='Enter' && handleLogin()} />
                  <button className="eye-btn" onClick={() => setShowPw(s=>!s)}>{showPw?'🙈':'👁️'}</button>
                </div>
                {errors.loginPw && <span className="field-error">{errors.loginPw}</span>}
              </div>
              <div className="forgot-link" onClick={handleForgot}>Forgot password?</div>
              <button className="btn-primary" onClick={handleLogin} disabled={loading}>{loading?'Logging in...':'Log In'}</button>
              <div className="auth-divider"><span>or</span></div>
              <button className="social-btn" onClick={() => setFormInfo('Google login coming soon!')}>
                <span style={{fontSize:20}}>🌐</span> Continue with Google
              </button>
            </div>
          )}

          {tab === 'signup' && (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div><div className="auth-title">Create Account ✨</div><div className="auth-sub">Join 1,000,000+ users on their health journey</div></div>
              <ErrorBanner /><InfoBanner />
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <div className="input-icon-wrap">
                  <span className="input-icon">👤</span>
                  <input className={`auth-input ${errors.signupName?'error':''}`} type="text" placeholder="Your full name"
                    value={signupName} onChange={e => { setSignupName(e.target.value); clearErr('signupName'); clearBanners(); }} />
                </div>
                {errors.signupName && <span className="field-error">{errors.signupName}</span>}
              </div>
              <div className="input-group">
                <label className="input-label">Email Address</label>
                <div className="input-icon-wrap">
                  <span className="input-icon">✉️</span>
                  <input className={`auth-input ${errors.signupEmail?'error':''}`} type="email" placeholder="you@example.com"
                    value={signupEmail} onChange={e => { setSignupEmail(e.target.value); clearErr('signupEmail'); clearBanners(); }} />
                </div>
                {errors.signupEmail && <span className="field-error">{errors.signupEmail}</span>}
              </div>
              <div className="input-group">
                <label className="input-label">Password</label>
                <div className="input-icon-wrap">
                  <span className="input-icon">🔒</span>
                  <input className={`auth-input ${errors.signupPw?'error':''}`} type={showPw?'text':'password'} placeholder="Min. 8 characters"
                    value={signupPw} onChange={e => { setSignupPw(e.target.value); clearErr('signupPw'); checkPw(e.target.value); clearBanners(); }}
                    onKeyDown={e => e.key==='Enter' && handleSignup()} />
                  <button className="eye-btn" onClick={() => setShowPw(s=>!s)}>{showPw?'🙈':'👁️'}</button>
                </div>
                <div className="password-strength">
                  <div className="password-strength-fill" style={{ width: pwStrengthWidth, background: pwStrengthColor }} />
                </div>
                {errors.signupPw && <span className="field-error">{errors.signupPw}</span>}
              </div>
              <div className="auth-terms">By signing up you agree to our <a style={{color:'var(--green)',cursor:'pointer'}}>Terms</a> and <a style={{color:'var(--green)',cursor:'pointer'}}>Privacy Policy</a></div>
              <button className="btn-primary" onClick={handleSignup} disabled={loading}>{loading?'Creating account...':'Create Account'}</button>
              <div className="auth-divider"><span>or</span></div>
              <button className="social-btn" onClick={() => setFormInfo('Google login coming soon!')}>
                <span style={{fontSize:20}}>🌐</span> Continue with Google
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// ONBOARD WRAPPER
// ════════════════════════════════════════════════
function OnboardScreen({ title, subtitle, hint, hintLabel, progress, onBack, onNext, children }) {
  return (
    <div className="screen" style={{ background:'var(--bg)' }}>
      <div className="onboard-top">
        <button className="btn-back" onClick={onBack}>‹</button>
        <div className="progress-bar"><div className="progress-fill" style={{ width:`${progress}%` }} /></div>
      </div>
      <div className="onboard-body">
        <h2 className="screen-title">{title}</h2>
        {subtitle && <p style={{ textAlign:'center', color:'var(--text-light)', fontSize:14, marginTop:-12, marginBottom:16 }}>{subtitle}</p>}
        {hint && (
          <div className="hint-card">
            <span className="icon">💚</span>
            <div>{hintLabel && <div className="label">{hintLabel}</div>}<p>{hint}</p></div>
          </div>
        )}
        {children}
      </div>
      <div className="onboard-footer">
        <button className="btn-primary" onClick={onNext}>Continue</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// GENDER
// ════════════════════════════════════════════════
function GenderPicker({ value, onChange }) {
  return (
    <>
      <div className="gender-grid">
        {[{id:'female',emoji:'👩',label:'Female'},{id:'male',emoji:'👨',label:'Male'}].map(g => (
          <div key={g.id} className={`gender-card ${value===g.id?'selected':''}`} onClick={() => onChange(g.id)}>
            <span className="g-emoji">{g.emoji}</span><span className="g-label">{g.label}</span>
          </div>
        ))}
      </div>
      <div className={`nonbinary-btn ${value==='nonbinary'?'selected':''}`} onClick={() => onChange('nonbinary')}>
        <span style={{fontSize:22}}>🏳️‍🌈</span><span style={{fontSize:15,fontWeight:700,color:'var(--text)'}}>Non-binary</span>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════
// GOAL
// ════════════════════════════════════════════════
function GoalPicker({ value, onChange }) {
  return (
    <div className="goal-list">
      {GOALS.map(g => (
        <div key={g.id} className={`goal-card ${value===g.id?'selected':''}`} onClick={() => onChange(g.id)}>
          <span className="g-icon">{g.icon}</span>
          <div><div className="g-name">{g.name}</div><div className="g-desc">{g.desc}</div></div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════
// DRUM PICKER (age)
// ════════════════════════════════════════════════
function DrumPicker({ value, min, max, unit, onChange }) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  const itemH = 52;
  const listRef = useRef(null);
  const itemsRef = useRef(null);
  const dragRef = useRef({ isDragging:false, startY:0, startTop:0 });

  const getTop = () => {
    const t = itemsRef.current?.style.transform || '';
    return parseFloat(t.replace('translateY(','')) || 0;
  };

  const setTop = useCallback((v, snap=false) => {
    const minT = -(values.length - 1) * itemH + itemH * 2;
    const clamped = Math.max(minT, Math.min(itemH * 2, v));
    if (itemsRef.current) {
      if (snap) itemsRef.current.style.transition = 'transform .2s';
      itemsRef.current.style.transform = `translateY(${clamped}px)`;
      if (snap) setTimeout(() => { if(itemsRef.current) itemsRef.current.style.transition=''; }, 200);
    }
    const idx = Math.round((itemH * 2 - clamped) / itemH);
    const safeIdx = Math.max(0, Math.min(values.length - 1, idx));
    onChange(values[safeIdx]);
  }, [values, onChange]);

  useEffect(() => {
    const idx = values.indexOf(value);
    if (idx >= 0 && itemsRef.current) {
      itemsRef.current.style.transition = '';
      itemsRef.current.style.transform = `translateY(${itemH * 2 - idx * itemH}px)`;
    }
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setTop(getTop() - e.deltaY);
      clearTimeout(el._wt);
      el._wt = setTimeout(() => setTop(getTop(), true), 150);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setTop]);

  const onPointerDown = (e) => {
    dragRef.current = { isDragging:true, startY: e.clientY, startTop: getTop() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current.isDragging) return;
    setTop(dragRef.current.startTop + (e.clientY - dragRef.current.startY));
  };
  const onPointerUp = () => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;
    setTop(getTop(), true);
  };

  const activeIdx = values.indexOf(value);

  return (
    <div className="drum-wrap">
      <div className="drum-line drum-line-top" />
      <div className="drum-line drum-line-bot" />
      <div className="drum-list" ref={listRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <div className="drum-items" ref={itemsRef}>
          {values.map((v, i) => (
            <div key={v} className={`drum-item ${i===activeIdx?'active':Math.abs(i-activeIdx)===1?'near':''}`}
              onClick={() => setTop(itemH*2 - i*itemH, true)}>
              {v}
            </div>
          ))}
        </div>
      </div>
      <span className="drum-unit">{unit}</span>
    </div>
  );
}

// ════════════════════════════════════════════════
// RULER PICKER
// ════════════════════════════════════════════════
function RulerPicker({ values, currentIdx, tickW=14, onIndexChange, displayLabel }) {
  const wrapRef = useRef(null);
  const innerRef = useRef(null);
  const drag = useRef({ isDragging:false, startX:0, startOff:0 });

  const halfW = () => wrapRef.current?.offsetWidth / 2 || 200;

  const getOff = () => {
    const t = innerRef.current?.style.transform || '';
    return parseFloat(t.replace('translateX(','')) || 0;
  };

  const setOff = useCallback((v, snap=false) => {
    const maxOff = halfW();
    const minOff = halfW() - (values.length - 1) * tickW;
    const clamped = Math.max(minOff, Math.min(maxOff, v));
    if (innerRef.current) {
      if (snap) innerRef.current.style.transition = 'transform .15s';
      innerRef.current.style.transform = `translateX(${clamped}px)`;
      if (snap) setTimeout(() => { if(innerRef.current) innerRef.current.style.transition=''; }, 150);
    }
    const idx = Math.round((halfW() - clamped) / tickW);
    onIndexChange(Math.max(0, Math.min(values.length - 1, idx)));
  }, [values.length, tickW, onIndexChange]);

  useEffect(() => {
    if (innerRef.current && wrapRef.current) {
      const off = halfW() - currentIdx * tickW;
      innerRef.current.style.transition = '';
      innerRef.current.style.transform = `translateX(${off}px)`;
    }
  }, [currentIdx, tickW]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      setOff(getOff() - e.deltaY * 0.5);
      clearTimeout(el._wt);
      el._wt = setTimeout(() => setOff(getOff(), true), 150);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setOff]);

  const onPointerDown = (e) => {
    drag.current = { isDragging:true, startX:e.clientX, startOff:getOff() };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current.isDragging) return;
    setOff(drag.current.startOff + (e.clientX - drag.current.startX));
  };
  const onPointerUp = () => { drag.current.isDragging = false; setOff(getOff(), true); };

  return (
    <>
      <div className="ruler-display">
        <span className="val">{displayLabel}</span>
      </div>
      <div className="ruler-wrap" ref={wrapRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <div className="ruler-inner" ref={innerRef}>
          {values.map((v, i) => {
            const isMaj = v.major;
            return (
              <div key={i} className={`ruler-tick ${isMaj?'major':'minor'}`} style={{ width:tickW }}>
                <div className="tick-line" />
                {isMaj && <div className="tick-label">{v.label}</div>}
              </div>
            );
          })}
        </div>
        <div className="ruler-center-line" />
      </div>
    </>
  );
}

// ════════════════════════════════════════════════
// HEIGHT PICKER
// ════════════════════════════════════════════════
function HeightPicker({ profile, onChange }) {
  const isFt = profile.heightUnit === 'ft';
  const currentIdx = isFt
    ? (profile.heightFt * 12 + profile.heightIn) - 48
    : profile.heightCm - 120;
  const values = isFt
    ? Array.from({ length: 37 }, (_, i) => {
        const tot = i + 48; const ft = Math.floor(tot/12); const inch = tot%12;
        return { major: inch===0, label: `${ft}'` };
      })
    : Array.from({ length: 101 }, (_, i) => {
        const cm = i + 120; return { major: cm%10===0, label:`${cm}` };
      });
  const displayLabel = isFt ? `${profile.heightFt}'${profile.heightIn}"` : `${profile.heightCm} cm`;

  const handleIdx = (idx) => {
    if (isFt) { const tot = idx+48; onChange({ heightFt:Math.floor(tot/12), heightIn:tot%12 }); }
    else onChange({ heightCm: idx+120 });
  };

  const switchUnit = (u) => {
    if (u === 'cm') onChange({ heightUnit:'cm', heightCm: Math.round(profile.heightFt*30.48+profile.heightIn*2.54) });
    else { const tot=Math.round(profile.heightCm/2.54); onChange({ heightUnit:'ft', heightFt:Math.floor(tot/12), heightIn:tot%12 }); }
  };

  return (
    <>
      <div className="unit-toggle">
        <button className={`unit-btn ${isFt?'active':''}`} onClick={() => switchUnit('ft')}>ft</button>
        <button className={`unit-btn ${!isFt?'active':''}`} onClick={() => switchUnit('cm')}>cm</button>
      </div>
      <RulerPicker values={values} currentIdx={currentIdx} onIndexChange={handleIdx} displayLabel={displayLabel} />
    </>
  );
}

// ════════════════════════════════════════════════
// WEIGHT PICKER
// ════════════════════════════════════════════════
function WeightPicker({ profile, isTarget, onChange }) {
  const unit = isTarget ? profile.targetWeightUnit : profile.weightUnit;
  const isKg = unit === 'kg';
  const min = isKg ? 30 : 70, max = isKg ? 200 : 440;
  const curVal = isTarget
    ? (isKg ? profile.targetWeightKg : profile.targetWeightLbs)
    : (isKg ? profile.weightKg : profile.weightLbs);
  const currentIdx = curVal - min;
  const values = Array.from({ length: max - min + 1 }, (_, i) => {
    const v = i + min; return { major: v%10===0, label:`${v}` };
  });
  const handleIdx = (idx) => {
    const val = idx + min;
    if (isTarget) { isKg ? onChange({ targetWeightKg:val }) : onChange({ targetWeightLbs:val }); }
    else { isKg ? onChange({ weightKg:val }) : onChange({ weightLbs:val }); }
  };
  const switchUnit = (u) => {
    const isToKg = u==='kg';
    if (isTarget) {
      onChange({ targetWeightUnit:u, ...(isToKg
        ? { targetWeightKg: Math.round(profile.targetWeightLbs*0.453592) }
        : { targetWeightLbs: Math.round(profile.targetWeightKg/0.453592) }) });
    } else {
      onChange({ weightUnit:u, ...(isToKg
        ? { weightKg: Math.round(profile.weightLbs*0.453592) }
        : { weightLbs: Math.round(profile.weightKg/0.453592) }) });
    }
  };
  return (
    <>
      <div className="unit-toggle">
        <button className={`unit-btn ${!isKg?'active':''}`} onClick={() => switchUnit('lbs')}>lbs</button>
        <button className={`unit-btn ${isKg?'active':''}`} onClick={() => switchUnit('kg')}>kg</button>
      </div>
      <RulerPicker values={values} currentIdx={currentIdx} onIndexChange={handleIdx}
        displayLabel={`${curVal} ${isKg?'kg':'lbs'}`} />
    </>
  );
}

// ════════════════════════════════════════════════
// ACTIVITY
// ════════════════════════════════════════════════
function ActivityPicker({ value, onChange }) {
  return (
    <div className="activity-list">
      {ACTIVITIES.map(a => (
        <div key={a.id} className={`activity-card ${value===a.id?'selected':''}`} onClick={() => onChange(a.id)}>
          <span style={{fontSize:26,width:38,textAlign:'center'}}>{a.icon}</span>
          <div><div className="a-name">{a.name}</div><div className="a-desc">{a.desc}</div></div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════
// CONCERNS
// ════════════════════════════════════════════════
function ConcernsPicker({ value, onChange }) {
  const toggle = (c) => {
    if (c === 'None') { onChange(['None']); return; }
    const without = value.filter(x => x !== 'None' && x !== c);
    onChange(value.includes(c) ? without : [...without, c]);
  };
  return (
    <div className="concern-list">
      {CONCERNS.map(c => (
        <div key={c} className={`concern-item ${value.includes(c)?'selected':''}`} onClick={() => toggle(c)}>
          <span>{c}</span>
          <div className="radio-circle"><div className="radio-dot" /></div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════
// DIET
// ════════════════════════════════════════════════
function DietPicker({ value, onChange }) {
  const toggle = (id) => {
    onChange(value.includes(id) ? value.filter(x=>x!==id) : [...value, id]);
  };
  return (
    <div className="diet-grid">
      {DIETS.map(d => (
        <div key={d.id} className={`diet-card ${value.includes(d.id)?'selected':''}`} onClick={() => toggle(d.id)}>
          <span className="d-emoji">{d.emoji}</span><span className="d-name">{d.name}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════
function SummaryScreen({ profile, nutrition, onBack, onStart }) {
  const bmiPct = Math.min(100, Math.max(0, ((nutrition.bmi - 15) / (45 - 15)) * 100));
  const goalObj = GOALS.find(g => g.id === profile.goal) || GOALS[0];
  const actObj  = ACTIVITIES.find(a => a.id === profile.activityLevel) || ACTIVITIES[1];
  const weightDisp  = profile.weightUnit==='lbs' ? `${profile.weightLbs} lbs` : `${profile.weightKg} kg`;
  const targDisp    = profile.targetWeightUnit==='lbs' ? `${profile.targetWeightLbs} lbs` : `${profile.targetWeightKg} kg`;

  return (
    <div className="screen" style={{ background:'var(--bg)' }}>
      <div className="onboard-top">
        <button className="btn-back" onClick={onBack}>‹</button>
        <div className="progress-bar"><div className="progress-fill" style={{ width:'100%' }} /></div>
      </div>
      <div className="onboard-body">
        <h2 className="screen-title">Your Profile Summary</h2>
        <div className="summary-card">
          <h3>Body Mass Index (BMI)</h3>
          <div className="bmi-value-pill">You — {nutrition.bmi}</div>
          <div className="bmi-bar-wrap">
            <div className="bmi-pointer" style={{ left:`${bmiPct}%` }} />
          </div>
          <div className="bmi-labels"><span>Normal</span><span>Overweight</span><span>Obese</span></div>
        </div>
        <div className="calorie-target-card">
          <div className="ct-label">Daily Calorie Target</div>
          <div className="ct-val">{nutrition.calorieTarget.toLocaleString()}</div>
          <div className="ct-unit">calories / day</div>
          <div className="macro-chips">
            <div className="macro-chip">🥩 {nutrition.protein}g protein</div>
            <div className="macro-chip">🍞 {nutrition.carbs}g carbs</div>
            <div className="macro-chip">🧈 {nutrition.fat}g fat</div>
          </div>
        </div>
        <div className="summary-card">
          {[
            { icon: goalObj.icon, label:'Main goal',      val: goalObj.name },
            { icon: '🎯',         label:'Target Weight',  val: targDisp },
            { icon: actObj.icon,  label:'Activity Level', val: actObj.name },
            { icon: '⚖️',         label:'Current Weight', val: weightDisp },
            { icon: '🔥',         label:'BMR',            val: `${nutrition.bmr.toLocaleString()} kcal` },
          ].map((r,i) => (
            <div key={i} className="summary-row" style={i===4?{marginBottom:0}:{}}>
              <span className="s-icon">{r.icon}</span>
              <div><div className="s-label">{r.label}</div><div className="s-val">{r.val}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div className="onboard-footer">
        <button className="btn-primary" onClick={onStart}>Start My Journey 🚀</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════
function MainApp({ user, profile, nutrition, foodLog, waterCups, totalCals, totalMacro, mealCals,
  activeTab, planDay, onTabChange, onPlanDayChange, onRemoveFood, onOpenFoodModal, onOpenScanner,
  onWaterToggle, onSignOut, showToast }) {

  const goalObj = GOALS.find(g => g.id === profile.goal) || GOALS[0];
  const actObj  = ACTIVITIES.find(a => a.id === profile.activityLevel) || ACTIVITIES[1];

  return (
    <div className="screen" style={{ display:'flex', flexDirection:'column' }}>
      {activeTab === 'home' && (
        <HomeTab foodLog={foodLog} nutrition={nutrition} totalCals={totalCals} totalMacro={totalMacro}
          mealCals={mealCals} waterCups={waterCups} onRemoveFood={onRemoveFood}
          onOpenFoodModal={onOpenFoodModal} onWaterToggle={onWaterToggle} />
      )}
      {activeTab === 'plan' && (
        <PlanTab nutrition={nutrition} planDay={planDay} onDayChange={onPlanDayChange} />
      )}
      {activeTab === 'insights' && (
        <InsightsTab nutrition={nutrition} profile={profile} />
      )}
      {activeTab === 'profile' && (
        <ProfileTab user={user} profile={profile} nutrition={nutrition}
          goalObj={goalObj} actObj={actObj} onSignOut={onSignOut} showToast={showToast} />
      )}
      <nav className="bottom-nav">
        {[
          { id:'home',     icon:'🏠', label:'Home' },
          { id:'plan',     icon:'📋', label:'Plan' },
        ].map(n => (
          <button key={n.id} className={`nav-item ${activeTab===n.id?'active':''}`} onClick={() => onTabChange(n.id)}>
            <span className="n-icon">{n.icon}</span><span className="n-label">{n.label}</span>
          </button>
        ))}
        <button className="scan-fab" onClick={onOpenScanner}>📷</button>
        {[
          { id:'insights', icon:'📊', label:'Insights' },
          { id:'profile',  icon:'👤', label:'Profile' },
        ].map(n => (
          <button key={n.id} className={`nav-item ${activeTab===n.id?'active':''}`} onClick={() => onTabChange(n.id)}>
            <span className="n-icon">{n.icon}</span><span className="n-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── HOME TAB ──
function HomeTab({ foodLog, nutrition, totalCals, totalMacro, mealCals, waterCups, onRemoveFood, onOpenFoodModal, onWaterToggle }) {
  const remaining = Math.max(0, nutrition.calorieTarget - totalCals);
  const pct = Math.min(100, (totalCals / nutrition.calorieTarget) * 100);
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const meals = ['breakfast','lunch','dinner','snacks'];
  const mealMeta = { breakfast:{icon:'🌅',name:'Breakfast'}, lunch:{icon:'🌞',name:'Lunch'}, dinner:{icon:'🌙',name:'Dinner'}, snacks:{icon:'🍎',name:'Snacks'} };

  return (
    <div className="tab-content">
      <div className="main-header">
        <div><h1>Today's Nutrition</h1><div className="date">{today}</div></div>
        <button className="notif-btn">🔔</button>
      </div>
      <div className="stats-row">
        <div className="stat-card"><div className="ic-val" style={{color:'var(--green)'}}>{nutrition.calorieTarget}</div><div className="ic-label">Goal</div></div>
        <div className="stat-card"><div className="ic-val" style={{color:'var(--green)'}}>{totalCals}</div><div className="ic-label">Eaten</div></div>
        <div className="stat-card"><div className="ic-val" style={{color:remaining>0?'var(--green)':'var(--red)'}}>{remaining}</div><div className="ic-label">Remaining</div></div>
      </div>
      <div className="calorie-ring-wrap">
        <svg width="200" height="200" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3DDC6B" />
              <stop offset="100%" stopColor="#2ab854" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle cx="100" cy="100" r="80" fill="none" stroke="var(--bg-card2)" strokeWidth="14"/>
          {/* Progress */}
          <circle cx="100" cy="100" r="80" fill="none"
            stroke="url(#ringGrad)" strokeWidth="14"
            strokeDasharray={2*Math.PI*80}
            strokeDashoffset={2*Math.PI*80*(1-pct/100)}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
            style={{transition:'stroke-dashoffset .8s ease', filter:'drop-shadow(0 0 8px rgba(61,220,107,.5))'}}
          />
          {/* Center text */}
          <text x="100" y="88" textAnchor="middle" fontSize="36" fontWeight="900" fill="white">{totalCals}</text>
          <text x="100" y="112" textAnchor="middle" fontSize="12" fill="var(--text-light)">of {nutrition.calorieTarget} kcal</text>
          <text x="100" y="132" textAnchor="middle" fontSize="11" fill={remaining > 0 ? 'var(--green)' : 'var(--red)'} fontWeight="700">
            {remaining > 0 ? `${remaining} remaining` : 'Goal reached! 🎉'}
          </text>
        </svg>
      </div>
      <div className="macro-bars">
        {[
          { name:'Protein', val:totalMacro('protein'), goal:nutrition.protein, color:'#3DDC6B' },
          { name:'Carbs',   val:totalMacro('carbs'),   goal:nutrition.carbs,   color:'#36B9FF' },
          { name:'Fat',     val:totalMacro('fat'),      goal:nutrition.fat,     color:'#FF6B35' },
        ].map(m => (
          <div key={m.name} className="macro-bar-row">
            <div className="macro-bar-label">
              <span className="m-name">{m.name}</span>
              <span className="m-val">{m.val}g / {m.goal}g</span>
            </div>
            <div className="macro-bar-bg">
              <div className="macro-bar-fill" style={{ width:`${Math.min(100,(m.val/m.goal)*100)}%`, background:m.color }} />
            </div>
          </div>
        ))}
      </div>
      {meals.map(meal => (
        <div key={meal} className="meal-section-card">
          <div className="meal-section-header">
            <h3>{mealMeta[meal].icon} {mealMeta[meal].name}</h3>
            <span className="meal-cals">{mealCals(meal)} kcal</span>
          </div>
          {foodLog[meal].map((f, i) => (
            <div key={i} className="food-log-item">
              <div><div className="fi-name">{f.name}</div><div className="fi-serving">{f.serving}</div></div>
              <div style={{display:'flex',alignItems:'center'}}>
                <span className="fi-cal">{f.cal} kcal</span>
                <button className="fi-del" onClick={() => onRemoveFood(meal, i)}>✕</button>
              </div>
            </div>
          ))}
          <button className="add-food-btn" onClick={() => onOpenFoodModal(meal)}>＋ Add food</button>
        </div>
      ))}
      <div className="water-section">
      <div className="water-card">
        <h3>💧 Water Intake</h3>
        <p style={{fontSize:12,color:'var(--text-light)',marginBottom:10}}>{waterCups} / 8 cups</p>
        <div className="water-cups">
          {Array.from({length:8},(_,i) => (
            <button key={i} className={`water-cup ${i<waterCups?'filled':''}`} onClick={() => onWaterToggle(i)}>💧</button>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

// ── PLAN TAB ──
function PlanTab({ nutrition, planDay, onDayChange }) {
  const plan = MEAL_PLANS[planDay];
  return (
    <div className="tab-content">
      <div className="plan-header">
        <h2>Your Meal Plan</h2>
        <p>{nutrition.calorieTarget} kcal target · Personalised for you</p>
      </div>
      <div className="plan-day-tabs">
        {MEAL_PLANS.map((d, i) => (
          <button key={i} className={`day-tab ${i===planDay?'active':''}`} onClick={() => onDayChange(i)}>{d.name}</button>
        ))}
      </div>
      {plan.meals.map((m, i) => (
        <div key={i} className="plan-meal-card">
          <div className="plan-meal-header">
            <span className="pm-type">{m.type}</span>
            <span className="pm-cals">{m.cals} kcal</span>
          </div>
          {m.foods.map((f, j) => (
            <div key={j} className="plan-food-row">
              <span style={{fontSize:22}}>{f.emoji}</span>
              <span className="pf-name">{f.name}</span>
              <span className="pf-cal">{f.cal} kcal</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── INSIGHTS TAB ──
function InsightsTab({ nutrition, profile }) {
  return (
    <div className="tab-content">
      <div className="main-header"><h1>Insights</h1></div>
      <div style={{padding:'0 20px'}}>
        <div className="summary-card" style={{marginBottom:16}}>
          <h3>This Week</h3>
          {[
            { icon:'🔥', label:'Avg daily calories', val:`${Math.round(nutrition.calorieTarget*0.88).toLocaleString()} kcal` },
            { icon:'💪', label:'Avg protein intake',  val:`${nutrition.protein}g / day` },
            { icon:'🎯', label:'Goal adherence',       val:'88%' },
            { icon:'💧', label:'Avg water intake',     val:'6 cups / day' },
          ].map((r,i) => (
            <div key={i} className="summary-row" style={i===3?{marginBottom:0}:{}}>
              <span className="s-icon">{r.icon}</span>
              <div><div className="s-label">{r.label}</div><div className="s-val">{r.val}</div></div>
            </div>
          ))}
        </div>
        <div className="summary-card">
          <h3>Progress</h3>
          <div className="summary-row">
            <span className="s-icon">📉</span>
            <div><div className="s-label">Weight trend</div>
              <div className="s-val">{profile.goal==='lose'?'↓ On track to lose 1 lb/week':profile.goal==='gain'?'↑ On track to gain 0.5 lb/week':'→ Maintaining'}</div>
            </div>
          </div>
          <div className="summary-row" style={{marginBottom:0}}>
            <span className="s-icon">🏆</span>
            <div><div className="s-label">Streak</div><div className="s-val">3 days 🔥</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PROFILE TAB ──
function ProfileTab({ user, profile, nutrition, goalObj, actObj, onSignOut, showToast }) {
  const weightDisp = profile.weightUnit==='lbs' ? `${profile.weightLbs} lbs` : `${profile.weightKg} kg`;
  const heightDisp = profile.heightUnit==='ft'  ? `${profile.heightFt}'${profile.heightIn}"` : `${profile.heightCm} cm`;
  return (
    <div className="tab-content">
      <div className="profile-hero">
        <div className="profile-avatar">👤</div>
        <div className="profile-name">{user?.name || 'Your Profile'}</div>
        <div className="profile-goal">{goalObj.icon} {goalObj.name}</div>
      </div>
      <div className="profile-stats-row">
        <div className="profile-stat"><div className="ps-val">{nutrition.bmi}</div><div className="ps-label">BMI</div></div>
        <div className="profile-stat"><div className="ps-val">{weightDisp}</div><div className="ps-label">Weight</div></div>
        <div className="profile-stat"><div className="ps-val">{heightDisp}</div><div className="ps-label">Height</div></div>
      </div>
      <div className="settings-section">
        <h3>Nutrition Goals</h3>
        {[
          { icon:'🔥', name:'Daily Calories', val:`${nutrition.calorieTarget} kcal` },
          { icon:'🥩', name:'Protein',         val:`${nutrition.protein}g` },
          { icon:'🍞', name:'Carbohydrates',   val:`${nutrition.carbs}g` },
          { icon:'🧈', name:'Fat',             val:`${nutrition.fat}g` },
        ].map((s,i) => (
          <div key={i} className="settings-item">
            <div className="si-left"><span className="si-icon">{s.icon}</span><span className="si-name">{s.name}</span></div>
            <span className="si-val">{s.val}</span>
          </div>
        ))}
      </div>
      <div className="settings-section">
        <h3>My Details</h3>
        <div className="settings-item"><div className="si-left"><span className="si-icon">🎂</span><span className="si-name">Age</span></div><span className="si-val">{profile.age} years</span></div>
        <div className="settings-item"><div className="si-left"><span className="si-icon">⚡</span><span className="si-name">Activity Level</span></div><span className="si-val">{actObj.name}</span></div>
        <div className="settings-item" onClick={() => showToast('Edit profile coming soon!')}><div className="si-left"><span className="si-icon">✏️</span><span className="si-name">Edit Profile</span></div><span className="si-arrow">›</span></div>
      </div>
      <div className="settings-section">
        <h3>App</h3>
        <div className="settings-item" onClick={() => showToast('Notifications enabled!')}><div className="si-left"><span className="si-icon">🔔</span><span className="si-name">Reminders</span></div><span className="si-arrow">›</span></div>
        <div className="settings-item" onClick={onSignOut} style={{color:'#FF4757'}}>
          <div className="si-left"><span className="si-icon">🚪</span><span className="si-name" style={{color:'#FF4757'}}>Sign Out</span></div><span className="si-arrow" style={{color:'#FF4757'}}>›</span>
        </div>
      </div>
      <div style={{padding:'0 24px 40px',textAlign:'center'}}>
        <p style={{fontSize:12,color:'var(--text-light)'}}>Signed in as <b>{user?.email || 'guest'}</b></p>
        <p style={{fontSize:11,color:'var(--text-light)',marginTop:4}}>NutriAI v1.0 · Powered by Supabase</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// FOOD MODAL
// ════════════════════════════════════════════════
function FoodModal({ meal, onClose, onAdd }) {
  const [query, setQuery] = useState('');
  const results = FOOD_DB.filter(f =>
    f.name.toLowerCase().includes(query.toLowerCase()) ||
    f.brand.toLowerCase().includes(query.toLowerCase())
  );
  const display = query ? results : FOOD_DB;

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle" />
        <div className="modal-header">
          <h2>Add Food — {meal?.charAt(0).toUpperCase()+meal?.slice(1)}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="search-input-wrap">
          <span className="search-icon" style={{opacity:0.5}}>🔍</span>
          <input className="search-input" placeholder="Search food..." value={query} onChange={e=>setQuery(e.target.value)} autoFocus />
        </div>
        <div className="food-search-results">
          {display.map((f, i) => (
            <div key={i} className="food-result-item">
              <div>
                <div className="fr-name">{f.name}</div>
                <div className="fr-cal">{f.brand} · {f.cal} kcal · {f.serving}</div>
              </div>
              <button className="fr-add" onClick={() => onAdd(f)}>Add</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// SCANNER — powered by Google Cloud Vision
// ════════════════════════════════════════════════
function ScannerScreen({ onBack, onLog, showToast, userId }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const [results, setResults]           = useState([]);
  const [selected, setSelected]         = useState(null);
  const [status, setStatus]             = useState('idle');
  const [cameraReady, setCameraReady]   = useState(false);
  const [cameraError, setCameraError]   = useState(false);
  const [capturedDataUrl, setCapturedDataUrl] = useState(null);
  const [logMeal, setLogMeal]           = useState('lunch');
  const [scansRemaining, setScansRemaining] = useState(null);

  // Start camera
  useEffect(() => {
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            // Give the video a moment to render first frame
            setTimeout(() => setCameraReady(true), 500);
          };
        }
      } catch (e) {
        console.warn('Camera error:', e);
        setCameraError(true);
      }
    };
    start();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Step 1: Capture frame from video → show preview → then send to API
  const captureAndScan = async () => {
    setStatus('capturing');
    setResults([]);
    setSelected(null);
    setCapturedDataUrl(null);

    let base64Image = null;
    let useTestImage = false;
    let dataUrl = null;

    if (!cameraError && videoRef.current) {
      try {
        const video = videoRef.current;
        // Validate that video has real dimensions
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) throw new Error('Video dimensions not ready');

        const canvas = canvasRef.current;
        // Cap at 800px wide to keep base64 manageable for the API
        const scale  = Math.min(1, 800 / w);
        canvas.width  = Math.round(w * scale);
        canvas.height = Math.round(h * scale);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        dataUrl      = canvas.toDataURL('image/jpeg', 0.8);
        base64Image  = dataUrl.split(',')[1];

        console.log(`[Scanner] Captured frame: ${canvas.width}x${canvas.height}, base64 length: ${base64Image.length}`);

        // Show preview for 1 second so user can see what was captured
        setCapturedDataUrl(dataUrl);
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.warn('[Scanner] Frame capture failed:', e.message);
        useTestImage = true;
      }
    } else {
      useTestImage = true;
    }

    setStatus('scanning');

    try {
      const res = await fetch('/api/recognize-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Image, useTestImage, userId }),
      });

      const data = await res.json();

      if (data.limitReached) {
        setStatus('error');
        showToast(`⚠️ ${data.error}`);
        return;
      }

      if (!res.ok || data.error) throw new Error(data.error || 'Recognition failed');

      if (data.remaining !== undefined) setScansRemaining(data.remaining);

      const foodResults = data.results || [];
      setResults(foodResults);
      setSelected(foodResults[0] || null);
      setStatus(data.isTestImage ? 'done-test' : 'done');
    } catch (err) {
      console.error('[Scanner] API error:', err.message);
      setStatus('error');
      showToast(`❌ ${err.message}`);
    }
  };

  const reset = () => {
    setStatus('idle');
    setResults([]);
    setSelected(null);
    setCapturedDataUrl(null);
  };

  const handleLog = () => {
    if (!selected) return;
    onLog({ ...selected, meal: logMeal });
  };

  const isDone = status === 'done' || status === 'done-test';

  return (
    <div className="screen scanner-screen">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="scanner-header">
        <button className="btn-back" style={{ color: '#fff' }} onClick={onBack}>‹</button>
        <h2>Food Scanner</h2>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)' }}>Google Vision AI</div>
          {scansRemaining !== null && (
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: scansRemaining <= 2 ? '#FF6B35' : 'rgba(255,255,255,.7)',
            }}>
              {scansRemaining} scan{scansRemaining !== 1 ? 's' : ''} left today
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Live camera feed (always mounted so stream stays alive) */}
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraError ? 'none' : 'block' }}
          autoPlay playsInline muted
        />

        {/* Captured frame preview (shown briefly before API call) */}
        {capturedDataUrl && status === 'scanning' && (
          <img
            src={capturedDataUrl}
            alt="Captured"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
          />
        )}

        {/* No camera */}
        {cameraError && !isDone && (
          <div className="no-camera">
            <div style={{ fontSize: 60 }}>📷</div>
            <p style={{ fontSize: 16, fontWeight: 700 }}>Camera not available</p>
            <p style={{ fontSize: 14, opacity: .7, marginBottom: 12 }}>
              You can still test Google Vision AI with a sample food image.
            </p>
            <button className="btn-primary" style={{ maxWidth: 240 }}
              onClick={captureAndScan} disabled={status === 'scanning' || status === 'capturing'}>
              {status === 'scanning' ? '🔍 Analysing...' : '🤖 Test with Sample Food'}
            </button>
          </div>
        )}

        {/* Idle overlay */}
        {!cameraError && status === 'idle' && (
          <div className="scanner-overlay">
            <div className="scan-frame">{cameraReady && <div className="scan-line" />}</div>
            <p className="scan-hint">
              {cameraReady ? 'Centre your food in the frame, then tap Scan' : 'Starting camera...'}
            </p>
            {cameraReady && (
              <button onClick={captureAndScan} style={{
                background: 'var(--green)', color: '#fff', border: 'none',
                borderRadius: 30, padding: '14px 40px', fontSize: 17,
                fontWeight: 700, cursor: 'pointer', marginTop: 10,
                boxShadow: '0 4px 20px rgba(60,185,68,.6)',
              }}>
                📸 Scan Food
              </button>
            )}
          </div>
        )}

        {/* Capturing flash */}
        {status === 'capturing' && (
          <div className="scanner-overlay" style={{ background: 'rgba(255,255,255,.15)' }}>
            <div style={{ textAlign: 'center', color: '#fff' }}>
              <div style={{ fontSize: 52 }}>📸</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>Capturing...</div>
            </div>
          </div>
        )}

        {/* Analysing overlay */}
        {status === 'scanning' && (
          <div className="scanner-overlay" style={{ background: 'rgba(0,0,0,.65)' }}>
            <div style={{ textAlign: 'center', color: '#fff' }}>
              <div style={{ fontSize: 48, marginBottom: 14, animation: 'pulse 1s ease-in-out infinite' }}>🔍</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>Google Vision is analysing...</div>
              <div style={{ fontSize: 13, opacity: .7, marginTop: 6 }}>Identifying food & nutrients</div>
              {capturedDataUrl && (
                <div style={{ marginTop: 14, fontSize: 12, opacity: .6 }}>
                  ✅ Frame captured — sending to AI
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <div className="scanner-overlay" style={{ background: 'rgba(0,0,0,.7)' }}>
            <div style={{ textAlign: 'center', color: '#fff', padding: '0 30px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Couldn't identify food</div>
              <p style={{ fontSize: 13, opacity: .75, marginBottom: 20 }}>
                Try better lighting, hold the camera closer, or make sure just one dish is in frame.
              </p>
              <button onClick={reset} style={{
                background: 'var(--green)', color: '#fff', border: 'none',
                borderRadius: 24, padding: '12px 28px', fontSize: 15,
                fontWeight: 700, cursor: 'pointer',
              }}>Try Again</button>
            </div>
          </div>
        )}

        {/* Results */}
        {isDone && results.length > 0 && (
          <div className="scanner-result-card" style={{ maxHeight: '75vh', overflowY: 'auto' }}>

            {status === 'done-test' && (
              <div style={{ background:'rgba(255,193,7,.15)', border:'1px solid rgba(255,193,7,.3)', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#FFC107', marginBottom:12, display:'flex', gap:6 }}>
                <span>🧪</span><span>Demo result — allow camera access to scan your actual food.</span>
              </div>
            )}

            {/* Captured preview thumbnail */}
            {capturedDataUrl && status === 'done' && (
              <div style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', height: 80 }}>
                <img src={capturedDataUrl} alt="Scanned" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <h3 style={{ textTransform:'capitalize', fontSize:18 }}>{selected?.label}</h3>
              <span style={{ fontSize:12, background:'var(--green-dim)', color:'var(--green)', borderRadius:20, padding:'3px 10px', fontWeight:700 }}>
                {selected?.confidence}% match
              </span>
            </div>
            <div style={{ fontSize:13, color:'var(--text-light)', marginBottom:16 }}>{selected?.serving} · Google Vision AI</div>

            <div className="scanner-macros" style={{ marginBottom:16 }}>
              <div className="scanner-macro"><div className="sm-val" style={{color:'var(--green)'}}>{selected?.cal}</div><div className="sm-label">Cal</div></div>
              <div className="scanner-macro"><div className="sm-val" style={{color:'var(--green)'}}>{selected?.protein}g</div><div className="sm-label">Protein</div></div>
              <div className="scanner-macro"><div className="sm-val" style={{color:'var(--green)'}}>{selected?.carbs}g</div><div className="sm-label">Carbs</div></div>
              <div className="scanner-macro"><div className="sm-val" style={{color:'var(--green)'}}>{selected?.fat}g</div><div className="sm-label">Fat</div></div>
            </div>

            {results.length > 1 && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-light)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.5px' }}>
                  Other possibilities — tap to select
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {results.map((r, i) => (
                    <button key={i} onClick={() => setSelected(r)} style={{
                      padding:'6px 14px', borderRadius:20, fontSize:13, fontWeight:600, cursor:'pointer',
                      border:'1.5px solid', textTransform:'capitalize',
                      borderColor: selected?.label === r.label ? 'var(--green)' : 'var(--border)',
                      background: selected?.label === r.label ? 'var(--green-dim)' : 'var(--bg-card)',
                      color: selected?.label === r.label ? 'var(--green)' : 'var(--text)',
                    }}>
                      {r.label} <span style={{opacity:.55,fontSize:11}}>{r.confidence}%</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-light)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.5px' }}>Log to meal</div>
              <div style={{ display:'flex', gap:8 }}>
                {['breakfast','lunch','dinner','snacks'].map(m => (
                  <button key={m} onClick={() => setLogMeal(m)} style={{
                    flex:1, padding:'8px 4px', borderRadius:10, fontSize:12, fontWeight:700,
                    border:'1.5px solid', textTransform:'capitalize', cursor:'pointer',
                    borderColor: logMeal===m ? 'var(--green)' : 'var(--border)',
                    background: logMeal===m ? 'var(--green-dim)' : 'var(--bg-card)',
                    color: logMeal===m ? 'var(--green)' : 'var(--text-light)',
                  }}>{m}</button>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button className="btn-primary" style={{ flex:1 }} onClick={handleLog}>
                ✅ Log {selected?.label}
              </button>
              <button onClick={reset} style={{
                padding:'17px 16px', border:'1.5px solid var(--border)',
                borderRadius:14, background:'var(--bg-card)', cursor:'pointer', fontSize:18,
              }}>🔄</button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════
function getBmiHint(profile) {
  const wKg = profile.weightUnit==='kg' ? profile.weightKg : profile.weightLbs*0.453592;
  const hM  = profile.heightUnit==='cm' ? profile.heightCm/100 : profile.heightFt*0.3048+profile.heightIn*0.0254;
  if (!hM) return 'Enter your weight to calculate your BMI.';
  const bmi = Math.round((wKg/(hM*hM))*10)/10;
  if (bmi < 18.5) return `Your BMI is ${bmi} — Underweight. Let's build a healthy gain plan!`;
  if (bmi < 25)   return `Your BMI is ${bmi} — Great! You're in a healthy range.`;
  if (bmi < 30)   return `Your BMI is ${bmi} — Just a bit more effort and you'll get there!`;
  return `Your BMI is ${bmi} — We'll create a safe plan for you.`;
}
