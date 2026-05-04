const https = require("https");

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

function parseYmd(ymd) {
  const s = String(ymd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const error = new Error("日期格式错误，应为YYYY-MM-DD");
    error.statusCode = 400;
    throw error;
  }
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    const error = new Error("日期格式错误，应为YYYY-MM-DD");
    error.statusCode = 400;
    throw error;
  }
  return d;
}

function ymdUtc(d) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysUtc(d, days) {
  const next = new Date(d.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildDateSeries(start, end, maxDays = 60) {
  if (end.getTime() < start.getTime()) {
    const error = new Error("结束日期不能早于开始日期");
    error.statusCode = 400;
    throw error;
  }
  const days = Math.floor((end.getTime() - start.getTime()) / (24 * 3600 * 1000)) + 1;
  if (days > maxDays) {
    const error = new Error("日期范围过大，无法展示天气");
    error.statusCode = 400;
    throw error;
  }
  const series = [];
  for (let i = 0; i < days; i += 1) {
    series.push(addDaysUtc(start, i));
  }
  return series;
}

function getWeatherKey() {
  const key =
    (process.env.AMAP_WEBSERVICE_KEY || "").trim() ||
    (process.env.AMAP_WEATHER_KEY || "").trim() ||
    (process.env.AMAP_API_KEY || "").trim();
  if (!key) {
    const error = new Error("后端未配置天气服务密钥");
    error.statusCode = 500;
    throw error;
  }
  return key;
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
            const error = new Error("天气服务响应解析失败，请稍后重试");
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
      const error = new Error("天气服务请求失败，请稍后重试");
      error.statusCode = 502;
      reject(error);
    });
  });
}

const cache = new Map();

function cacheGet(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function cacheSet(key, value, ttlMs = 10 * 60 * 1000) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function reverseGeocodeAdcode(longitude, latitude) {
  const cacheKey = `regeo:${longitude.toFixed(6)},${latitude.toFixed(6)}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const key = getWeatherKey();
  const location = `${longitude},${latitude}`;
  const url = `https://restapi.amap.com/v3/geocode/regeo?key=${encodeURIComponent(
    key
  )}&location=${encodeURIComponent(location)}&extensions=base&radius=1000&output=JSON`;
  const data = await httpGetJson(url, 5000);

  if (String(data?.status) !== "1") {
    const error = new Error("逆地理解析失败，请稍后重试");
    error.statusCode = 502;
    throw error;
  }

  const addressComponent = data?.regeocode?.addressComponent || {};
  const adcode = addressComponent?.adcode;
  if (!adcode) {
    const error = new Error("逆地理解析失败，请稍后重试");
    error.statusCode = 502;
    throw error;
  }

  const locationInfo = {
    adcode,
    province: addressComponent?.province || "",
    city: addressComponent?.city || "",
    district: addressComponent?.district || "",
    township: addressComponent?.township || "",
  };

  cacheSet(cacheKey, locationInfo);
  return locationInfo;
}

async function fetchAmapForecast(adcode) {
  const cacheKey = `forecast:${adcode}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const key = getWeatherKey();
  const url = `https://restapi.amap.com/v3/weather/weatherInfo?key=${encodeURIComponent(
    key
  )}&city=${encodeURIComponent(adcode)}&extensions=all&output=JSON`;
  const data = await httpGetJson(url, 5000);

  if (String(data?.status) !== "1") {
    const error = new Error("天气接口调用失败，请稍后重试");
    error.statusCode = 502;
    throw error;
  }

  const forecasts = Array.isArray(data?.forecasts) ? data.forecasts : [];
  if (!forecasts.length) {
    const error = new Error("暂无天气数据，请稍后重试");
    error.statusCode = 502;
    throw error;
  }

  cacheSet(cacheKey, forecasts[0]);
  return forecasts[0];
}

async function getForecastForRange({ longitude, latitude, start_date, end_date }) {
  const cacheKey = `range:${longitude.toFixed(6)},${latitude.toFixed(6)}:${start_date}:${end_date}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const start = parseYmd(start_date);
  const end = parseYmd(end_date);
  const series = buildDateSeries(start, end);

  const location = await reverseGeocodeAdcode(longitude, latitude);
  const forecast = await fetchAmapForecast(location.adcode);

  const casts = Array.isArray(forecast?.casts) ? forecast.casts : [];
  const castByDate = new Map();
  for (const c of casts) {
    if (c && c.date) castByDate.set(String(c.date), c);
  }

  const dates = series.map((d) => {
    const ymd = ymdUtc(d);
    const cast = castByDate.get(ymd);
    if (!cast) {
      return {
        date: ymd,
        weather: "暂无该日期天气数据",
        temp_min: null,
        temp_max: null,
        wind: null,
      };
    }

    const dayweather = cast?.dayweather || "";
    const nightweather = cast?.nightweather || "";
    const weather = dayweather || nightweather || "";

    const daytemp = cast?.daytemp;
    const nighttemp = cast?.nighttemp;

    const daywind = cast?.daywind || "";
    const daypower = cast?.daypower || "";
    const wind = `${daywind}${daypower}`.trim() || null;

    return {
      date: ymd,
      weather,
      temp_min: nighttemp ?? null,
      temp_max: daytemp ?? null,
      wind,
    };
  });

  const result = {
    location: {
      province: location.province || "",
      city: location.city || "",
      district: location.district || "",
      adcode: location.adcode || "",
    },
    dates,
    source: "amap",
  };

  cacheSet(cacheKey, result);
  return result;
}

exports.main = async (event) => {
  const method = getMethod(event);
  if (method === "OPTIONS") {
    return emptyResponse(204);
  }

  const path = normalizePath(event, "weather");

  try {
    if (method === "GET" && path === "/config/amap") {
      const jsKey = String(process.env.AMAP_JS_KEY || "").trim();
      const securityJsCode = String(process.env.AMAP_SECURITY_JS_CODE || "").trim();
      if (!jsKey || !securityJsCode) {
        return jsonResponse(500, { detail: "后端未配置地图服务密钥" });
      }
      return jsonResponse(
        200,
        { js_key: jsKey, security_js_code: securityJsCode },
        { "Cache-Control": "no-store" }
      );
    }

    if (method === "GET" && path === "/weather/forecast") {
      const query = getQuery(event);
      const longitude = Number(query.longitude);
      const latitude = Number(query.latitude);
      if (Number.isNaN(longitude) || Number.isNaN(latitude)) {
        return jsonResponse(400, { detail: "longitude/latitude参数错误" });
      }

      const start_date = String(query.start_date || "").trim();
      const end_date = String(query.end_date || "").trim();
      const data = await getForecastForRange({ longitude, latitude, start_date, end_date });
      return jsonResponse(200, data);
    }

    return jsonResponse(404, { detail: "Not Found" });
  } catch (e) {
    const statusCode = Number(e?.statusCode) || 500;
    const message = e?.message ? String(e.message) : "服务器错误";
    return jsonResponse(statusCode, { detail: message });
  }
};
