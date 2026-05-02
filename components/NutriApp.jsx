'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { GOALS, ACTIVITIES, CONCERNS, DIETS, FOOD_DB, SCAN_FOODS, MEAL_PLANS } from '../lib/data';
import { calcNutrition } from '../lib/calculations';
import {
  loadProfile, saveProfile, dbRowToProfile, dbRowToNutrition,
  loadFoodLogs, addFoodLog, deleteFoodLog,
  loadWater, saveWater,
  loadWeightLogs, logWeight,
  loadStreak, updateStreak,
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
  const [authModal, setAuthModal]     = useState({ open:false, tab:'login' });
  const [foodModal, setFoodModal]     = useState({ open:false, meal:null });
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [streak, setStreak]           = useState({ current_streak:0, longest_streak:0, total_days:0 });
  const [weightLogs, setWeightLogs]   = useState([]);
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

      // Load today's food logs, water, streak and weight logs
      const [logs, cups, streakData, weightData] = await Promise.all([
        loadFoodLogs(authUser.id),
        loadWater(authUser.id),
        loadStreak(authUser.id),
        loadWeightLogs(authUser.id, 30),
      ]);
      setFoodLog(logs);
      setWaterCups(cups);
      setStreak(streakData);
      setWeightLogs(weightData);

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

  // ── AUTO-RECALCULATE when profile changes (after onboarding complete) ──
  useEffect(() => {
    if (screen === 'main' && profile.goal && profile.activityLevel) {
      const n = calcNutrition(profile);
      setNutrition(n);
      // Persist updated nutrition to DB
      if (user?.id) {
        saveProfile(user.id, profile, n, user.name).catch(console.error);
      }
    }
  }, [
    profile.gender, profile.goal, profile.age,
    profile.heightFt, profile.heightIn, profile.heightCm, profile.heightUnit,
    profile.weightLbs, profile.weightKg, profile.weightUnit,
    profile.targetWeightLbs, profile.targetWeightKg,
    profile.activityLevel,
  ]);

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
    // Save to DB + update streak
    if (user?.id) {
      const [dbId, newStreak] = await Promise.all([
        addFoodLog(user.id, meal, food),
        updateStreak(user.id),
      ]);
      if (newStreak) setStreak(newStreak);
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

      {/* EDIT PROFILE MODAL */}
      {editProfileOpen && (
        <EditProfileModal
          profile={profile}
          nutrition={nutrition}
          onClose={() => setEditProfileOpen(false)}
          onSave={(updatedProfile) => {
            setProfile(p => ({ ...p, ...updatedProfile }));
            setEditProfileOpen(false);
            showToast('✅ Profile updated! Calorie target recalculated.');
          }}
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
              onEditProfile={() => setEditProfileOpen(true)}
              streak={streak}
              weightLogs={weightLogs}
              onLogWeight={async (w, unit) => {
                const updated = [...weightLogs.filter(l => l.log_date !== new Date().toISOString().split('T')[0]),
                                 { log_date: new Date().toISOString().split('T')[0], weight: w, unit }]
                  .sort((a,b) => a.log_date.localeCompare(b.log_date));
                setWeightLogs(updated);
                if (user?.id) await logWeight(user.id, w, unit);
                showToast(`⚖️ Weight logged: ${w} ${unit}`);
              }}
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
  onWaterToggle, onSignOut, showToast, onEditProfile, streak, weightLogs, onLogWeight }) {

  const goalObj = GOALS.find(g => g.id === profile.goal) || GOALS[0];
  const actObj  = ACTIVITIES.find(a => a.id === profile.activityLevel) || ACTIVITIES[1];

  return (
    <div className="screen" style={{ display:'flex', flexDirection:'column' }}>
      {activeTab === 'home' && (
        <HomeTab foodLog={foodLog} nutrition={nutrition} totalCals={totalCals} totalMacro={totalMacro}
          mealCals={mealCals} waterCups={waterCups} onRemoveFood={onRemoveFood}
          onOpenFoodModal={onOpenFoodModal} onWaterToggle={onWaterToggle} user={user} />
      )}
      {activeTab === 'plan' && (
        <PlanTab nutrition={nutrition} planDay={planDay} onDayChange={onPlanDayChange} />
      )}
      {activeTab === 'insights' && (
        <InsightsTab nutrition={nutrition} profile={profile}
          streak={streak} weightLogs={weightLogs} onLogWeight={onLogWeight} />
      )}
      {activeTab === 'profile' && (
        <ProfileTab user={user} profile={profile} nutrition={nutrition}
          goalObj={goalObj} actObj={actObj} onSignOut={onSignOut} showToast={showToast}
          onEditProfile={onEditProfile} streak={streak} />
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
function HomeTab({ foodLog, nutrition, totalCals, totalMacro, mealCals, waterCups, onRemoveFood, onOpenFoodModal, onWaterToggle, user }) {
  const remaining = Math.max(0, nutrition.calorieTarget - totalCals);
  const pct = Math.min(100, (totalCals / nutrition.calorieTarget) * 100);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiLoading, setAiLoading]         = useState(false);
  const [aiExpanded, setAiExpanded]       = useState(false);

  const fetchSuggestions = async () => {
    setAiLoading(true);
    setAiExpanded(true);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calorieTarget: nutrition.calorieTarget,
          caloriesEaten: totalCals,
          proteinTarget: nutrition.protein,
          proteinEaten:  totalMacro('protein'),
          carbsTarget:   nutrition.carbs,
          carbsEaten:    totalMacro('carbs'),
          fatTarget:     nutrition.fat,
          fatEaten:      totalMacro('fat'),
        }),
      });
      const data = await res.json();
      setAiSuggestions(data);
    } catch (e) { console.error(e); }
    setAiLoading(false);
  };

  // Auto-fetch on mount
  useEffect(() => { fetchSuggestions(); }, []);
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const meals = ['breakfast','lunch','dinner','snacks'];
  const mealMeta = { breakfast:{icon:'🌅',name:'Breakfast'}, lunch:{icon:'🌞',name:'Lunch'}, dinner:{icon:'🌙',name:'Dinner'}, snacks:{icon:'🍎',name:'Snacks'} };

  return (
    <div className="tab-content">
      <div className="main-header">
        <div>
          <div style={{ fontSize:13, color:'var(--text-mid)', marginBottom:2 }}>
            {new Date().getHours() < 12 ? `Good Morning, ${user?.name?.split(' ')[0] || 'there'}! 🌅` : new Date().getHours() < 17 ? `Good Afternoon, ${user?.name?.split(' ')[0] || 'there'}! 🌞` : `Good Evening, ${user?.name?.split(' ')[0] || 'there'}! 🌙`}
          </div>
          <h1>Daily Nutrition</h1>
          <div className="date">{today}</div>
        </div>
        <button className="notif-btn">🔔</button>
      </div>
      <div className="stats-row">
        <div className="stat-card stat-card-orange">
          <div className="sc-icon">🔥</div>
          <div className="sc-label">Calories</div>
          <div className="sc-val">{totalCals}</div>
          <div className="sc-sub">/ {nutrition.calorieTarget} kcal</div>
        </div>
        <div className="stat-card stat-card-pink">
          <div className="sc-icon">💪</div>
          <div className="sc-label">Protein</div>
          <div className="sc-val">{totalMacro('protein')}g</div>
          <div className="sc-sub">/ {nutrition.protein}g</div>
        </div>
        <div className="stat-card stat-card-lime">
          <div className="sc-icon">🌾</div>
          <div className="sc-label">Carbs</div>
          <div className="sc-val" style={{color:'#111'}}>{totalMacro('carbs')}g</div>
          <div className="sc-sub" style={{color:'rgba(0,0,0,.5)'}}>/ {nutrition.carbs}g</div>
        </div>
      </div>
      <div className="calorie-ring-wrap">
        <svg width="200" height="200" viewBox="0 0 200 200">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C8FF57" />
              <stop offset="50%" stopColor="#FF6B9D" />
              <stop offset="100%" stopColor="#A855F7" />
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
          { name:'Protein', val:totalMacro('protein'), goal:nutrition.protein, color:'#FF6B9D' },
          { name:'Carbs',   val:totalMacro('carbs'),   goal:nutrition.carbs,   color:'#C8FF57' },
          { name:'Fat',     val:totalMacro('fat'),      goal:nutrition.fat,     color:'#A855F7' },
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
      {/* ── AI COACH CARD ── */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <div style={{ background: 'linear-gradient(135deg, #1a3d28 0%, #0f2418 100%)', border: '1px solid var(--border-green)', borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, background: 'var(--green-dim)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>AI Nutrition Coach</div>
                <div style={{ fontSize: 11, color: 'var(--text-mid)' }}>Personalised for you today</div>
              </div>
            </div>
            <button onClick={fetchSuggestions} style={{ background: 'var(--green-dim)', border: '1px solid var(--border-green)', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--green)', cursor: 'pointer' }}>
              {aiLoading ? '...' : '↻ Refresh'}
            </button>
          </div>
          {aiSuggestions?.coachMsg && (
            <div style={{ padding: '0 18px 12px', fontSize: 14, color: 'var(--text-mid)', fontStyle: 'italic', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
              "{aiSuggestions.coachMsg}"
            </div>
          )}
          {aiSuggestions?.insight && (
            <div style={{ margin: '10px 18px', background: 'rgba(255,255,255,.05)', borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{aiSuggestions.insight.icon}</span>
              <span style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5 }}>{aiSuggestions.insight.text}</span>
            </div>
          )}
          {aiLoading && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-mid)', fontSize: 13 }}>
              <div style={{ fontSize: 24, marginBottom: 8, animation: 'pulse 1s infinite' }}>🧠</div>
              Analysing your nutrition...
            </div>
          )}
          {!aiLoading && aiSuggestions?.suggestions && (
            <div style={{ padding: '4px 18px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10, marginTop: 8 }}>
                Suggested for you now
              </div>
              {aiSuggestions.suggestions.map((s, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28, flexShrink: 0 }}>{s.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-mid)', marginBottom: 4 }}>💡 {s.reason}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, background: 'rgba(61,220,107,.15)', color: 'var(--green)', borderRadius: 6, padding: '2px 8px', fontWeight: 700 }}>{s.cal} kcal</span>
                      <span style={{ fontSize: 11, color: 'var(--text-light)' }}>🥩 {s.protein}g</span>
                      <span style={{ fontSize: 11, color: 'var(--text-light)' }}>🍞 {s.carbs}g</span>
                      <span style={{ fontSize: 11, color: 'var(--text-light)' }}>🧈 {s.fat}g</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4 }}>✨ {s.tip}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
function InsightsTab({ nutrition, profile, streak, weightLogs, onLogWeight }) {
  const [weightInput, setWeightInput] = useState('');
  const [weightUnit, setWeightUnit]   = useState(profile.weightUnit || 'lbs');
  const [showWeightInput, setShowWeightInput] = useState(false);

  const handleLogWeight = () => {
    const w = parseFloat(weightInput);
    if (!w || w < 20 || w > 500) return;
    onLogWeight(w, weightUnit);
    setWeightInput('');
    setShowWeightInput(false);
  };

  // ── Weight Chart (SVG) ──
  const chartW = 320, chartH = 140, padL = 40, padR = 16, padT = 16, padB = 28;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const hasData = weightLogs.length >= 2;
  const vals    = weightLogs.map(l => parseFloat(l.weight));
  const minW    = hasData ? Math.min(...vals) - 2 : 60;
  const maxW    = hasData ? Math.max(...vals) + 2 : 180;

  const toX = (i) => padL + (i / (weightLogs.length - 1)) * innerW;
  const toY = (v) => padT + innerH - ((v - minW) / (maxW - minW)) * innerH;

  const pathD = hasData
    ? weightLogs.map((l, i) => `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(parseFloat(l.weight))}`).join(' ')
    : '';

  const areaD = hasData
    ? `${pathD} L ${toX(weightLogs.length-1)} ${padT+innerH} L ${toX(0)} ${padT+innerH} Z`
    : '';

  const targetWeight = profile.weightUnit === 'lbs' ? profile.targetWeightLbs : profile.targetWeightKg;
  const targetY      = hasData ? toY(targetWeight) : null;

  // ── Streak Badges ──
  const BADGES = [
    { days:1,   icon:'✅', label:'First Log',    color:'#3DDC6B' },
    { days:3,   icon:'🔥', label:'3-Day Streak', color:'#FF6B35' },
    { days:7,   icon:'💪', label:'1 Week',       color:'#36B9FF' },
    { days:14,  icon:'⭐', label:'2 Weeks',      color:'#FFC107' },
    { days:30,  icon:'🏆', label:'1 Month',      color:'#9C27B0' },
    { days:100, icon:'👑', label:'100 Days',     color:'#FFD700' },
  ];
  const current = streak?.current_streak || 0;
  const longest = streak?.longest_streak || 0;
  const total   = streak?.total_days     || 0;

  return (
    <div className="tab-content">
      <div className="main-header">
        <div><h1>Insights</h1><div className="date">Your progress overview</div></div>
      </div>

      {/* ── STREAK SECTION ── */}
      <div style={{ padding:'0 20px', marginBottom:20 }}>
        <div style={{ background:'linear-gradient(135deg,#1a3d28,#0f2418)', border:'1px solid var(--border-green)', borderRadius:18, padding:'18px 18px 14px' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:14 }}>Streak & Badges</div>

          {/* Streak stats */}
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            {[
              { icon:'🔥', val:current, label:'Current' },
              { icon:'🏆', val:longest, label:'Best' },
              { icon:'📅', val:total,   label:'Total Days' },
            ].map((s,i) => (
              <div key={i} style={{ flex:1, background:'rgba(255,255,255,.05)', borderRadius:14, padding:'12px 8px', textAlign:'center' }}>
                <div style={{ fontSize:22 }}>{s.icon}</div>
                <div style={{ fontSize:24, fontWeight:900, color:'var(--green)', lineHeight:1.1, marginTop:4 }}>{s.val}</div>
                <div style={{ fontSize:11, color:'var(--text-mid)', marginTop:3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Badge row */}
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>Badges</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {BADGES.map((b,i) => {
              const unlocked = total >= b.days;
              return (
                <div key={i} style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                  padding:'10px 12px', borderRadius:14, minWidth:60, textAlign:'center',
                  background: unlocked ? `${b.color}22` : 'rgba(255,255,255,.04)',
                  border:`1px solid ${unlocked ? b.color+'66' : 'rgba(255,255,255,.06)'}`,
                  opacity: unlocked ? 1 : 0.4,
                }}>
                  <span style={{ fontSize:24, filter: unlocked ? 'none' : 'grayscale(1)' }}>{b.icon}</span>
                  <span style={{ fontSize:10, fontWeight:700, color: unlocked ? b.color : 'var(--text-light)' }}>{b.label}</span>
                  {!unlocked && (
                    <span style={{ fontSize:9, color:'var(--text-light)' }}>{b.days - total}d left</span>
                  )}
                </div>
              );
            })}
          </div>

          {current > 0 && (
            <div style={{ marginTop:12, padding:'8px 12px', background:'rgba(61,220,107,.1)', borderRadius:10, fontSize:13, color:'var(--green)', textAlign:'center' }}>
              🔥 {current}-day streak! Keep it going!
            </div>
          )}
        </div>
      </div>

      {/* ── WEIGHT CHART ── */}
      <div style={{ padding:'0 20px', marginBottom:20 }}>
        <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:18, padding:'18px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>⚖️ Weight Progress</div>
              <div style={{ fontSize:12, color:'var(--text-mid)', marginTop:2 }}>Last 30 days</div>
            </div>
            <button onClick={() => setShowWeightInput(s=>!s)} style={{
              background:'var(--green-dim)', border:'1px solid var(--border-green)',
              borderRadius:20, padding:'6px 14px', fontSize:12, fontWeight:700,
              color:'var(--green)', cursor:'pointer',
            }}>+ Log Weight</button>
          </div>

          {/* Weight input */}
          {showWeightInput && (
            <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center' }}>
              <div className="unit-toggle" style={{ margin:0, flexShrink:0 }}>
                <button className={`unit-btn ${weightUnit==='lbs'?'active':''}`} onClick={() => setWeightUnit('lbs')}>lbs</button>
                <button className={`unit-btn ${weightUnit==='kg'?'active':''}`} onClick={() => setWeightUnit('kg')}>kg</button>
              </div>
              <input type="number" placeholder={`e.g. ${weightUnit==='lbs'?'165':'75'}`}
                value={weightInput} onChange={e => setWeightInput(e.target.value)}
                style={{ flex:1, padding:'10px 14px', borderRadius:12, border:'1px solid var(--border-green)', background:'var(--bg-input)', color:'var(--text)', fontSize:16, fontWeight:700, outline:'none' }}
              />
              <button onClick={handleLogWeight} style={{
                background:'var(--green)', border:'none', borderRadius:12,
                padding:'10px 16px', color:'#0B1612', fontWeight:700, fontSize:14, cursor:'pointer',
              }}>Save</button>
            </div>
          )}

          {/* SVG Chart */}
          {hasData ? (
            <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ overflow:'visible' }}>
              <defs>
                <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3DDC6B" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#3DDC6B" stopOpacity="0"/>
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[0,.25,.5,.75,1].map((t,i) => {
                const y = padT + innerH * t;
                const val = maxW - (maxW - minW) * t;
                return (
                  <g key={i}>
                    <line x1={padL} y1={y} x2={chartW-padR} y2={y} stroke="rgba(255,255,255,.06)" strokeWidth="1"/>
                    <text x={padL-6} y={y+4} fontSize="9" fill="var(--text-light)" textAnchor="end">{Math.round(val)}</text>
                  </g>
                );
              })}

              {/* Target weight line */}
              {targetY && targetY >= padT && targetY <= padT+innerH && (
                <g>
                  <line x1={padL} y1={targetY} x2={chartW-padR} y2={targetY} stroke="#FF6B35" strokeWidth="1.5" strokeDasharray="4 4"/>
                  <text x={chartW-padR+4} y={targetY+4} fontSize="9" fill="#FF6B35">Goal</text>
                </g>
              )}

              {/* Area fill */}
              <path d={areaD} fill="url(#wGrad)"/>

              {/* Line */}
              <path d={pathD} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>

              {/* Data points */}
              {weightLogs.map((l,i) => (
                <circle key={i} cx={toX(i)} cy={toY(parseFloat(l.weight))} r="4"
                  fill="var(--bg-card)" stroke="var(--green)" strokeWidth="2.5"/>
              ))}

              {/* Latest value label */}
              {weightLogs.length > 0 && (
                <text x={toX(weightLogs.length-1)} y={toY(parseFloat(weightLogs[weightLogs.length-1].weight))-10}
                  fontSize="11" fontWeight="700" fill="var(--green)" textAnchor="middle">
                  {weightLogs[weightLogs.length-1].weight} {weightUnit}
                </text>
              )}

              {/* X axis dates */}
              {weightLogs.length > 0 && [0, Math.floor((weightLogs.length-1)/2), weightLogs.length-1]
                .filter((v,i,a) => a.indexOf(v) === i)
                .map((idx) => (
                  <text key={idx} x={toX(idx)} y={chartH-4} fontSize="9" fill="var(--text-light)" textAnchor="middle">
                    {weightLogs[idx].log_date.slice(5)}
                  </text>
                ))
              }
            </svg>
          ) : (
            <div style={{ textAlign:'center', padding:'30px 20px', color:'var(--text-mid)' }}>
              <div style={{ fontSize:36, marginBottom:8 }}>⚖️</div>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--text)', marginBottom:4 }}>No weight data yet</div>
              <div style={{ fontSize:13 }}>Tap "+ Log Weight" above to start tracking your progress</div>
            </div>
          )}

          {/* Start / target weight */}
          {hasData && (
            <div style={{ display:'flex', gap:10, marginTop:12 }}>
              {[
                { label:'Starting', val:`${weightLogs[0].weight} ${weightUnit}`, color:'var(--text-mid)' },
                { label:'Current',  val:`${weightLogs[weightLogs.length-1].weight} ${weightUnit}`, color:'var(--green)' },
                { label:'Target',   val:`${targetWeight} ${weightUnit}`, color:'#FF6B35' },
              ].map((s,i) => (
                <div key={i} style={{ flex:1, background:'var(--bg-card2)', borderRadius:10, padding:'8px', textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'var(--text-light)', marginBottom:3 }}>{s.label}</div>
                  <div style={{ fontSize:13, fontWeight:800, color:s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── WEEKLY STATS ── */}
      <div style={{ padding:'0 20px', marginBottom:20 }}>
        <div className="summary-card">
          <h3>This Week</h3>
          {[
            { icon:'🔥', label:'Avg daily calories', val:`${Math.round(nutrition.calorieTarget*0.88).toLocaleString()} kcal` },
            { icon:'💪', label:'Avg protein intake', val:`${nutrition.protein}g / day` },
            { icon:'🎯', label:'Goal adherence',      val:'88%' },
            { icon:'💧', label:'Avg water intake',    val:'6 cups / day' },
          ].map((r,i,a) => (
            <div key={i} className="summary-row" style={i===a.length-1?{marginBottom:0}:{}}>
              <span className="s-icon">{r.icon}</span>
              <div><div className="s-label">{r.label}</div><div className="s-val">{r.val}</div></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PROFILE TAB ──
function ProfileTab({ user, profile, nutrition, goalObj, actObj, onSignOut, showToast, onEditProfile, streak }) {
  const weightDisp = profile.weightUnit==='lbs' ? `${profile.weightLbs} lbs` : `${profile.weightKg} kg`;
  const heightDisp = profile.heightUnit==='ft'  ? `${profile.heightFt}'${profile.heightIn}"` : `${profile.heightCm} cm`;
  return (
    <div className="tab-content">
      <div className="profile-hero">
        <div className="profile-avatar">👤</div>
        <div className="profile-name">{user?.name || 'Your Profile'}</div>
        <div className="profile-goal">{goalObj.icon} {goalObj.name}</div>
        {streak?.current_streak > 0 && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,107,53,.2)', border:'1px solid rgba(255,107,53,.4)', borderRadius:20, padding:'5px 14px', marginTop:10, fontSize:13, fontWeight:700, color:'#FF9060' }}>
            🔥 {streak.current_streak}-day streak
          </div>
        )}
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
        <div className="settings-item" onClick={onEditProfile}><div className="si-left"><span className="si-icon">✏️</span><span className="si-name">Edit Profile</span></div><span className="si-arrow">›</span></div>
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
// SCANNER — Photo (Google Vision) + Barcode (Open Food Facts)
// ════════════════════════════════════════════════
function ScannerScreen({ onBack, onLog, showToast, userId }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const detectorRef = useRef(null);
  const scanLoopRef = useRef(null);
  const [scanTab, setScanTab]           = useState('photo'); // 'photo' | 'barcode'
  const [results, setResults]           = useState([]);
  const [selected, setSelected]         = useState(null);
  const [status, setStatus]             = useState('idle');
  const [cameraReady, setCameraReady]   = useState(false);
  const [cameraError, setCameraError]   = useState(false);
  const [capturedDataUrl, setCapturedDataUrl] = useState(null);
  const [logMeal, setLogMeal]           = useState('lunch');
  const [scansRemaining, setScansRemaining] = useState(null);
  const [barcodeStatus, setBarcodeStatus] = useState('scanning'); // 'scanning'|'found'|'notfound'
  const [barcodeResult, setBarcodeResult] = useState(null);

  // Start camera — iOS Safari compatible
  useEffect(() => {
    const start = async () => {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('[Camera] getUserMedia not supported');
        setCameraError(true);
        return;
      }

      // iOS Safari needs simple constraints first
      const constraints = [
        // Try 1: Back camera with ideal constraints (most devices)
        { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        // Try 2: Back camera simple (iOS fallback)
        { video: { facingMode: 'environment' }, audio: false },
        // Try 3: Any camera (last resort)
        { video: true, audio: false },
      ];

      let stream = null;
      for (const constraint of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraint);
          console.log('[Camera] Started with constraint:', JSON.stringify(constraint.video));
          break;
        } catch (e) {
          console.warn('[Camera] Constraint failed:', e.name, e.message);
        }
      }

      if (!stream) {
        console.warn('[Camera] All constraints failed');
        setCameraError(true);
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // iOS Safari requires these attributes
        videoRef.current.setAttribute('autoplay', '');
        videoRef.current.setAttribute('playsinline', '');
        videoRef.current.setAttribute('muted', '');
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().then(() => {
            setTimeout(() => setCameraReady(true), 600);
          }).catch(e => {
            console.warn('[Camera] Play failed:', e);
            // Try playing without waiting
            setCameraReady(true);
          });
        };
        // iOS fallback if onloadedmetadata doesn't fire
        setTimeout(() => {
          if (!cameraReady && stream.active) {
            videoRef.current?.play().catch(() => {});
            setCameraReady(true);
          }
        }, 3000);
      }
    };
    start();
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
    };
  }, []);

  // ── Switch tab: start/stop barcode loop ──
  useEffect(() => {
    if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
    if (scanTab === 'barcode' && cameraReady) {
      setBarcodeStatus('scanning');
      setBarcodeResult(null);
      startBarcodeLoop();
    }
  }, [scanTab, cameraReady]);

  // ── Barcode detection loop using BarcodeDetector API ──
  const startBarcodeLoop = () => {
    if (!('BarcodeDetector' in window)) {
      setBarcodeStatus('unsupported');
      return;
    }
    if (!detectorRef.current) {
      detectorRef.current = new window.BarcodeDetector({
        formats: ['ean_13','ean_8','upc_a','upc_e','code_128','code_39','qr_code'],
      });
    }
    const detect = async () => {
      if (scanTab !== 'barcode') return;
      try {
        if (videoRef.current && videoRef.current.readyState === 4) {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            console.log('[Barcode] Detected:', code);
            setBarcodeStatus('found');
            lookupBarcode(code);
            return; // stop loop after detection
          }
        }
      } catch (e) { /* continue */ }
      scanLoopRef.current = requestAnimationFrame(detect);
    };
    scanLoopRef.current = requestAnimationFrame(detect);
  };

  // ── Look up barcode on Open Food Facts ──
  const lookupBarcode = async (code) => {
    setBarcodeStatus('loading');
    try {
      const res  = await fetch(`/api/barcode?code=${code}`);
      const data = await res.json();
      if (data.found) {
        setBarcodeResult(data);
        setBarcodeStatus('found');
      } else {
        setBarcodeStatus('notfound');
        showToast('❌ Product not found. Try searching manually.');
      }
    } catch (e) {
      setBarcodeStatus('notfound');
      showToast('❌ Barcode lookup failed.');
    }
  };

  const resetBarcode = () => {
    setBarcodeResult(null);
    setBarcodeStatus('scanning');
    startBarcodeLoop();
  };

  const handleBarcodeLog = () => {
    if (!barcodeResult) return;
    onLog({ ...barcodeResult, meal: logMeal });
  };

  // ── Tab switch helper ──
  const switchScanTab = (tab) => {
    setScanTab(tab);
    setStatus('idle');
    setResults([]);
    setSelected(null);
    setCapturedDataUrl(null);
  };

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

      {/* Header */}
      <div className="scanner-header">
        <button className="btn-back" style={{ color: '#fff' }} onClick={onBack}>‹</button>
        <h2>Food Scanner</h2>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)' }}>
            {scanTab === 'photo' ? 'Google Vision AI' : 'Open Food Facts'}
          </div>
          {scanTab === 'photo' && scansRemaining !== null && (
            <div style={{ fontSize: 11, fontWeight: 700, color: scansRemaining <= 2 ? '#FF6B35' : 'rgba(255,255,255,.7)' }}>
              {scansRemaining} scan{scansRemaining !== 1 ? 's' : ''} left today
            </div>
          )}
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{ display:'flex', gap:8, padding:'10px 16px', background:'rgba(0,0,0,.5)', backdropFilter:'blur(10px)' }}>
        {[['photo','📸 Photo','AI Vision'],['barcode','🔲 Barcode','Instant scan']].map(([id,label,sub]) => (
          <button key={id} onClick={() => switchScanTab(id)} style={{
            flex:1, padding:'10px 8px', borderRadius:14, border:'1.5px solid',
            borderColor: scanTab===id ? 'var(--green)' : 'rgba(255,255,255,.1)',
            background: scanTab===id ? 'rgba(61,220,107,.15)' : 'rgba(255,255,255,.05)',
            cursor:'pointer', textAlign:'center',
          }}>
            <div style={{ fontSize:14, fontWeight:700, color: scanTab===id ? 'var(--green)' : '#fff' }}>{label}</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.5)', marginTop:2 }}>{sub}</div>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Live camera feed — always mounted so stream stays alive */}
        <video
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraError ? 'none' : 'block' }}
          autoPlay playsInline muted
          webkit-playsinline="true"
        />

        {/* Captured frame preview (shown briefly before API call) */}
        {capturedDataUrl && status === 'scanning' && (
          <img
            src={capturedDataUrl}
            alt="Captured"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
          />
        )}

        {/* ── PHOTO TAB OVERLAYS ── */}
        {/* No camera */}
        {scanTab === 'photo' && cameraError && !isDone && (
          <div className="no-camera">
            <div style={{ fontSize: 52 }}>📷</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Camera access needed</p>

            {/* iOS specific instructions */}
            <div style={{ background:'rgba(255,255,255,.06)', borderRadius:14, padding:'12px 16px', marginBottom:14, textAlign:'left', maxWidth:300 }}>
              <p style={{ fontSize:13, fontWeight:700, color:'var(--lime)', marginBottom:8 }}>📱 iPhone — Allow camera:</p>
              <p style={{ fontSize:12, color:'rgba(255,255,255,.7)', lineHeight:1.6 }}>
                1. Open <b>Settings</b> → <b>Safari</b><br/>
                2. Tap <b>Camera</b> → select <b>Allow</b><br/>
                3. Come back and reload the page
              </p>
            </div>

            <div style={{ background:'rgba(255,255,255,.06)', borderRadius:14, padding:'12px 16px', marginBottom:16, textAlign:'left', maxWidth:300 }}>
              <p style={{ fontSize:13, fontWeight:700, color:'var(--lime)', marginBottom:8 }}>🤖 Or test with AI sample:</p>
              <p style={{ fontSize:12, color:'rgba(255,255,255,.7)' }}>Try the scanner with a sample food image</p>
            </div>

            <button className="btn-primary" style={{ maxWidth: 260 }}
              onClick={captureAndScan} disabled={status === 'scanning' || status === 'capturing'}>
              {status === 'scanning' ? '🔍 Analysing...' : '🤖 Test AI Recognition'}
            </button>
          </div>
        )}

        {/* Idle overlay */}
        {scanTab === 'photo' && !cameraError && status === 'idle' && (
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
        {scanTab === 'photo' && status === 'capturing' && (
          <div className="scanner-overlay" style={{ background: 'rgba(255,255,255,.15)' }}>
            <div style={{ textAlign: 'center', color: '#fff' }}>
              <div style={{ fontSize: 52 }}>📸</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>Capturing...</div>
            </div>
          </div>
        )}

        {/* Analysing overlay */}
        {scanTab === 'photo' && status === 'scanning' && (
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
        {scanTab === 'photo' && status === 'error' && (
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

        {/* Photo Results */}
        {scanTab === 'photo' && isDone && results.length > 0 && (
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
              <div className="scanner-macro"><div className="sm-val" style={{color:'var(--orange)'}}>{selected?.cal}</div><div className="sm-label">Cal</div></div>
              <div className="scanner-macro"><div className="sm-val" style={{color:'var(--pink)'}}>{selected?.protein}g</div><div className="sm-label">Protein</div></div>
              <div className="scanner-macro"><div className="sm-val" style={{color:'var(--lime)'}}>{selected?.carbs}g</div><div className="sm-label">Carbs</div></div>
              <div className="scanner-macro"><div className="sm-val" style={{color:'var(--purple)'}}>{selected?.fat}g</div><div className="sm-label">Fat</div></div>
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

        {/* ── BARCODE TAB ── */}
        {scanTab === 'barcode' && !barcodeResult && (
          <div className="scanner-overlay">
            {/* Barcode frame — wider, shorter */}
            <div style={{
              width: 300, height: 140, borderRadius: 16,
              border: '2px solid var(--green)',
              boxShadow: '0 0 0 9999px rgba(0,0,0,.5), 0 0 30px rgba(61,220,107,.3)',
              position: 'relative',
            }}>
              {/* Animated scan line */}
              <div style={{
                position:'absolute', left:6, right:6, height:2,
                background:'linear-gradient(90deg,transparent,var(--green),transparent)',
                animation:'scanMove 1.5s ease-in-out infinite',
                boxShadow:'0 0 8px var(--green)',
              }} />
              {/* Corner marks */}
              {[[0,0],[1,0],[0,1],[1,1]].map(([r,b],i) => (
                <div key={i} style={{
                  position:'absolute', width:20, height:20,
                  top: r ? 'auto' : -2, bottom: r ? -2 : 'auto',
                  left: b ? 'auto' : -2, right: b ? -2 : 'auto',
                  borderTop: r ? 'none' : '3px solid var(--green)',
                  borderBottom: r ? '3px solid var(--green)' : 'none',
                  borderLeft: b ? 'none' : '3px solid var(--green)',
                  borderRight: b ? '3px solid var(--green)' : 'none',
                  borderRadius: r===0&&b===0?'4px 0 0 0':r===0&&b===1?'0 4px 0 0':r===1&&b===0?'0 0 0 4px':'0 0 4px 0',
                }}/>
              ))}
            </div>
            <p style={{ color:'rgba(255,255,255,.8)', fontSize:14, textAlign:'center', marginTop:12 }}>
              {barcodeStatus === 'loading' ? '🔍 Looking up product...' :
               barcodeStatus === 'unsupported' ? '⚠️ Barcode detection not supported on this browser' :
               'Point at a product barcode'}
            </p>
            {barcodeStatus === 'unsupported' && (
              <p style={{ color:'rgba(255,255,255,.5)', fontSize:12, textAlign:'center', padding:'0 40px', marginTop:6 }}>
                Try Chrome on Android for best results
              </p>
            )}
          </div>
        )}

        {/* Barcode result card */}
        {scanTab === 'barcode' && barcodeResult && (
          <div className="scanner-result-card" style={{ maxHeight:'75vh', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              {barcodeResult.image && (
                <img src={barcodeResult.image} alt={barcodeResult.name}
                  style={{ width:60, height:60, objectFit:'contain', borderRadius:10, background:'#fff', padding:4 }} />
              )}
              <div style={{ flex:1 }}>
                <h3 style={{ fontSize:17, marginBottom:2 }}>{barcodeResult.name}</h3>
                <div style={{ fontSize:13, color:'var(--text-light)' }}>
                  {barcodeResult.brand} · {barcodeResult.serving}
                </div>
              </div>
              <div style={{ background:'var(--green-dim)', border:'1px solid var(--border-green)', borderRadius:20, padding:'4px 10px' }}>
                <div style={{ fontSize:11, color:'var(--green)', fontWeight:700 }}>🔲 Scanned</div>
              </div>
            </div>

            <div className="scanner-macros" style={{ marginBottom:16 }}>
              <div className="scanner-macro"><div className="sm-val" style={{color:'var(--orange)'}}>{barcodeResult.cal}</div><div className="sm-label">Cal</div></div>
              <div className="scanner-macro"><div className="sm-val" style={{color:'var(--pink)'}}>{barcodeResult.protein}g</div><div className="sm-label">Protein</div></div>
              <div className="scanner-macro"><div className="sm-val" style={{color:'var(--lime)'}}>{barcodeResult.carbs}g</div><div className="sm-label">Carbs</div></div>
              <div className="scanner-macro"><div className="sm-val" style={{color:'var(--purple)'}}>{barcodeResult.fat}g</div><div className="sm-label">Fat</div></div>
            </div>

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
              <button className="btn-primary" style={{ flex:1 }} onClick={handleBarcodeLog}>
                ✅ Log {barcodeResult.name}
              </button>
              <button onClick={resetBarcode} style={{
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
// ════════════════════════════════════════════════
// EDIT PROFILE MODAL
// ════════════════════════════════════════════════
function EditProfileModal({ profile, nutrition, onClose, onSave }) {
  const [local, setLocal] = useState({ ...profile });
  const upd = (k, v) => setLocal(p => ({ ...p, [k]: v }));

  // Live preview of new calorie target
  const preview = calcNutrition(local);

  const fields = [
    { label: 'Current Weight', type: 'weight',   key: 'weightLbs',   keyKg: 'weightKg',   unitKey: 'weightUnit' },
    { label: 'Target Weight',  type: 'weight',   key: 'targetWeightLbs', keyKg: 'targetWeightKg', unitKey: 'targetWeightUnit' },
    { label: 'Age',            type: 'number',   key: 'age',          min: 8,  max: 90 },
  ];

  return (
    <div className="auth-modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="auth-modal-sheet">
        <div className="auth-modal-handle" />
        <div className="auth-modal-scroll">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
            <div className="auth-title">Edit Profile</div>
            <button onClick={onClose} style={{ background:'var(--bg-card2)', border:'1px solid var(--border)', borderRadius:8, width:30, height:30, color:'var(--text-light)', cursor:'pointer', fontSize:14 }}>✕</button>
          </div>
          <div className="auth-sub" style={{ marginBottom:16 }}>Changes instantly recalculate your calorie target</div>

          {/* Goal */}
          <div className="input-group">
            <label className="input-label">Main Goal</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {GOALS.map(g => (
                <button key={g.id} onClick={() => upd('goal', g.id)} style={{
                  padding:'8px 14px', borderRadius:20, fontSize:13, fontWeight:700, cursor:'pointer',
                  border:'1.5px solid', borderColor: local.goal===g.id ? 'var(--green)' : 'var(--border)',
                  background: local.goal===g.id ? 'var(--green-dim)' : 'var(--bg-card2)',
                  color: local.goal===g.id ? 'var(--green)' : 'var(--text-mid)',
                }}>{g.icon} {g.name}</button>
              ))}
            </div>
          </div>

          {/* Activity Level */}
          <div className="input-group">
            <label className="input-label">Activity Level</label>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {ACTIVITIES.map(a => (
                <div key={a.id} onClick={() => upd('activityLevel', a.id)} style={{
                  padding:'12px 14px', borderRadius:12, cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                  border:'1.5px solid', borderColor: local.activityLevel===a.id ? 'var(--green)' : 'var(--border)',
                  background: local.activityLevel===a.id ? 'var(--green-dim)' : 'var(--bg-card2)',
                }}>
                  <span style={{fontSize:20}}>{a.icon}</span>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:'var(--text)'}}>{a.name}</div>
                    <div style={{fontSize:12,color:'var(--text-mid)'}}>{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weight */}
          <div className="input-group">
            <label className="input-label">Current Weight</label>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <div className="unit-toggle" style={{ margin:0 }}>
                <button className={`unit-btn ${local.weightUnit==='lbs'?'active':''}`} onClick={() => upd('weightUnit','lbs')}>lbs</button>
                <button className={`unit-btn ${local.weightUnit==='kg'?'active':''}`} onClick={() => upd('weightUnit','kg')}>kg</button>
              </div>
              <input type="number" value={local.weightUnit==='lbs'?local.weightLbs:local.weightKg}
                onChange={e => {
                  const v = parseInt(e.target.value)||0;
                  local.weightUnit==='lbs' ? upd('weightLbs',v) : upd('weightKg',v);
                }}
                style={{ flex:1, padding:'12px 14px', borderRadius:12, border:'1px solid var(--border)', background:'var(--bg-input)', color:'var(--text)', fontSize:16, fontWeight:700, outline:'none' }}
              />
            </div>
          </div>

          {/* Age */}
          <div className="input-group">
            <label className="input-label">Age</label>
            <input type="number" value={local.age} min={8} max={90}
              onChange={e => upd('age', parseInt(e.target.value)||25)}
              style={{ padding:'12px 14px', borderRadius:12, border:'1px solid var(--border)', background:'var(--bg-input)', color:'var(--text)', fontSize:16, fontWeight:700, outline:'none', width:'100%' }}
            />
          </div>

          {/* Live preview */}
          <div style={{ background:'linear-gradient(135deg,#1a3d28,#0f2418)', border:'1px solid var(--border-green)', borderRadius:16, padding:'16px 18px' }}>
            <div style={{ fontSize:12, color:'var(--text-mid)', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>New Calorie Target Preview</div>
            <div style={{ fontSize:36, fontWeight:900, color:'var(--green)', letterSpacing:-1 }}>{preview.calorieTarget.toLocaleString()}</div>
            <div style={{ fontSize:13, color:'var(--text-mid)', marginTop:4 }}>kcal / day</div>
            <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
              {[['🥩',preview.protein,'g protein'],['🍞',preview.carbs,'g carbs'],['🧈',preview.fat,'g fat']].map(([icon,val,label],i) => (
                <span key={i} style={{ background:'rgba(255,255,255,.07)', borderRadius:16, padding:'4px 12px', fontSize:12, fontWeight:700, color:'var(--text)' }}>{icon} {val}{label}</span>
              ))}
            </div>
            {preview.calorieTarget !== nutrition?.calorieTarget && (
              <div style={{ fontSize:12, color:'var(--green)', marginTop:8 }}>
                {preview.calorieTarget > nutrition?.calorieTarget ? '↑' : '↓'} {Math.abs(preview.calorieTarget - nutrition?.calorieTarget)} kcal change from current
              </div>
            )}
          </div>

          <button className="btn-primary" onClick={() => onSave(local)}>
            Save & Recalculate ✓
          </button>
        </div>
      </div>
    </div>
  );
}

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
