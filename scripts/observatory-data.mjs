// observatory-data.mjs — fetch every instrument reading from its source and write
// docs/data/observatory.json.
//
//   node scripts/observatory-data.mjs
//
// Rules this file exists to enforce:
//   1. No number without source, url, as_of and fetched_at.
//   2. A source that fails does not fail the run and does not fail the page — it is
//      recorded as failed, and the page says so.
//   3. Nothing is invented. If a value cannot be fetched, it is absent, not guessed.
//
// Runs in GitHub Actions, where the network is open. Several sources are unreachable
// from the authoring sandbox; those come back with status "unreachable" there, which
// is the correct behaviour and is how the degraded path gets tested.

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const OUT = 'docs/data/observatory.json';
const UA = 'NirodhaCollective-Observatory/0.1 (+https://mycelorium.github.io/predator-principle/; office@artecont.at)';
const TIMEOUT = 45000;

const metrics = {};
const notes = [];
const nowIso = () => new Date().toISOString();

async function get(url, as = 'text') {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: as === 'json' ? 'application/json' : '*/*' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return as === 'json' ? res.json() : res.text();
}

function put(key, { value, unit, as_of, source, url, licence, note }) {
  metrics[key] = {
    value, unit, as_of, source, url,
    licence: licence || null,
    note: note || null,
    fetched_at: nowIso(),
    status: 'ok',
  };
}

function fail(key, { source, url, error }) {
  metrics[key] = {
    value: null, unit: null, as_of: null, source, url,
    licence: null, note: null,
    fetched_at: nowIso(),
    status: 'failed',
    error: String(error && error.message ? error.message : error),
  };
}

/* ── tiny CSV reader (quoted fields, one header row) ───────────────────────── */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const lastWorld = (rows, col, entity = 'country', name = 'World') => {
  const hits = rows.filter((r) => r[entity] === name && r[col] !== '' && r[col] != null);
  return hits.length ? hits[hits.length - 1] : null;
};

/* ══════════════════════════════════════════════════════ 1 · OWID CO2 ═══════ */
const OWID_CO2 = 'https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv';
try {
  const rows = parseCsv(await get(OWID_CO2));
  const em = lastWorld(rows, 'co2');
  const tw = lastWorld(rows, 'temperature_change_from_co2');
  if (em) put('co2_emissions', {
    value: Math.round(Number(em.co2)), unit: 'Mt CO₂ / year', as_of: em.year,
    source: 'Our World in Data — CO2 and Greenhouse Gas Emissions',
    url: 'https://github.com/owid/co2-data', licence: 'CC-BY-4.0',
  });
  if (tw) put('warming_from_co2', {
    value: Number(Number(tw.temperature_change_from_co2).toFixed(3)), unit: '°C',
    as_of: tw.year,
    source: 'Our World in Data — temperature change attributable to CO₂',
    url: 'https://github.com/owid/co2-data', licence: 'CC-BY-4.0',
    note: 'Attributed warming from CO₂ alone, not the total observed anomaly.',
  });
} catch (error) {
  fail('co2_emissions', { source: 'Our World in Data', url: OWID_CO2, error });
  fail('warming_from_co2', { source: 'Our World in Data', url: OWID_CO2, error });
}

/* ══════════════════════════════════════════════════ 2 · OWID energy ════════ */
const OWID_ENERGY = 'https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv';
try {
  const rows = parseCsv(await get(OWID_ENERGY));
  const spec = [
    ['solar_share_elec', 'solar_share_elec', 'Solar share of electricity'],
    ['wind_share_elec', 'wind_share_elec', 'Wind share of electricity'],
    ['renewables_share_elec', 'renewables_share_elec', 'Renewables share of electricity'],
    ['fossil_share_elec', 'fossil_share_elec', 'Fossil share of electricity'],
  ];
  for (const [key, col, label] of spec) {
    const r = lastWorld(rows, col);
    if (!r) continue;
    put(key, {
      value: Number(Number(r[col]).toFixed(2)), unit: '% of world electricity', as_of: r.year,
      source: `Our World in Data / Ember — ${label}`,
      url: 'https://github.com/owid/energy-data', licence: 'CC-BY-4.0',
    });
  }
  // series for the long line: solar+wind share by year
  const series = rows.filter((r) => r.country === 'World' && r.solar_share_elec !== '' && Number(r.year) >= 1985)
    .map((r) => [Number(r.year), Number((Number(r.solar_share_elec) + Number(r.wind_share_elec || 0)).toFixed(2))]);
  if (series.length) metrics.solar_wind_series = {
    value: series, unit: '% of world electricity', as_of: String(series[series.length - 1][0]),
    source: 'Our World in Data / Ember', url: 'https://github.com/owid/energy-data',
    licence: 'CC-BY-4.0', note: null, fetched_at: nowIso(), status: 'ok',
  };
} catch (error) {
  for (const k of ['solar_share_elec', 'wind_share_elec', 'renewables_share_elec', 'fossil_share_elec', 'solar_wind_series']) {
    fail(k, { source: 'Our World in Data / Ember', url: OWID_ENERGY, error });
  }
}

/* ══════════════════════════════════════════ 3 · NOAA atmospheric CO₂ ═══════ */
const NOAA = 'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.csv';
try {
  const text = await get(NOAA);
  const lines = text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  const head = lines.shift().split(',').map((h) => h.trim());
  const iY = head.indexOf('year'), iM = head.indexOf('month');
  const iA = head.findIndex((h) => h === 'average' || h === 'monthly average');
  const good = lines.map((l) => l.split(',')).filter((c) => c.length > iA && Number(c[iA]) > 0);
  const last = good[good.length - 1];
  if (!last) throw new Error('no usable rows');
  put('co2_ppm', {
    value: Number(Number(last[iA]).toFixed(2)), unit: 'ppm',
    as_of: `${last[iY].trim()}-${String(last[iM]).trim().padStart(2, '0')}`,
    source: 'NOAA Global Monitoring Laboratory — Mauna Loa monthly mean',
    url: 'https://gml.noaa.gov/ccgg/trends/', licence: 'public domain (US Government)',
  });
} catch (error) {
  fail('co2_ppm', { source: 'NOAA GML Mauna Loa', url: NOAA, error });
  notes.push('Atmospheric CO₂ could not be fetched; the pre-industrial baseline of 280 ppm is a constant, not a reading.');
}

/* ═══════════════════════════════ 4 · EV share of new cars (OWID / IEA) ═════ */
const EV = 'https://ourworldindata.org/grapher/electric-car-sales-share.csv';
try {
  const rows = parseCsv(await get(EV));
  const r = lastWorld(rows, 'Share of new cars that are electric', 'Entity');
  const col = Object.keys(r).find((k) => k.toLowerCase().includes('electric'));
  put('ev_share_new_cars', {
    value: Number(Number(r[col]).toFixed(1)), unit: '% of new car sales', as_of: r.Year,
    source: 'Our World in Data, from IEA Global EV Outlook',
    url: 'https://ourworldindata.org/grapher/electric-car-sales-share',
    licence: 'OWID CC-BY; underlying IEA data subject to IEA terms — attribution required',
  });
  const series = rows.filter((x) => x.Entity === 'World' && x[col] !== '')
    .map((x) => [Number(x.Year), Number(Number(x[col]).toFixed(1))]);
  if (series.length) metrics.ev_share_series = {
    value: series, unit: '% of new car sales', as_of: String(series[series.length - 1][0]),
    source: 'Our World in Data / IEA', url: 'https://ourworldindata.org/grapher/electric-car-sales-share',
    licence: 'OWID CC-BY; IEA terms apply', note: null, fetched_at: nowIso(), status: 'ok',
  };
} catch (error) {
  fail('ev_share_new_cars', { source: 'Our World in Data / IEA', url: EV, error });
  fail('ev_share_series', { source: 'Our World in Data / IEA', url: EV, error });
}

/* ══════════════════════════════════ 5 · IUCN Red List (token required) ═════ */
const IUCN_TOKEN = process.env.IUCN_TOKEN;
if (IUCN_TOKEN) {
  const url = 'https://api.iucnredlist.org/api/v4/statistics/counts';
  try {
    const j = await get(`${url}?token=${encodeURIComponent(IUCN_TOKEN)}`, 'json');
    notes.push('IUCN endpoint answered; shape not yet mapped — see raw payload in the run log.');
    metrics.iucn_raw = {
      value: j, unit: null, as_of: null,
      source: 'IUCN Red List API v4', url: 'https://api.iucnredlist.org/',
      licence: 'IUCN Red List Terms of Use', note: 'unmapped payload, first contact',
      fetched_at: nowIso(), status: 'ok',
    };
  } catch (error) {
    fail('threatened_species', { source: 'IUCN Red List API v4', url, error });
  }
} else {
  metrics.threatened_species = {
    value: null, unit: null, as_of: null,
    source: 'IUCN Red List API v4', url: 'https://api.iucnredlist.org/',
    licence: null, note: 'No IUCN_TOKEN configured; the API requires an access token, so this indicator is not retrieved.',
    fetched_at: nowIso(), status: 'no_token',
  };
}

/* ══════════════════════════ 6 · The Fever — GDELT, three blocks per set ════ */
const FEVER_SETS = {
  predation: {
    economy: ['"hostile takeover"', '"predatory pricing"', '"price war"', '"asset stripping"', '"squeeze out competitors"', '"corner the market"'],
    geopolitics: ['"arms race"', '"war of attrition"', '"seize control"', '"zero-sum"', '"at the expense of"', '"escalate the conflict"'],
    nature: ['"outcompete"', '"overexploit"', '"drive to extinction"', '"strip the land"', '"plunder"', '"invasive takeover"'],
  },
  cooperation: {
    economy: ['"joint venture"', '"profit sharing"', '"shared standard"', '"open source"', '"cooperative model"', '"mutual benefit"'],
    geopolitics: ['"ceasefire agreement"', '"joint declaration"', '"mutual recognition"', '"de-escalate"', '"confidence building"', '"cooperation treaty"'],
    nature: ['"symbiosis"', '"mutualism"', '"restoration project"', '"rewilding"', '"conservation partnership"', '"reciprocity"'],
  },
};
const FEVER_VERSION = '1.0';

// GDELT rate-limits hard, and a shared Actions runner often arrives at an IP that is
// already hot. One 429 is not a failure of the source — it is a queue. Back off and wait.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gdeltBlock(terms) {
  const q = `(${terms.join(' OR ')})`;
  const url = 'https://api.gdeltproject.org/api/v2/doc/doc'
    + `?query=${encodeURIComponent(q)}&mode=timelinevol&timespan=3m&format=json`;
  const waits = [0, 20000, 45000, 90000];
  let lastError;
  for (const wait of waits) {
    if (wait) await sleep(wait);
    try {
      const j = await get(url, 'json');
      const data = j?.timeline?.[0]?.data || [];
      if (!data.length) throw new Error('empty timeline');
      return { url, points: data.map((d) => [d.date, Number(d.value)]) };
    } catch (error) {
      lastError = error;
      if (!/429|timeout|empty/i.test(String(error.message))) throw error;
    }
  }
  throw lastError;
}

const fever = { version: FEVER_VERSION, sets: FEVER_SETS, blocks: {}, status: 'ok' };
try {
  for (const [side, blocks] of Object.entries(FEVER_SETS)) {
    for (const [domain, terms] of Object.entries(blocks)) {
      const r = await gdeltBlock(terms);
      fever.blocks[`${side}.${domain}`] = r;
      await sleep(12000);
    }
  }
} catch (error) {
  fever.status = 'failed';
  fever.error = String(error && error.message ? error.message : error);
}
fever.note = 'Counts are term matches rather than unique documents, and query blocks may overlap. The absolute level depends on the term lists used; only relative change over time is comparable.';
fever.source = 'GDELT DOC 2.0 API';
fever.url = 'https://api.gdeltproject.org/api/v2/doc/doc';
fever.fetched_at = nowIso();
metrics.fever = fever;

/* ════════════════════ 6b · biosphere-state indicators, full series ════════ */
// World-level series from named datasets, retrieved whole rather than as a latest
// value, so the page can plot the record. Each retrieval is wrapped independently:
// a source that cannot be reached is recorded with status "failed" and no
// substitute value is written.

const OWID_GRAPHER = (slug) => `https://ourworldindata.org/grapher/${slug}.csv`;

async function grapherWorld(key, slug, cols, meta) {
  const url = OWID_GRAPHER(slug);
  try {
    const rows = parseCsv(await get(url));
    const world = rows.filter((r) => r.Entity === 'World' || r.Code === 'OWID_WRL');
    if (!world.length) throw new Error('no World rows in dataset');

    const series = {};
    for (const [name, column] of Object.entries(cols)) {
      const pts = world
        .filter((r) => r[column] !== '' && r[column] != null && !Number.isNaN(Number(r[column])))
        .map((r) => [Number(r.Year), Number(Number(r[column]).toFixed(2))])
        .sort((a, b) => a[0] - b[0]);
      if (!pts.length) throw new Error(`column "${column}" empty for World`);
      series[name] = pts;
    }

    const anyKey = Object.keys(series)[0];
    const last = series[anyKey][series[anyKey].length - 1];
    put(key, {
      value: Object.fromEntries(Object.entries(series).map(([n, p]) => [n, p[p.length - 1][1]])),
      unit: meta.unit, as_of: String(last[0]),
      source: meta.source, url: meta.url || url, licence: meta.licence, note: meta.note,
    });
    metrics[key].series = series;
    metrics[key].hands = meta.hands || null;
  } catch (error) {
    fail(key, { source: meta.source, url, error });
  }
}

// 1 · Marine fish stocks by exploitation status (FAO SOFIA, via OWID). The two
//     categories are exhaustive and sum to 100 per cent.
await grapherWorld('fish_stocks', 'fish-stocks-within-sustainable-levels', {
  sustainable: 'Biologically sustainable',
  overexploited: 'Overexploited',
}, {
  unit: '% of assessed marine fish stocks',
  source: 'FAO, The State of World Fisheries and Aquaculture, via Our World in Data',
  licence: 'CC-BY-4.0',
  note: 'Coverage is limited to stocks assessed by FAO. Unassessed stocks are excluded and their status is unknown. Assessment intervals are irregular.',
  hands: { turn: 'sustainable', take: 'overexploited' },
});

// 2 · Living Planet Index (WWF/ZSL, via OWID), with the published upper and lower
//     estimates retained alongside the central series.
await grapherWorld('living_planet_index', 'global-living-planet-index', {
  index: 'Central estimate',
  upper: 'Upper estimate',
  lower: 'Lower estimate',
}, {
  unit: 'index, 1970 = 1',
  source: 'WWF / Zoological Society of London, Living Planet Index, via Our World in Data',
  licence: 'CC-BY-4.0',
  note: 'Mean proportional rate of change across monitored vertebrate populations. Not an abundance count and not a proportion of species lost. Sampling is uneven across taxa and regions.',
  hands: { take: 'index' },
});

// 3 · CO2 emissions from land-use change (OWID CO2 dataset, already fetched above).
try {
  const rows = parseCsv(await get(OWID_CO2));
  const pts = rows
    .filter((r) => r.country === 'World' && r.land_use_change_co2 !== '' && r.land_use_change_co2 != null)
    .map((r) => [Number(r.year), Number((Number(r.land_use_change_co2) / 1000).toFixed(2))])
    .sort((a, b) => a[0] - b[0]);
  if (!pts.length) throw new Error('no World land_use_change_co2 rows');
  const last = pts[pts.length - 1];
  const peak = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
  put('land_use_change_co2', {
    value: last[1], unit: 'Gt CO₂ / year', as_of: String(last[0]),
    source: 'Our World in Data — CO2 and Greenhouse Gas Emissions (land-use change)',
    url: 'https://github.com/owid/co2-data', licence: 'CC-BY-4.0',
    note: `Emissions attributed to land-use change, including deforestation and conversion of other vegetated land. Uncertainty on this term is substantially larger than on fossil-fuel emissions and the publisher revises the full historical series between releases. Maximum in the series is ${peak[1]} Gt (${peak[0]}).`,
  });
  metrics.land_use_change_co2.series = { taken: pts };
  metrics.land_use_change_co2.peak = { year: peak[0], value: peak[1] };
  metrics.land_use_change_co2.hands = { take: 'taken' };
} catch (error) {
  fail('land_use_change_co2', {
    source: 'Our World in Data — CO2 and Greenhouse Gas Emissions',
    url: 'https://github.com/owid/co2-data', error,
  });
}

// 4 · Electricity generation shares: fossil fuels against solar and wind, both as
//     percentages of the same total.
try {
  const rows = parseCsv(await get(OWID_ENERGY));
  const world = rows.filter((r) => r.country === 'World' && Number(r.year) >= 1985);
  const pick = (col) => world
    .filter((r) => r[col] !== '' && r[col] != null)
    .map((r) => [Number(r.year), Number(Number(r[col]).toFixed(2))])
    .sort((a, b) => a[0] - b[0]);
  const fossil = pick('fossil_share_elec');
  const sw = world
    .filter((r) => r.solar_share_elec !== '' && r.solar_share_elec != null)
    .map((r) => [Number(r.year), Number((Number(r.solar_share_elec) + Number(r.wind_share_elec || 0)).toFixed(2))])
    .sort((a, b) => a[0] - b[0]);
  if (!fossil.length || !sw.length) throw new Error('no World electricity shares');
  put('electricity_crossing', {
    value: { fossil: fossil[fossil.length - 1][1], solar_wind: sw[sw.length - 1][1] },
    unit: '% of world electricity', as_of: String(fossil[fossil.length - 1][0]),
    source: 'Our World in Data / Ember — share of electricity generation',
    url: 'https://github.com/owid/energy-data', licence: 'CC-BY-4.0',
    note: 'Electricity generation only. Electricity accounts for approximately one fifth of global final energy consumption; other end uses are not covered by this indicator.',
  });
  metrics.electricity_crossing.series = { taken: fossil, turning: sw };
  metrics.electricity_crossing.hands = { take: 'taken', turn: 'turning' };
} catch (error) {
  fail('electricity_crossing', {
    source: 'Our World in Data / Ember', url: 'https://github.com/owid/energy-data', error,
  });
}

/* ══════════════════════════════════════════ 7 · values kept by hand ════════ */
put('battery_pack_price', {
  value: 108, unit: 'USD / kWh', as_of: '2025',
  source: 'BloombergNEF Lithium-Ion Battery Price Survey (December 2025)',
  url: 'https://about.bnef.com/insights/clean-transport/lithium-ion-battery-pack-prices-see-largest-drop-since-2017-falling-to-115-per-kilowatt-hour-bloombergnef/',
  licence: 'reported figure, cited not redistributed',
  note: 'Published annually as a report rather than as a machine-readable feed; value transcribed manually. Next revision expected each December.',
});
metrics.battery_pack_price.status = 'manual';

put('co2_preindustrial_baseline', {
  value: 280, unit: 'ppm', as_of: 'pre-1750',
  source: 'Ice-core consensus value',
  url: 'https://www.ncei.noaa.gov/products/paleoclimatology/ice-core',
  note: 'Reference value from ice-core records, approximately stable through the Holocene. Fixed input, not a current measurement.',
});
metrics.co2_preindustrial_baseline.status = 'constant';

/* ══════════════════════════════════════════════════════════ write ═════════ */
const ok = Object.values(metrics).filter((m) => m.status === 'ok').length;
const bad = Object.values(metrics).filter((m) => m.status === 'failed').length;

await mkdir(new URL('docs/data/', root), { recursive: true });
await writeFile(new URL(OUT, root), JSON.stringify({
  generated_at: nowIso(),
  generator: 'scripts/observatory-data.mjs',
  rules: [
    'Every value carries source, url, reference period and retrieval timestamp.',
    'A failed retrieval is recorded as failed; no previous value is substituted.',
    'No value is interpolated, smoothed, extrapolated or projected.',
  ],
  notes,
  metrics,
}, null, 2) + '\n', 'utf8');

console.log(`observatory-data: ${ok} ok, ${bad} failed, ${Object.keys(metrics).length} entries -> ${OUT}`);
for (const [k, m] of Object.entries(metrics)) {
  if (m.status !== 'ok') console.log(`  ${m.status.padEnd(10)} ${k}${m.error ? ' — ' + m.error : ''}`);
}
