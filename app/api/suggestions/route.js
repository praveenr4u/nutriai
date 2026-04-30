import { NextResponse } from 'next/server';

// ── Meal suggestion database ──
const MEALS = {
  highProtein: [
    { name: 'Grilled Chicken & Quinoa Bowl', cal: 420, protein: 45, carbs: 32, fat: 8,  emoji: '🍗', reason: 'High protein boost', tip: 'Add lemon juice for extra flavour' },
    { name: 'Greek Yogurt Parfait', cal: 280, protein: 22, carbs: 28, fat: 6,  emoji: '🍦', reason: 'Quick protein fix', tip: 'Top with nuts for healthy fats' },
    { name: 'Tuna Salad Wrap', cal: 350, protein: 35, carbs: 30, fat: 9,  emoji: '🫓', reason: 'Lean protein + carbs', tip: 'Use whole wheat wrap' },
    { name: 'Egg White Omelette', cal: 180, protein: 24, carbs: 3,  fat: 6,  emoji: '🍳', reason: 'Pure protein meal', tip: 'Add spinach for iron' },
    { name: 'Salmon & Steamed Veg', cal: 380, protein: 38, carbs: 15, fat: 18, emoji: '🐟', reason: 'Protein + omega-3s', tip: 'Season with dill and lemon' },
    { name: 'Cottage Cheese Bowl', cal: 220, protein: 28, carbs: 8,  fat: 5,  emoji: '🥛', reason: 'Casein protein snack', tip: 'Great before bed' },
  ],
  highCarb: [
    { name: 'Oatmeal with Banana', cal: 310, protein: 8,  carbs: 58, fat: 4,  emoji: '🥣', reason: 'Complex carbs for energy', tip: 'Add cinnamon to boost metabolism' },
    { name: 'Brown Rice & Vegetables', cal: 350, protein: 8,  carbs: 68, fat: 3,  emoji: '🍚', reason: 'Sustained energy', tip: 'Use 1 cup cooked brown rice' },
    { name: 'Whole Wheat Pasta', cal: 380, protein: 14, carbs: 72, fat: 4,  emoji: '🍝', reason: 'Complex carbs + fibre', tip: 'Top with tomato sauce' },
    { name: 'Sweet Potato & Beans', cal: 320, protein: 12, carbs: 60, fat: 2,  emoji: '🍠', reason: 'Carbs + plant protein', tip: 'Drizzle with olive oil' },
  ],
  lowCalorie: [
    { name: 'Garden Salad', cal: 80,  protein: 4,  carbs: 10, fat: 3,  emoji: '🥗', reason: 'Light & filling', tip: 'Use lemon dressing to save calories' },
    { name: 'Veggie Soup', cal: 120, protein: 6,  carbs: 18, fat: 2,  emoji: '🍲', reason: 'Filling, very low cal', tip: 'Add legumes for protein' },
    { name: 'Apple & Almonds', cal: 160, protein: 4,  carbs: 22, fat: 8,  emoji: '🍎', reason: 'Smart snack combo', tip: '10-12 almonds is one serving' },
    { name: 'Cucumber & Hummus', cal: 100, protein: 4,  carbs: 12, fat: 4,  emoji: '🥒', reason: 'Zero-guilt snack', tip: 'Use 2 tbsp hummus' },
  ],
  balanced: [
    { name: 'Chicken Caesar Salad', cal: 380, protein: 32, carbs: 18, fat: 18, emoji: '🥗', reason: 'Perfect macro balance', tip: 'Ask for dressing on the side' },
    { name: 'Veggie Stir Fry & Rice', cal: 420, protein: 18, carbs: 55, fat: 12, emoji: '🥘', reason: 'Well-rounded meal', tip: 'Use coconut aminos instead of soy' },
    { name: 'Turkey & Avocado Bowl', cal: 450, protein: 35, carbs: 28, fat: 20, emoji: '🫙', reason: 'Balanced nutrition', tip: 'Half an avocado is perfect' },
    { name: 'Lentil & Spinach Curry', cal: 340, protein: 20, carbs: 45, fat: 8,  emoji: '🍛', reason: 'Plant-based balance', tip: 'Serve with brown rice' },
    { name: 'Smoothie Bowl', cal: 320, protein: 14, carbs: 48, fat: 8,  emoji: '🫐', reason: 'Nutrient dense', tip: 'Top with chia seeds' },
  ],
  quickSnacks: [
    { name: 'Protein Bar', cal: 200, protein: 20, carbs: 22, fat: 6,  emoji: '🍫', reason: 'Quick energy boost', tip: 'Choose bars with <5g sugar' },
    { name: 'Banana', cal: 105, protein: 1,  carbs: 27, fat: 0,  emoji: '🍌', reason: 'Natural energy', tip: 'Great pre-workout' },
    { name: 'Blueberries', cal: 84,  protein: 1,  carbs: 21, fat: 0,  emoji: '🫐', reason: 'Antioxidant rich', tip: 'Eat a full cup for best benefits' },
    { name: 'Rice Cakes & Peanut Butter', cal: 180, protein: 5,  carbs: 24, fat: 8,  emoji: '🍞', reason: 'Satisfying snack', tip: '2 rice cakes + 1 tbsp PB' },
  ],
  breakfast: [
    { name: 'Avocado Toast & Eggs', cal: 420, protein: 18, carbs: 32, fat: 24, emoji: '🥑', reason: 'Healthy fats + protein', tip: 'Use sourdough for gut health' },
    { name: 'Overnight Oats', cal: 360, protein: 14, carbs: 52, fat: 9,  emoji: '🥣', reason: 'Prep the night before', tip: 'Add chia seeds for omega-3s' },
    { name: 'Smoothie + Toast', cal: 380, protein: 12, carbs: 60, fat: 8,  emoji: '🥤', reason: 'Quick morning fuel', tip: 'Add spinach to your smoothie' },
  ],
  dinner: [
    { name: 'Baked Salmon & Broccoli', cal: 380, protein: 38, carbs: 12, fat: 18, emoji: '🐟', reason: 'Light yet satisfying', tip: 'Bake at 200°C for 15 mins' },
    { name: 'Chicken & Sweet Potato', cal: 440, protein: 40, carbs: 38, fat: 10, emoji: '🍗', reason: 'Muscle-building dinner', tip: 'Meal prep 4 portions at once' },
    { name: 'Vegetable Curry & Rice', cal: 420, protein: 14, carbs: 65, fat: 10, emoji: '🍛', reason: 'Comforting & nutritious', tip: 'Use light coconut milk' },
  ],
};

// ── AI Coaching messages ──
const COACHING = {
  onTrack:    ["You're right on track today! 🎯", "Great progress! Keep it up 💪", "You're crushing your goals today! 🔥"],
  lowProtein: ["You're low on protein today. Try adding a protein-rich meal 💪", "Protein gap detected! Your muscles need more fuel 🏋️", "Low protein alert! Aim for lean meats or legumes 🥩"],
  highCalories: ["You're close to your calorie limit — go light for the rest of the day 🥗", "Easy on the calories now! A light salad would be perfect 🌿", "Almost at your limit — stick to vegetables and lean protein 🥦"],
  lowCalories: ["You haven't eaten much today. Don't forget to fuel up! 🍽️", "Big calorie gap! You need to eat more to reach your goals 📈", "You're well under your target — a proper meal would help ⚡"],
  morning:    ["Good morning! Start with a protein-rich breakfast 🌅", "Morning! Fuel up for the day ahead 🌞"],
  afternoon:  ["Afternoon energy dip? A balanced lunch will help 🌞", "Keep the momentum going with a nutritious lunch! 💚"],
  evening:    ["Wind down with a light, protein-rich dinner 🌙", "Evening meals should be light — focus on protein and veg 🌿"],
};

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 11) return 'morning';
  if (h < 15) return 'afternoon';
  return 'evening';
}

export async function POST(request) {
  try {
    const { calorieTarget, caloriesEaten, proteinTarget, proteinEaten,
            carbsTarget, carbsEaten, fatTarget, fatEaten, goal } = await request.json();

    const remaining     = Math.max(0, calorieTarget - caloriesEaten);
    const proteinGap    = Math.max(0, proteinTarget - proteinEaten);
    const carbsGap      = Math.max(0, carbsTarget - carbsEaten);
    const pctConsumed   = caloriesEaten / calorieTarget;
    const pctProtein    = proteinEaten / proteinTarget;
    const timeOfDay     = getTimeOfDay();

    // ── Determine coaching message ──
    let coachMsg;
    if (pctConsumed > 0.95)       coachMsg = getRandom(COACHING.highCalories);
    else if (pctConsumed < 0.25)  coachMsg = getRandom(COACHING.lowCalories);
    else if (pctProtein < 0.40)   coachMsg = getRandom(COACHING.lowProtein);
    else                           coachMsg = getRandom(COACHING.onTrack);

    // ── Pick 3 meal suggestions ──
    let pool = [];

    // Time-based suggestions
    if (timeOfDay === 'morning') pool.push(...MEALS.breakfast);
    else if (timeOfDay === 'evening') pool.push(...MEALS.dinner);

    // Macro-gap suggestions
    if (pctProtein < 0.50) pool.push(...MEALS.highProtein);
    if (carbsGap > carbsTarget * 0.5) pool.push(...MEALS.highCarb);

    // Calorie-based
    if (remaining < 300)        pool.push(...MEALS.lowCalorie, ...MEALS.quickSnacks);
    else if (remaining < 600)   pool.push(...MEALS.quickSnacks, ...MEALS.balanced);
    else                         pool.push(...MEALS.balanced);

    // Deduplicate
    const seen = new Set();
    const unique = pool.filter(m => {
      if (seen.has(m.name)) return false;
      seen.add(m.name);
      return true;
    });

    // Filter to meals that fit remaining calories (with 20% tolerance)
    const fits = unique.filter(m => m.cal <= remaining * 1.2);
    const final = fits.length >= 3 ? fits : unique;

    // Shuffle and pick 3
    const shuffled = final.sort(() => Math.random() - 0.5).slice(0, 3);

    // ── Nutrient insight ──
    let insight = null;
    if (pctProtein < 0.40) {
      insight = { type: 'warning', icon: '💪', text: `Only ${proteinEaten}g protein so far. You need ${proteinGap}g more to hit your target.` };
    } else if (remaining < 200 && remaining > 0) {
      insight = { type: 'success', icon: '🎯', text: `Almost there! Only ${remaining} kcal remaining for today.` };
    } else if (pctConsumed < 0.2 && timeOfDay !== 'morning') {
      insight = { type: 'info', icon: '⚡', text: `You've only eaten ${caloriesEaten} kcal today. Make sure to eat enough to fuel your body.` };
    } else if (carbsEaten > carbsTarget * 0.9) {
      insight = { type: 'warning', icon: '🍞', text: `High carb day! Keep your remaining meals protein and fat focused.` };
    }

    return NextResponse.json({
      coachMsg,
      suggestions: shuffled,
      insight,
      remaining,
      timeOfDay,
      summary: {
        calories:  { eaten: caloriesEaten, target: calorieTarget, pct: Math.round(pctConsumed * 100) },
        protein:   { eaten: proteinEaten,  target: proteinTarget,  pct: Math.round(pctProtein * 100) },
      },
    });

  } catch (error) {
    console.error('[Suggestions] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
