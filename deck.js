'use strict';
const conf = require('./conf.json');
let EventEmitter = require('events'),
    http = require('http');

const DECK_SIZE = 84;
const HAND_SIZE = 6;

class Deck extends EventEmitter {
    constructor() {
        super();

        this.deck = [];
        this.idSet = new Set();
        this.isGenerated = false;
        console.log(conf.API_KEY);
        this.requestUrl = `http://api.giphy.com/v1/gifs/random?api_key=` +
                `${conf.API_KEY}&rating=g`;
        this.generateDeck();
    }

    generateDeck() {
        let self = this;

        function addGif(response) {
            let responseBody = '';

            if (response.statusCode != 200) {
                http.get(self.requestUrl, addGif);
            }

            response.on('data', chunk => {
                responseBody += chunk;
            });


            response.on('end', () => {
                let json = JSON.parse(responseBody.toString());
                console.log(json);

                //Don't add already added cards
                if (json.data.id in self.idSet) {
                    http.get(requestUrl, addGif);
                } else {
                    self.idSet.add(json.data.id);
                    self.deck.push(json.data);

                    if (self.deck.length >= DECK_SIZE) {
                        self.isGenerated = true;
                        self.emit('deckGenerated');
                    }
                }
            });
        }

        for (let i = 0;i < DECK_SIZE;i++) {
            http.get(this.requestUrl, addGif);
            console.log(this.requestUrl);
        }
    }

    canDeal(playerCnt) {
        return this.deck.length >= playerCnt;
    }

    deal(players) {
        let self = this,
            outOfCards = false;

        players.forEach(p => {
            while ((self.deck.length > 0) && (p.hand.length < HAND_SIZE)) {
                p.hand.push(self.deck[self.deck.length - 1]);
                self.deck.pop();
            }
        });
    }
}

module.exports = Deck;
