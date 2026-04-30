import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get('code');

  if (!barcode) {
    return NextResponse.json({ error: 'No barcode provided' }, { status: 400 });
  }

  console.log('[Barcode] Looking up:', barcode);

  try {
    // ── Try Open Food Facts first (free, 3M+ products) ──
    const offRes = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { headers: { 'User-Agent': 'NutriAI/1.0 (nutriai-sigma.vercel.app)' } }
    );

    if (offRes.ok) {
      const offData = await offRes.json();

      if (offData.status === 1 && offData.product) {
        const p   = offData.product;
        const n   = p.nutriments || {};

        const cal     = Math.round(n['energy-kcal_100g'] || n['energy_100g'] / 4.184 || 0);
        const protein = Math.round((n['proteins_100g']       || 0) * 10) / 10;
        const carbs   = Math.round((n['carbohydrates_100g']  || 0) * 10) / 10;
        const fat     = Math.round((n['fat_100g']            || 0) * 10) / 10;

        const name    = p.product_name || p.product_name_en || 'Unknown Product';
        const brand   = p.brands || '';
        const serving = p.serving_size || '100g';
        const image   = p.image_front_small_url || p.image_url || null;

        console.log('[Barcode] Found on Open Food Facts:', name, cal, 'kcal');

        return NextResponse.json({
          found:   true,
          source:  'Open Food Facts',
          barcode,
          name,
          brand,
          serving,
          cal,
          protein,
          carbs,
          fat,
          image,
        });
      }
    }

    // ── Fallback: USDA Branded Foods (requires free API key) ──
    // If OFF returns nothing, return not found with a helpful message
    console.log('[Barcode] Not found in Open Food Facts for:', barcode);
    return NextResponse.json({
      found:   false,
      barcode,
      message: 'Product not found. Try searching manually.',
    });

  } catch (error) {
    console.error('[Barcode] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
