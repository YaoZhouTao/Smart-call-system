const { pinyin } = require('pinyin-pro');
const { match } = require('pinyin-pro');
const { UPdateMySQL,InsertyMySQL,deletemysql } = require('./mysql'); // 引入数据库连接函数
var ws = require("nodejs-websocket")
// var port = 8099;
var port = 4566;

//在线用户表
var onlinetable = new Map();

//join 主动加入房间
//leave 主动离开房间
//new_peer 有人加入房间，通知已经在房间的人
//peer-leave 有人离开房间，通知已经在房间的人
//offer 发送offer给对端peer
//answer 发送offer给对端peer
//candidate 发送candidate给对点peer
const SIGNAL_TYPE_JOIN = "join"; 
const SIGNAL_TYPE_RESP_JOIN = "resp-join";  //告知加入者对方是谁
const SIGNAL_TYPE_NEW_PEER = "new-peer";
const SIGNAL_TYPE_PEER_LEAVE = "peer-leave";
const SIGNAL_TYPE_OFFER = "offer";
const SIGNAL_TYPE_ANSWER = "answer";
const SIGNAL_TYPE_CANDIDATE = "candidate";

/* ------- ZeroRTCMap -------*/ 
var ZeroRTCMap = function(){
    this._entrys = new Array();

    this.put = function(key, value){
        if(key == null || key == undefined){
            return;
        }
        var index = this._getIndex(key);
        if(index == -1){
            var entry = new Object();
            entry.key = key;
            entry.value = value;
            this._entrys[this._entrys.length] = entry;
        }else{
            this._entrys[index.value] = value;
        }
    };
    this.get = function(key){
        var index = this._getIndex(key);
        return (index != -1) ? this._entrys[index].value : null;
    };
    this.remove = function(key){
        var index = this._getIndex(key);
        if(index != -1){
            this._entrys.splice(index, 1);
        }
    }; 
    this.clear = function(){
        this._entrys.length = 0;
    };
    this.contains = function(key){
        var index = this._getIndex(key);
        return (index != -1) ? true : false;
    };
    this.size = function(){
        return this._entrys.length;
    };
    this._getEntrys = function(){
        return this._entrys;
    };
    this._getIndex = function(key){
        if(key == null || key == undefined){
            return -1;
        };
        var _length = this._entrys.length;
        for(var i = 0;i < _length;i++){
            var entry = this._entrys[i];
            if(entry == null || entry == undefined){
                continue;
            }
            if(entry.key == key){
                return i;
            }
        }
        return -1;
    };
}

var roomTableMap = new ZeroRTCMap();

function Client(uid, conn, roomId,room_create){
    this.uid = uid;
    this.conn = conn;
    this.roomId = roomId;
    this.room_create = room_create;
}

function handleJoin(message, conn){
    var create_room = 0;
    var roomId = message.roomId;
    var uid = message.uid;
    UPdateMySQL(1,roomId,uid);
    console.info("uid: " + uid + " try to join room " + roomId);

    var roomMap = roomTableMap.get(roomId); //根据房间id查找房间是否存在
    if(roomMap == null){
        create_room = 1;
        console.log('****************************');
        roomMap = new ZeroRTCMap(); //不存在就创建房间Map  key: roomid value: roomMap
        roomTableMap.put(roomId, roomMap);
        const { DateTime } = require("luxon");

        const currentTimeLuxon = DateTime.now().toFormat("yyyy-MM-dd HH:mm:ss");
        // console.log(currentTimeLuxon);
        InsertyMySQL(roomId,currentTimeLuxon,uid);
    }else{
        if(roomMap.size() >= 10){
            console.log("房间人数已经达到上限，请跟换其他房间");
            return null;
        }
    }

    let client = new Client(uid, conn, roomId,create_room);
    roomMap.put(uid, client);
    if(roomMap.size() > 1){
        //房间里面已经有人了，加上新进来的人就有两个人了，所以要通知对方
        let clients = roomMap._getEntrys();
        for(let i in clients){ 
            let remoteUid = clients[i].key;
            if(remoteUid != uid){
                let jsonMsg = {
                    'cmd': SIGNAL_TYPE_NEW_PEER,
                    'remoteUid': uid,
                };
                let msg = JSON.stringify(jsonMsg);
                let remoteClient = roomMap.get(remoteUid);
                console.info("new-peer: " + msg);
                if(remoteClient != null && remoteClient.conn != null){
                    remoteClient.conn.sendText(msg);
                }
            }
        }
    }
    return client;
}

function handleLeave(message){
    var roomId = message.roomId;
    var uid = message.uid;

    UPdateMySQL(0,'',uid);
    deletemysql(uid);

    console.info("uid: " + uid + "leave room" + roomId);

    var roomMap = roomTableMap.get(roomId);
    if(roomMap == null){
        console.error("handleleave can't find then roomId " + roomId);
        return;
    }
    roomMap.remove(uid); //删除发送者
    if(roomMap.size() >= 1){
        var clients = roomMap._getEntrys();
        for(var i in clients){
            var jsonMsg = {
                'cmd': 'peer-leave',
                'remoteUid': uid   //谁离开填写谁
            };
            var msg = JSON.stringify(jsonMsg);
            var remoteUid = clients[i].key;
            var remoteClient = roomMap.get(remoteUid);
            if(remoteClient){
                console.info("notify peer: " + remoteClient.uid + ", uid: " + uid + "leave");
                remoteClient.conn.sendText(msg);
            }
        }
    }
}

function handleForceLeave(client){
    var roomId = client.roomId;
    var uid = client.uid;

    //1.先查找房间号
    var roomMap = roomTableMap.get(roomId);
    if(roomMap == null){
        console.warn("handleForceLeave can't find then roomId " + roomId);
        return;
    }

    //2.判别uid是否在房间
    if(!roomMap.contains(uid)){
        console.info("uid: " + uid + "have leave roomId" + roomId);
        return;
    }

    //3.到这里，说明客户端没有正常离开
    console.info("uid: " + uid + "force leave room" + roomId);

    roomMap.remove(uid); //删除发送者
    if(roomMap.size() >= 1){
        var clients = roomMap._getEntrys();
        for(var i in clients){
            var jsonMsg = {
                'cmd': 'peer-leave',
                'remoteUid': uid   //谁离开填写谁
            };
            var msg = JSON.stringify(jsonMsg);
            var remoteUid = clients[i].key;
            var remoteClient = roomMap.get(remoteUid);
            if(remoteClient){
                console.info("notify peer: " + remoteClient.uid + ", uid: " + uid + "leave");
                remoteClient.conn.sendText(msg);
            }
        }
    }else if(roomMap.size() <= 0){
        roomTableMap.remove(roomId);
    }
}

function handleOffer(message){
    var roomId = message.roomId;
    var uid = message.uid;
    var remoteUid = message.remoteUid;
    console.log("收到offer");
    var roomMap = roomTableMap.get(roomId);
    if(roomMap  == null){
        console.error("房间不存在 " + roomId);
        return;
    }

    if(roomMap.get(uid) == null){
        console.error("房间里找不到： " + uid);
        return;
    }

    var remoteClient = roomMap.get(remoteUid);
    if(remoteClient){
        var msg = JSON.stringify(message);
        remoteClient.conn.sendText(msg);
    }else{
        console.error("找不到另一个人 " + remoteUid);
    }
    console.log(uid + " 成功把offer发送给 " + remoteUid);
}

function handleAnswer(message){
    var roomId = message.roomId;
    var uid = message.uid;
    var remoteUid = message.remoteUid;

    console.log("handleAnswer  uid = " + uid + "   remoteUid = " + remoteUid);


    var roomMap = roomTableMap.get(roomId);
    if(roomMap  == null){
        console.error("handleAnswer can't find then roomId " + roomId);
        return;
    }

    if(roomMap.get(uid) == null){
        console.error("handleAnswer can't find then uid " + uid);
        return;
    }

    var remoteClient = roomMap.get(remoteUid);
    if(remoteClient){
        var msg = JSON.stringify(message);
        remoteClient.conn.sendText(msg);
    }else{
        console.error("can't find remoteUid: " + remoteUid);
    }
    console.log(uid + " 成功把Answer发送给 " + remoteUid);
}

function handleCandidate(message){
    console.log("收到Candidate");
    var roomId = message.roomId;
    var uid = message.uid;
    var remoteUid = message.remoteUid;


    var roomMap = roomTableMap.get(roomId);
    if(roomMap  == null){
        console.error("handleCandidate can't find then roomId " + roomId);
        return;
    }

    if(roomMap.get(uid) == null){
        console.error("handleCandidate can't find then uid " + uid);
        return;
    }

    var remoteClient = roomMap.get(remoteUid);
    if(remoteClient){
        var msg = JSON.stringify(message);
        remoteClient.conn.sendText(msg);
    }else{
        console.error("can't find remoteUid: " + remoteUid);
    }
    console.log(uid + " 成功把Candidate发送给 " + remoteUid);
}

var namearr = ['徐滔','李伟','张凯仁','代勇','青龙'];

function handlecall(msg,conn){
    var originalString = pinyin(msg.name,{ toneType: 'none' });
    console.log(originalString);
    const valuesIterator = onlinetable.keys();
    for(const mz of valuesIterator){
        var reault = match(mz, originalString.replace(/\s/g, ''), { continuous: true }); // 连续匹配模式
        //console.log(reault);
        if(reault != null){
            console.log(mz);
            var jsonMsg = {
                'cmd': 'find_ture',
                'name': mz   
            };
            let mes = JSON.stringify(jsonMsg);
            conn.sendText(mes);
            return;
        }
    }
    originalString = pinyin(msg.name,{ pattern: 'initial' });
    console.log("***************************" + originalString + "------------------" + originalString.replace(/\s/g));
    for(const mz of valuesIterator){
        reault = match(mz, originalString.replace(/\s/g, ''), { continuous: true }); // 连续匹配模式
        // console.log(reault);
        if(reault != null){
            console.log(mz);
            var jsonMsg = {
                'cmd': 'find_ture',
                'name': mz   
            };
            let mes = JSON.stringify(jsonMsg);
            conn.sendText(mes);
            return;
        }
    }

    
    var jsonMsg = {
        'cmd': 'find_false',
        'name': msg.name   
    };
    var mes = JSON.stringify(jsonMsg);
    conn.sendText(mes);
}

function handlcreateroom(msg,conn){
    handleJoin(msg,conn);
    var jsonMsg = {
        'cmd': 'invate',
        'roomId': msg.roomId 
    };
    var mes = JSON.stringify(jsonMsg);
    var a = onlinetable.get(msg.remotename);
    //console.log(a);
    if(a == null){
        var jsonMsg = {
            'cmd': 'find_false',
            'name': msg.name   
        };
        var mes = JSON.stringify(jsonMsg);
        conn.sendText(mes);
    }else{
        a.sendText(mes);
    }
}

function handlconnect(msg,conn){
    onlinetable.set(msg.name,conn);
    //console.log(msg.name);
}

var server = ws.createServer(function(conn){
    console.log("--------- 创建一个新的连接 ---------");
    conn.client = null;
    //conn.sendText("我收到你的连接了。。。");
    conn.on("text", function(str){
    console.log(str);
    try{
        var jsonMsg = JSON.parse(str);
    }catch{
        return;
    }
    //console.log(jsonMsg);
    switch(jsonMsg.cmd){
        case SIGNAL_TYPE_JOIN:
            conn.client = handleJoin(jsonMsg,conn);
            break;
        case "leave":
            handleLeave(jsonMsg);
            break;
        case SIGNAL_TYPE_OFFER:
            handleOffer(jsonMsg);
            break;
        case SIGNAL_TYPE_ANSWER:
            handleAnswer(jsonMsg);
            break;
        case SIGNAL_TYPE_CANDIDATE:
            handleCandidate(jsonMsg);
            break;
        case "call":
            handlecall(jsonMsg,conn);
            break;
        case "createroom":
            handlcreateroom(jsonMsg,conn);
            break;
        case "connect":
            if(jsonMsg.name){
                conn.name = jsonMsg.name;
            }
            handlconnect(jsonMsg,conn);
            break;
    }
    });

    conn.on("close", function(code, reason){
        console.info("连接关闭 code: " + code + ", reason: " + reason);
        if(conn.client != null){
            handleForceLeave(conn.client);
        }
        console.log("close " + conn.name);
        if(conn.name){
            UPdateMySQL(0,'',conn.name);
            deletemysql(conn.name);
            onlinetable.delete(conn.name);
            console.info("成功删除客户端" + conn.name);
        }
    });

    conn.on("error", function(err){
        console.info("监听到错误：" + err);
    });
}).listen(port);