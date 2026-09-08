const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    },
  });

const text = (message, status = 200) =>
  new Response(message, {
    status,
    headers: { 'access-control-allow-origin': '*' },
  });

const cleanString = (value, max = 2000) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const nullableNumber = value =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function requireFields(body, fields) {
  for (const field of fields) {
    if (!body?.[field]) return field;
  }
  return null;
}

async function saveReport(env, body) {
  const missing = requireFields(body, ['id', 'emergencyType', 'description', 'createdAt']);
  if (missing) return json({ error: `Missing field: ${missing}` }, 400);

  const peopleCount = Math.max(1, Math.min(10000, Number.parseInt(body.peopleCount, 10) || 1));

  await env.DB.prepare(`
    INSERT INTO reports (
      id, reporter_name, contact, emergency_type, description, people_count,
      latitude, longitude, accuracy, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      reporter_name = excluded.reporter_name,
      contact = excluded.contact,
      emergency_type = excluded.emergency_type,
      description = excluded.description,
      people_count = excluded.people_count,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy = excluded.accuracy
  `).bind(
    cleanString(body.id, 100),
    cleanString(body.reporterName, 150),
    cleanString(body.contact, 150),
    cleanString(body.emergencyType, 100),
    cleanString(body.description, 4000),
    peopleCount,
    nullableNumber(body.latitude),
    nullableNumber(body.longitude),
    nullableNumber(body.accuracy),
    cleanString(body.createdAt, 50),
  ).run();

  return json({ ok: true, id: body.id });
}

async function saveEvent(env, body) {
  const missing = requireFields(body, ['id', 'type', 'createdAt']);
  if (missing) return json({ error: `Missing field: ${missing}` }, 400);

  // Never mark a report RESCUED from BLE alone. BLE is only a proximity signal.
  await env.DB.prepare(`
    INSERT INTO rescue_events (
      id, report_id, event_type, beacon_token, beacon_label, rssi,
      latitude, longitude, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).bind(
    cleanString(body.id, 100),
    body.reportId ? cleanString(body.reportId, 100) : null,
    cleanString(body.type, 100),
    body.beaconToken ? cleanString(body.beaconToken, 1000) : null,
    body.beaconLabel ? cleanString(body.beaconLabel, 200) : null,
    nullableNumber(body.rssi),
    nullableNumber(body.latitude),
    nullableNumber(body.longitude),
    cleanString(body.createdAt, 50),
  ).run();

  return json({ ok: true, id: body.id });
}

async function getBeacons(env) {
  const result = await env.DB.prepare(`
    SELECT id, label, manufacturer_token
    FROM rescue_beacons
    WHERE active = 1
    ORDER BY label ASC
  `).all();

  return json({
    devices: (result.results ?? []).map(row => ({
      id: row.id,
      label: row.label,
      manufacturerToken: row.manufacturer_token,
    })),
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return text('', 204);

    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, service: 'rescuelink-api' });
    }

    if (request.method === 'GET' && url.pathname === '/api/beacons') {
      return getBeacons(env);
    }

    if (request.method === 'POST' && url.pathname === '/api/reports') {
      try {
        return await saveReport(env, await request.json());
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Invalid request' }, 400);
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/events') {
      try {
        return await saveEvent(env, await request.json());
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Invalid request' }, 400);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};
