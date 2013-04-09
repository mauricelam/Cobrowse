var DEBUG = true;
var PORT = 3100;
var QUEUE_SIZE = 8;

var http = require('http');

var server = http.createServer();
server.listen(PORT);

var io = require('socket.io').listen(server);
io.set ('transports', ['xhr-polling', 'jsonp-polling']);

var actions = new Array();

var index = 1;

Array.prototype.inject = function(element) {

    if (this.length >= QUEUE_SIZE) {
        this.shift();
    }
    this.push(element);
};

function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
             .toString(16)
             .substring(1);
};

function guid() {
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
         s4() + '-' + s4() + s4() + s4();
};

io.sockets.on('connection', function(client) {

    if (DEBUG)
        console.log("New Connection: ", client.id)
    // Send 'init' signal to connected client.
    client.on('id', function(data){
        // var id =data);
        if(data.id == index){
            console.log("Hi ", data);
            client.emit("init", "Success");
        }else{
            client.emit("error", data);
        }
    })
    

    client.on('action', function(action){
        if(DEBUG)
            console.log("Message: " + action);

        actions.inject(action);
        client.broadcast.emit('action', action);
    });


    client.on('disconnect', function() {

        if (DEBUG)
            console.log("Disconnected: ", client.id);
    })
})
