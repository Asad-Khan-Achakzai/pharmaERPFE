/**
 * Run: node --test ../pharmaERPFE/src/utils/userTerritorySaveMapping.test.js
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

function mapEntireAreaSave(selectedAreaIds, brickExtraIds) {
  if (!selectedAreaIds.length) return { territoryId: null, coverageTerritoryIds: [] };
  const territoryId = selectedAreaIds[0];
  const seen = new Set();
  const coverageTerritoryIds = [...selectedAreaIds.slice(1), ...brickExtraIds].filter((id) => {
    if (id === territoryId) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return { territoryId, coverageTerritoryIds };
}

function mapEntireZoneSave(selectedZoneIds, brickExtraIds) {
  if (!selectedZoneIds.length) return { territoryId: null, coverageTerritoryIds: [] };
  const territoryId = selectedZoneIds[0];
  const seen = new Set();
  const coverageTerritoryIds = [...selectedZoneIds.slice(1), ...brickExtraIds].filter((id) => {
    if (id === territoryId) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return { territoryId, coverageTerritoryIds };
}

describe('userTerritorySaveMapping', () => {
  test('multi-area maps first to primary and rest to coverage', () => {
    const a1 = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const a2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
    const b1 = 'cccccccccccccccccccccccc';
    const r = mapEntireAreaSave([a1, a2], [b1]);
    assert.equal(r.territoryId, a1);
    assert.deepEqual(r.coverageTerritoryIds, [a2, b1]);
  });

  test('multi-zone maps first to primary and rest to coverage', () => {
    const z1 = 'dddddddddddddddddddddddd';
    const z2 = 'eeeeeeeeeeeeeeeeeeeeeeee';
    const r = mapEntireZoneSave([z1, z2], []);
    assert.equal(r.territoryId, z1);
    assert.deepEqual(r.coverageTerritoryIds, [z2]);
  });

  test('dedupes duplicate ids in coverage', () => {
    const a1 = 'aaaaaaaaaaaaaaaaaaaaaaaa';
    const a2 = 'bbbbbbbbbbbbbbbbbbbbbbbb';
    const r = mapEntireAreaSave([a1, a2, a2], [a2]);
    assert.equal(r.territoryId, a1);
    assert.deepEqual(r.coverageTerritoryIds, [a2]);
  });
});
