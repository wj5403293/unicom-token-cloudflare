# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify, render_template_string, session
import random, requests, uuid, time, json, os
from datetime import datetime
from urllib.parse import quote
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5
from base64 import b64encode

app = Flask(__name__)
app.secret_key = "unicom_login_secret_key_2024" 

# ----------------- 内置appid配置区 -----------------
DEFAULT_APPID = "5f8af22ad0912d306b5053abf90c7ebbb695887bc870ae0706d573c348539c26c5c0a878641fcc0d3e90acb9be1e6ef858a59af546f3c826988332376b7d18c8ea2398ee3a9c3db947e2471d32a49612"

# ----------------- 加密类 -----------------
class Encrypt:
    def __init__(self):
        self.k="""-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDc+CZK9bBA9IU+gZUOc6FUGu7y
O9WpTNB0PzmgFBh96Mg1WrovD1oqZ+eIF4LjvxKXGOdI79JRdve9NPhQo07+uqGQ
gE4imwNnRx7PFtCRryiIEcUoavuNtuRVoBAm6qdB0SrctgaqGfLgKvZHOnwTjyNq
jBUxzMeQlEC2czEMSwIDAQAB
-----END PUBLIC KEY-----"""
    
    def rsa(self, d, is_password=False):
        try:
            if not d: return ""
            if is_password:
                d = d + "000000"
            d = d.encode('utf-8')
            l = len(d); dl = 117; p = RSA.import_key(self.k); c = PKCS1_v1_5.new(p); r = []
            for i in range(0, l, dl): r.append(c.encrypt(d[i:i+dl]))
            return b64encode(b''.join(r)).decode()
        except: return ""

# ----------------- 联通核心请求类 -----------------
class UnicomClient:
    def __init__(self, phone, appid, deviceId=""):
        self.phone = phone
        self.e = Encrypt()
        self.did = deviceId if deviceId else uuid.uuid4().hex
        self.aid = appid if (appid and len(appid)>20) else DEFAULT_APPID
        self.s = requests.Session()
        requests.packages.urllib3.disable_warnings()

    def post(self, url, data, is_ios=False):
        try:
            if is_ios:
                ua = "ChinaUnicom4.x/12.2 (com.chinaunicom.mobilebusiness; build:44; iOS 26.2) Alamofire/4.7.3 unicom{version:iphone_c@12.0200}"
            else:
                ua = f"Mozilla/5.0 (Linux; Android 13; M2007J3SC) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/107.0 Mobile Safari/537.36; unicom{{version:android@11.0800,desmobile:{self.phone}}};devicetype{{deviceBrand:Xiaomi,deviceModel:M2007J3SC}};"
            
            h = {'Host':'m.client.10010.com', 'User-Agent': ua, 'Content-Type':'application/x-www-form-urlencoded', 'X-Requested-With':'com.sinovatech.unicom.ui'}
            r = self.s.post(url, headers=h, data=data, timeout=15, verify=False)
            try: return r.json()
            except: return {"code":"Err", "msg":"HTML响应(IP被风控)"}
        except Exception as e: return {"code":"Err", "msg":"请求异常"}

    def validateTencentCaptcha(self, mobileHex, ticket, randStr):
        url = "https://loginxhm.10010.com/login-web/v1/chartCaptcha/validateTencentCaptcha"
        payload = {"seq": uuid.uuid4().hex, "captchaType": "10", "mobile": mobileHex, "ticket": ticket, "randStr": randStr, "imei": self.did}
        h = {"Content-Type":"application/json", "Origin": "https://img.client.10010.com", "Referer": "https://img.client.10010.com/loginRisk/index.html"}
        try:
            r = self.s.post(url, headers=h, json=payload, timeout=15, verify=False)
            return r.json()
        except: return {"code":"Err", "msg":"滑块校验网络异常"}

    # 1. 密码登录流程 (使用 iOS 协议)
    def login_pwd(self, pwd, resultToken=""):
        url = "https://m.client.10010.com/mobileService/login.htm"
        t = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        enc_mobile = quote(self.e.rsa(self.phone, False))
        enc_pwd = quote(self.e.rsa(pwd, True))
        
        d = f"deviceOS=26.2&mobile={enc_mobile}&netWay=wifi&deviceCode={self.did}&deviceId={self.did}&uniqueIdentifier={self.did}&version=iphone_c@12.0200&password={enc_pwd}&appId={self.aid}&pip=10.98.155.187&reqtime={quote(t)}&isRemberPwd=false&keyVersion=2"
        if resultToken:
            d += f"&resultToken={quote(resultToken)}"

        res = self.post(url, d, is_ios=True)
        
        code = str(res.get("code", ""))
        if code in ["0", "0000"]:
            return {"status": "success", "data": res}
        
        # 触发滑块风控拦截
        dsc = str(res.get("desc") or res.get("dsc") or res.get("rsp_desc") or "")
        if code in ["ECS99998", "ECS99999"] or "ECS1164" in dsc or "滑块" in dsc or "安全" in dsc:
            return {"status": "need_captcha", "msg": dsc, "mobile": res.get("mobile") or enc_mobile}
            
        return {"status": "fail", "msg": f"登录失败: {dsc} [{code}]"}

    # 2. 短信发送流程 (使用 Android 协议)
    def send_sms(self, resultToken=""):
        url = "https://m.client.10010.com/mobileService/sendRadomNum.htm"
        t = datetime.now().strftime('%Y%m%d%H%M%S')
        mobile = quote(self.e.rsa(self.phone, False))
        
        d = f"isFirstInstall=1&simCount=1&yw_code=&deviceOS=android13&mobile={mobile}&netWay=Wifi&loginCodeLen=6&deviceId={self.did}&deviceCode={self.did}&version=android@11.0800&send_flag=&resultToken={quote(resultToken)}&keyVersion=&provinceChanel=general&appId={self.aid}&deviceModel=M2007J3SC&androidId={self.did[:16]}&deviceBrand=Xiaomi&timestamp={t}"
        res = self.post(url, d, is_ios=False)
        
        code = str(res.get("code", ""))
        dsc = str(res.get("desc") or res.get("dsc") or res.get("rsp_desc") or "")
        
        if code in ["0", "0000"] or str(res.get("rsp_code")) == "0000" or str(res.get("status")) == "success":
            return {"status": "success", "msg": "验证码已发送", "data": res}
            
        if code in ["ECS99998", "ECS99999"] or "ECS1164" in dsc:
            return {"status": "need_captcha", "msg": dsc, "mobile": res.get("mobile") or mobile}
            
        return {"status": "fail", "msg": f"发送失败: {dsc}"}

    # 3. 短信登录流程 (使用 Android 协议)
    def login_sms(self, code):
        url = "https://m.client.10010.com/mobileService/radomLogin.htm"
        t = datetime.now().strftime('%Y%m%d%H%M%S')
        mobile = quote(self.e.rsa(self.phone, False))
        pwd = quote(self.e.rsa(code, False))
        d = f"isFirstInstall=1&simCount=1&yw_code=&loginStyle=0&isRemberPwd=true&deviceOS=android13&mobile={mobile}&netWay=Wifi&version=android@11.0800&deviceId={self.did}&password={pwd}&keyVersion=&provinceChanel=general&appId={self.aid}&deviceModel=M2007J3SC&androidId={self.did[:16]}&deviceBrand=Xiaomi&timestamp={t}"
        
        res = self.post(url, d, is_ios=False)
        
        if str(res.get("code")) in ["0", "0000"]:
            return {"status": "success", "data": res}
        return {"status": "fail", "msg": f"登录失败: {res.get('desc','未知')} [{res.get('code')}]"}

# ----------------- 统一路由分发 -----------------
@app.route('/api', methods=['POST'])
def api_handler():
    try:
        input_data = request.json
        action = input_data.get('action')
        phone = input_data.get('phone', '')
        appid = input_data.get('appid', '')
        
        if not phone: return jsonify({"status":"fail","msg":"手机号不能为空"})
        
        did = session.get('deviceId')
        if not did:
            did = uuid.uuid4().hex
            session['deviceId'] = did
        u = UnicomClient(phone, appid, did)
        
        # 1. 发送短信
        if action == 'send_sms':
            res = u.send_sms(input_data.get('resultToken', ''))
            if res.get('status') == 'need_captcha':
                session['mobileHex'] = res.get('mobile')
            return jsonify(res)
            
        # 2. 短信验证码登录
        elif action == 'login_sms':
            code = input_data.get('code', '')
            if not code: return jsonify({"status":"fail","msg":"验证码不能为空"})
            res = u.login_sms(code)
            if res.get('status') == 'success':
                d = res['data']
                full_data = f"{phone}#{code}#{d.get('token_online','')}#{d.get('ecs_token','')}#{u.aid}"
                return jsonify({"status":"success", "full":full_data})
            return jsonify(res)

        # 3. 密码直接登录
        elif action == 'login_pwd':
            pwd = input_data.get('pwd', '')
            if not pwd: return jsonify({"status":"fail","msg":"密码不能为空"})
            res = u.login_pwd(pwd, input_data.get('resultToken', ''))
            if res.get('status') == 'need_captcha':
                session['mobileHex'] = res.get('mobile')
                return jsonify(res)
            elif res.get('status') == 'success':
                d = res['data']
                full_data = f"{phone}#{pwd}#{d.get('token_online','')}#{d.get('ecs_token','')}#{u.aid}"
                return jsonify({"status":"success", "full":full_data})
            return jsonify(res)

        # 4. 验证滑块
        elif action == 'validate':
            ticket, randstr = input_data.get('ticket'), input_data.get('randstr')
            mobileHex = session.get('mobileHex', '')
            res = u.validateTencentCaptcha(mobileHex, ticket, randstr)
            if str(res.get("code")) == "0000":
                return jsonify({"status":"success","resultToken":res.get("data",{}).get("resultToken","")})
            return jsonify({"status":"fail", "msg":"滑块校验失败"})
            
    except Exception as e:
        return jsonify({"status":"fail","msg":f"服务器内部错误"})

@app.route('/')
def idx():
    return render_template_string(HTML)

# ----------------- 前端 HTML -----------------
HTML="""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>联通 Token 获取 (双通道旗舰版)</title>
<script src="https://turing.captcha.qcloud.com/TJCaptcha.js"></script>

<style>
body{font-family:'Segoe UI',Roboto,sans-serif;background:#f0f2f5;display:flex;justify-content:center;padding-top:30px;margin:0;}
.box{background:#fff;padding:25px;border-radius:12px;width:100%;max-width:420px;box-shadow:0 6px 20px rgba(0,0,0,0.08);margin-bottom:30px;}
h3{text-align:center;color:#333;margin-bottom:20px;font-weight:600}

/* Tab 样式 */
.tabs{display:flex;margin-bottom:20px;border-radius:8px;overflow:hidden;background:#f8f9fa;border:1px solid #ddd;}
.tab{flex:1;text-align:center;padding:12px;cursor:pointer;font-size:15px;color:#555;transition:0.3s;font-weight:600;}
.tab.active{background:#007bff;color:#fff;}

.notice{background:#fff7e6;border:1px solid #ffe0b2;border-radius:8px;padding:12px;margin-bottom:16px}
.notice-title{font-weight:700;color:#7a4a00;margin-bottom:6px;font-size:14px;}
.notice-text{font-size:13px;color:#6b4b16;line-height:1.6}

input{width:100%;padding:12px;margin-bottom:12px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;font-size:14px;}
input:disabled{background:#f5f5f5;color:#888;}

.ph-wrap{position:relative}
.ph-suggest{position:absolute;left:0;right:0;top:46px;background:#fff;border:1px solid #ddd;border-radius:6px;box-shadow:0 6px 16px rgba(0,0,0,0.08);z-index:10;display:none;max-height:200px;overflow:auto}
.ph-item{padding:10px 12px;cursor:pointer;font-size:14px}
.ph-item:hover{background:#f3f5f7}
.ph-empty{padding:10px 12px;color:#888;font-size:13px}

button{width:100%;padding:12px;border:none;border-radius:6px;color:#fff;font-weight:bold;cursor:pointer;font-size:15px;transition:0.2s}
button:active{transform:scale(0.98)}
.btn-login{background:#007bff;margin-top:5px;}
.btn-send{background:#28a745;}

.res-box{display:none;margin-top:15px}
.res-content{background:#1e1e1e;color:#fff;padding:15px;border-radius:8px;font-size:13px;word-break:break-all;font-family:Consolas,monospace;line-height:1.5;}
.msg-box{text-align:center;font-size:14px;margin-top:10px;padding:10px;border-radius:6px;display:none}
.msg-err{background:#fee;color:#c00;border:1px solid #fcc}
.msg-succ{background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9}

.radio-group{display:flex;gap:15px;margin-bottom:10px;align-items:center}
.radio-label{font-size:13px;cursor:pointer;color:#444;display:flex;align-items:center;gap:4px}

/* 彩虹色定义 */
.c-phone{color:#00e676;font-weight:bold}
.c-pwd{color:#ff4081;font-weight:bold} 
.c-token{color:#40c4ff} 
.c-ecs{color:#ea80fc} 
.c-appid{color:#ffd740} 
.c-sep{color:#555} 
</style>
</head>
<body>

<div class="box">
    <h3>联通 Token 获取</h3>
    
    <div class="tabs">
        <div id="tab-pwd" class="tab active" onclick="switchTab('pwd')">🔑 密码登录</div>
        <div id="tab-sms" class="tab" onclick="switchTab('sms')">📱 短信登录</div>
    </div>

    <div class="notice">
        <div class="notice-title">💡 通道说明</div>
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
        <span style="font-size:13px;font-weight:bold;color:#333">设备指纹:</span>
        <label class="radio-label"><input type="radio" name="amode" value="builtin" checked> 内置</label>
        <label class="radio-label"><input type="radio" name="amode" value="random"> 随机</label>
        <label class="radio-label"><input type="radio" name="amode" value="custom"> 自定义</label>
    </div>
    <input type="text" id="adv" placeholder="将自动使用后台AppId建议使用随机" disabled>

    <div id="area-pwd">
        <input type="password" id="pwd" placeholder="请输入联通登陆密码">
        <button class="btn-login" id="btn-login-pwd" onclick="doLoginPwd()">立即登录获取 Token</button>
    </div>

    <div id="area-sms" style="display:none;">
        <input type="text" id="sms-pwd" placeholder="输入联通登陆密码(仅用于生成长效配置串,可选)">
        <div style="display:flex;gap:10px;margin-bottom:12px;">
            <input type="text" id="cd" placeholder="短信验证码" maxlength="6" style="margin-bottom:0;">
            <button class="btn-send" id="btn-send" style="width:140px;font-size:14px;padding:0;" onclick="doSendSms()">获取验证码</button>
        </div>
        <button class="btn-login" id="btn-login-sms" onclick="doLoginSms()">验证并获取 Token</button>
    </div>

    <div id="msg" class="msg-box"></div>

    <div id="res" class="res-box">
        <div class="msg-succ" style="margin-bottom:10px">✅ 获取成功！</div>
        <div id="res-html" class="res-content"></div>
        <textarea id="res-raw" style="display:none"></textarea>
        <textarea id="res-simple-raw" style="display:none"></textarea>
        <button style="background:#28a745;width:100%;margin-top:10px" onclick="copyRaw()">📋 复制完整数据</button>
        <button style="background:#ff9800;width:100%;margin-top:8px" onclick="copySimple()">📋 复制 简易版(token#appid)</button>
    </div>
</div>

<script>
let currentMode = 'pwd';
const CAPTCHA_APPID = "195809716";

// ------ 界面切换 ------
function switchTab(mode) {
    currentMode = mode;
    document.getElementById('msg').style.display = 'none';
    document.getElementById('res').style.display = 'none';
    
    if(mode === 'pwd') {
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

// ------ 手机号历史缓存 ------
const PHONE_HISTORY_KEY = "phone_history";
function loadPhoneHistory(){
    try{ const list = JSON.parse(localStorage.getItem(PHONE_HISTORY_KEY)); return Array.isArray(list)?list:[]; }catch(e){ return []; }
}
function savePhoneHistory(phone){
    try{
        if(phone.length !== 11) return;
        let list = [phone, ...loadPhoneHistory().filter(v => v !== phone)].slice(0, 10);
        localStorage.setItem(PHONE_HISTORY_KEY, JSON.stringify(list));
    }catch(e){}
}
function renderPhoneSuggest(keyword){
    const box = document.getElementById('ph-suggest');
    const list = loadPhoneHistory().filter(v => v.includes(keyword));
    box.innerHTML = '';
    if(!list.length){ box.style.display = 'none'; return; }
    list.forEach(v=>{
        const item = document.createElement('div'); item.className = 'ph-item'; item.textContent = v;
        item.onmousedown = () => { document.getElementById('ph').value = v; box.style.display = 'none'; };
        box.appendChild(item);
    });
    box.style.display = 'block';
}
document.getElementById('ph').oninput = (e) => renderPhoneSuggest(e.target.value);
document.getElementById('ph').onfocus = (e) => renderPhoneSuggest(e.target.value);
document.getElementById('ph').onblur = () => setTimeout(()=>document.getElementById('ph-suggest').style.display='none', 150);

// ------ AppId 逻辑 ------
function getFinalAppId(){
    let mode = document.querySelector('input[name="amode"]:checked').value;
    return mode === 'builtin' ? '' : document.getElementById('adv').value;
}
document.querySelectorAll('input[name="amode"]').forEach(r => {
    r.addEventListener('change', () => {
        let adv = document.getElementById('adv');
        if(r.value === 'builtin'){ adv.disabled=true; adv.value=''; adv.placeholder='将自动使用后台高权重AppId'; }
        else if(r.value === 'random'){ adv.disabled=true; adv.value=generateAppId(); adv.placeholder=''; }
        else { adv.disabled=false; adv.value=''; adv.placeholder='请粘贴自己抓包的真实AppId'; }
    });
});
function generateAppId(){
    function rnd(){ return String(Math.floor(Math.random()*10)); }
    return rnd()+"f"+rnd()+"af"+rnd()+rnd()+"ad"+rnd()+"912d306b5053abf90c7ebbb695887bc870ae0706d573c348539c26c5c0a878641fcc0d3e90acb9be1e6ef858a59af546f3c826988332376b7d18c8ea2398ee3a9c3db947e2471d32a49612";
}

// ------ 核心网络请求 ------
function showMsg(t, isErr){
    let m = document.getElementById('msg');
    m.innerText = t; m.className = 'msg-box ' + (isErr?'msg-err':'msg-succ'); m.style.display = 'block';
}

function renderResult(fullStr) {
    let parts = fullStr.split('#');
    let html = `<span class="c-phone">${parts[0]}</span><span class="c-sep">#</span>` +
               `<span class="c-pwd">${parts[1]}</span><span class="c-sep">#</span>` +
               `<span class="c-token">${parts[2]}</span><span class="c-sep">#</span>` +
               `<span class="c-ecs">${parts[3]}</span><span class="c-sep">#</span>` +
               `<span class="c-appid">${parts[4]}</span>`;
    document.getElementById('res-html').innerHTML = html;
    document.getElementById('res-raw').value = fullStr;
    try{ document.getElementById('res-simple-raw').value = parts[2] + "#" + parts[4]; }catch(e){}
    document.getElementById('res').style.display = 'block';
}

// 滑块唤起器
async function callCaptcha(actionType, phone, appid, extraData) {
    if(typeof TencentCaptcha!=='function'){ showMsg('滑块组件加载失败，请刷新页面','err'); return; }
    
    let captcha = new TencentCaptcha(CAPTCHA_APPID, async function(res){
        if(res.ret === 0){
            showMsg('滑块验证成功，正在请求...', false);
            try{
                let vr = await fetch('/api', {method:'POST', headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({action:'validate', ticket:res.ticket, randstr:res.randstr, phone:phone, appid:appid})});
                let vd = await vr.json();
                
                if(vd.status === 'success') {
                    if(actionType === 'login_pwd') doLoginPwd(extraData.pwd, vd.resultToken);
                    if(actionType === 'send_sms') doSendSms(vd.resultToken);
                } else { showMsg(vd.msg||'滑块后端校验失败','err'); }
            }catch(e){ showMsg('网络异常','err'); }
        } else { showMsg('您取消了安全验证','err'); }
    });
    captcha.show();
}

// 密码登录流程
async function doLoginPwd(pwdStr, resultToken="") {
    let p = document.getElementById('ph').value;
    let pwd = pwdStr || document.getElementById('pwd').value;
    let aid = getFinalAppId();
    let btn = document.getElementById('btn-login-pwd');
    
    if(!p || !pwd){ showMsg('手机号和密码不能为空', true); return; }
    savePhoneHistory(p);
    
    btn.disabled = true; btn.innerText = '正在验证...';
    try{
        let r = await fetch('/api',{method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({action:'login_pwd', phone:p, pwd:pwd, appid:aid, resultToken:resultToken})});
        let d = await r.json();
        
        if(d.status === 'success'){
            showMsg('登录成功！', false);
            renderResult(d.full);
        } else if(d.status === 'need_captcha') {
            showMsg('触发安全风控，请完成拼图', true);
            await callCaptcha('login_pwd', p, aid, {pwd: pwd});
        } else { showMsg(d.msg, true); }
    }catch(e){ showMsg('网络异常', true); }
    btn.disabled = false; btn.innerText = '立即登录获取 Token';
}

// 短信发送流程
async function doSendSms(resultToken="") {
    let p = document.getElementById('ph').value;
    let aid = getFinalAppId();
    let btn = document.getElementById('btn-send');
    
    if(!p){ showMsg('请输入手机号', true); return; }
    savePhoneHistory(p);
    
    btn.disabled = true; btn.innerText = '发送中...';
    try{
        let r = await fetch('/api',{method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({action:'send_sms', phone:p, appid:aid, resultToken:resultToken})});
        let d = await r.json();
        
        if(d.status === 'success'){ showMsg('验证码已下发', false); }
        else if(d.status === 'need_captcha'){
            showMsg('需要安全验证', true);
            await callCaptcha('send_sms', p, aid, {});
        } else { showMsg(d.msg, true); }
    }catch(e){ showMsg('网络异常', true); }
    btn.disabled = false; btn.innerText = '获取验证码';
}

// 短信验证码登录
async function doLoginSms() {
    let p = document.getElementById('ph').value;
    let c = document.getElementById('cd').value;
    let smsPwd = document.getElementById('sms-pwd').value || c; // 如果没填密码，则使用验证码补位
    let aid = getFinalAppId();
    let btn = document.getElementById('btn-login-sms');
    
    if(!p || !c){ showMsg('验证码不能为空', true); return; }
    
    btn.disabled = true; btn.innerText = '验证中...';
    try{
        let r = await fetch('/api',{method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({action:'login_sms', phone:p, code:c, appid:aid})});
        let d = await r.json();
        
        if(d.status === 'success'){
            showMsg('登录成功！', false);
            // 巧妙替换第二位为密码
            let modifiedFull = d.full.split('#');
            modifiedFull[1] = smsPwd; 
            renderResult(modifiedFull.join('#'));
        } else { showMsg(d.msg, true); }
    }catch(e){ showMsg('网络异常', true); }
    btn.disabled = false; btn.innerText = '验证并获取 Token';
}

// ------ 复制功能 ------
function copyRaw(){
    let t = document.getElementById('res-raw');
    t.style.display='block'; t.select(); document.execCommand('copy'); t.style.display='none';
    alert('已复制完整配置数据');
}
function copySimple(){
    let t = document.getElementById('res-simple-raw');
    t.style.display='block'; t.select(); document.execCommand('copy'); t.style.display='none';
    alert('已复制简易版');
}
</script>
</body>
</html>
"""

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)