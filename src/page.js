export const HTML = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>联通 Token 获取</title>
<script src="https://turing.captcha.qcloud.com/TJCaptcha.js"></script>
<style>
:root{
  --bg:#f0f2f5;
  --card:#ffffff;
  --line:#d8dee7;
  --text:#223042;
  --muted:#5f6b7a;
  --primary:#1769ff;
  --primary-dark:#0f4fc7;
  --success:#1c9c5f;
  --warning-bg:#fff7e6;
  --warning-line:#ffd59a;
  --warning-text:#775013;
  --error-bg:#fff1f1;
  --error-text:#b42318;
  --code-bg:#1b1f26;
}
*{box-sizing:border-box}
body{
  margin:0;
  font-family:"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;
  background:linear-gradient(180deg,#eef3f9 0%,#f5f7fa 100%);
  color:var(--text);
  display:flex;
  justify-content:center;
  padding:30px 16px;
}
.box{
  width:100%;
  max-width:420px;
  background:var(--card);
  border:1px solid rgba(17,24,39,0.06);
  border-radius:16px;
  padding:24px;
  box-shadow:0 18px 45px rgba(34,48,66,0.08);
}
h3{
  margin:0 0 18px;
  text-align:center;
  font-size:22px;
}
.tabs{
  display:flex;
  margin-bottom:18px;
  border-radius:10px;
  overflow:hidden;
  background:#f6f8fb;
  border:1px solid var(--line);
}
.tab{
  flex:1;
  text-align:center;
  padding:12px;
  cursor:pointer;
  font-size:15px;
  color:var(--muted);
  transition:0.2s;
  font-weight:600;
}
.tab.active{
  background:var(--primary);
  color:#fff;
}
.notice{
  background:var(--warning-bg);
  border:1px solid var(--warning-line);
  border-radius:10px;
  padding:12px;
  margin-bottom:16px;
}
.notice-title{
  font-weight:700;
  color:var(--warning-text);
  margin-bottom:6px;
  font-size:14px;
}
.notice-text{
  font-size:13px;
  color:var(--warning-text);
  line-height:1.6;
}
input{
  width:100%;
  padding:12px 13px;
  margin-bottom:12px;
  border:1px solid var(--line);
  border-radius:8px;
  font-size:14px;
  outline:none;
  transition:border-color 0.2s, box-shadow 0.2s;
}
input:focus{
  border-color:#95b8ff;
  box-shadow:0 0 0 3px rgba(23,105,255,0.12);
}
input:disabled{
  background:#f5f7fb;
  color:#8a94a3;
}
.ph-wrap{position:relative}
.ph-suggest{
  position:absolute;
  left:0;
  right:0;
  top:46px;
  background:#fff;
  border:1px solid var(--line);
  border-radius:8px;
  box-shadow:0 12px 30px rgba(34,48,66,0.08);
  z-index:10;
  display:none;
  max-height:200px;
  overflow:auto;
}
.ph-item{
  padding:10px 12px;
  cursor:pointer;
  font-size:14px;
}
.ph-item:hover{background:#f3f6fb}
button{
  width:100%;
  padding:12px;
  border:none;
  border-radius:8px;
  color:#fff;
  font-weight:700;
  cursor:pointer;
  font-size:15px;
  transition:0.2s;
}
button:active{transform:scale(0.99)}
button:disabled{opacity:0.7;cursor:not-allowed}
.btn-login{background:linear-gradient(135deg,var(--primary),var(--primary-dark));margin-top:5px;}
.btn-send{background:linear-gradient(135deg,#27b36d,#138f54);}
.res-box{display:none;margin-top:15px}
.res-content{
  background:var(--code-bg);
  color:#fff;
  padding:15px;
  border-radius:10px;
  font-size:13px;
  word-break:break-all;
  font-family:Consolas,Monaco,monospace;
  line-height:1.6;
}
.msg-box{
  text-align:center;
  font-size:14px;
  margin-top:10px;
  padding:10px;
  border-radius:8px;
  display:none;
}
.msg-err{
  background:var(--error-bg);
  color:var(--error-text);
  border:1px solid #f6c7c7;
}
.msg-succ{
  background:#edf9f2;
  color:#136f42;
  border:1px solid #bfe7d1;
}
.radio-group{
  display:flex;
  gap:12px;
  margin-bottom:10px;
  align-items:center;
  flex-wrap:wrap;
}
.radio-label{
  font-size:13px;
  cursor:pointer;
  color:#445164;
  display:flex;
  align-items:center;
  gap:4px;
}
.c-phone{color:#00e676;font-weight:bold}
.c-pwd{color:#ff4081;font-weight:bold}
.c-token{color:#40c4ff}
.c-ecs{color:#ea80fc}
.c-appid{color:#ffd740}
.c-sep{color:#5f6774}
@media (max-width: 480px){
  .box{padding:18px}
  .tab{font-size:14px;padding:11px 8px}
}
</style>
</head>
<body>
<div class="box">
  <h3>联通 Token 获取</h3>

  <div class="tabs">
    <div id="tab-pwd" class="tab active" onclick="switchTab('pwd')">密码登录</div>
    <div id="tab-sms" class="tab" onclick="switchTab('sms')">短信登录</div>
  </div>

  <div class="notice">
    <div class="notice-title">通道说明</div>
    <div id="notice-pwd" class="notice-text">
      使用官方密码接口登录，自动对接腾讯滑块。<br><b>输出格式:</b> 手机号#服务密码#token#ecs#appid
    </div>
    <div id="notice-sms" class="notice-text" style="display:none;">
      使用短信验证码接口登录，采用混合策略。<br><b>输出格式:</b> 手机号#验证码或密码#token#ecs#appid
    </div>
  </div>

  <div class="ph-wrap">
    <input type="tel" id="ph" placeholder="请输入联通手机号" maxlength="11" autocomplete="off">
    <div id="ph-suggest" class="ph-suggest"></div>
  </div>

  <div class="radio-group">
    <span style="font-size:13px;font-weight:bold;color:#334155">设备指纹:</span>
    <label class="radio-label"><input type="radio" name="amode" value="builtin" checked> 内置</label>
    <label class="radio-label"><input type="radio" name="amode" value="random"> 随机</label>
    <label class="radio-label"><input type="radio" name="amode" value="custom"> 自定义</label>
  </div>
  <input type="text" id="adv" placeholder="将自动使用后台 AppId，建议使用随机" disabled>

  <div id="area-pwd">
    <input type="password" id="pwd" placeholder="请输入联通登录密码">
    <button class="btn-login" id="btn-login-pwd" onclick="doLoginPwd()">立即登录获取 Token</button>
  </div>

  <div id="area-sms" style="display:none;">
    <input type="text" id="sms-pwd" placeholder="输入联通登录密码(仅用于生成长效配置串，可选)">
    <div style="display:flex;gap:10px;margin-bottom:12px;">
      <input type="text" id="cd" placeholder="短信验证码" maxlength="6" style="margin-bottom:0;">
      <button class="btn-send" id="btn-send" style="width:140px;font-size:14px;padding:0;" onclick="doSendSms()">获取验证码</button>
    </div>
    <button class="btn-login" id="btn-login-sms" onclick="doLoginSms()">验证并获取 Token</button>
  </div>

  <div id="msg" class="msg-box"></div>

  <div id="res" class="res-box">
    <div class="msg-succ" style="margin-bottom:10px">获取成功</div>
    <div id="res-html" class="res-content"></div>
    <textarea id="res-raw" style="display:none"></textarea>
    <textarea id="res-simple-raw" style="display:none"></textarea>
    <button style="background:#22a05a;width:100%;margin-top:10px" onclick="copyRaw()">复制完整数据</button>
    <button style="background:#f39c12;width:100%;margin-top:8px" onclick="copySimple()">复制简易版(token#appid)</button>
  </div>
</div>

<script>
let currentMode = 'pwd';
const CAPTCHA_APPID = '195809716';
const PHONE_HISTORY_KEY = 'phone_history';

function switchTab(mode) {
  currentMode = mode;
  document.getElementById('msg').style.display = 'none';
  document.getElementById('res').style.display = 'none';

  if (mode === 'pwd') {
    document.getElementById('tab-pwd').className = 'tab active';
    document.getElementById('tab-sms').className = 'tab';
    document.getElementById('area-pwd').style.display = 'block';
    document.getElementById('area-sms').style.display = 'none';
    document.getElementById('notice-pwd').style.display = 'block';
    document.getElementById('notice-sms').style.display = 'none';
  } else {
    document.getElementById('tab-sms').className = 'tab active';
    document.getElementById('tab-pwd').className = 'tab';
    document.getElementById('area-sms').style.display = 'block';
    document.getElementById('area-pwd').style.display = 'none';
    document.getElementById('notice-sms').style.display = 'block';
    document.getElementById('notice-pwd').style.display = 'none';
  }
}

function loadPhoneHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(PHONE_HISTORY_KEY));
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

function savePhoneHistory(phone) {
  try {
    if (phone.length !== 11) {
      return;
    }
    const list = [phone].concat(loadPhoneHistory().filter(function(v) { return v !== phone; })).slice(0, 10);
    localStorage.setItem(PHONE_HISTORY_KEY, JSON.stringify(list));
  } catch (error) {}
}

function renderPhoneSuggest(keyword) {
  const box = document.getElementById('ph-suggest');
  const list = loadPhoneHistory().filter(function(v) { return v.indexOf(keyword) !== -1; });
  box.innerHTML = '';
  if (!list.length) {
    box.style.display = 'none';
    return;
  }
  list.forEach(function(v) {
    const item = document.createElement('div');
    item.className = 'ph-item';
    item.textContent = v;
    item.onmousedown = function() {
      document.getElementById('ph').value = v;
      box.style.display = 'none';
    };
    box.appendChild(item);
  });
  box.style.display = 'block';
}

document.getElementById('ph').oninput = function(e) { renderPhoneSuggest(e.target.value); };
document.getElementById('ph').onfocus = function(e) { renderPhoneSuggest(e.target.value); };
document.getElementById('ph').onblur = function() {
  setTimeout(function() {
    document.getElementById('ph-suggest').style.display = 'none';
  }, 150);
};

function getFinalAppId() {
  const mode = document.querySelector('input[name="amode"]:checked').value;
  return mode === 'builtin' ? '' : document.getElementById('adv').value;
}

document.querySelectorAll('input[name="amode"]').forEach(function(radio) {
  radio.addEventListener('change', function() {
    const adv = document.getElementById('adv');
    if (radio.value === 'builtin') {
      adv.disabled = true;
      adv.value = '';
      adv.placeholder = '将自动使用后台高权重 AppId';
    } else if (radio.value === 'random') {
      adv.disabled = true;
      adv.value = generateAppId();
      adv.placeholder = '';
    } else {
      adv.disabled = false;
      adv.value = '';
      adv.placeholder = '请粘贴自己抓包的真实 AppId';
    }
  });
});

function generateAppId() {
  function rnd() {
    return String(Math.floor(Math.random() * 10));
  }
  return rnd() + 'f' + rnd() + 'af' + rnd() + rnd() + 'ad' + rnd() + '912d306b5053abf90c7ebbb695887bc870ae0706d573c348539c26c5c0a878641fcc0d3e90acb9be1e6ef858a59af546f3c826988332376b7d18c8ea2398ee3a9c3db947e2471d32a49612';
}

function showMsg(text, isErr) {
  const box = document.getElementById('msg');
  box.innerText = text;
  box.className = 'msg-box ' + (isErr ? 'msg-err' : 'msg-succ');
  box.style.display = 'block';
}

function renderResult(fullStr) {
  const parts = fullStr.split('#');
  const html =
    '<span class="c-phone">' + (parts[0] || '') + '</span><span class="c-sep">#</span>' +
    '<span class="c-pwd">' + (parts[1] || '') + '</span><span class="c-sep">#</span>' +
    '<span class="c-token">' + (parts[2] || '') + '</span><span class="c-sep">#</span>' +
    '<span class="c-ecs">' + (parts[3] || '') + '</span><span class="c-sep">#</span>' +
    '<span class="c-appid">' + (parts[4] || '') + '</span>';

  document.getElementById('res-html').innerHTML = html;
  document.getElementById('res-raw').value = fullStr;
  document.getElementById('res-simple-raw').value = (parts[2] || '') + '#' + (parts[4] || '');
  document.getElementById('res').style.display = 'block';
}

async function postApi(payload) {
  const response = await fetch('/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.json();
}

async function callCaptcha(actionType, phone, appid, extraData) {
  if (typeof TencentCaptcha !== 'function') {
    showMsg('滑块组件加载失败，请刷新页面', true);
    return;
  }

  const captcha = new TencentCaptcha(CAPTCHA_APPID, async function(res) {
    if (res.ret !== 0) {
      showMsg('您取消了安全验证', true);
      return;
    }

    showMsg('滑块验证成功，正在继续请求...', false);

    try {
      const validateData = await postApi({
        action: 'validate',
        ticket: res.ticket,
        randstr: res.randstr,
        phone: phone,
        appid: appid
      });

      if (validateData.status !== 'success') {
        showMsg(validateData.msg || '滑块后端校验失败', true);
        return;
      }

      if (actionType === 'login_pwd') {
        await doLoginPwd(extraData.pwd, validateData.resultToken);
      } else if (actionType === 'send_sms') {
        await doSendSms(validateData.resultToken);
      }
    } catch (error) {
      showMsg('网络异常', true);
    }
  });

  captcha.show();
}

async function doLoginPwd(pwdStr, resultToken) {
  const phone = document.getElementById('ph').value.trim();
  const pwd = pwdStr || document.getElementById('pwd').value;
  const appid = getFinalAppId();
  const btn = document.getElementById('btn-login-pwd');

  if (!phone || !pwd) {
    showMsg('手机号和密码不能为空', true);
    return;
  }

  savePhoneHistory(phone);
  btn.disabled = true;
  btn.innerText = '正在验证...';

  try {
    const data = await postApi({
      action: 'login_pwd',
      phone: phone,
      pwd: pwd,
      appid: appid,
      resultToken: resultToken || ''
    });

    if (data.status === 'success') {
      showMsg('登录成功', false);
      renderResult(data.full);
    } else if (data.status === 'need_captcha') {
      showMsg('触发安全风控，请完成拼图', true);
      await callCaptcha('login_pwd', phone, appid, { pwd: pwd });
    } else {
      showMsg(data.msg || '登录失败', true);
    }
  } catch (error) {
    showMsg('网络异常', true);
  } finally {
    btn.disabled = false;
    btn.innerText = '立即登录获取 Token';
  }
}

async function doSendSms(resultToken) {
  const phone = document.getElementById('ph').value.trim();
  const appid = getFinalAppId();
  const btn = document.getElementById('btn-send');

  if (!phone) {
    showMsg('请输入手机号', true);
    return;
  }

  savePhoneHistory(phone);
  btn.disabled = true;
  btn.innerText = '发送中...';

  try {
    const data = await postApi({
      action: 'send_sms',
      phone: phone,
      appid: appid,
      resultToken: resultToken || ''
    });

    if (data.status === 'success') {
      showMsg('验证码已下发', false);
    } else if (data.status === 'need_captcha') {
      showMsg('需要安全验证', true);
      await callCaptcha('send_sms', phone, appid, {});
    } else {
      showMsg(data.msg || '发送失败', true);
    }
  } catch (error) {
    showMsg('网络异常', true);
  } finally {
    btn.disabled = false;
    btn.innerText = '获取验证码';
  }
}

async function doLoginSms() {
  const phone = document.getElementById('ph').value.trim();
  const code = document.getElementById('cd').value.trim();
  const smsPwd = document.getElementById('sms-pwd').value || code;
  const appid = getFinalAppId();
  const btn = document.getElementById('btn-login-sms');

  if (!phone || !code) {
    showMsg('验证码不能为空', true);
    return;
  }

  btn.disabled = true;
  btn.innerText = '验证中...';

  try {
    const data = await postApi({
      action: 'login_sms',
      phone: phone,
      code: code,
      appid: appid
    });

    if (data.status === 'success') {
      showMsg('登录成功', false);
      const modified = data.full.split('#');
      modified[1] = smsPwd;
      renderResult(modified.join('#'));
    } else {
      showMsg(data.msg || '登录失败', true);
    }
  } catch (error) {
    showMsg('网络异常', true);
  } finally {
    btn.disabled = false;
    btn.innerText = '验证并获取 Token';
  }
}

async function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

async function copyRaw() {
  try {
    await copyText(document.getElementById('res-raw').value);
    alert('已复制完整配置数据');
  } catch (error) {
    alert('复制失败，请手动复制');
  }
}

async function copySimple() {
  try {
    await copyText(document.getElementById('res-simple-raw').value);
    alert('已复制简易版');
  } catch (error) {
    alert('复制失败，请手动复制');
  }
}
</script>
</body>
</html>`;
