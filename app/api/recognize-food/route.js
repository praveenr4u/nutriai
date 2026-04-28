import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GOOGLE_VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';

// Daily scan limit per user (free tier protection)
const DAILY_SCAN_LIMIT = 10;

// Server-side Supabase client (uses service role to bypass RLS for counting)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const today = () => new Date().toISOString().split('T')[0];

// Check and increment scan count — returns { allowed, remaining, count }
async function checkScanLimit(userId) {
  if (!userId) return { allowed: true, remaining: DAILY_SCAN_LIMIT, count: 0 };

  const date = today();

  // Get current count
  const { data, error } = await supabaseAdmin
    .from('scan_logs')
    .select('scan_count')
    .eq('user_id', userId)
    .eq('scan_date', date)
    .single();

  const currentCount = data?.scan_count ?? 0;

  if (currentCount >= DAILY_SCAN_LIMIT) {
    return { allowed: false, remaining: 0, count: currentCount };
  }

  // Increment (upsert)
  await supabaseAdmin
    .from('scan_logs')
    .upsert(
      { user_id: userId, scan_date: date, scan_count: currentCount + 1, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,scan_date' }
    );

  return {
    allowed:   true,
    remaining: DAILY_SCAN_LIMIT - (currentCount + 1),
    count:     currentCount + 1,
  };
}

// ── Nutrition database keyed by food label ──
const FOOD_NUTRITION = {
  // Proteins
  'chicken':            { cal: 165, protein: 31, carbs: 0,   fat: 3.6,  serving: '100g' },
  'grilled chicken':    { cal: 165, protein: 31, carbs: 0,   fat: 3.6,  serving: '100g' },
  'fried chicken':      { cal: 320, protein: 28, carbs: 11,  fat: 19,   serving: '1 piece' },
  'chicken breast':     { cal: 165, protein: 31, carbs: 0,   fat: 3.6,  serving: '100g' },
  'beef':               { cal: 250, protein: 26, carbs: 0,   fat: 15,   serving: '100g' },
  'steak':              { cal: 271, protein: 26, carbs: 0,   fat: 18,   serving: '100g' },
  'burger':             { cal: 354, protein: 20, carbs: 29,  fat: 17,   serving: '1 burger' },
  'hamburger':          { cal: 354, protein: 20, carbs: 29,  fat: 17,   serving: '1 burger' },
  'hot dog':            { cal: 290, protein: 10, carbs: 24,  fat: 18,   serving: '1 hot dog' },
  'sausage':            { cal: 301, protein: 13, carbs: 2,   fat: 27,   serving: '100g' },
  'bacon':              { cal: 541, protein: 37, carbs: 1,   fat: 42,   serving: '100g' },
  'salmon':             { cal: 208, protein: 20, carbs: 0,   fat: 13,   serving: '100g' },
  'fish':               { cal: 136, protein: 22, carbs: 0,   fat: 5,    serving: '100g' },
  'shrimp':             { cal: 99,  protein: 24, carbs: 0,   fat: 0.3,  serving: '100g' },
  'tuna':               { cal: 109, protein: 25, carbs: 0,   fat: 0.5,  serving: '100g' },
  'egg':                { cal: 78,  protein: 6,  carbs: 0.6, fat: 5,    serving: '1 egg' },
  'eggs':               { cal: 155, protein: 13, carbs: 1.1, fat: 11,   serving: '2 eggs' },
  'scrambled eggs':     { cal: 182, protein: 13, carbs: 2,   fat: 14,   serving: '2 eggs' },
  'omelette':           { cal: 190, protein: 14, carbs: 1,   fat: 15,   serving: '1 omelette' },
  'pork':               { cal: 242, protein: 27, carbs: 0,   fat: 14,   serving: '100g' },
  'lamb':               { cal: 294, protein: 25, carbs: 0,   fat: 21,   serving: '100g' },
  'turkey':             { cal: 189, protein: 29, carbs: 0,   fat: 7,    serving: '100g' },
  // Grains & carbs
  'rice':               { cal: 206, protein: 4,  carbs: 45,  fat: 0.4,  serving: '1 cup' },
  'white rice':         { cal: 206, protein: 4,  carbs: 45,  fat: 0.4,  serving: '1 cup' },
  'brown rice':         { cal: 216, protein: 5,  carbs: 44,  fat: 1.8,  serving: '1 cup' },
  'pasta':              { cal: 220, protein: 8,  carbs: 43,  fat: 1.3,  serving: '1 cup' },
  'spaghetti':          { cal: 220, protein: 8,  carbs: 43,  fat: 1.3,  serving: '1 cup' },
  'noodles':            { cal: 220, protein: 7,  carbs: 40,  fat: 3,    serving: '1 cup' },
  'bread':              { cal: 79,  protein: 3,  carbs: 15,  fat: 1,    serving: '1 slice' },
  'toast':              { cal: 79,  protein: 3,  carbs: 15,  fat: 1,    serving: '1 slice' },
  'sandwich':           { cal: 350, protein: 18, carbs: 40,  fat: 12,   serving: '1 sandwich' },
  'pizza':              { cal: 266, protein: 11, carbs: 33,  fat: 10,   serving: '1 slice' },
  'french fries':       { cal: 365, protein: 4,  carbs: 48,  fat: 17,   serving: '1 medium' },
  'fries':              { cal: 365, protein: 4,  carbs: 48,  fat: 17,   serving: '1 medium' },
  'potato':             { cal: 130, protein: 3,  carbs: 30,  fat: 0.1,  serving: '1 medium' },
  'sweet potato':       { cal: 103, protein: 2,  carbs: 24,  fat: 0.1,  serving: '1 medium' },
  'oatmeal':            { cal: 158, protein: 6,  carbs: 27,  fat: 3,    serving: '1 cup' },
  'oats':               { cal: 158, protein: 6,  carbs: 27,  fat: 3,    serving: '1 cup' },
  'cereal':             { cal: 150, protein: 4,  carbs: 33,  fat: 1,    serving: '1 cup' },
  'pancake':            { cal: 227, protein: 6,  carbs: 38,  fat: 6,    serving: '3 pancakes' },
  'waffle':             { cal: 291, protein: 7,  carbs: 40,  fat: 12,   serving: '1 waffle' },
  'tortilla':           { cal: 146, protein: 4,  carbs: 26,  fat: 3,    serving: '1 tortilla' },
  'burrito':            { cal: 490, protein: 22, carbs: 56,  fat: 19,   serving: '1 burrito' },
  'taco':               { cal: 210, protein: 10, carbs: 20,  fat: 9,    serving: '1 taco' },
  'wrap':               { cal: 300, protein: 14, carbs: 36,  fat: 10,   serving: '1 wrap' },
  'bagel':              { cal: 270, protein: 10, carbs: 53,  fat: 1.5,  serving: '1 bagel' },
  'croissant':          { cal: 406, protein: 8,  carbs: 45,  fat: 21,   serving: '1 croissant' },
  'muffin':             { cal: 340, protein: 5,  carbs: 55,  fat: 12,   serving: '1 muffin' },
  // Vegetables
  'salad':              { cal: 80,  protein: 2,  carbs: 8,   fat: 5,    serving: '1 bowl' },
  'broccoli':           { cal: 55,  protein: 4,  carbs: 11,  fat: 0.6,  serving: '1 cup' },
  'spinach':            { cal: 23,  protein: 3,  carbs: 3,   fat: 0.4,  serving: '1 cup' },
  'carrot':             { cal: 52,  protein: 1,  carbs: 12,  fat: 0.3,  serving: '1 cup' },
  'tomato':             { cal: 35,  protein: 2,  carbs: 8,   fat: 0.4,  serving: '1 cup' },
  'cucumber':           { cal: 16,  protein: 1,  carbs: 4,   fat: 0.1,  serving: '1 cup' },
  'avocado':            { cal: 234, protein: 3,  carbs: 12,  fat: 21,   serving: '1 medium' },
  'corn':               { cal: 132, protein: 5,  carbs: 29,  fat: 2,    serving: '1 cup' },
  'mushroom':           { cal: 22,  protein: 3,  carbs: 3,   fat: 0.3,  serving: '1 cup' },
  'vegetable':          { cal: 65,  protein: 3,  carbs: 13,  fat: 0.4,  serving: '1 cup' },
  'lettuce':            { cal: 15,  protein: 1,  carbs: 3,   fat: 0.2,  serving: '1 cup' },
  'cabbage':            { cal: 22,  protein: 1,  carbs: 5,   fat: 0.1,  serving: '1 cup' },
  'onion':              { cal: 44,  protein: 1,  carbs: 10,  fat: 0.1,  serving: '1 cup' },
  'garlic':             { cal: 42,  protein: 2,  carbs: 10,  fat: 0.1,  serving: '3 cloves' },
  'pepper':             { cal: 31,  protein: 1,  carbs: 7,   fat: 0.3,  serving: '1 cup' },
  // Fruits
  'apple':              { cal: 95,  protein: 0.5,carbs: 25,  fat: 0.3,  serving: '1 medium' },
  'banana':             { cal: 105, protein: 1.3,carbs: 27,  fat: 0.4,  serving: '1 medium' },
  'orange':             { cal: 62,  protein: 1,  carbs: 15,  fat: 0.2,  serving: '1 medium' },
  'mango':              { cal: 201, protein: 3,  carbs: 50,  fat: 1,    serving: '1 mango' },
  'strawberry':         { cal: 53,  protein: 1,  carbs: 13,  fat: 0.5,  serving: '1 cup' },
  'blueberry':          { cal: 84,  protein: 1,  carbs: 21,  fat: 0.5,  serving: '1 cup' },
  'grapes':             { cal: 104, protein: 1,  carbs: 27,  fat: 0.2,  serving: '1 cup' },
  'watermelon':         { cal: 86,  protein: 2,  carbs: 22,  fat: 0.4,  serving: '2 cups' },
  'pineapple':          { cal: 82,  protein: 1,  carbs: 22,  fat: 0.2,  serving: '1 cup' },
  'fruit':              { cal: 86,  protein: 1,  carbs: 22,  fat: 0.3,  serving: '1 cup' },
  // Dairy
  'milk':               { cal: 149, protein: 8,  carbs: 12,  fat: 8,    serving: '1 cup' },
  'yogurt':             { cal: 100, protein: 17, carbs: 6,   fat: 0.7,  serving: '170g' },
  'cheese':             { cal: 113, protein: 7,  carbs: 0.4, fat: 9,    serving: '1 slice' },
  'ice cream':          { cal: 273, protein: 5,  carbs: 31,  fat: 15,   serving: '1 cup' },
  'butter':             { cal: 102, protein: 0.1,carbs: 0,   fat: 11.5, serving: '1 tbsp' },
  'cream':              { cal: 52,  protein: 0.4,carbs: 0.4, fat: 5.6,  serving: '1 tbsp' },
  // Snacks & desserts
  'cookie':             { cal: 148, protein: 2,  carbs: 21,  fat: 7,    serving: '2 cookies' },
  'cake':               { cal: 352, protein: 5,  carbs: 55,  fat: 14,   serving: '1 slice' },
  'chocolate':          { cal: 546, protein: 5,  carbs: 60,  fat: 31,   serving: '100g' },
  'chips':              { cal: 536, protein: 7,  carbs: 53,  fat: 35,   serving: '100g' },
  'popcorn':            { cal: 375, protein: 11, carbs: 74,  fat: 4,    serving: '100g' },
  'nuts':               { cal: 607, protein: 20, carbs: 21,  fat: 54,   serving: '100g' },
  'almonds':            { cal: 164, protein: 6,  carbs: 6,   fat: 14,   serving: '28g' },
  'peanut butter':      { cal: 188, protein: 8,  carbs: 6,   fat: 16,   serving: '2 tbsp' },
  'hummus':             { cal: 166, protein: 8,  carbs: 18,  fat: 10,   serving: '4 tbsp' },
  'granola':            { cal: 471, protein: 10, carbs: 64,  fat: 20,   serving: '100g' },
  // Drinks & soups
  'coffee':             { cal: 5,   protein: 0.3,carbs: 0,   fat: 0,    serving: '1 cup' },
  'juice':              { cal: 112, protein: 1.7,carbs: 26,  fat: 0.5,  serving: '1 cup' },
  'smoothie':           { cal: 180, protein: 5,  carbs: 35,  fat: 3,    serving: '350ml' },
  'soup':               { cal: 150, protein: 8,  carbs: 18,  fat: 4,    serving: '1 bowl' },
  'lentil soup':        { cal: 226, protein: 18, carbs: 40,  fat: 0.8,  serving: '1 bowl' },
  // Asian
  'sushi':              { cal: 350, protein: 15, carbs: 54,  fat: 8,    serving: '8 pieces' },
  'ramen':              { cal: 436, protein: 21, carbs: 57,  fat: 14,   serving: '1 bowl' },
  'fried rice':         { cal: 238, protein: 5,  carbs: 40,  fat: 6,    serving: '1 cup' },
  'curry':              { cal: 300, protein: 15, carbs: 30,  fat: 12,   serving: '1 serving' },
  'dumplings':          { cal: 336, protein: 14, carbs: 38,  fat: 14,   serving: '6 pieces' },
  'spring roll':        { cal: 153, protein: 3,  carbs: 19,  fat: 7,    serving: '2 rolls' },
  'pad thai':           { cal: 357, protein: 18, carbs: 44,  fat: 12,   serving: '1 serving' },
  // Indian
  'biryani':            { cal: 290, protein: 12, carbs: 45,  fat: 8,    serving: '1 cup' },
  'naan':               { cal: 262, protein: 9,  carbs: 45,  fat: 5,    serving: '1 piece' },
  'dal':                { cal: 198, protein: 12, carbs: 28,  fat: 5,    serving: '1 cup' },
  'samosa':             { cal: 262, protein: 5,  carbs: 31,  fat: 13,   serving: '2 pieces' },
  'chapati':            { cal: 120, protein: 3,  carbs: 18,  fat: 3.7,  serving: '1 piece' },
  'idli':               { cal: 58,  protein: 2,  carbs: 12,  fat: 0.4,  serving: '2 pieces' },
  'dosa':               { cal: 168, protein: 4,  carbs: 30,  fat: 3.7,  serving: '1 dosa' },
  // Default
  'food':               { cal: 200, protein: 8,  carbs: 25,  fat: 7,    serving: '1 serving' },
};

// Fuzzy match label → nutrition
function matchNutrition(label) {
  const lower = label.toLowerCase().trim();
  if (FOOD_NUTRITION[lower]) return { ...FOOD_NUTRITION[lower] };
  for (const key of Object.keys(FOOD_NUTRITION)) {
    if (lower.includes(key) || key.includes(lower)) {
      return { ...FOOD_NUTRITION[key] };
    }
  }
  return { ...FOOD_NUTRITION['food'] };
}

// Filter Google Vision labels to food-relevant ones
const NON_FOOD_LABELS = new Set([
  'tableware','plate','dishware','serveware','bowl','cup','glass','cutlery',
  'table','wood','ingredient','recipe','cuisine','dish','meal','food',
  'fast food','comfort food','produce','garnish','finger food',
  'superfood','natural foods','plant','flower','organism','photography',
]);

function isFoodLabel(label) {
  const lower = label.toLowerCase();
  // Keep if it matches our nutrition DB or is not a generic/non-food term
  if (FOOD_NUTRITION[lower]) return true;
  if (NON_FOOD_LABELS.has(lower)) return false;
  // Keep labels that look like specific foods
  return true;
}

export async function POST(request) {
  try {
    const { imageBase64, useTestImage, userId } = await request.json();

    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Google Vision API key not configured' }, { status: 500 });
    }

    // ── Daily scan limit check ──
    const { allowed, remaining, count } = await checkScanLimit(userId);
    if (!allowed) {
      return NextResponse.json({
        error: `Daily scan limit reached (${DAILY_SCAN_LIMIT}/day). Resets at midnight. Log food manually instead.`,
        limitReached: true,
        remaining: 0,
      }, { status: 429 });
    }
    console.log(`[Scanner] User ${userId || 'guest'}: scan ${count}/${DAILY_SCAN_LIMIT} today`);

    // Build image input
    const imageField = (imageBase64 && !useTestImage)
      ? { content: imageBase64 }
      : { source: { imageUri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Spaghetti_bolognese_%28hozinja%29.jpg/640px-Spaghetti_bolognese_%28hozinja%29.jpg' } };

    const body = {
      requests: [{
        image: imageField,
        features: [
          { type: 'LABEL_DETECTION',  maxResults: 15 },
          { type: 'WEB_DETECTION',    maxResults: 5  },
        ],
      }],
    };

    console.log('[Google Vision] Sending request, image type:', imageBase64 ? 'base64' : 'test URL');

    const res = await fetch(`${GOOGLE_VISION_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log('[Google Vision] Status:', res.status);

    if (!res.ok) {
      const errMsg = data?.error?.message || 'Google Vision request failed';
      console.error('[Google Vision] Error:', errMsg);
      return NextResponse.json({ error: errMsg }, { status: 502 });
    }

    const response = data.responses?.[0];
    if (!response) {
      return NextResponse.json({ error: 'No response from Google Vision' }, { status: 422 });
    }

    // 1. Collect label annotations
    const labelAnnotations = (response.labelAnnotations || [])
      .map(l => ({ name: l.description, score: l.score }));

    // 2. Add web entity labels (often more food-specific, e.g. "Pad Thai" vs "Noodle")
    const webEntities = (response.webDetection?.webEntities || [])
      .filter(e => e.score > 0.5 && e.description)
      .map(e => ({ name: e.description, score: e.score * 0.9 })); // slight discount

    // 3. Merge and deduplicate
    const allLabels = [...labelAnnotations, ...webEntities];
    const seen = new Set();
    const unique = allLabels.filter(l => {
      const key = l.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log('[Google Vision] All labels:', unique.map(l => `${l.name}(${Math.round(l.score*100)}%)`).join(', '));

    // 4. Filter to food-relevant labels and sort by score
    const foodLabels = unique
      .filter(l => isFoodLabel(l.name))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    console.log('[Google Vision] Food labels:', foodLabels.map(l => l.name).join(', '));

    if (!foodLabels.length) {
      return NextResponse.json({
        error: 'No food detected. Try better lighting and hold the camera closer to the food.',
      }, { status: 422 });
    }

    // 5. Map to nutrition data
    const results = foodLabels.map(l => ({
      label: l.name,
      confidence: Math.round(l.score * 100),
      ...matchNutrition(l.name),
    }));

    return NextResponse.json({ results, isTestImage: !imageBase64 || useTestImage, remaining });

  } catch (error) {
    console.error('[recognize-food] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
