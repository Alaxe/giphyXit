let server = require('http').createServer(),
    WebSocketServer = require('ws').Server,
    url = require('url'),
    wss = new WebSocketServer({server: server, port: 8080}),

    express = require('express'),  
    app = express(),
    port = 6000,
    randomstring = require('randomstring'),
    Room = require('./room.js');

app.set('view engine', 'ejs');
app.set('views', './client');
app.use(express.static('client'));


let rooms = {};

app.get('/p$', function(req, res) {
    key = randomstring.generate(6);
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
            console.log('creating game %s', msg.gameId);
            rooms[msg.gameId] = new Room();
            rooms[msg.gameId].on('gameEnd', () => {
                console.log('deleting game %s', msg.gameId);
                delete rooms[msg.gameId];
            });
        }

        ws.removeAllListeners('message');
        if (!rooms[msg.gameId].canJoin()) {
            console.log('can\'t join');
            ws.close();
        } else {
            rooms[msg.gameId].addPlayer(ws, msg.name);
        }
    });
});

server.on('request', app);
app.listen(port, function() {
    console.log('listening on port ', port);
});
