'use strict';
let EventEmitter = require('events'),
    WebSocket = require('ws'),
    Player = require('./player.js'),
    Deck = require('./deck.js'),
    shuffle = require('knuth-shuffle').knuthShuffle;


const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;
const MAX_SCORE = 30;
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
            let player = new Player(ws, userName);

            this.addPlayerListeners(player);
            this.players.push(player);
            this.sendPlayers();
        }
    }
    addPlayerListeners(player) {
        let self = this;

        player.on('disconnect', () => {
            self.removePlayer(player);
        });
        player.on('startGame', () => {
            let err = self.startGame();
            if (err !== true) {
                player.sendError(err);
            }
        });
        player.on('describeCard', (card, description) => {
            self.describeId = card.id;
            self.describeText = description;

            self.chooseCards.push({
                player: self.players[self.storyTellerInd],
                card: card
            });
            self.sendCardDescription();
        });

        player.on('playCard', (card) => {
            self.chooseCards.push({
                player: player,
                card: card
            });

            if (self.chooseCards.length == self.players.length) {
                self.sendChooseCards();
            }
        });
        player.on('vote', () => {
            self.votesLeft--;

            if (self.votesLeft == 0) {
                self.sendVoteResults();
            }
        });
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
            p.playedCard = false;
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

    sendCardDescription(card, description) {
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

    sendChooseCards() {
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

    getPlayerList() {
        let playerList = [];

        this.players.forEach(p => {
            playerList.push({
                name: p.name,
                score: p.score,
                scoreChange: p.scoreChange,
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
        if (!this.deck.canDeal(this.players.length)) {
            return true;
        } else {
            this.players.forEach(p => {
                if (p.score >= MAX_SCORE) {
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

    calculateScoreChange(votesById) {
        let guessedCnt = 0;

        this.players.forEach(p => {
            this.scoreChange = 0;
            if (p.voteId == this.describeId) {
                guessedCnt++;
            }
        });

        if ((guessedCnt == 0) || (guessedCnt == this.players.length - 1)) {
            //If all or no players have guessed, everybody except the story 
            //teller receives 2 points

            this.players.forEach(p => {
                if (!p.storyTeller) {
                    p.score += 2;
                    p.scoreChange += 2;
                }
            });
        } else {
            //Otherwise the story teller and the correctlly-guessed players 
            //receive 3 points and every non-story-teller receives 1 point for 
            //every person, who has voted for their card.

            this.players.forEach(p => {
                if ((p.storyTeller) || (p.voteId == this.describeId)) {
                    p.score += 3;
                    p.scoreChange += 3;
                }
            });
            this.chooseCards.forEach(c => {
                if (!c.player.storyTeller) {
                    c.player.score += votesById[c.card.id].votes.length;
                    c.player.scoreChange += votesById[c.card.id].votes.length;
                }
            });
        }
    }

    sendVoteResults() {
        let votesById = {};
        this.chooseCards.forEach(c => {
            votesById[c.card.id] = {
                player: c.player.name,
                votes: []
            };
        })

        this.players.forEach(p => {
            if (!p.storyTeller) {
                votesById[p.voteId].votes.push(p.name);
            }
        });

        this.calculateScoreChange(votesById);

        let msg = JSON.stringify({
            type: 'voteResults',
            votesById: votesById,
            players: this.getPlayerList(),
            correctId: this.describeId
        });

        this.players.forEach(p => {
            p.ws.send(msg);
        });
        
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
