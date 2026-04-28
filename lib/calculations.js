import { ACTIVITIES } from './data';

export function calcBMI(profile) {
  const weightKg = profile.weightUnit === 'kg' ? profile.weightKg : profile.weightLbs * 0.453592;
  const heightM  = profile.heightUnit === 'cm'
    ? profile.heightCm / 100
    : profile.heightFt * 0.3048 + profile.heightIn * 0.0254;
  if (!heightM) return 0;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function calcNutrition(profile) {
  const weightKg = profile.weightUnit === 'kg' ? profile.weightKg : profile.weightLbs * 0.453592;
  const heightCm = profile.heightUnit === 'cm'
    ? profile.heightCm
    : profile.heightFt * 30.48 + profile.heightIn * 2.54;
  const isMale = profile.gender === 'male' || profile.gender === 'nonbinary';

  // Harris-Benedict BMR
  let bmr = isMale
    ? 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * profile.age)
    : 447.593 + (9.247 * weightKg) + (3.098 * heightCm) - (4.330 * profile.age);

  const actFactor = ACTIVITIES.find(a => a.id === profile.activityLevel)?.factor || 1.375;
  const tdee = bmr * actFactor;

  let calorieTarget = tdee;
  if (profile.goal === 'lose') calorieTarget = tdee - 500;
  else if (profile.goal === 'gain') calorieTarget = tdee + 300;
  calorieTarget = Math.round(Math.max(1200, calorieTarget));

  return {
    bmi: calcBMI(profile),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorieTarget,
    protein: Math.round(calorieTarget * 0.30 / 4),
    carbs:   Math.round(calorieTarget * 0.40 / 4),
    fat:     Math.round(calorieTarget * 0.30 / 9),
  };
}
