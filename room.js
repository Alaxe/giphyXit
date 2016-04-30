"use strict";
var EventEmitter = require('events'),
    Player = require('./player.js'),
    http = require('http'),
    decoder = new require('string_decoder').StringDecoder('utf8');

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;
const DECK_SIZE = 84;
const HAND_SIZE = 6;

class Room extends EventEmitter {
    constructor() {
        super();
        this.players = [];
        this.playing = false;
        this.deck = [];
        this.storyTellerInd = 0;
    }

    canJoin() {
        if ((this.playing) || (this.players.length >= MAX_PLAYERS)) {
            return false;
        } else {
            return true;
        }
    }
    canStart() {
        return ((this.players.length >= MIN_PLAYERS) && (!this.playing));
    }

    addPlayer(ws, userName) {
        this.players.push(new Player(this, ws, userName));
        this.sendPlayers();
    }
    removePlayer(player) {
        //TO-DO handle disconnect while playing - story teller is important
        let index = this.players.indexOf(player);
        if (index >= 0) {
            this.players.splice(index, 1);
            this.sendPlayers();
        }
    }

    genDeck(callback, tags, rating) {
        tags = tags || '';
        rating = rating || 'g';

        let self = this,
            idSet = new Set(),
            reqUrl = `http://api.giphy.com/v1/gifs/random?api_key` + 
                    `=dc6zaTOxFJmzC&tag=${tags}&rating=${rating}`;

        function addGif(res) {
            let resBody = '';

            if (res.statusCode != 200) {
                http.get(reqUrl, addGif);
            }

            res.on('data', chunk => {
                resBody += chunk;
            });

            res.on('end', () => {
                let json = JSON.parse(resBody.toString());  

                //Don't add already added cards
                if (json.data.id in idSet) {
                    http.get(reqUrl, addGif);
                } else {
                    idSet.add(json.data.id);
                    self.deck.push(json.data);

                    if (self.deck.length >= DECK_SIZE) {
                        callback();
                    }
                }
            });
        }

        for (let i = 0;i < DECK_SIZE;i++) {
            http.get(reqUrl, addGif);
        }
    }

    dealCards() {
        let self = this,
            outOfCards = false;

        self.players.forEach(p => {
            while ((self.deck.length > 0) && (p.hand.length < HAND_SIZE)) {
                p.hand.push(self.deck[self.deck.length - 1]);
                self.deck.pop();
            }
        });
    }

    startRound() {
        this.players[this.storyTellerInd].storyTeller = true;

        let playerList = this.getPlayerList();

        this.players.forEach(p => {
            p.sendStartRound(playerList);
        });
    }

    startGame() {
        let self = this;

        if (this.playing) {
            return;
        }
        this.playing = true;

        this.genDeck((err) => {
            self.dealCards();
            self.startRound();
        });
    }

    getPlayerList() {
        let playerList = [];

        this.players.forEach(p => {
            playerList.push({
                name: p.name,
                score: p.score,
                storyTeller: p.storyTeller
            });
        });

        return playerList;
    }

    sendPlayers() {
        let msgStr = JSON.stringify({
            type: 'updatePlayers',
            players: this.getPlayerList()
        });

        this.players.forEach(p => {
            p.ws.send(msgStr);  
        });
    }
};

module.exports = Room;
