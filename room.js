"use strict";
var EventEmitter = require('events'),
    Player = require('./player.js'),
    http = require('http'),
    shuffle = require('knuth-shuffle').knuthShuffle;


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

        this.describeId = '';
        this.describeText = '';
        this.chooseCards = [];
    }

    static get HAND_SIZE() {
        return HAND_SIZE;
    }

    canJoin() {
        if ((this.playing) || (this.players.length >= MAX_PLAYERS)) {
            return false;
        } else {
            return true;
        }
    }
    canStart() {
        return true;
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
        this.dealCards();
        this.chooseCards = [];

        this.players[this.storyTellerInd].storyTeller = true;
        let playerList = this.getPlayerList();

        this.players.forEach(p => {
            let msg = {
                type: 'startRound',
                hand: p.hand,
                players: playerList,
                storyTeller: p.storyTeller
            };
            p.ws.send(JSON.stringify(msg));
        });
    }

    startGame() {
        let self = this;

        if (this.playing) {
            return;
        }
        this.playing = true;

        this.genDeck(() => {
            self.startRound();
        });
    }

    setCardDescription(card, description) {
        this.describeId = card.id;
        this.describeText = description;

        this.chooseCards.push({
            player: this.players[this.storyTellerInd],
            card: card
        });

        let msgStr = JSON.stringify({
            type: 'describeCard',
            text: this.describeText
        });

        this.players.forEach(p => {
            if (!p.storyTeller) {
                p.ws.send(msgStr);
            }
        });
    }

    playCard(player, card) { 
        this.chooseCards.push({
            player: player,
            card: card
        });


        console.log(this.chooseCards.length);
        if (this.chooseCards.length == this.players.length) {
            shuffle(this.chooseCards);
            console.log('I\'ve done it mum');
            
            //Don't send the clients info about who played the cards
            let cleanCards = [];
            this.chooseCards.forEach(c => {
                cleanCards.push(c.card);
            });

            let msg = JSON.stringify({
                type: 'chooseCard',
                cards: cleanCards
            });

            this.players.forEach(p => {
                p.ws.send(msg);
            });
        }
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
