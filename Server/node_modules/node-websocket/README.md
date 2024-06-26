# websocket

parse socket buffer, add event emitter and cookie id

## download & install
    // in package.json
    "dependencies": {
      "node-websocket": ">=0.0.1"
    }
    $ npm install

## config & run
    
    // in your nodeserver file
    var ws = require('node-websocket').init;
    // bind events
    ws.on('connection', function(socket) {
      console.log(socket.id); // ID in cookie,key: socketId
      ws.on('join', function(data) {
        //send message
        socket.send('yes! it will send to frontend');
      });
    });

    // You should emit server's close event and delete socket object when frontend exit
    ws.on('close', function(socketId) {
      console.log('close ' + socketId);
      delete sockets[socketId];
    });
    
    // you need start server in the end
    ws.start(8000);

## emit in frondend
    // you need creat socket object first
    socket.send(JSON.stringify({
      event: 'join',
      data: {
        room: room
      }
    }));

## all arguments & events & methods

* Server.prototype.start(port)

* Server 'connection' event, emit when connect success, create socket object in callback

* Server 'close' event, emit when a socket ended, return socketId.

* Server.prototype.on(eventName, callback);

* Server.prototype.emit(eventName, data);

* socket.id, ID in cookie,key: socketId

* Socket.prototype.send(data);

* Socket.prototype.close(data);

## bug && suggestion?
[Tell Me Please~](https://github.com/youngerheart/websocket/issues)
