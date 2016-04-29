"use strict";
var EventEmitter = require('events'),
    Player = require('./player.js');

class Room extends EventEmitter {
    constructor() {
        super();
        this.players = [];
        this.playing = false;
    }

    addPlayer(ws, userName) {
        this.players.push(new Player(this, ws, userName));
        this.sendPlayers();
    }
    removePlayer(player) {
        var index = this.players.indexOf(player);
        if (index >= 0) {
            this.players.splice(index, 1);
            this.sendPlayers();
        }
    }

    sendPlayers() {
        var playerList = [],
            msgStr;

        this.players.forEach(p => {
            playerList.push({
                name: p.name,
                score: p.score
            });
        });

        msgStr = JSON.stringify({
            type: 'updatePlayers',
            players: playerList
        });

        this.players.forEach(p => {
            p.ws.send(msgStr);  
        });
    }
};

module.exports = Room;
