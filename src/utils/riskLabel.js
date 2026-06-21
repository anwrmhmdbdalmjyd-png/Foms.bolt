// ============================================================
//  src/utils/riskLabel.js
//
//  Pure UI-mapping helper: converts a numeric fraud risk_score
//  into a label + badge tone. Lives in utils/ (not in
//  fraud.service.js) because services should only ever return
//  raw data — deciding how to color/label that data in the UI
//  is a presentation concern, not a data-access concern.
// ============================================================

export function riskLabel(score) {
  if (score >= 70) return { label: 'عالي', tone: 'danger' };
  if (score >= 40) return { label: 'متوسط', tone: 'warning' };
  return { label: 'منخفض', tone: 'success' };
}
