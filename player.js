'use strict';
var EventEmitter = require('events'),
    Room = require('./room.js');

class Player extends EventEmitter {
    constructor(room, ws, name) {
        super();

        this.room = room;
        this.ws = ws;

        this.name = name;
        this.score = 0;
        this.storyTeller = false;
        this.voteId = '';
        this.hand = [];


        this.ws.on('close', () => {
            room.removePlayer(this);
        });
        this.ws.on('message', this.handleMessage.bind(this));
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

    startGame(msg) {
        if (this.room.canStart()) {
            this.room.startGame();
        } else {
            this.sendError('Can\'t start game');
        }
    }
    describeCard(msg) {
        let card = this.getCardById(msg.id);
        if (!this.storyTeller) {
            this.sendError('Umm, only the story teller can describe' +
                    'cards and you don\'t look like them.' +
                    'Nice try anyways, you cheat');
            return;
        }
        if (!card) {
            this.sendError('Umm, you don\'t have that card.');
            return;
        }
        this.removeCard(msg.id);
        this.room.setCardDescription(card, msg.text);
    }
    playCard(msg) {
        let card = this.getCardById(msg.id);

        if (this.storyTeller) {
            this.sendError('Umm, story teller can\'t play cards.');
            return;
        }
        if (this.hand.length < Room.HAND_SIZE) {
            this.sendError('Umm, you\'ve already played a card');
            return;
        }
        if (!card) {
            this.sendError('Umm, you actually don\'t have that card');
            return
        }

        this.room.playCard(this, card);
        this.removeCard(msg.id);
    }
    vote(msg) {
        if (this.voteId != '') {
            return;
        }
        this.voteId = msg.id;
        this.room.votesLeft--;
        console.log('Votes left', this.name, this.room.votesLeft);

        if (this.room.votesLeft == 0) {
            this.room.sendVoteResults();
        }
    }

    handleMessage(msgStr) {
        let msg = JSON.parse(msgStr);
        switch (msg.type) {
            case 'startGame': 
                this.startGame(msg);
                break;
            case 'describeCard':
                this.describeCard(msg);          
                break;
            case 'playCard':
                this.playCard(msg);
                break;
            case 'vote':
                this.vote(msg);
       }
    }
}

module.exports = Player;
