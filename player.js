'use strict';
var EventEmitter = require('events');

class Player extends EventEmitter {
    constructor(room, ws, name) {
        super();

        this._room = room;
        this.ws = ws;
        this.name = name;
        this.score = 0;

        this.ws.on('close', () => {
            room.removePlayer(this);
        });
    }
}

module.exports = Player;
