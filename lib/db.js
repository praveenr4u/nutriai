import { supabase } from './supabase';

const today = () => new Date().toISOString().split('T')[0];

// ─────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────

export async function loadProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') console.error('[DB] loadProfile:', error.message);
  return data || null;
}

export async function saveProfile(userId, profile, nutrition, userName) {
  const row = {
    id:                 userId,
    full_name:          userName,
    gender:             profile.gender,
    goal:               profile.goal,
    age:                profile.age,
    height_unit:        profile.heightUnit,
    height_ft:          profile.heightFt,
    height_in:          profile.heightIn,
    height_cm:          profile.heightCm,
    weight_unit:        profile.weightUnit,
    weight_lbs:         profile.weightLbs,
    weight_kg:          profile.weightKg,
    target_weight_unit: profile.targetWeightUnit,
    target_weight_lbs:  profile.targetWeightLbs,
    target_weight_kg:   profile.targetWeightKg,
    activity_level:     profile.activityLevel,
    health_concerns:    profile.healthConcerns,
    diet_prefs:         profile.dietPrefs,
    calorie_target:     nutrition?.calorieTarget,
    protein_target:     nutrition?.protein,
    carbs_target:       nutrition?.carbs,
    fat_target:         nutrition?.fat,
    onboarding_done:    true,
  };

  const { error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'id' });

  if (error) console.error('[DB] saveProfile:', error.message);
  return !error;
}

// Convert DB row → app profile shape
export function dbRowToProfile(row) {
  if (!row) return null;
  return {
    gender:           row.gender,
    goal:             row.goal,
    age:              row.age            ?? 25,
    heightUnit:       row.height_unit    ?? 'ft',
    heightFt:         row.height_ft      ?? 5,
    heightIn:         row.height_in      ?? 7,
    heightCm:         row.height_cm      ?? 170,
    weightUnit:       row.weight_unit    ?? 'lbs',
    weightLbs:        row.weight_lbs     ?? 165,
    weightKg:         row.weight_kg      ?? 75,
    targetWeightUnit: row.target_weight_unit ?? 'lbs',
    targetWeightLbs:  row.target_weight_lbs  ?? 150,
    targetWeightKg:   row.target_weight_kg   ?? 68,
    activityLevel:    row.activity_level,
    healthConcerns:   row.health_concerns ?? [],
    dietPrefs:        row.diet_prefs     ?? [],
  };
}

// Convert DB row → nutrition shape
export function dbRowToNutrition(row) {
  if (!row || !row.calorie_target) return null;
  return {
    calorieTarget: row.calorie_target,
    protein:       row.protein_target,
    carbs:         row.carbs_target,
    fat:           row.fat_target,
    bmi:           0,
    bmr:           0,
    tdee:          0,
  };
}

// ─────────────────────────────────────────────
// FOOD LOGS
// ─────────────────────────────────────────────

export async function loadFoodLogs(userId, date = today()) {
  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', date)
    .order('created_at', { ascending: true });

  if (error) { console.error('[DB] loadFoodLogs:', error.message); return {}; }

  // Group by meal
  const grouped = { breakfast: [], lunch: [], dinner: [], snacks: [] };
  for (const row of (data || [])) {
    const meal = row.meal;
    if (grouped[meal]) {
      grouped[meal].push({
        dbId:    row.id,
        name:    row.food_name,
        cal:     row.calories,
        protein: Number(row.protein),
        carbs:   Number(row.carbs),
        fat:     Number(row.fat),
        serving: row.serving,
      });
    }
  }
  return grouped;
}

export async function addFoodLog(userId, meal, food, date = today()) {
  const { data, error } = await supabase
    .from('food_logs')
    .insert({
      user_id:   userId,
      log_date:  date,
      meal,
      food_name: food.name || food.label,
      calories:  food.cal,
      protein:   food.protein ?? 0,
      carbs:     food.carbs   ?? 0,
      fat:       food.fat     ?? 0,
      serving:   food.serving ?? '',
    })
    .select('id')
    .single();

  if (error) { console.error('[DB] addFoodLog:', error.message); return null; }
  return data?.id;
}

export async function deleteFoodLog(dbId) {
  const { error } = await supabase
    .from('food_logs')
    .delete()
    .eq('id', dbId);
  if (error) console.error('[DB] deleteFoodLog:', error.message);
  return !error;
}

// ─────────────────────────────────────────────
// WATER
// ─────────────────────────────────────────────

export async function loadWater(userId, date = today()) {
  const { data, error } = await supabase
    .from('water_logs')
    .select('cups')
    .eq('user_id', userId)
    .eq('log_date', date)
    .single();
  if (error && error.code !== 'PGRST116') console.error('[DB] loadWater:', error.message);
  return data?.cups ?? 0;
}

export async function saveWater(userId, cups, date = today()) {
  const { error } = await supabase
    .from('water_logs')
    .upsert({ user_id: userId, log_date: date, cups, updated_at: new Date().toISOString() },
             { onConflict: 'user_id,log_date' });
  if (error) console.error('[DB] saveWater:', error.message);
}

// ─────────────────────────────────────────────
// WEIGHT LOGS
// ─────────────────────────────────────────────

export async function loadWeightLogs(userId, days = 30) {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const { data, error } = await supabase
    .from('weight_logs')
    .select('log_date, weight, unit')
    .eq('user_id', userId)
    .gte('log_date', from.toISOString().split('T')[0])
    .order('log_date', { ascending: true });
  if (error) { console.error('[DB] loadWeightLogs:', error.message); return []; }
  return data || [];
}

export async function logWeight(userId, weight, unit = 'lbs', date = today()) {
  const { error } = await supabase
    .from('weight_logs')
    .upsert({ user_id: userId, log_date: date, weight, unit },
             { onConflict: 'user_id,log_date' });
  if (error) console.error('[DB] logWeight:', error.message);
  return !error;
}

// ─────────────────────────────────────────────
// STREAKS
// ─────────────────────────────────────────────

export async function loadStreak(userId) {
  const { data, error } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') console.error('[DB] loadStreak:', error.message);
  return data || { current_streak: 0, longest_streak: 0, total_days: 0 };
}

export async function updateStreak(userId) {
  const todayStr  = today();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];

  const existing = await loadStreak(userId);
  let { current_streak = 0, longest_streak = 0, total_days = 0, last_log_date } = existing;

  if (last_log_date === todayStr) return existing; // already updated today

  if (last_log_date === yStr) {
    current_streak += 1; // consecutive day
  } else {
    current_streak = 1;  // streak broken or first day
  }

  longest_streak = Math.max(longest_streak, current_streak);
  total_days     += 1;

  const { error } = await supabase
    .from('streaks')
    .upsert({ user_id: userId, current_streak, longest_streak, total_days,
              last_log_date: todayStr, updated_at: new Date().toISOString() },
             { onConflict: 'user_id' });

  if (error) console.error('[DB] updateStreak:', error.message);
  return { current_streak, longest_streak, total_days, last_log_date: todayStr };
}
