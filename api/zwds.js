/**
 * ZWDS API — Serverless function for Vercel
 * POST /api/zwds
 * Body: { year, month, day, hour, minute, gender, isLunar }
 */
const { calculateChart } = require('../scripts/zwds_calc');

export default async function handler(req, res) {
  // CORS for the web page
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { year, month, day, hour, minute, gender, isLunar } = req.body;

    if (!year || !month || !day || hour === undefined || !gender) {
      return res.status(400).json({ error: 'Missing required fields: year, month, day, hour, gender' });
    }

    const result = calculateChart(
      parseInt(year), parseInt(month), parseInt(day),
      parseInt(hour), parseInt(minute) || 0,
      gender.toLowerCase(),
      !!isLunar
    );

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
