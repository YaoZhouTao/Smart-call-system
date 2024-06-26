const socket = new WebSocket("ws://124.221.180.75:9999");

socket.onopen = () => {
    console.log("TTS 连接已建立");
};

socket.onmessage = event => {
    const audioData = event.data;
    const audioBlob = new Blob([audioData], { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
    console.log("收到TTS服务器信息!!!");
};

socket.onclose = event => {
    console.log("WebSocket 连接已关闭");
};

function TTS_sendText(message,uid) {
    var jsonMsg = {
        'cmd': 'message',
        'data': message,   //要转换的数据
        'uid': uid
    };
    var msg = JSON.stringify(jsonMsg);
    socket.send(msg);
    // const textInput = document.getElementById("text-input").value;
    // socket.send(textInput);
}
