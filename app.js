const conf = require('./conf.json');

let server = require('http').createServer(),
    WebSocketServer = require('ws').Server,
    url = require('url'),
    wss = new WebSocketServer({server: server, port: conf.WS_PORT}),

    express = require('express'),
    app = express(),
    port = conf.WEB_PORT,
    randomstring = require('randomstring'),
    Room = require('./room.js');

app.set('view engine', 'ejs');
app.set('views', './client');
app.use(express.static('client'));


let rooms = {};

app.get('/p?$', function(req, res) {
    key = randomstring.generate(8);
    res.redirect('/p/' + key);
});
app.get('/p/:room', function(req, res) {
    let roomId = req.params.room,
        room;

    if ((roomId in rooms) && (!rooms[roomId].canJoin())) {
        res.redirect('/p');
    } else {
        res.render('play', room);
    }
});

wss.on('connection', function(ws) {
    ws.on('message', function initConnect(msgStr) {
        let msg = JSON.parse(msgStr);

        if (msg.type != 'connect') {
            ws.close();
        }

        if (!(msg.gameId in rooms)) {
            rooms[msg.gameId] = new Room();
            rooms[msg.gameId].on('gameEnd', () => {
                delete rooms[msg.gameId];
            });
        }

        ws.removeAllListeners('message');
        if (!rooms[msg.gameId].canJoin()) {
            ws.close();
        } else {
            rooms[msg.gameId].addPlayer(ws, msg.name);
        }
    });
});

server.on('request', app);
app.listen(port, function() {
    console.log('Server running on port ', port);
});
