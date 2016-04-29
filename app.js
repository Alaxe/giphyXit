var server = require('http').createServer(),
    WebSocketServer = require('ws').Server,
    url = require('url'),
    wss = new WebSocketServer({server: server, port: 8080}),

    express = require('express'),  
    app = express(),
    port = 8000,
    randomstring = require('randomstring'),
    Room = require('./room.js');

app.set('view engine', 'ejs');
app.use(express.static('static'));


var rooms = {};

app.get('/p$', function(req, res) {
    key = randomstring.generate(6);
    res.redirect('/p/' + key);
});
app.get('/p/:room', function(req, res) {
    var roomId = req.params.room,
        room;

    if (!(roomId in rooms)) {
        rooms[roomId] = new Room();
    }

    room = rooms[roomId];
    if (room.playing) {
        res.redirect('/p');
    } else {
        res.render('play', room);
    }
});

wss.on('connection', function(ws) {
    ws.on('message', function initConnect(msgStr) {
        var msg = JSON.parse(msgStr);

        if ((msg.type == 'connect') && (msg.gameId in rooms)) {
            ws.removeAllListeners('message');
            rooms[msg.gameId].addPlayer(ws, msg.name);
        } 
    });
});

server.on('request', app);
app.listen(port, function() {
    console.log('listening on some port');
});
