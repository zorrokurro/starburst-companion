import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  querySprites, getSpriteById, getDistinctTypes, getStatRange,
  getAllSpritesAll, getTypeChartAttackTypes, getTypeChartList,
  getAllCollections, getCollectionById, createCollection, updateCollection,
  deleteCollection, reorderCollection, getCollectionItems, addToCollection,
  removeFromCollection, reorderCollectionItem, getSpriteCollections,
  searchEngravings, getEngravingsFilters,
  getAllGenericTraits
} from './db.js';
import {
  calculateTypeMultiplier,
  getTypeEffectivenessAgainst, getTypeChartMatrix
} from './typeCalculator.js';
import { calculateAllSkillsDamage } from './damageCalculator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

// ── Sprites API ──

app.get('/api/sprites', (req, res) => {
  try {
    const { sort, order, types, finalOnly, minTotal, maxTotal, search, page, limit } = req.query;
    const parsedTypes = types ? types.split(',').filter(Boolean) : undefined;

    const parsedMinTotal = minTotal !== undefined ? Number(minTotal) : undefined;
    const parsedMaxTotal = maxTotal !== undefined ? Number(maxTotal) : undefined;
    const result = querySprites({
      sort, order, types: parsedTypes,
      finalOnly: finalOnly === '1',
      minTotal: parsedMinTotal,
      maxTotal: parsedMaxTotal,
      search, page, limit,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sprites/all', (_req, res) => {
  try {
    res.json(getAllSpritesAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sprites/:id', (req, res) => {
  try {
    const sprite = getSpriteById(Number(req.params.id));
    if (!sprite) return res.status(404).json({ error: 'Not found' });
    res.json(sprite);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sprites/:id/collections', (req, res) => {
  try {
    res.json(getSpriteCollections(Number(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/filters/types', (_req, res) => {
  try { res.json(getDistinctTypes()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/filters/stats', (_req, res) => {
  try { res.json(getStatRange()); } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Collections API ──

app.get('/api/collections', (_req, res) => {
  try { res.json(getAllCollections()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/collections/:id', (req, res) => {
  try {
    const col = getCollectionById(Number(req.params.id));
    if (!col) return res.status(404).json({ error: 'Not found' });
    col.items = getCollectionItems(col.id);
    res.json(col);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/collections', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
    res.status(201).json(createCollection(name.trim()));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/collections/:id', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
    res.json(updateCollection(Number(req.params.id), name.trim()));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/collections/:id', (req, res) => {
  try {
    deleteCollection(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/collections/:id/reorder', (req, res) => {
  try {
    const { sortOrder } = req.body;
    reorderCollection(Number(req.params.id), sortOrder);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/collections/:id/items', (req, res) => {
  try {
    const { spriteId } = req.body;
    if (!spriteId) return res.status(400).json({ error: 'spriteId required' });
    addToCollection(Number(req.params.id), Number(spriteId));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/collections/:id/items/:spriteId', (req, res) => {
  try {
    removeFromCollection(Number(req.params.id), Number(req.params.spriteId));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/collections/:id/items/reorder', (req, res) => {
  try {
    const { spriteId, sortOrder } = req.body;
    reorderCollectionItem(Number(req.params.id), Number(spriteId), sortOrder);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Type / Calculation API (for type-chart.html & team-sim.html) ──

app.get('/api/types', (_req, res) => {
  try {
    res.json(getTypeChartAttackTypes());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/type-chart', (_req, res) => {
  try {
    res.json(getTypeChartList());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/type-chart-matrix', (_req, res) => {
  try {
    res.json(getTypeChartMatrix());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/calculate-effectiveness', (req, res) => {
  const { attackTypes, defendTypes } = req.body;
  if (!attackTypes || !defendTypes) {
    return res.status(400).json({ error: 'attackTypes and defendTypes are required' });
  }
  try {
    const multiplier = calculateTypeMultiplier(attackTypes, defendTypes);
    const effectiveness = getTypeEffectivenessAgainst(defendTypes);
    res.json({ multiplier, effectiveness });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/calculate-damage', (req, res) => {
  const { attacker, defender, skills, params } = req.body;
  if (!attacker || !defender) {
    return res.status(400).json({ error: 'attacker and defender are required' });
  }
  try {
    if (!params.traitCache) {
      params.traitCache = getAllGenericTraits();
    }
    const results = calculateAllSkillsDamage(attacker, defender, skills || [], params || {});
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/team-matchup', (req, res) => {
  const { team1, team2 } = req.body;
  if (!team1 || !team2) {
    return res.status(400).json({ error: 'team1 and team2 are required' });
  }
  try {
    const matrix = [];
    for (const attacker of team1) {
      const row = [];
      for (const defender of team2) {
        const attackTypes = attacker.types || [];
        const defendTypes = defender.types || [];
        const multiplier = calculateTypeMultiplier(attackTypes, defendTypes);
        row.push(multiplier);
      }
      matrix.push(row);
    }
    res.json(matrix);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Engravings API ──

app.get('/api/engravings/filters', (_req, res) => {
  try { res.json(getEngravingsFilters()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/engravings', (req, res) => {
  try {
    const { search, type, series_name, rarity, page, limit } = req.query;
    const result = searchEngravings({ search, type, series_name, rarity, page, limit });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Generic Traits API ──

app.get('/api/generic-traits', (_req, res) => {
  try { res.json(getAllGenericTraits()); } catch (err) { res.status(500).json({ error: err.message }); }
});

// SPA fallback (skip API routes)
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});

// Auto-start only when run directly (not when imported by Electron)
if (!process.env.SEER_DB_PATH) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
