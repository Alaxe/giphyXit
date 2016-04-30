'use strict';
var EventEmitter = require('events');

class Player extends EventEmitter {
    constructor(room, ws, name) {
        super();

        this.room = room;
        this.ws = ws;

        this.name = name;
        this.score = 0;
        this.storyTeller = false;
        this.hand = [];


        this.ws.on('close', () => {
            room.removePlayer(this);
        });
        this.ws.on('message', this.handleMessage.bind(this));
    }

    sendError(text) {
        let msgText = JSON.stringify({type: 'error', text: text});
        this.ws.send(msgText);
    }

    sendStartRound(playerList) {
        let msg = {
            type: 'startRound',
            hand: this.hand,
            players: playerList,
            storyTeller: this.storyTeller
        };
        this.ws.send(JSON.stringify(msg));
    }
    
    handleMessage(msgStr) {
        let msg = JSON.parse(msgStr);
        switch (msg.type) {
            case 'startGame': 
                if (this.room.canStart()) {
                    this.room.startGame();
                } else {
                    this.sendError('Can\'t start game');
                }
                break;
       }
    }
}

module.exports = Player;
