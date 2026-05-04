const http = require("http");
const https = require("https");
const { URL } = require("url");

const ALLOWED_ORIGIN = "https://smart-d3gdo2kb0dd16f0e4-1428097561.tcloudbaseapp.com";

function corsHeaders() {
  return {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

function sendJson(res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    ...corsHeaders(),
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function sendOptions(res) {
  res.writeHead(204, { ...corsHeaders() });
  res.end("");
}

function httpPostJson(url, payload, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(payload || {});

    const req = https.request(
      {
        method: "POST",
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
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
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : {};
          } catch {
            reject(new Error("invalid_json"));
            return;
          }
          if (res.statusCode && res.statusCode >= 400) {
            const msg =
              (json && (json.detail || json.error || json.message)) ||
              `upstream_${res.statusCode}`;
            const err = new Error(String(msg));
            err.statusCode = res.statusCode;
            reject(err);
            return;
          }
          resolve(json);
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function sseWriteData(res, text) {
  const s = String(text ?? "");
  const lines = s.replace(/\r/g, "").split("\n");
  for (const line of lines) {
    res.write(`data: ${line}\n`);
  }
  res.write("\n");
}

async function generateSummaryViaExistingAiFunction(planId) {
  const envId = (process.env.CLOUDBASE_ENV_ID || "").trim();
  if (!envId) {
    const err = new Error("missing_env_id");
    err.statusCode = 500;
    throw err;
  }

  const endpoint = `https://${envId}.service.tcloudbase.com/ai/ai/plan-summary`;
  const json = await httpPostJson(endpoint, { plan_id: Number(planId) });
  const summary = json && json.summary;
  if (typeof summary !== "string" || !summary.trim()) {
    const err = new Error("empty_summary");
    err.statusCode = 502;
    throw err;
  }
  return summary;
}

function streamText(res, fullText, { chunkSize = 5, intervalMs = 200 } = {}) {
  return new Promise((resolve) => {
    const text = String(fullText || "");
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }

    let idx = 0;
    let closed = false;

    const heartbeat = setInterval(() => {
      if (closed) return;
      res.write(": ping\n\n");
    }, 15000);

    const timer = setInterval(() => {
      if (closed) return;
      if (idx >= chunks.length) {
        clearInterval(timer);
        clearInterval(heartbeat);
        sseWriteData(res, "[DONE]");
        res.end();
        resolve();
        return;
      }
      sseWriteData(res, chunks[idx]);
      idx += 1;
    }, intervalMs);

    res.on("close", () => {
      closed = true;
      clearInterval(timer);
      clearInterval(heartbeat);
      resolve();
    });
  });
}

const server = http.createServer(async (req, res) => {
  const origin = String(req.headers.origin || "");
  if (origin && origin !== ALLOWED_ORIGIN) {
    res.writeHead(403, {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
    });
    res.end(JSON.stringify({ detail: "forbidden_origin" }));
    return;
  }

  const url = new URL(req.url || "/", "http://127.0.0.1");
  const rawPathname = String(url.pathname || "/").replace(/\/+$/, "") || "/";
  const pathname = rawPathname.startsWith("/ai_stream")
    ? rawPathname.slice("/ai_stream".length) || "/"
    : rawPathname;

  if (req.method === "OPTIONS") {
    sendOptions(res);
    return;
  }

  if (req.method === "GET" && pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && pathname === "/ai/plan-summary/stream") {
    const planId = Number(url.searchParams.get("plan_id"));
    if (!Number.isFinite(planId) || planId <= 0) {
      sendJson(res, 400, { detail: "plan_id is required" });
      return;
    }

    res.writeHead(200, {
      ...corsHeaders(),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    res.write("\n");

    try {
      const summary = await generateSummaryViaExistingAiFunction(planId);
      await streamText(res, summary);
    } catch (e) {
      console.error("ai_stream_failed", { message: e?.message || String(e) });
      sseWriteData(res, "[DONE]");
      res.end();
    }

    return;
  }

  sendJson(res, 404, { detail: "Not Found" });
});

const port = Number(process.env.PORT || 9000);
server.listen(Number.isFinite(port) ? port : 9000);
