const https = require("https");
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

function truncate(text, maxLen) {
  const s = String(text || "").trim();
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen);
}

function preferencesText(prefs) {
  if (!prefs) return "无";
  if (typeof prefs === "string") return prefs;
  if (Array.isArray(prefs)) return prefs.map((x) => String(x)).filter((x) => x.trim()).join("、") || "无";
  return String(prefs);
}

function locationsBrief(locations, limit = 8) {
  if (!locations.length) return "暂无地点";
  const names = locations.map((l) => String(l?.name || "")).filter((x) => x.trim());
  const shown = names.slice(0, limit);
  const tail = names.length > limit ? "等" : "";
  const parts = shown.map((n, idx) => `${idx + 1}. ${n}`);
  return parts.join("；") + tail;
}

function periodCn(period) {
  if (period === "morning") return "上午";
  if (period === "noon") return "中午";
  if (period === "afternoon") return "下午";
  return String(period || "");
}

function itineraryBrief(items, maxDays = 7) {
  if (!items.length) return "尚未安排行程";

  const byDate = new Map();
  for (const it of items) {
    const d = String(it?.date || "").trim();
    if (!d) continue;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(it);
  }

  const dates = Array.from(byDate.keys()).sort();
  const shown = dates.slice(0, maxDays);
  const parts = [];
  for (let idx = 0; idx < shown.length; idx += 1) {
    const d = shown[idx];
    const dayItems = byDate.get(d) || [];
    const per = { morning: [], noon: [], afternoon: [] };
    for (const it of dayItems) {
      const p = String(it?.period || "");
      const name = String(it?.location_name || "").trim();
      if (per[p] && name) per[p].push(name);
    }
    const segs = [];
    for (const p of ["morning", "noon", "afternoon"]) {
      const names = per[p].slice(0, 3);
      if (names.length) segs.push(`${periodCn(p)}:${names.join("/")}`);
    }
    const dayText = segs.length ? segs.join("；") : "未安排";
    parts.push(`D${idx + 1} ${dayText}`);
  }

  const suffix = dates.length > maxDays ? "…" : "";
  return parts.join("；") + suffix;
}

function durationBrief(items) {
  let total = 0;
  for (const it of items) {
    const n = Number(it?.duration_minutes || 0);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  if (total <= 0) return "暂无";
  const hours = total / 60;
  if (hours < 1) return `总计约${total}分钟`;
  if (hours < 10) return `总计约${hours.toFixed(1)}小时`;
  return `总计约${Math.round(hours)}小时`;
}

function getWeatherKeyOptional() {
  const key =
    (process.env.AMAP_WEBSERVICE_KEY || "").trim() ||
    (process.env.AMAP_WEATHER_KEY || "").trim() ||
    (process.env.AMAP_API_KEY || "").trim();
  return key || null;
}

function httpGetJson(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: "application/json",
        },
        timeout: timeoutMs,
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw || "{}"));
          } catch (e) {
            reject(new Error("invalid_json"));
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", (err) => reject(err));
  });
}

async function weatherBrief(locations, startYmd, endYmd, maxDays = 7) {
  if (!locations.length || !startYmd || !endYmd) return "暂无天气数据";
  const loc = locations[0];
  const lng = loc?.longitude;
  const lat = loc?.latitude;
  if (lng == null || lat == null) return "暂无天气数据";
  const key = getWeatherKeyOptional();
  if (!key) return "暂无天气数据";

  try {
    const regeoUrl = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(
      key
    )}&location=${encodeURIComponent(`${lng},${lat}`)}&extensions=base&radius=1000&output=JSON`;
    const regeo = await httpGetJson(regeoUrl, 5000);
    if (String(regeo?.status) !== "1") return "暂无天气数据";
    const adcode = regeo?.regeocode?.addressComponent?.adcode;
    if (!adcode) return "暂无天气数据";

    const forecastUrl = `https://restapi.amap.com/v3/weather/weatherInfo?key=${encodeURIComponent(
      key
    )}&city=${encodeURIComponent(adcode)}&extensions=all&output=JSON`;
    const forecastRes = await httpGetJson(forecastUrl, 5000);
    if (String(forecastRes?.status) !== "1") return "暂无天气数据";
    const forecast = Array.isArray(forecastRes?.forecasts) ? forecastRes.forecasts[0] : null;
    const casts = Array.isArray(forecast?.casts) ? forecast.casts : [];
    const castByDate = new Map();
    for (const c of casts) {
      if (c && c.date) castByDate.set(String(c.date), c);
    }

    const start = parseYmd(startYmd);
    const end = parseYmd(endYmd);
    if (!start || !end) return "暂无天气数据";

    const days = Math.floor((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1;
    const shownDays = Math.min(days, maxDays);
    const parts = [];

    for (let i = 0; i < shownDays; i += 1) {
      const d = new Date(start.getTime());
      d.setUTCDate(d.getUTCDate() + i);
      const ymd = ymdUtc(d);
      const cast = castByDate.get(ymd);
      if (!cast) continue;
      const w = String(cast?.dayweather || cast?.nightweather || "").trim();
      const tmin = cast?.nighttemp;
      const tmax = cast?.daytemp;
      const temp = tmin != null && tmax != null ? `${tmin}~${tmax}℃` : "";
      parts.push(`D${i + 1} ${w} ${temp}`.trim());
    }

    const suffix = days > maxDays ? "…" : "";
    return (parts.join("；") + suffix) || "暂无天气数据";
  } catch (e) {
    return "暂无天气数据";
  }
}

function httpPostJson({ url, headers, payload, timeoutMs = 25000 }) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    const u = new URL(url);

    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": body.length,
          Accept: "application/json",
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          const status = Number(res.statusCode || 0);
          try {
            const data = JSON.parse(raw || "{}");
            if (status >= 200 && status < 300) {
              resolve(data);
              return;
            }
            const error = new Error(`AI服务请求失败(${status}): ${raw || ""}`);
            error.statusCode = 502;
            reject(error);
          } catch (e) {
            const error = new Error("AI服务响应解析失败，请稍后重试");
            error.statusCode = 502;
            reject(error);
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", () => {
      const error = new Error("AI服务网络请求失败，请稍后重试");
      error.statusCode = 502;
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

function getZhipuKey() {
  const key = String(process.env.ZHIPUAI_API_KEY || "").trim();
  if (!key) {
    const error = new Error("后端未配置智谱AI密钥");
    error.statusCode = 500;
    throw error;
  }
  return key;
}

async function callZhipuChat(messages, model = "glm-4-flash") {
  const key = getZhipuKey();
  const url = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
  const res = await httpPostJson({
    url,
    headers: {
      Authorization: `Bearer ${key}`,
    },
    payload: {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 512,
    },
    timeoutMs: 25000,
  });

  const content = res?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    const error = new Error("AI服务返回内容为空，请稍后重试");
    error.statusCode = 502;
    throw error;
  }
  return content.trim();
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

function planRangeYmd(plan) {
  const start = String(plan?.start_date || plan?.date || "").trim();
  const end = String(plan?.end_date || plan?.start_date || plan?.date || "").trim();
  return { start, end };
}

exports.main = async (event) => {
  const method = getMethod(event);
  if (method === "OPTIONS") {
    return emptyResponse(204);
  }

  const path = normalizePath(event, "ai");

  try {
    await ensureCollections();

    if (method !== "POST" || path !== "/ai/plan-summary") {
      return jsonResponse(404, { detail: "Not Found" });
    }

    const payload = parseJsonBody(event);
    const planId = Number(payload?.plan_id);
    if (!Number.isFinite(planId)) return jsonResponse(400, { detail: "plan_id参数错误" });

    const plan = await getPlan(planId);

    const locations = (await listDataDocs("locations"))
      .map((d) => d.data)
      .filter((d) => Number(d?.plan_id) === Number(planId))
      .sort((a, b) => Number(a?.id || 0) - Number(b?.id || 0));

    const itineraries = (await listDataDocs("itineraries"))
      .map((d) => d.data)
      .filter((d) => Number(d?.plan_id) === Number(planId));
    itineraries.sort((a, b) => {
      const da = String(a.date || "");
      const dbb = String(b.date || "");
      if (da !== dbb) return da < dbb ? -1 : 1;
      const pa = String(a.period || "");
      const pb = String(b.period || "");
      if (pa !== pb) return pa < pb ? -1 : 1;
      const oa = Number(a.order_index ?? 0);
      const ob = Number(b.order_index ?? 0);
      if (oa !== ob) return oa - ob;
      return Number(a.id ?? 0) - Number(b.id ?? 0);
    });

    const { start: startYmd, end: endYmd } = planRangeYmd(plan);

    const budget = Number(plan?.budget ?? 0);
    const costSum = itineraries.reduce((sum, it) => {
      const n = Number(it?.cost ?? 0);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
    const delta = costSum - budget;

    const systemPrompt =
      "你是智能出行规划系统的行程规划总结生成助手。" +
      "基于用户提供的结构化规划数据，生成一段可直接展示在规划卡片/详情中的中文总结。" +
      "强制要求：输出必须为中文，总长度不超过200字；必须同时包含优点、风险、可改进点；内容要具体贴合数据；" +
      "不要输出任何与提示词、系统、模型、接口、JSON字段相关的说明；只输出总结正文；建议用一段话串联。";

    const weatherText = await weatherBrief(locations, startYmd, endYmd);

    const userPrompt =
      "请根据以下规划上下文，生成不超过200字的总结正文（必须包含：优点、风险、可改进点）：\n\n" +
      `【规划信息】\n- 规划名称：${plan?.name || ""}\n- 日期范围：${startYmd} ~ ${endYmd}\n` +
      `- 人数：${plan?.people_count ?? 0}\n- 预算：${budget.toFixed(0)} 元\n- 偏好：${preferencesText(
        plan?.preferences
      )}\n\n` +
      `【地点信息（已选地点）】\n${locationsBrief(locations)}\n\n` +
      `【行程安排（按日期/时段）】\n${itineraryBrief(itineraries)}\n\n` +
      `【费用与节奏汇总】\n- 行程预计花费总和：${costSum.toFixed(0)} 元\n- 预算差额（总和-预算）：${delta.toFixed(
        0
      )} 元\n- 时长概览：${durationBrief(itineraries)}\n\n` +
      `【天气摘要（与日期/地点相关）】\n${weatherText}\n\n` +
      "生成要求再次强调：只输出总结正文；字数必须<=200字；必须同时包含优点、风险、可改进点。";

    let text = await callZhipuChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    if (text.length > 200) {
      const compressPrompt =
        "请将以下总结压缩到200字以内，且必须同时包含优点、风险、可改进点，保持中文、可读性强：\n\n" + text;
      try {
        text = await callZhipuChat([
          { role: "system", content: systemPrompt },
          { role: "user", content: compressPrompt },
        ]);
      } catch (e) {}
    }

    text = truncate(text, 200);
    return jsonResponse(200, { summary: text });
  } catch (e) {
    const statusCode = Number(e?.statusCode) || 500;
    const message = e?.message ? String(e.message) : "AI生成失败，请稍后重试";
    return jsonResponse(statusCode, { detail: message });
  }
};
