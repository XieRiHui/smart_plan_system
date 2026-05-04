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
  if (doc.data && typeof doc.data === "object") return doc.data;
  return doc;
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

async function planExists(planId) {
  const docs = await listDataDocs("plans");
  return docs.some((d) => Number(d?.data?.id) === Number(planId));
}

exports.main = async (event) => {
  const method = getMethod(event);
  if (method === "OPTIONS") {
    return emptyResponse(204);
  }

  const path = normalizePath(event, "locations");

  try {
    await ensureCollections();

    const listMatch = path.match(/^\/plans\/(\d+)\/locations$/);
    if (listMatch) {
      const planId = Number(listMatch[1]);
      if (!(await planExists(planId))) return jsonResponse(404, { detail: "规划不存在" });

      if (method === "GET") {
        const docs = await listDataDocs("locations");
        const items = docs
          .map((d) => d.data)
          .filter((d) => Number(d?.plan_id) === Number(planId))
          .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));
        return jsonResponse(200, items);
      }

      if (method === "POST") {
        const payload = parseJsonBody(event);
        const now = new Date().toISOString();
        const id = await getNextId("locations");
        const item = {
          id,
          plan_id: planId,
          name: String(payload?.name || "").trim(),
          address: payload?.address ?? "",
          latitude: payload?.latitude ?? null,
          longitude: payload?.longitude ?? null,
          description: payload?.description ?? null,
          created_at: now,
          updated_at: now,
        };
        if (!item.name) return jsonResponse(400, { detail: "地点名称为必填项" });
        await db.collection("locations").add({ data: item });
        return jsonResponse(200, item);
      }

      return jsonResponse(405, { detail: "Method Not Allowed" });
    }

    const delMatch = path.match(/^\/plans\/(\d+)\/locations\/(\d+)$/);
    if (delMatch) {
      const planId = Number(delMatch[1]);
      const locationId = Number(delMatch[2]);
      if (method !== "DELETE") return jsonResponse(405, { detail: "Method Not Allowed" });

      const docs = await listDataDocs("locations");
      const found = docs.find(
        (d) => Number(d?.data?.id) === Number(locationId) && Number(d?.data?.plan_id) === Number(planId)
      );
      const item = found ? found.data : null;
      if (!item) return jsonResponse(404, { detail: "地点不存在" });

      await db.collection("locations").doc(found._id).remove();
      return jsonResponse(200, { message: "地点删除成功" });
    }

    return jsonResponse(404, { detail: "Not Found" });
  } catch (e) {
    const statusCode = Number(e?.statusCode) || 500;
    const message = e?.message ? String(e.message) : "服务器错误";
    return jsonResponse(statusCode, { detail: message });
  }
};
