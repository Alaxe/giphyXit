'use strict';
var EventEmitter = require('events'),
    Room = require('./room.js');

class Player extends EventEmitter {
    constructor(ws, name) {
        super();
        this.ws = ws;

        this.name = name;
        this.score = 0;
        this.scoreChange = 0;
        this.storyTeller = false;
        this.playedCard = false;
        this.voteId = '';
        this.hand = [];

        let self = this;
        this.ws.on('close', () => {
            self.emit('disconnect');
        });

        this.ws.on('message', (msgStr) => {
            let msg = JSON.parse(msgStr);
            switch (msg.type) {
                case 'startGame': 
                    self.onStartGame(msg);
                    break;
                case 'describeCard':
                    self.describeCard(msg);          
                    break;
                case 'playCard':
                    self.playCard(msg);
                    break;
                case 'vote':
                    self.vote(msg);
                    break;
           }
        });
    }

    getCardById(id) {
        for (let i = 0;i < this.hand.length;i++) {
            if (this.hand[i].id == id) {
                return this.hand[i];
            }
        }
        return null;
    }
    removeCard(id) {
        for (let i = 0;i < this.hand.length;i++) {
            if (this.hand[i].id == id) {
                this.hand.splice(i, 1);
                return true;
            }
        }
        return false;
    }

    sendError(text) {
        let msgText = JSON.stringify({type: 'error', text: text});
        this.ws.send(msgText);
    }

    onStartGame(msg) {
        this.emit('startGame');
        /*let error = this.room.startGame();
        if (error !== true) {
            this.sendError(error);
        }*/
    }
    describeCard(msg) {
        let card = this.getCardById(msg.id);
        if (!this.storyTeller) {
            this.sendError('Umm, only the story teller can describe' +
                    'cards and you don\'t look like them.' +
                    'Nice try anyways, you cheat');
        } else if (!card) {
            this.sendError('Umm, you don\'t have that card.');
        } else {
            this.removeCard(msg.id);
            this.emit('describeCard', card, msg.text);
            //this.room.setCardDescription(card, msg.text);
        }
    }
    playCard(msg) {
        let card = this.getCardById(msg.id);

        if (this.storyTeller) {
            this.sendError('Umm, story teller can\'t play cards.');
        } else if (this.playedCard) {
            this.sendError('Umm, you\'ve already played a card');
        } else if (!card) {
            this.sendError('Umm, you actually don\'t have that card');
        } else {
            this.playedCard = true;
            this.emit('playCard', card);
            this.removeCard(msg.id);
        }
    }

    vote(msg) {
        if (this.voteId != '') {
            return;
        }
        this.voteId = msg.id;
        this.emit('vote');
    }
}

module.exports = Player;
