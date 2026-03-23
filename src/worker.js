import { HTML } from "./page.js";

const DEFAULT_APPID = "5f8af22ad0912d306b5053abf90c7ebbb695887bc870ae0706d573c348539c26c5c0a878641fcc0d3e90acb9be1e6ef858a59af546f3c826988332376b7d18c8ea2398ee3a9c3db947e2471d32a49612";
const RSA_MODULUS_B64URL = "3PgmSvWwQPSFPoGVDnOhVBru8jvVqUzQdD85oBQYfejINVq6Lw9aKmfniBeC478SlxjnSO_SUXb3vTT4UKNO_rqhkIBOIpsDZ0cezxbQka8oiBHFKGr7jbbkVaAQJuqnQdEq3LYGqhny4Cr2Rzp8E48jaowVMczHkJRAtnMxDEs";
const RSA_EXPONENT_B64URL = "AQAB";
const SESSION_COOKIE = "uc_session";
const SESSION_MAX_AGE = 60 * 60 * 12;
const SHANGHAI_TZ = "Asia/Shanghai";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const hmacKeyCache = new Map();
const RSA_MODULUS_BYTES = base64UrlToBytes(RSA_MODULUS_B64URL);
const RSA_MODULUS = bytesToBigInt(RSA_MODULUS_BYTES);
const RSA_EXPONENT = bytesToBigInt(base64UrlToBytes(RSA_EXPONENT_B64URL));
const RSA_BLOCK_SIZE = RSA_MODULUS_BYTES.length;
const RSA_CHUNK_SIZE = RSA_BLOCK_SIZE - 11;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleApi(request, env);
    }

    if (request.method === "GET" && url.pathname === "/") {
      return serveIndex();
    }

    if (request.method === "GET" && url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    return new Response("Not Found", { status: 404 });
  }
};

function serveIndex() {
  const headers = new Headers({
    "content-type": "text/html; charset=UTF-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  return new Response(HTML, { status: 200, headers });
}

async function handleApi(request, env) {
  const session = await readSession(request, env);

  try {
    const inputData = await request.json();
    const action = String(inputData.action || "");
    const phone = String(inputData.phone || "").trim();
    const appid = String(inputData.appid || "").trim();

    if (!phone) {
      return jsonWithSession(env, session, { status: "fail", msg: "手机号不能为空" });
    }

    if (!session.deviceId) {
      session.deviceId = crypto.randomUUID().replace(/-/g, "");
    }

    const client = new UnicomClient(phone, appid, session.deviceId);

    if (action === "send_sms") {
      const result = await client.sendSms(String(inputData.resultToken || ""));
      if (result.status === "need_captcha") {
        session.mobileHex = result.mobile || "";
      }
      return jsonWithSession(env, session, result);
    }

    if (action === "login_sms") {
      const code = String(inputData.code || "").trim();
      if (!code) {
        return jsonWithSession(env, session, { status: "fail", msg: "验证码不能为空" });
      }
      const result = await client.loginSms(code);
      if (result.status === "success") {
        const data = result.data || {};
        session.mobileHex = "";
        return jsonWithSession(env, session, {
          status: "success",
          full: phone + "#" + code + "#" + String(data.token_online || "") + "#" + String(data.ecs_token || "") + "#" + client.aid
        });
      }
      return jsonWithSession(env, session, result);
    }

    if (action === "login_pwd") {
      const pwd = String(inputData.pwd || "");
      if (!pwd) {
        return jsonWithSession(env, session, { status: "fail", msg: "密码不能为空" });
      }

      const result = await client.loginPwd(pwd, String(inputData.resultToken || ""));
      if (result.status === "need_captcha") {
        session.mobileHex = result.mobile || "";
        return jsonWithSession(env, session, result);
      }
      if (result.status === "success") {
        const data = result.data || {};
        session.mobileHex = "";
        return jsonWithSession(env, session, {
          status: "success",
          full: phone + "#" + pwd + "#" + String(data.token_online || "") + "#" + String(data.ecs_token || "") + "#" + client.aid
        });
      }
      return jsonWithSession(env, session, result);
    }

    if (action === "validate") {
      const ticket = String(inputData.ticket || "");
      const randstr = String(inputData.randstr || "");
      const mobileHex = String(session.mobileHex || "");

      if (!ticket || !randstr || !mobileHex) {
        return jsonWithSession(env, session, { status: "fail", msg: "缺少滑块校验上下文" });
      }

      const result = await client.validateTencentCaptcha(mobileHex, ticket, randstr);
      if (String(result.code || "") === "0000") {
        return jsonWithSession(env, session, {
          status: "success",
          resultToken: String(result.data?.resultToken || "")
        });
      }
      return jsonWithSession(env, session, { status: "fail", msg: "滑块校验失败" });
    }

    return jsonWithSession(env, session, { status: "fail", msg: "未知操作" });
  } catch (error) {
    return jsonWithSession(env, session, { status: "fail", msg: "服务器内部错误" });
  }
}

class UnicomClient {
  constructor(phone, appid, deviceId) {
    this.phone = phone;
    this.did = deviceId || crypto.randomUUID().replace(/-/g, "");
    this.aid = appid && appid.length > 20 ? appid : DEFAULT_APPID;
  }

  async post(url, body, isIos = false) {
    const userAgent = isIos
      ? "ChinaUnicom4.x/12.2 (com.chinaunicom.mobilebusiness; build:44; iOS 26.2) Alamofire/4.7.3 unicom{version:iphone_c@12.0200}"
      : "Mozilla/5.0 (Linux; Android 13; M2007J3SC) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/107.0 Mobile Safari/537.36; unicom{version:android@11.0800,desmobile:" + this.phone + "};devicetype{deviceBrand:Xiaomi,deviceModel:M2007J3SC};";

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": userAgent,
          "x-requested-with": "com.sinovatech.unicom.ui"
        },
        body
      });

      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (error) {
        return { code: "Err", msg: "HTML响应(IP被风控)" };
      }
    } catch (error) {
      return { code: "Err", msg: "请求异常" };
    }
  }

  async validateTencentCaptcha(mobileHex, ticket, randStr) {
    try {
      const response = await fetch("https://loginxhm.10010.com/login-web/v1/chartCaptcha/validateTencentCaptcha", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "origin": "https://img.client.10010.com",
          "referer": "https://img.client.10010.com/loginRisk/index.html"
        },
        body: JSON.stringify({
          seq: crypto.randomUUID().replace(/-/g, ""),
          captchaType: "10",
          mobile: mobileHex,
          ticket,
          randStr,
          imei: this.did
        })
      });

      return await response.json();
    } catch (error) {
      return { code: "Err", msg: "滑块校验网络异常" };
    }
  }

  async loginPwd(password, resultToken = "") {
    const timestamp = formatShanghaiDate(false);
    const encryptedPhone = encodeLikePythonQuote(rsaEncrypt(this.phone, false));
    const encryptedPassword = encodeLikePythonQuote(rsaEncrypt(password, true));

    let body =
      "deviceOS=26.2" +
      "&mobile=" + encryptedPhone +
      "&netWay=wifi" +
      "&deviceCode=" + this.did +
      "&deviceId=" + this.did +
      "&uniqueIdentifier=" + this.did +
      "&version=iphone_c@12.0200" +
      "&password=" + encryptedPassword +
      "&appId=" + this.aid +
      "&pip=10.98.155.187" +
      "&reqtime=" + encodeLikePythonQuote(timestamp) +
      "&isRemberPwd=false" +
      "&keyVersion=2";

    if (resultToken) {
      body += "&resultToken=" + encodeLikePythonQuote(resultToken);
    }

    const result = await this.post("https://m.client.10010.com/mobileService/login.htm", body, true);
    const code = String(result.code || "");
    const desc = String(result.desc || result.dsc || result.rsp_desc || "");

    if (code === "0" || code === "0000") {
      return { status: "success", data: result };
    }

    if (code === "ECS99998" || code === "ECS99999" || desc.includes("ECS1164") || desc.includes("滑块") || desc.includes("安全")) {
      return {
        status: "need_captcha",
        msg: desc,
        mobile: result.mobile || encryptedPhone
      };
    }

    return { status: "fail", msg: "登录失败: " + desc + " [" + code + "]" };
  }

  async sendSms(resultToken = "") {
    const timestamp = formatShanghaiDate(true);
    const mobile = encodeLikePythonQuote(rsaEncrypt(this.phone, false));
    const body =
      "isFirstInstall=1" +
      "&simCount=1" +
      "&yw_code=" +
      "&deviceOS=android13" +
      "&mobile=" + mobile +
      "&netWay=Wifi" +
      "&loginCodeLen=6" +
      "&deviceId=" + this.did +
      "&deviceCode=" + this.did +
      "&version=android@11.0800" +
      "&send_flag=" +
      "&resultToken=" + encodeLikePythonQuote(resultToken) +
      "&keyVersion=" +
      "&provinceChanel=general" +
      "&appId=" + this.aid +
      "&deviceModel=M2007J3SC" +
      "&androidId=" + this.did.slice(0, 16) +
      "&deviceBrand=Xiaomi" +
      "&timestamp=" + timestamp;

    const result = await this.post("https://m.client.10010.com/mobileService/sendRadomNum.htm", body, false);
    const code = String(result.code || "");
    const desc = String(result.desc || result.dsc || result.rsp_desc || "");

    if (code === "0" || code === "0000" || String(result.rsp_code || "") === "0000" || String(result.status || "") === "success") {
      return { status: "success", msg: "验证码已发送", data: result };
    }

    if (code === "ECS99998" || code === "ECS99999" || desc.includes("ECS1164")) {
      return {
        status: "need_captcha",
        msg: desc,
        mobile: result.mobile || mobile
      };
    }

    return { status: "fail", msg: "发送失败: " + desc };
  }

  async loginSms(code) {
    const timestamp = formatShanghaiDate(true);
    const mobile = encodeLikePythonQuote(rsaEncrypt(this.phone, false));
    const encryptedCode = encodeLikePythonQuote(rsaEncrypt(code, false));
    const body =
      "isFirstInstall=1" +
      "&simCount=1" +
      "&yw_code=" +
      "&loginStyle=0" +
      "&isRemberPwd=true" +
      "&deviceOS=android13" +
      "&mobile=" + mobile +
      "&netWay=Wifi" +
      "&version=android@11.0800" +
      "&deviceId=" + this.did +
      "&password=" + encryptedCode +
      "&keyVersion=" +
      "&provinceChanel=general" +
      "&appId=" + this.aid +
      "&deviceModel=M2007J3SC" +
      "&androidId=" + this.did.slice(0, 16) +
      "&deviceBrand=Xiaomi" +
      "&timestamp=" + timestamp;

    const result = await this.post("https://m.client.10010.com/mobileService/radomLogin.htm", body, false);
    if (String(result.code || "") === "0" || String(result.code || "") === "0000") {
      return { status: "success", data: result };
    }
    return {
      status: "fail",
      msg: "登录失败: " + String(result.desc || "未知") + " [" + String(result.code || "") + "]"
    };
  }
}

async function jsonWithSession(env, session, data, status = 200) {
  const headers = new Headers({
    "content-type": "application/json; charset=UTF-8",
    "cache-control": "no-store"
  });
  headers.set("set-cookie", await createSessionCookie(env, session));
  return new Response(JSON.stringify(data), { status, headers });
}

async function readSession(request, env) {
  const raw = readCookie(request.headers.get("cookie") || "", SESSION_COOKIE);
  if (!raw) {
    return {};
  }

  const parts = raw.split(".");
  if (parts.length !== 2) {
    return {};
  }

  const [payload, signature] = parts;
  const valid = await verifySignature(env, payload, signature);
  if (!valid) {
    return {};
  }

  try {
    const decoded = JSON.parse(decoder.decode(base64UrlToBytes(payload)));
    if (!decoded || typeof decoded !== "object") {
      return {};
    }
    const expiresAt = Number(decoded.expiresAt || 0);
    if (!expiresAt || expiresAt < Date.now()) {
      return {};
    }
    return {
      deviceId: String(decoded.deviceId || ""),
      mobileHex: String(decoded.mobileHex || "")
    };
  } catch (error) {
    return {};
  }
}

async function createSessionCookie(env, session) {
  const payload = {
    deviceId: String(session.deviceId || ""),
    mobileHex: String(session.mobileHex || ""),
    expiresAt: Date.now() + SESSION_MAX_AGE * 1000
  };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const encodedSignature = await signPayload(env, encodedPayload);
  return SESSION_COOKIE + "=" + encodedPayload + "." + encodedSignature + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + SESSION_MAX_AGE;
}

async function signPayload(env, payload) {
  const key = await getHmacKey(env);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

async function verifySignature(env, payload, signature) {
  const key = await getHmacKey(env);
  try {
    return await crypto.subtle.verify("HMAC", key, base64UrlToBytes(signature), encoder.encode(payload));
  } catch (error) {
    return false;
  }
}

async function getHmacKey(env) {
  const secret = String(env.SESSION_SECRET || "dev-insecure-secret-change-me");
  if (!hmacKeyCache.has(secret)) {
    hmacKeyCache.set(
      secret,
      crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
    );
  }
  return hmacKeyCache.get(secret);
}

function readCookie(cookieHeader, name) {
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.trim().split("=");
    if (key === name) {
      return valueParts.join("=");
    }
  }
  return "";
}

function formatShanghaiDate(compact) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  if (compact) {
    return values.year + values.month + values.day + values.hour + values.minute + values.second;
  }
  return values.year + "-" + values.month + "-" + values.day + " " + values.hour + ":" + values.minute + ":" + values.second;
}

function encodeLikePythonQuote(value) {
  return encodeURIComponent(String(value || "")).replace(/%2F/g, "/");
}

function rsaEncrypt(value, isPassword) {
  if (!value) {
    return "";
  }

  const message = isPassword ? value + "000000" : value;
  const source = encoder.encode(message);
  const chunks = [];

  for (let offset = 0; offset < source.length; offset += RSA_CHUNK_SIZE) {
    const chunk = source.slice(offset, offset + RSA_CHUNK_SIZE);
    const padded = padPkcs1V15(chunk, RSA_BLOCK_SIZE);
    const cipherInt = modPow(bytesToBigInt(padded), RSA_EXPONENT, RSA_MODULUS);
    chunks.push(bigIntToBytes(cipherInt, RSA_BLOCK_SIZE));
  }

  return bytesToBase64(concatBytes(chunks));
}

function padPkcs1V15(chunk, blockSize) {
  const paddingLength = blockSize - chunk.length - 3;
  if (paddingLength < 8) {
    throw new Error("RSA chunk too large");
  }

  const padding = new Uint8Array(paddingLength);
  let filled = 0;
  while (filled < paddingLength) {
    const random = crypto.getRandomValues(new Uint8Array(paddingLength - filled));
    for (const value of random) {
      if (value !== 0) {
        padding[filled] = value;
        filled += 1;
      }
      if (filled === paddingLength) {
        break;
      }
    }
  }

  const output = new Uint8Array(blockSize);
  output[0] = 0x00;
  output[1] = 0x02;
  output.set(padding, 2);
  output[2 + paddingLength] = 0x00;
  output.set(chunk, 3 + paddingLength);
  return output;
}

function modPow(base, exponent, modulus) {
  let result = 1n;
  let current = base % modulus;
  let power = exponent;

  while (power > 0n) {
    if (power & 1n) {
      result = (result * current) % modulus;
    }
    power >>= 1n;
    current = (current * current) % modulus;
  }

  return result;
}

function bytesToBigInt(bytes) {
  let hex = "";
  for (const value of bytes) {
    hex += value.toString(16).padStart(2, "0");
  }
  return BigInt("0x" + (hex || "00"));
}

function bigIntToBytes(value, length) {
  let hex = value.toString(16);
  if (hex.length % 2) {
    hex = "0" + hex;
  }

  const pairs = hex ? hex.match(/.{1,2}/g) || [] : [];
  const bytes = Uint8Array.from(pairs.map((pair) => Number.parseInt(pair, 16)));
  if (bytes.length > length) {
    throw new Error("Integer exceeds target length");
  }

  const output = new Uint8Array(length);
  output.set(bytes, length - bytes.length);
  return output;
}

function concatBytes(chunks) {
  const totalLength = chunks.reduce((sum, item) => sum + item.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function bytesToBase64(bytes) {
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.slice(index, index + size));
  }
  return btoa(binary);
}

function toBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}
