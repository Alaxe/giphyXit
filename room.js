"use strict";
var EventEmitter = require('events'),
    WebSocket = require('ws'),
    Player = require('./player.js'),
    http = require('http'),
    shuffle = require('knuth-shuffle').knuthShuffle;


const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;
const DECK_SIZE = 84;
const HAND_SIZE = 6;
const ROUND_TIMEOUT = 10;

const RoomState = {
    LOBBY: 0,
    PLAYING: 1,
    FINISHED: 2
};

class Room extends EventEmitter {
    constructor() {
        super();

        this.players = [];
        this.deck = [];
        this.storyTellerInd = -1;
        this.state = RoomState.LOBBY;

        this.describeId = '';
        this.describeText = '';
        this.chooseCards = [];
        this.votesLeft = 0;
    }

    static get HAND_SIZE() {
        return HAND_SIZE;
    }

    canJoin() {
        if (this.state !== RoomState.LOBBY) {
            return false;
        } else if (this.players.length >= MAX_PLAYERS) {
            return false;
        } else {
            return true;
        }
    }
    canStart() {
        if (this.state !== RoomState.LOBBY) {
            return 'Already playing';
        } else if (this.players.length < MIN_PLAYERS) {
            return 'Not enough players';
        } else {
            return null;
        }
    }

    addPlayer(ws, userName) {
        let taken = false;
        for(let i = 0;i < this.players.length;i++) {
            if (this.players[i].name === userName) {
                taken = true;
                break;
            }
        }
        if (taken) {
            ws.send(JSON.stringify({type: 'nameTaken'}));
        } else {
            this.players.push(new Player(this, ws, userName));
            this.sendPlayers();
        }
    }
    removePlayer(player) {
        let index = this.players.indexOf(player);
        if (index >= 0) {
            this.players.splice(index, 1);
            this.sendPlayers();
        }
        if (this.players.length == 0) {
            this.state = RoomState.FINISHED;

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

        if (this.storyTellerInd >= 0) {
            this.players[this.storyTellerInd].storyTeller = false;
        }
        this.storyTellerInd++;
        if (this.storyTellerInd >= this.players.length) {
            this.storyTellerInd = 0;
        }
        this.players.forEach(p => {
            p.voteId = '';
        });
        this.players[this.storyTellerInd].storyTeller = true;

        let playerList = this.getPlayerList();

        this.players.forEach(p => {
            p.ws.send(JSON.stringify({
                type: 'startRound',
                hand: p.hand,
                players: playerList,
                storyTeller: p.storyTeller
            }));
        });
    }

    startGame() {
        let self = this;
        this.state = RoomState.PLAYING;

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


        if (this.chooseCards.length == this.players.length) {
            shuffle(this.chooseCards);
            this.votesLeft = this.players.length - 1;
            
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
            if (p.ws.readyState == WebSocket.OPEN) {
                p.ws.send(msgStr);  
            }
        });
    }

    gameEnded() {
        let answ = false;

        if (this.deck.length < this.players.length) {
            answ = true;
        } else {
            this.players.forEach(p => {
                if (p.score >= 30) {
                    answ = true;
                }
            });
        }

        return answ;
    } 

    endGame() {
        this.players[this.storyTellerInd].storyTeller = false;
        this.players.sort((a, b) => {
            return a.score < b.score;
        });

        let msg = JSON.stringify({
            type: 'gameEnded',
            players: this.getPlayerList()
        });
        this.playing = false;
        this.players.forEach(p => {
            p.ws.send(msg);
            p.ws.close();
        });

        this.state = RoomState.FINISHED;
        this.emit('gameEnd', this.gameId);
    }

    sendVoteResults() {
        let votesById = {};
        this.chooseCards.forEach(c => {
            votesById[c.card.id] = {
                player: c.player.name,
                votes: []
            };
        })

        let guessedCnt = 0;
        this.players.forEach(p => {
            if (p.voteId in votesById) {
                if (p.voteId == this.describeId) {
                    guessedCnt++;
                }
                votesById[p.voteId].votes.push(p.name);
            }
        });

        let msg = JSON.stringify({
            type: 'voteResults',
            votesById: votesById,
            correctId: this.describeId
        });
        this.players.forEach(p => {
            p.ws.send(msg);
        });
        
        if ((guessedCnt == 0) || (guessedCnt == this.players.length - 1)) {
            this.players.forEach(p => {
                if (!p.storyTeller) {
                    p.score += 2;
                }
            });
        } else {
            this.players.forEach(p => {
                if (p.storyTeller) {
                    p.score += 3;
                } else if (p.voteId == this.describeId) {
                    p.score += 3;
                }
            });
            this.chooseCards.forEach(c => {
                if (!c.player.storyTeller) {
                    c.player.score += votesById[c.card.id].votes.length;
                }
            });
        }

        let self = this;
        setTimeout(() => {
            if (self.gameEnded()) {
                self.endGame();
            } else {
                self.startRound();
            }
        }, ROUND_TIMEOUT * 1000);
    }
};

module.exports = Room;
