export function showLabFeature() {
  const v = import.meta.env.VITE_SHOW_LAB
  return v === '1' || v === 'true' || v === 'yes'
}
