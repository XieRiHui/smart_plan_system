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

function getQuery(event) {
  return event?.queryStringParameters || event?.query || {};
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

function periodRank(period) {
  if (period === "morning") return 0;
  if (period === "noon") return 1;
  if (period === "afternoon") return 2;
  return 3;
}

function ensurePeriod(period) {
  if (!["morning", "noon", "afternoon"].includes(period)) {
    const error = new Error("period必须是morning/noon/afternoon");
    error.statusCode = 400;
    throw error;
  }
}

function ensureNonNegativeInt(value, name) {
  if (value == null) return;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    const error = new Error(`${name}不能为负数`);
    error.statusCode = 400;
    throw error;
  }
}

function ensureNonNegativeFloat(value, name) {
  if (value == null) return;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    const error = new Error(`${name}不能为负数`);
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

function unwrapDataDoc(doc) {
  if (!doc || typeof doc !== "object") return null;
  let cur = doc;
  if (cur.data && typeof cur.data === "object") cur = cur.data;
  if (!cur || typeof cur !== "object") return cur;
  for (let i = 0; i < 6; i += 1) {
    if (!cur || typeof cur !== "object") return cur;
    const nested = cur.data;
    if (!nested || typeof nested !== "object") return cur;
    if (nested.id == null && nested.plan_id == null && nested.date == null) return cur;

    const outerTime = Date.parse(String(cur.updated_at || ""));
    const nestedTime = Date.parse(String(nested.updated_at || ""));

    if (Number.isFinite(nestedTime) && (!Number.isFinite(outerTime) || nestedTime > outerTime)) {
      cur = nested;
      continue;
    }

    return cur;
  }

  return cur;
}

async function listDataDocs(collectionName) {
  const res = await db.collection(collectionName).get();
  const docs = Array.isArray(res?.data) ? res.data : [];
  return docs
    .filter((d) => d && typeof d === "object" && d._id)
    .map((d) => ({ _id: d._id, data: unwrapDataDoc(d) }));
}

async function getPlan(planId) {
  const docs = await listDataDocs("plans");
  const plan = docs.find((d) => Number(d?.data?.id) === Number(planId))?.data || null;
  if (!plan) {
    const error = new Error("规划不存在");
    error.statusCode = 404;
    throw error;
  }
  return plan;
}

function planRange(plan) {
  const startStr = plan?.start_date || plan?.date;
  const endStr = plan?.end_date || plan?.start_date || plan?.date;
  const start = parseYmd(startStr);
  const end = parseYmd(endStr);
  if (!start || !end) return null;
  return { start, end };
}

function ensureDateInRange(plan, ymd) {
  const d = parseYmd(ymd);
  if (!d) {
    const error = new Error("日期格式错误，应为YYYY-MM-DD");
    error.statusCode = 400;
    throw error;
  }
  const range = planRange(plan);
  if (!range) {
    const error = new Error("日期必须落在规划的start_date~end_date范围内");
    error.statusCode = 400;
    throw error;
  }
  if (d.getTime() < range.start.getTime() || d.getTime() > range.end.getTime()) {
    const error = new Error("日期必须落在规划的start_date~end_date范围内");
    error.statusCode = 400;
    throw error;
  }
}

async function getLocation(planId, locationId) {
  const docs = await listDataDocs("locations");
  const loc =
    docs.find(
      (d) => Number(d?.data?.id) === Number(locationId) && Number(d?.data?.plan_id) === Number(planId)
    )?.data || null;
  if (!loc) {
    const error = new Error("地点不存在");
    error.statusCode = 404;
    throw error;
  }
  return loc;
}

async function getItineraryById(itineraryId) {
  const docs = await listDataDocs("itineraries");
  const item = docs.find((d) => Number(d?.data?.id) === Number(itineraryId))?.data || null;
  if (!item) {
    const error = new Error("行程不存在");
    error.statusCode = 404;
    throw error;
  }
  return item;
}

exports.main = async (event) => {
  const method = getMethod(event);
  if (method === "OPTIONS") {
    return emptyResponse(204);
  }

  const path = normalizePath(event, "itinerary");

  try {
    await ensureCollections();

    if (path === "/itinerary" && method === "GET") {
      const query = getQuery(event);
      const planId = Number(query.plan_id);
      if (!Number.isFinite(planId)) return jsonResponse(400, { detail: "plan_id参数错误" });

      await getPlan(planId);

      const docs = await listDataDocs("itineraries");
      const items = docs
        .map((d) => d.data)
        .filter((d) => Number(d?.plan_id) === Number(planId));
      items.sort((a, b) => {
        const da = String(a.date || "");
        const dbb = String(b.date || "");
        if (da !== dbb) return da < dbb ? -1 : 1;
        const pa = periodRank(String(a.period || ""));
        const pb = periodRank(String(b.period || ""));
        if (pa !== pb) return pa - pb;
        const oa = Number(a.order_index ?? 0);
        const ob = Number(b.order_index ?? 0);
        if (oa !== ob) return oa - ob;
        return Number(a.id ?? 0) - Number(b.id ?? 0);
      });

      return jsonResponse(200, items);
    }

    if (path === "/itinerary" && method === "POST") {
      const payload = parseJsonBody(event);
      const planId = Number(payload?.plan_id);
      if (!Number.isFinite(planId)) return jsonResponse(400, { detail: "plan_id参数错误" });

      const plan = await getPlan(planId);

      const period = String(payload?.period || "");
      ensurePeriod(period);

      const date = String(payload?.date || "");
      ensureDateInRange(plan, date);

      ensureNonNegativeInt(payload?.duration_minutes, "duration_minutes");
      ensureNonNegativeFloat(payload?.cost, "cost");
      ensureNonNegativeInt(payload?.order_index, "order_index");

      const locationId = Number(payload?.location_id);
      if (!Number.isFinite(locationId)) return jsonResponse(400, { detail: "location_id参数错误" });
      const location = await getLocation(planId, locationId);

      let orderIndex = payload?.order_index;
      if (orderIndex == null) {
        const docs = await listDataDocs("itineraries");
        const items = docs
          .map((d) => d.data)
          .filter(
            (d) =>
              Number(d?.plan_id) === Number(planId) && String(d?.date || "") === date && String(d?.period || "") === period
          );
        const max = items.reduce((m, it) => {
          const v = Number(it?.order_index);
          if (!Number.isFinite(v)) return m;
          return Math.max(m, v);
        }, -1);
        orderIndex = max < 0 ? 0 : max + 1;
      }

      const now = new Date().toISOString();
      const id = await getNextId("itineraries");
      const item = {
        id,
        plan_id: planId,
        date,
        period,
        location_id: location.id,
        location_name: location.name,
        location_address: location.address,
        duration_minutes: payload?.duration_minutes ?? null,
        cost: payload?.cost ?? null,
        order_index: orderIndex,
        note: payload?.note ?? null,
        created_at: now,
        updated_at: now,
      };

      await db.collection("itineraries").add({ data: item });
      return jsonResponse(200, item);
    }

    const idMatch = path.match(/^\/itinerary\/(\d+)$/);
    if (idMatch) {
      const itineraryId = Number(idMatch[1]);

      if (method === "PUT") {
        const docs = await listDataDocs("itineraries");
        const found = docs.find((d) => Number(d?.data?.id) === Number(itineraryId));
        const current = found ? found.data : null;
        if (!current) return jsonResponse(404, { detail: "行程不存在" });

        const plan = await getPlan(Number(current.plan_id));

        const payload = parseJsonBody(event);
        const update = { ...current };

        if (payload?.period != null) {
          const period = String(payload.period || "");
          ensurePeriod(period);
          update.period = period;
        }

        if (payload?.date != null) {
          const date = String(payload.date || "");
          ensureDateInRange(plan, date);
          update.date = date;
        }

        if (payload?.duration_minutes != null) {
          ensureNonNegativeInt(payload.duration_minutes, "duration_minutes");
          update.duration_minutes = payload.duration_minutes;
        }

        if (payload?.cost != null) {
          ensureNonNegativeFloat(payload.cost, "cost");
          update.cost = payload.cost;
        }

        if (payload?.order_index != null) {
          ensureNonNegativeInt(payload.order_index, "order_index");
          update.order_index = payload.order_index;
        }

        if (payload?.note != null) {
          update.note = payload.note;
        }

        if (payload?.location_id != null) {
          const loc = await getLocation(Number(current.plan_id), Number(payload.location_id));
          update.location_id = loc.id;
          update.location_name = loc.name;
          update.location_address = loc.address;
        }

        update.updated_at = new Date().toISOString();
        await db.collection("itineraries").doc(found._id).update({ data: update });
        return jsonResponse(200, update);
      }

      if (method === "DELETE") {
        const docs = await listDataDocs("itineraries");
        const found = docs.find((d) => Number(d?.data?.id) === Number(itineraryId));
        if (!found) return jsonResponse(404, { detail: "行程不存在" });
        await db.collection("itineraries").doc(found._id).remove();
        return jsonResponse(200, { message: "行程删除成功" });
      }

      return jsonResponse(405, { detail: "Method Not Allowed" });
    }

    return jsonResponse(404, { detail: "Not Found" });
  } catch (e) {
    const statusCode = Number(e?.statusCode) || 500;
    const message = e?.message ? String(e.message) : "服务器错误";
    return jsonResponse(statusCode, { detail: message });
  }
};

