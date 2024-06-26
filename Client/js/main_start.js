'use strict';

var localUserId = "";
var userName = ""; 

const nameInput = document.getElementById("nameInput");
const submitButton = document.getElementById("submitButton");
const outputElement = document.getElementById("output");

submitButton.addEventListener("click", () => {
    userName = nameInput.value;
    localUserId = userName;
    console.log(`您输入的姓名是：${userName}`);
    var jsonMsg = {
    'cmd': 'connect',
    'name': userName,
    };
    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);
});


var IS_PAGE = '';

var iscall = 0;


//加入广播判断条件，0为加入普通房间，1为加上广播房间
var notice = 0;

// 获取页面来源信息
const sourcePage = localStorage.getItem('sourcePage');

if (sourcePage === 'SD') {
  // 来自页面 B 的逻辑
  console.log("1111SD");
  IS_PAGE = 'SD';
} else if (sourcePage === 'YY') {
  // 来自页面 C 的逻辑

  IS_PAGE = 'YY';
  start();
  record();
  console.log("1111YY");
}

// const synth = window.speechSynthesis;

var remotename = null;

var stoproom = 0;
var startroom = 0;

//join 主动加入房间
//leave 主动离开房间
//new_peer 有人加入房间，通知已经在房间的人
//peer-leave 有人离开房间，通知已经在房间的人
//offer 发送offer给对端peer
//answer 发送offer给对端peer
//candidate 发送candidate给对点peer
const SIGNAL_TYPE_JOIN = "join"; 
const SIGNAL_TYPE_RESP_JOIN = "resp-join";  //告知加入者对方是谁
const SIGNAL_TYPE_LEAVE = "leave";
const SIGNAL_TYPE_NEW_PEER = "new-peer";
const SIGNAL_TYPE_PEER_LEAVE = "peer-leave";
const SIGNAL_TYPE_OFFER = "offer";
const SIGNAL_TYPE_ANSWER = "answer";
const SIGNAL_TYPE_CANDIDATE = "candidate";
var flag = 0;
var ClientMap = new Map();

function Client(remoteid, remotecp, viodeo){
    this.remoteid = remoteid;
    this.remotecp = remotecp;
    this.viodeo = viodeo;
}



console.log("本地id = " + localUserId);
var roomId = 0;
var formattedStartTime = null; //记录加入音频时的开始时间
// 获取视频容器videoContainer
const videoContainer = document.getElementById('videoContainer');

var localVideo = document.querySelector('#localVideo');
// var remoteVideo1 = document.querySelector('#remotelVideo1');
// var remoteVideo2 = document.querySelector('#remotelVideo2');
// var remoteVideo3 = document.querySelector('#remotelVideo3');
// var remoteVideo4 = document.querySelector('#remotelVideo4');
// var remoteVideo5 = document.querySelector('#remotelVideo5');
var localStream = null;     //本地流
var remoteStream = null;
var Recording_is_allowed = 0;  //是否允许录制本地音频
var zeroRTCEngine;

let chunks = []; // 用于存储录制的音频数据块
let chunkslocale = []; // 用于存储录制的音频数据块
var mediaRecorder = null;
var mediaRecorderLocale = null;

var isComplete = 0; //标记是否为最后一个音频块

var MediaRecorderStream = null;

function handleRemoteStreamAdd(event,remoteUid){
    console.info("成功添加视频");
    remoteStream = event.streams[0];
    ClientMap.get(remoteUid).viodeo.srcObject = remoteStream;

    if(remoteStream != null && localStream != null && Recording_is_allowed == 1){
        console.log("开始录制音频" + remoteStream);
        Recording_is_allowed = 0;
        mediaRecorderLocale = new MediaRecorder(localStream);  // 设置 timeslice 为 1000 毫秒
            // mediaRecorderLocale.ondataavailable = function(e) {
            //     if (e.data.size > 0) {
            //         chunkslocale.push(e.data); // 将录制的音频数据块存储到数组中
            //     }                                                               
            // };
            mediaRecorderLocale.ondataavailable = function (e) {
                console.log("进入音频发送函数");
                if (e.data.size > 0) {
                    console.log("发送音频到服务器");
                    chunkslocale.push(e.data); // 将录制的音频数据块存储到数组中
            
                    // 边录边上传音频数据块到服务器
                    const formData = new FormData();
                    formData.append('audio', new Blob([e.data], { type: 'audio/wav' }));
                    formData.append('userId', `${userName}`); // 替换为实际的用户ID
                    formData.append('fileName', `${formattedStartTime}.wav`); // 替换为实际的文件名
                    formData.append('isComplete', `${isComplete}`); // 替换为实际的文件名
                    formData.append('clientDirectory', `${roomId}`); //
                    fetch('http://81.70.96.128:20020/upload', {
                        method: 'POST',
                        body: formData,
                    })
                    .then(response => response.text())
                    .then(data => console.log(data)); // 在控制台打印服务器返回的文本数据
                }
            };
            //mediaRecorder.start();
            const startTime = new Date(); // 获取当前时间
            formattedStartTime = startTime.toISOString();
            console.log("当前时间" + formattedStartTime);
            mediaRecorderLocale.start(1000);
        //});
    }else{
        console.log("音频没有准备就绪，等待中");
        return;
    }

}


// // 将音频 Blob 存储到文件的示例函数
// function saveAudioBlobToFile(blob) {
//     const url = URL.createObjectURL(blob);

//     // 创建一个链接并下载录制的音频文件
//     const a = document.createElement('a');
//     a.style.display = 'none';
//     a.href = url;
//     a.download = 'recorded_audio.wav'; // 指定文件名
//     document.body.appendChild(a);
//     a.click();
//     window.URL.revokeObjectURL(url);

//     // 移除链接元素
//     document.body.removeChild(a);
// }

function handleconnectionstatechange(){
    console.info("iceconnectionstate -> ------------------------------------------------");
    if(pc != null){
        console.info("connectionstate -> " + pc.connectionState);
    }
}

function handleiceconnectionstatechange(){
    console.info("iceconnectionstate -> +++++++++++++++++++++++++++++++++++++++++++++++++");
    if(pc != null){
        console.info("iceconnectionstate -> " + pc.iceConnectionState);
    }
}

function handleTceCandidate(event,remoteUserId){
    if(event.candidate){
        var jsonMsg = {
            'cmd': 'candidate',
            'roomId': roomId,
            'uid': localUserId,
            'remoteUid': remoteUserId,
            'msg': JSON.stringify(event.candidate)
        };
        var message = JSON.stringify(jsonMsg);
        zeroRTCEngine.sendMessage(message);
        //console.info("handleTceCandidate message: "+ message);
        console.info("成功发送 candidate message");
    }else{
        console.warn("发送失败 candidates");
    }
}

function createPeerConnection(remoteUid){
    var defaultConfiguration = {
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
        iceTransportPolicy: "all",       //relay 或者 all 
        iceServers: [
            {
                "urls": [
                    "turn:192.144.215.114:3478?transport=udp",
                    "turn:192.144.215.114:3478?transport=tcp"
                ],
                "username": "rzyk",
                "credential": "123456"
            },
            {
                "urls": [
                    "stun:192.144.215.114:3478"
                ]
            }
        ]
    };
    const hasKey = ClientMap.has(remoteUid);
    if(hasKey == true){
        let pc = new RTCPeerConnection(defaultConfiguration);
        ClientMap.get(remoteUid).remotecp = pc;
        pc.onicecandidate = (event) => {
            handleTceCandidate(event,remoteUid);
        };
        //pc.ontrack = handleRemoteStreamAdd;
        pc.ontrack = (event) =>{
            handleRemoteStreamAdd(event,remoteUid);
        }
        //pc.onconnectionstatechange = handleconnectionstatechange;
        //pc.oniceconnectionstatechange = handleiceconnectionstatechange;

        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }
}

function createOfferAndSendMessage(session,remoteUid){
    ClientMap.get(remoteUid).remotecp.setLocalDescription(session)
        .then(function(){
            var jsonMsg = {
                'cmd': 'offer',
                'roomId': roomId,
                'uid': localUserId,
                'remoteUid': remoteUid,
                'msg': JSON.stringify(session)
            };
            var message = JSON.stringify(jsonMsg);
            zeroRTCEngine.sendMessage(message);
            //console.info("send offer message: "+ message);
            console.info("offer 发送成功");

        })
        .catch(function(error){
            console.error("offer setLocalDescription failed: " + error);
        });
}

function handleCreateOfferError(error){
    console.error("offer setLocalDescription failed: " + error);
}

function createAnswerAndSendMessage(session,remoteUid){
    ClientMap.get(remoteUid).remotecp.setLocalDescription(session)
        .then(function(){
            var jsonMsg = {
                'cmd': 'answer',
                'roomId': roomId,
                'uid': localUserId,
                'remoteUid': remoteUid,
                'msg': JSON.stringify(session)
            };
            console.log("createAnswerAndSendMessage uid = " + localUserId + "  remoteUid" + remoteUid);
            var message = JSON.stringify(jsonMsg);
            zeroRTCEngine.sendMessage(message);
            //console.info("send answer message: "+ message);
            console.info("成功发送 answer message");
        })
        .catch(function(error){
            console.error("answer setLocalDescription failed: " + error);
        });
}

function handleCreateAnswerError(error){
    console.error("answer setLocalDescription failed: " + error);
}

var ZeroRTCEngine = function(wsUrl){
    this.init(wsUrl);
    zeroRTCEngine = this;
    return this;
}

ZeroRTCEngine.prototype.init = function(wsUrl){
    //设置websocket url
    this.wsUrl = wsUrl;
    /* wensocket 对象*/
    this.signaling = null;
}

ZeroRTCEngine.prototype.createWebsocket = function(){
    zeroRTCEngine = this;
    zeroRTCEngine.signaling = new WebSocket(this.wsUrl);

    zeroRTCEngine.signaling.onopen = function(){
        zeroRTCEngine.onOpen();
    }

    zeroRTCEngine.signaling.onmessage = function(ev){
        zeroRTCEngine.onMessage(ev);
    }

    zeroRTCEngine.signaling.onerror = function(ev){
        zeroRTCEngine.onError(ev);
    }

    zeroRTCEngine.signaling.onclose = function(ev){
        zeroRTCEngine.onClose(ev);
    }
}

ZeroRTCEngine.prototype.onOpen = function(){
    console.log("wensocket open");
}

ZeroRTCEngine.prototype.onMessage = function(event){
    //console.log("onMessage: " + event.data);
    try{
        var jsonMsg = JSON.parse(event.data);
        if (jsonMsg.type == "heartbeat reply") {
            console.log('Received heartbeat reply.');
            return;
        }
    }catch(e){
        console.warn("onMessage parse Josn failed:" + e);
        return;
    }
    
    switch(jsonMsg.cmd){
        case SIGNAL_TYPE_NEW_PEER:
            handleRemoteNewPeer(jsonMsg);
            break;
        case SIGNAL_TYPE_PEER_LEAVE:
            handleRemotePeerLeave(jsonMsg);
            break;
        case SIGNAL_TYPE_OFFER:
            handleRemoteOffer(jsonMsg);
            break;
        case SIGNAL_TYPE_ANSWER:
            handleRemoteAnswer(jsonMsg);
            break;
        case SIGNAL_TYPE_CANDIDATE:
            handleRemoteCandidate(jsonMsg);
            break;     
        case "find_ture":
            handlecallback(jsonMsg);   
            break;
        case "invate":
            handlinvate(jsonMsg);
            break;
        case "find_false":
            handlfind_false(jsonMsg);
            break;
        case "Room_to_destroy":
            hangup();
            break;
        case "start_broadcast":
            start_broadcast();
            break;
        case "_destroy_Room":
            doLeave();
            break;
    }
}

function start_broadcast(){
    roomId = '广播专属房间';
    notice = 1;
    initLocalStream();
}

function handlfind_false(msg){
    // const utterance = new SpeechSynthesisUtterance(msg.name + "不在线或者不存在该用户");
    // // 播放语音
    // synth.speak(utterance);
    TTS_sendText(msg.name + "不在线或者不存在该用户",localUserId + roomid(8));
}

function handlinvate(msg){
    roomId = msg.roomId;
    initLocalStream();
}

function handlecallback(msg){
    console.log("手动服务器数据" + msg.name);
    // const utterance = new SpeechSynthesisUtterance("请您核对拨打" + msg.name + "电话，信息是否正确");
    // // 播放语音
    // synth.speak(utterance);
    TTS_sendText("请您核对拨打" + msg.name + "电话，信息是否正确",localUserId + roomid(8));
    remotename = msg.name;
    stoproom = 0;
    startroom = 1;
}

ZeroRTCEngine.prototype.onError = function(event){
    console.log("onError: " + event.data);
}

ZeroRTCEngine.prototype.onClose = function(event){
    console.log("onClose -> code:  " + event.code + ", reason: " + EventTarget.reason);
}

ZeroRTCEngine.prototype.closeWebsocket = function() {
    if (this.signaling && this.signaling.readyState === WebSocket.OPEN) {
        this.signaling.close();
    }
};

window.addEventListener('beforeunload', function(event) {
    if (zeroRTCEngine) {
        zeroRTCEngine.closeWebsocket();
    }
});


ZeroRTCEngine.prototype.sendMessage = function(message){
    this.signaling.send(message);
}

function handleResponseJoin(message){
    console.info("handleResponseJoin, remoteUid: " + message.remoteUid);
    remoteUserId = message.remoteUid;
    // doOffer();
}
 
function handleRemotePeerLeave(message){
    console.info("有人离开了, remoteUid: " + message.remoteUid);
    if(ClientMap.get(message.remoteUid)){
        console.log("关闭对方显示成功");
        ClientMap.get(message.remoteUid).viodeo.srcObject = null;
    }
    if(ClientMap.get(message.remoteUid).remotecp != null){
        ClientMap.get(message.remoteUid).remotecp.close();
        ClientMap.get(message.remoteUid).remotecp = null;
    }
    ClientMap.delete(message.remoteUid);
}

function createRemoteVideoElement(id) {
    const videoElement = document.createElement('video');
    videoElement.id = `remoteVideo${id}`;
    videoElement.autoplay  = true;
    videoElement.playsinline = true;
    return videoElement;
}
  
  

function handleRemoteNewPeer(message){
    remotename = message.remoteUid;
    console.info("有新人加入房间: " + remotename);
    const remoteVideo1 = createRemoteVideoElement(message.remoteUid);
    videoContainer.appendChild(remoteVideo1);
    let client = new Client(message.remoteUid,null,remoteVideo1);
    ClientMap.set(message.remoteUid,client);
    doOffer(message.remoteUid);
}

//服务器之间将对端数据发送过来，所以uid就是对端id
function handleRemoteOffer(message){
    console.log("收到offer remoteUid = " + message.uid + " uid = " + message.remoteUid);
    let remoteUid = message.uid;
    if(ClientMap.get(remoteUid) == null){
        const remoteVideo1 = createRemoteVideoElement(remoteUid);
        videoContainer.appendChild(remoteVideo1);
        let client = new Client(remoteUid,null,remoteVideo1);
        ClientMap.set(remoteUid,client);
        createPeerConnection(remoteUid);
    }
    var desc = JSON.parse(message.msg);
    ClientMap.get(remoteUid).remotecp.setRemoteDescription(desc);
    doAnswer(remoteUid);
}

//服务器之间将对端数据发送过来，所以uid就是对端id
function handleRemoteAnswer(message){
    var desc = JSON.parse(message.msg);
    ClientMap.get(message.uid).remotecp.setRemoteDescription(desc);
    console.log("成功收到Answer");
}

function handleRemoteCandidate(message){
    var candidate = JSON.parse(message.msg);
    ClientMap.get(message.uid).remotecp.addIceCandidate(candidate).catch(e =>{
        console.error("addIceCandidate failed:" + e.name);
    });
    console.log("成功收到IceCandidate");
}

function doOffer(remoteUid){
    //创建RTCPeerConnection
    createPeerConnection(remoteUid);
    ClientMap.get(remoteUid).remotecp.createOffer().then(function(session){createOfferAndSendMessage(session,remoteUid);}).catch(handleCreateOfferError);
}

function doAnswer(remoteUid){
    console.log("准备发送Answer");
    ClientMap.get(remoteUid).remotecp.createAnswer().then(function(session){createAnswerAndSendMessage(session,remoteUid)}).catch(handleCreateAnswerError);
}

function doJoin(roomId){
    var jsonMsg = {
        'cmd': 'join',
        'roomId': roomId,
        'uid': userName,
        'notice': notice
    };
    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);
    console.info("doJoin message: "+ message);
}

function docreate(){
    roomId = roomid(6);
    var jsonMsg = {
        'cmd': 'createroom',
        'roomId': roomId,
        'uid': userName,
        'remotename': remotename
    };
    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);
}

function roomid(length) {
    const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let password = "";
  
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
  
    return password;
}

function doLeave(){
    var jsonMsg = {
        'cmd': 'leave',
        'roomId': roomId,
        'uid': localUserId,
    };
    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);
    console.info("doLeave message: "+ message);
    hangup();
}

function hangup(){
    localVideo.srcObject = null; //关闭自己的本地显示
    for(var client of ClientMap.values()){
        client.viodeo.srcObject = null;//关闭对方显示
        if(client.remotecp != null){
        client.remotecp.close(); //关闭RTCPeerConnection
        client.remotecp = null;
    }
    }
    //remoteVideo.srcObject = null; 
    closeLocalStream(); //关闭本地流
    ClientMap.clear();
    //zhuche_mediaRecorder_bakc();
    isComplete = 1;
    mediaRecorderLocale.stop();
    //mediaRecorder.stop();
}

function closeLocalStream(){
    if(localStream != null){
        localStream.getTracks().forEach((track) => {
            track.stop();
        })
    }
}

function openLocalStream(stream){
    console.log('Open local stream');
    if(iscall === 0){
        doJoin(roomId);
    }else if(iscall === 1){
        docreate();
        iscall = 0;
    }
    isComplete = 0;   //录音数据还没开始上传，上传完成之后置1
    localVideo.srcObject = stream;
    localStream = stream;
    MediaRecorderStream = stream;
    Recording_is_allowed = 1;
}


function initLocalStream(){
    navigator.mediaDevices.getUserMedia({
        audio: true,
        //video: true
    })
    .then(openLocalStream)
    .catch(function(e){
        alert("getUserMedia() error: " + e.name)
    });
}

zeroRTCEngine = new ZeroRTCEngine("ws://81.70.96.128:4566");
zeroRTCEngine.createWebsocket();

// 发送心跳包
function sendHeartbeat() {
    const message = JSON.stringify({ "type": 'heartbeat' });
    zeroRTCEngine.sendMessage(message);
}

// 定时发送心跳包
setInterval(sendHeartbeat, 30000);

//注册录音停止回调函数
function zhuche_mediaRecorder_bakc(){
// 停止录制
    // mediaRecorder.onstop = () => {
    //     //const mergedChunks = chunks.concat(chunkslocale);
    //     console.log("进入远端流录音回调函数");
    //     const blob = new Blob(chunks, { type: 'audio/wav' }); // 创建包含录制音频的 Blob 对象
    //     const formData = new FormData(); // 创建表单数据对象
    //     formData.append('audio', blob, 'lisi.wav'); // 将 Blob 对象追加到表单数据中

    //     fetch('http://101.42.12.250:3000/upload', {
    //     //fetch('http://127.0.0.1:3000/upload', {
    //     method: 'POST',
    //     body: formData, // 发送包含录制音频的表单数据的 POST 请求到服务器
    //     })
    //     .then(response => response.text())
    //     .then(data => console.log(data)); // 在控制台打印服务器返回的文本数据

    //     chunks = []; // 重置音频数据块数组
    // };
    mediaRecorderLocale.onstop = () => {
        const blob = new Blob(chunkslocale, { type: 'audio/wav' }); // 创建包含录制音频的 Blob 对象
        const formData = new FormData(); // 创建表单数据对象
        formData.append('audio', blob, `${formattedStartTime}.wav`); // 将 Blob 对象追加到表单数据中

        fetch('http://81.70.96.128:20020/upload', {
        //fetch('http://127.0.0.1:3000/upload', {
        method: 'POST',
        body: formData, // 发送包含录制音频的表单数据的 POST 请求到服务器
        })
        .then(response => response.text())
        .then(data => console.log(data)); // 在控制台打印服务器返回的文本数据

        chunkslocale = []; // 重置音频数据块数组
    };
}

if(IS_PAGE === 'SD'){
    document.getElementById('joinBtn').onclick = function(){
        roomId = document.getElementById('zero-RoomID').value;
        if(roomId =="" || roomId == "请输入房间ID"){
            alert("请输入房间ID");
            return;
        }
        console.log("加入按钮被点击, roomID: " + roomId);
        //初始化本地流
        // 获取当前时间并格式化
        
        initLocalStream();
    }
    
    document.getElementById('leavBtn').onclick = function(){
        console.log("离开按钮被点击");
        doLeave();
    }
}


// 创建语音合成的消息


//保存上一次语言识别结果，防止两条相同指令重复执行
var savemsg = " ";



function printfmessage(mes){
    //console.log("main_start打印的message" + mes);
    var ret = removePunctuation(mes);
    if(ret){
        if(ret != savemsg){
            savemsg = ret;
            if(ret.startsWith('加入')){
                const pattern = /加入(.+)房间/;
                const matches = ret.match(pattern); 
                if (matches && matches.length > 1) {
                    const variablePart = matches[1];
                    console.log(`提取的可变部分：${variablePart}`);
                    roomId = variablePart;
                    // const utterance = new SpeechSynthesisUtterance("请您核对" + ret + "信息是否正确");
                    // // 播放语音
                    // synth.speak(utterance);
                    TTS_sendText("请您核对" + ret + "信息是否正确",localUserId + roomid(8));
                    stoproom = 0;
                    startroom = 1;
                } else {
                    console.log("未找到匹配的可变部分");
                    return;
                }
            }else if(ret.startsWith('退出') || ret.startsWith("结束")){
                if(ret.startsWith('退出')){
                    // const utterance = new SpeechSynthesisUtterance("请问是否确定退出房间");
                    // // 播放语音
                    // synth.speak(utterance);
                    TTS_sendText("请问是否确定退出房间",localUserId + roomid(8));
                }else if(ret.startsWith("结束")){
                    // const utterance = new SpeechSynthesisUtterance("请问是否确定结束通话");
                    // // 播放语音
                    // synth.speak(utterance);
                    TTS_sendText("请问是否确定结束通话",localUserId + roomid(8));
                }
                
                stoproom = 1;
                startroom = 0;
            }
        }
    }
}

//去除所有标点符号
function removePunctuation(str) {
    // 使用正则表达式匹配所有标点符号，并将其替换为空字符串
    const cleanedStr = str.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()，。、！？【】《》（）]/g, '');
    if ((cleanedStr.startsWith('加入') || cleanedStr.startsWith('退出') ) && cleanedStr.endsWith('房间')) {
        return cleanedStr;
    } else if(cleanedStr === "信息正确" || cleanedStr === "确定"){
        if(stoproom === 0 && startroom === 1){
            console.log("加入成功**************************************************");
            initLocalStream();
            startroom = 0;
        }else if(stoproom === 1 && startroom === 0){
            console.log("退出成功**************************************************");
            doLeave();
            stoproom = 0;
        }
    }else if(cleanedStr === "信息错误" && startroom == 1){
        // const utterance = new SpeechSynthesisUtterance("请重新输入");
        // // 播放语音
        // synth.speak(utterance);
        TTS_sendText("请重新输入",localUserId + roomid(8));
    }else if((cleanedStr.startsWith("拨打") || cleanedStr.startsWith("拨通") )&& cleanedStr.endsWith("电话")){
        console.log("-----------------------------OK    ------------------");
        iscall = 1;
        const pattern = /拨打(.+)电话/;
        const matches = cleanedStr.match(pattern); 
        if (matches && matches.length > 1) {
            const variablePart = matches[1];
            console.log(`提取的可变部分：${variablePart}`);
            call(variablePart);
        } else {
            console.log("未找到匹配的可变部分");
            return;
        }
    }else if(cleanedStr == "结束通话"){
        return cleanedStr;
    }else{
        return " ";
    }
}

function call(name){
    var jsonMsg = {
        'cmd': 'call',
        'name': name,
    };
    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);
}

//获取当前时间
function getCurrentDateTime() {
    const currentDate = new Date();

    const year = currentDate.getFullYear();
    const month = padZero(currentDate.getMonth() + 1);  // getMonth 返回的是 0 到 11，因此需要加 1
    const day = padZero(currentDate.getDate());

    const hours = padZero(currentDate.getHours());
    const minutes = padZero(currentDate.getMinutes());
    const seconds = padZero(currentDate.getSeconds());

    const formattedDateTime = `${year}:${month}:${day}-${hours}:${minutes}:${seconds}`;

    return formattedDateTime;
}

// 辅助函数，用于在数字前补零
function padZero(number) {
    return number.toString().padStart(2, '0');
}