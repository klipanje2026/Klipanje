export function effectName(name) {
  let stem = String(name || '').split(/[\\/]/).pop().replace(/\.(mp4|mov|webm|m4v)$/i, '');
  stem = stem.replace(/(?:-1200-[\d.]+x|-effect)+$/i, '').replace(/[đĐ]/g, 'dj');
  stem = stem.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120).replace(/-+$/g, '');
  return (stem || 'video') + '-effect.mp4';
}
