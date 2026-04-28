export const GOALS = [
  { id: 'lose',     icon: '⚖️', name: 'Lose Weight',    desc: 'Burn fat and reach a healthier weight' },
  { id: 'maintain', icon: '😊', name: 'Stay in Shape',  desc: 'Maintain my current weight and health' },
  { id: 'gain',     icon: '💪', name: 'Build Muscle',   desc: 'Gain lean muscle and strength' },
  { id: 'health',   icon: '❤️', name: 'Improve Health', desc: 'Eat better and feel more energetic' },
];

export const ACTIVITIES = [
  { id: 'sedentary', icon: '🪑', name: 'Sedentary',          desc: 'I sit or lie down most of the day',          factor: 1.2 },
  { id: 'light',     icon: '🚶', name: 'Lightly Active',     desc: 'I walk or do light chores',                  factor: 1.375 },
  { id: 'moderate',  icon: '🏃', name: 'Moderately Active',  desc: 'I exercise regularly or move a lot at work', factor: 1.55 },
  { id: 'very',      icon: '🏋️', name: 'Very Active',        desc: 'I do physical activities all day',           factor: 1.725 },
];

export const CONCERNS = [
  'None', 'Hypertension', 'High cholesterol', 'Obesity',
  'Diabetes', 'Heart disease', 'Kidney disease', 'Lung disease', 'Thyroid issues', 'PCOS',
];

export const DIETS = [
  { id: 'none',       emoji: '🍽️', name: 'No Preference' },
  { id: 'vegetarian', emoji: '🥦', name: 'Vegetarian' },
  { id: 'vegan',      emoji: '🌱', name: 'Vegan' },
  { id: 'keto',       emoji: '🥑', name: 'Keto' },
  { id: 'paleo',      emoji: '🥩', name: 'Paleo' },
  { id: 'gluten',     emoji: '🌾', name: 'Gluten-Free' },
  { id: 'dairy',      emoji: '🥛', name: 'Dairy-Free' },
  { id: 'halal',      emoji: '☪️', name: 'Halal' },
];

export const FOOD_DB = [
  { name: 'Grilled Chicken Breast', brand: 'Home cooked',       cal: 165, protein: 31, carbs: 0,  fat: 3.6, serving: '100g' },
  { name: 'Brown Rice',             brand: 'Cooked',            cal: 216, protein: 5,  carbs: 44, fat: 1.8, serving: '1 cup' },
  { name: 'Avocado',                brand: 'Fresh',             cal: 234, protein: 3,  carbs: 12, fat: 21,  serving: '1 medium' },
  { name: 'Greek Yogurt',           brand: 'Plain, 0% fat',     cal: 100, protein: 17, carbs: 6,  fat: 0.7, serving: '170g' },
  { name: 'Egg (boiled)',           brand: 'Large',             cal: 78,  protein: 6,  carbs: 0.6,fat: 5,   serving: '1 egg' },
  { name: 'Banana',                 brand: 'Fresh',             cal: 105, protein: 1.3,carbs: 27, fat: 0.4, serving: '1 medium' },
  { name: 'Oatmeal',               brand: 'Rolled oats, cooked',cal: 158, protein: 6,  carbs: 27, fat: 3,   serving: '1 cup' },
  { name: 'Salmon (baked)',         brand: 'Atlantic',          cal: 208, protein: 20, carbs: 0,  fat: 13,  serving: '100g' },
  { name: 'Broccoli',              brand: 'Steamed',            cal: 55,  protein: 4,  carbs: 11, fat: 0.6, serving: '1 cup' },
  { name: 'Whole Wheat Bread',      brand: '1 slice',           cal: 69,  protein: 4,  carbs: 12, fat: 1,   serving: '1 slice' },
  { name: 'Almonds',               brand: 'Raw',                cal: 164, protein: 6,  carbs: 6,  fat: 14,  serving: '28g' },
  { name: 'Apple',                 brand: 'Medium, fresh',      cal: 95,  protein: 0.5,carbs: 25, fat: 0.3, serving: '1 medium' },
  { name: 'Pasta (whole wheat)',   brand: 'Cooked',             cal: 174, protein: 7,  carbs: 37, fat: 0.8, serving: '1 cup' },
  { name: 'Lentil Soup',           brand: 'Homemade',           cal: 226, protein: 18, carbs: 40, fat: 0.8, serving: '1 bowl' },
  { name: 'Tuna (canned)',         brand: 'In water',           cal: 109, protein: 25, carbs: 0,  fat: 0.5, serving: '100g' },
  { name: 'Sweet Potato',          brand: 'Baked',              cal: 103, protein: 2.3,carbs: 24, fat: 0.1, serving: '1 medium' },
  { name: 'Cottage Cheese',        brand: 'Low-fat',            cal: 163, protein: 28, carbs: 6,  fat: 2.3, serving: '1 cup' },
  { name: 'Mixed Salad',           brand: 'With vinaigrette',   cal: 80,  protein: 2,  carbs: 8,  fat: 5,   serving: '1 bowl' },
  { name: 'Protein Bar',           brand: 'Generic',            cal: 200, protein: 20, carbs: 22, fat: 6,   serving: '1 bar' },
  { name: 'Blueberries',           brand: 'Fresh',              cal: 84,  protein: 1.1,carbs: 21, fat: 0.5, serving: '1 cup' },
  { name: 'Smoothie (green)',      brand: 'Spinach, banana',    cal: 180, protein: 5,  carbs: 35, fat: 3,   serving: '350ml' },
  { name: 'Hummus',                brand: 'Store-bought',       cal: 166, protein: 8,  carbs: 18, fat: 10,  serving: '4 tbsp' },
  { name: 'Pizza (margherita)',    brand: '1 slice',            cal: 266, protein: 11, carbs: 33, fat: 10,  serving: '1 slice' },
  { name: 'Burger (beef)',         brand: 'Fast food',          cal: 354, protein: 20, carbs: 29, fat: 17,  serving: '1 patty + bun' },
  { name: 'French Fries',          brand: 'Medium serving',     cal: 365, protein: 4,  carbs: 48, fat: 17,  serving: '1 medium' },
];

export const SCAN_FOODS = [
  { name: 'Grilled Chicken Breast', brand: 'Home cooked',    cal: 165, protein: 31, carbs: 0,  fat: 3.6, serving: '100g' },
  { name: 'Caesar Salad',          brand: 'Restaurant style',cal: 190, protein: 8,  carbs: 14, fat: 14,  serving: '1 bowl' },
  { name: 'Avocado Toast',         brand: '2 slices wheat',  cal: 320, protein: 9,  carbs: 32, fat: 18,  serving: '1 serving' },
  { name: 'Scrambled Eggs',        brand: '2 large eggs',    cal: 182, protein: 13, carbs: 2,  fat: 14,  serving: '2 eggs' },
  { name: 'Protein Shake',         brand: 'Chocolate',       cal: 160, protein: 25, carbs: 8,  fat: 3,   serving: '1 scoop' },
  { name: 'Oatmeal Bowl',          brand: 'With berries',    cal: 210, protein: 7,  carbs: 38, fat: 4,   serving: '1 bowl' },
  { name: 'Grilled Salmon',        brand: 'With lemon',      cal: 280, protein: 28, carbs: 0,  fat: 18,  serving: '150g' },
  { name: 'Vegetable Curry',       brand: 'With rice',       cal: 340, protein: 12, carbs: 58, fat: 8,   serving: '1 plate' },
];

const MON_MEALS = [
  { type: 'Breakfast 🌅', cals: 380, foods: [
    { emoji: '🥣', name: 'Oatmeal with berries', cal: 210 },
    { emoji: '☕', name: 'Black coffee',          cal: 5 },
    { emoji: '🍌', name: 'Banana',                cal: 105 },
    { emoji: '🥛', name: 'Low-fat milk',          cal: 60 },
  ]},
  { type: 'Lunch 🌞', cals: 520, foods: [
    { emoji: '🐔', name: 'Grilled chicken breast', cal: 165 },
    { emoji: '🍚', name: 'Brown rice (1 cup)',      cal: 216 },
    { emoji: '🥦', name: 'Steamed broccoli',        cal: 55 },
  ]},
  { type: 'Snack 🍎', cals: 180, foods: [
    { emoji: '🍎', name: 'Apple',                   cal: 95 },
    { emoji: '🥜', name: 'Almonds (small handful)', cal: 85 },
  ]},
  { type: 'Dinner 🌙', cals: 450, foods: [
    { emoji: '🐟', name: 'Baked salmon (150g)', cal: 280 },
    { emoji: '🥗', name: 'Mixed green salad',   cal: 80 },
    { emoji: '🍠', name: 'Sweet potato',         cal: 103 },
  ]},
];

const TUE_MEALS = [
  { type: 'Breakfast 🌅', cals: 340, foods: [
    { emoji: '🍳', name: 'Scrambled eggs (2)', cal: 182 },
    { emoji: '🍞', name: 'Whole wheat toast',  cal: 69 },
    { emoji: '🍊', name: 'Orange juice',       cal: 89 },
  ]},
  { type: 'Lunch 🌞', cals: 500, foods: [
    { emoji: '🫘', name: 'Lentil soup',        cal: 226 },
    { emoji: '🥗', name: 'Garden salad',       cal: 80 },
    { emoji: '🫓', name: 'Whole wheat bread',  cal: 69 },
  ]},
  { type: 'Snack 🧁', cals: 160, foods: [
    { emoji: '🍦', name: 'Greek yogurt', cal: 100 },
    { emoji: '🫐', name: 'Blueberries',  cal: 60 },
  ]},
  { type: 'Dinner 🌙', cals: 490, foods: [
    { emoji: '🍗', name: 'Chicken stir-fry',   cal: 280 },
    { emoji: '🍚', name: 'White rice (1 cup)', cal: 206 },
    { emoji: '🥦', name: 'Steamed greens',     cal: 40 },
  ]},
];

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const MEAL_PLANS = DAYS.map((name, i) => ({
  name,
  meals: i % 2 === 0 ? MON_MEALS : TUE_MEALS,
}));
