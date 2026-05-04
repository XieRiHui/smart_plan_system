const tcb = require("@cloudbase/node-sdk");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://smart-d3gdo2kb0dd16f0e4-1428097561.tcloudbaseapp.com",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  };
}

function jsonResponse(statusCode, data, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
    body: JSON.stringify(data),
  };
}

function emptyResponse(statusCode, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...corsHeaders(),
      ...extraHeaders,
    },
    body: "",
  };
}

function getMethod(event) {
  const method = event?.httpMethod || event?.requestContext?.httpMethod || event?.method;
  return String(method || "").toUpperCase();
}

function normalizePath(event, functionName) {
  const rawPath =
    event?.path ||
    event?.requestContext?.path ||
    event?.rawPath ||
    event?.resourcePath ||
    "/";
  let path = String(rawPath || "/");

  if (!path.startsWith("/")) path = `/${path}`;

  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "api") {
    parts.shift();
    path = `/${parts.join("/")}`;
  }

  return path === "/" ? "/" : path.replace(/\/+$/, "");
}

function parseJsonBody(event) {
  if (!event?.body) return {};
  if (typeof event.body === "object") return event.body;
  try {
    return JSON.parse(String(event.body));
  } catch (e) {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

function parseYmd(ymd) {
  const s = String(ymd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function ymdUtc(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function diffDaysUtc(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / (24 * 3600 * 1000));
}

function addDaysUtc(d, days) {
  const next = new Date(d.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizePlanRange(plan) {
  const startStr = plan?.start_date || plan?.date;
  const endStr = plan?.end_date || plan?.start_date || plan?.date;
  const start = parseYmd(startStr);
  const end = parseYmd(endStr);
  if (!start || !end) return null;
  return { start, end, startStr: ymdUtc(start), endStr: ymdUtc(end) };
}

function ensureSummaryLength(summary) {
  if (summary == null) return;
  const text = String(summary);
  if (text.length > 200) {
    const error = new Error("总结长度不能超过200字");
    error.statusCode = 400;
    throw error;
  }
}

const app = tcb.init({ env: process.env.CLOUDBASE_ENV_ID });
const db = app.database();

const requiredCollections = ["counters", "plans", "locations", "itineraries"];
let collectionsEnsured = false;
async function ensureCollections() {
  if (collectionsEnsured) return;
  collectionsEnsured = true;
  if (typeof db.createCollection !== "function") return;

  for (const name of requiredCollections) {
    try {
      await db.createCollection(name);
    } catch (e) {}
  }
}

function unwrapDataDoc(doc) {
  if (!doc || typeof doc !== "object") return null;
  let cur = doc;
  if (cur.data && typeof cur.data === "object") cur = cur.data;
  if (!cur || typeof cur !== "object") return cur;
  if (cur.id != null || cur.name != null || cur.date != null || cur.start_date != null) return cur;
  if (cur.data && typeof cur.data === "object") return cur.data;
  return cur;
}

function sanitizePlan(obj) {
  const x = obj && typeof obj === "object" ? obj : {};
  return {
    id: x.id != null ? Number(x.id) : x.id,
    name: x.name != null ? String(x.name) : "",
    date: x.date ?? null,
    start_date: x.start_date ?? null,
    end_date: x.end_date ?? null,
    budget: x.budget != null ? Number(x.budget) : 0,
    people_count: x.people_count != null ? Number(x.people_count) : 0,
    preferences: x.preferences ?? null,
    summary: x.summary ?? "",
    created_at: x.created_at ?? null,
    updated_at: x.updated_at ?? null,
  };
}

async function listDataDocs(collectionName) {
  const res = await db.collection(collectionName).get();
  const docs = Array.isArray(res?.data) ? res.data : [];
  return docs
    .filter((d) => d && typeof d === "object" && d._id)
    .map((d) => ({ _id: d._id, data: unwrapDataDoc(d) }));
}

function readCounterFromGetResult(res) {
  const data = res?.data;
  if (!data) return { exists: false, value: 0 };

  if (Array.isArray(data)) {
    if (data.length === 0) return { exists: false, value: 0 };
    const first = data[0];
    const obj = unwrapDataDoc(first) || first;
    const value = Number(obj?.value ?? obj?.data?.value ?? 0);
    return { exists: true, value: Number.isFinite(value) ? value : 0 };
  }

  if (typeof data === "object") {
    if (Object.keys(data).length === 0) return { exists: false, value: 0 };
    let obj = data;
    if (obj.data && typeof obj.data === "object" && obj.value == null) obj = obj.data;
    const value = Number(obj?.value ?? 0);
    return { exists: true, value: Number.isFinite(value) ? value : 0 };
  }

  return { exists: false, value: 0 };
}

async function getMaxIdFromCollection(collectionName) {
  const docs = await listDataDocs(collectionName);
  let max = 0;
  for (const d of docs) {
    const id = Number(d?.data?.id ?? 0);
    if (Number.isFinite(id) && id > max) max = id;
  }
  return max;
}

async function getNextId(seqName) {
  const docId = `seq_${seqName}`;
  const now = new Date().toISOString();

  const ref = db.collection("counters").doc(docId);
  const res = await ref.get();
  const counter = readCounterFromGetResult(res);

  let base = counter.exists ? counter.value : 0;
  if (!counter.exists) {
    const maxId = await getMaxIdFromCollection(seqName);
    if (Number.isFinite(maxId) && maxId > base) base = maxId;
  }

  const value = base + 1;
  if (counter.exists) {
    await ref.update({ data: { value, updated_at: now } });
  } else {
    await ref.set({ data: { value, updated_at: now } });
  }
  return value;
}

async function findOneById(collectionName, id) {
  const docs = await listDataDocs(collectionName);
  const found = docs.find((d) => Number(d?.data?.id) === Number(id));
  return found ? found.data : null;
}

async function updateOneById(collectionName, id, updateData) {
  const docs = await listDataDocs(collectionName);
  const found = docs.find((d) => Number(d?.data?.id) === Number(id));
  if (!found) return null;

  const merged = { ...(found.data || {}), ...(updateData || {}) };
  const next = sanitizePlan(merged);
  await db.collection(collectionName).doc(found._id).update({ data: next });
  return next;
}

async function deleteByPlanId(collectionName, planId) {
  const docs = await listDataDocs(collectionName);
  const targets = docs.filter((d) => Number(d?.data?.plan_id) === Number(planId));
  for (const t of targets) {
    await db.collection(collectionName).doc(t._id).remove();
  }
}

exports.main = async (event) => {
  const method = getMethod(event);
  if (method === "OPTIONS") {
    return emptyResponse(204);
  }

  const path = normalizePath(event, "plan");

  try {
    await ensureCollections();

    if (method === "GET" && path === "/plans") {
      const docs = await listDataDocs("plans");
      const items = docs
        .map((d) => sanitizePlan(d.data))
        .filter(Boolean)
        .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
      return jsonResponse(200, items);
    }

    if (method === "POST" && path === "/plans") {
      const payload = parseJsonBody(event);
      ensureSummaryLength(payload?.summary);

      const now = new Date().toISOString();
      const id = await getNextId("plans");

      const item = {
        id,
        name: String(payload?.name || "").trim(),
        date: payload?.date || null,
        start_date: payload?.start_date ?? null,
        end_date: payload?.end_date ?? null,
        budget: Number(payload?.budget ?? 0),
        people_count: Number(payload?.people_count ?? 0),
        preferences: Array.isArray(payload?.preferences) ? payload.preferences : payload?.preferences ?? null,
        summary: payload?.summary ?? "",
        created_at: now,
        updated_at: now,
      };

      if (!item.name || !item.date) {
        return jsonResponse(400, { detail: "规划名称与日期为必填项" });
      }

      await db.collection("plans").add({ data: item });
      return jsonResponse(200, item);
    }

    const planIdMatch = path.match(/^\/plans\/(\d+)$/);
    if (planIdMatch) {
      const planId = Number(planIdMatch[1]);

      if (method === "GET") {
        const plan = await findOneById("plans", planId);
        if (!plan) return jsonResponse(404, { detail: "规划不存在" });
        return jsonResponse(200, sanitizePlan(plan));
      }

      if (method === "PUT") {
        const plan = await findOneById("plans", planId);
        if (!plan) return jsonResponse(404, { detail: "规划不存在" });

        const payload = parseJsonBody(event);
        ensureSummaryLength(payload?.summary);

        const next = { ...payload, updated_at: new Date().toISOString() };
        const updated = await updateOneById("plans", planId, next);
        return jsonResponse(200, updated);
      }

      if (method === "DELETE") {
        const docs = await listDataDocs("plans");
        const found = docs.find((d) => Number(d?.data?.id) === Number(planId));
        if (!found) return jsonResponse(404, { detail: "规划不存在" });

        await db.collection("plans").doc(found._id).remove();
        await Promise.all([deleteByPlanId("locations", planId), deleteByPlanId("itineraries", planId)]);
        return jsonResponse(200, { message: "规划删除成功" });
      }

      return jsonResponse(405, { detail: "Method Not Allowed" });
    }

    const copyMatch = path.match(/^\/plans\/(\d+)\/copy$/);
    if (copyMatch) {
      const sourcePlanId = Number(copyMatch[1]);
      if (method !== "POST") return jsonResponse(405, { detail: "Method Not Allowed" });

      const sourcePlan = await findOneById("plans", sourcePlanId);
      if (!sourcePlan) return jsonResponse(404, { detail: "规划不存在" });

      const range = normalizePlanRange(sourcePlan);
      if (!range) return jsonResponse(400, { detail: "源规划日期不完整，无法复制" });

      const daySpan = diffDaysUtc(range.end, range.start);
      const today = parseYmd(ymdUtc(new Date()));
      const tomorrow = addDaysUtc(today, 1);

      let targetStart = range.start;
      if (targetStart.getTime() <= today.getTime()) {
        targetStart = tomorrow;
      }
      const targetEnd = addDaysUtc(targetStart, daySpan);
      const shiftDays = diffDaysUtc(targetStart, range.start);

      const now = new Date().toISOString();
      const newPlanId = await getNextId("plans");
      const newPlan = {
        id: newPlanId,
        name: `${sourcePlan.name || ""}（复制）`,
        date: ymdUtc(targetStart),
        start_date: ymdUtc(targetStart),
        end_date: ymdUtc(targetEnd),
        budget: Number(sourcePlan.budget ?? 0),
        people_count: Number(sourcePlan.people_count ?? 0),
        preferences: sourcePlan.preferences ?? null,
        summary: sourcePlan.summary ?? null,
        created_at: now,
        updated_at: now,
      };

      const srcLocationsDocs = await listDataDocs("locations");
      const srcLocations = srcLocationsDocs
        .map((d) => d.data)
        .filter((d) => Number(d?.plan_id) === Number(sourcePlanId))
        .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));

      const locationIdMap = new Map();
      for (const loc of srcLocations) {
        const newLocId = await getNextId("locations");
        locationIdMap.set(Number(loc.id), newLocId);
      }

      const srcItinsDocs = await listDataDocs("itineraries");
      const srcItins = srcItinsDocs
        .map((d) => d.data)
        .filter((d) => Number(d?.plan_id) === Number(sourcePlanId));

      await db.collection("plans").add({ data: newPlan });

      for (const loc of srcLocations) {
        const newLocId = locationIdMap.get(Number(loc.id));
        const newLoc = {
          id: newLocId,
          plan_id: newPlanId,
          name: loc.name ?? "",
          address: loc.address ?? "",
          latitude: loc.latitude ?? null,
          longitude: loc.longitude ?? null,
          description: loc.description ?? null,
          created_at: now,
          updated_at: now,
        };
        await db.collection("locations").add({ data: newLoc });
      }

      for (const it of srcItins) {
        const newItId = await getNextId("itineraries");
        const srcDate = parseYmd(it.date);
        const nextDate = srcDate ? ymdUtc(addDaysUtc(srcDate, shiftDays)) : it.date;
        const mappedLocationId =
          it.location_id != null ? locationIdMap.get(Number(it.location_id)) ?? null : null;

        const newIt = {
          id: newItId,
          plan_id: newPlanId,
          date: nextDate,
          period: it.period ?? "",
          location_id: mappedLocationId,
          location_name: it.location_name ?? "",
          location_address: it.location_address ?? "",
          duration_minutes: it.duration_minutes ?? null,
          cost: it.cost ?? null,
          order_index: it.order_index ?? null,
          note: it.note ?? null,
          created_at: now,
          updated_at: now,
        };
        await db.collection("itineraries").add({ data: newIt });
      }

      return jsonResponse(200, newPlan);
    }

    return jsonResponse(404, { detail: "Not Found" });
  } catch (e) {
    const statusCode = Number(e?.statusCode) || 500;
    const message = e?.message ? String(e.message) : "服务器错误";
    return jsonResponse(statusCode, { detail: message });
  }
};
