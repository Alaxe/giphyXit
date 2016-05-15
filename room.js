'use strict';
let EventEmitter = require('events'),
    WebSocket = require('ws'),
    Player = require('./player.js'),
    Deck = require('./deck.js'),
    shuffle = require('knuth-shuffle').knuthShuffle;


const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;
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
        this.deck = new Deck();
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
            this.emit('gameEnd');
        }
    }

    startRound() {
        this.deck.deal(this.players);
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

        if (this.state !== RoomState.LOBBY) {
            return 'Already playing';
        } else if (this.players.length < MIN_PLAYERS) {
            return 'Not enough players';
        } else if (!this.deck.isGenerated) {
            this.deck.on('deckGenerated', this.onStartGame.bind(this));
            return true;
        } else {
            this.state = RoomState.PLAYING;
            this.startRound();
            return true;
        }
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
        //can't deal enough cards for another round
        //console.log(this.players.length);
        if (!this.deck.canDeal(this.players.length)) {
            return true;
        } else {
            this.players.forEach(p => {
                if (p.score >= 30) {
                    return true;
                }
            });
            return false;
        }
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
        this.emit('gameEnd');
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
}

module.exports = Room;
