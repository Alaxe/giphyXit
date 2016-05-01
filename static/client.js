//ws stands for WebSocket
var curView = null,
    gameId = '',
    ws = null,

    userName = '',
    storyTeller = false,
    gamePhase = '';

    players = [],
    hand = [],
    voteList = [];

function setView(view) {
    console.log('setting view %s', view);
    $('.view').hide();
    $('#' + view).show();

    curView = view;
}

function updatePlayerList() {
    var waitTable = $('#playerList > tbody'),
        row = null,
        cell = null;

    waitTable.empty();
    players.forEach(function (player) {
        row = $('<tr></tr>')
            .addClass((player.name === userName) ? 'active' : '')
            .appendTo(waitTable);
        cell = $('<td></td>')
            .text(player.name)
            .appendTo(row);
    });
}

function updateScoreboard() {
    var scoreboard = $('#scoreboard > tbody'),
        row = null,
        nameCell = null,
        scoreCell = null,
        storyTellerBadge = null;

    scoreboard.empty();
    players.forEach(function (player) {
        row = $('<tr></tr>')
            .addClass((player.name === userName) ? 'active' : '')
            .appendTo(scoreboard);
        nameCell = $('<td></td>')
            .text(player.name)
            .appendTo(row);
        scoreCell = $('<td></td>')
            .text(player.score)
            .appendTo(row);

        if (player.storyTeller) {
            storyTellerBadge = $('<span></span>')
                .text('ST')
                .addClass('badge')
                .appendTo(nameCell);
        }
    });
}

function updateHand() {
    var handDiv = $('#hand');
    
    handDiv.empty();
    hand.forEach(function (card) {
        $('<img/>')
            .addClass('card')
            .attr('src', card.fixed_width_downsampled_url)
            .data('cardId', card.id)
            .appendTo(handDiv);
    });

    $('#hand > .card').click(function() {
        $('#hand > .card').removeClass('active');
        $(this).addClass('active');
    });
}

function setDescription(desc) {
    desc = desc || 'Waiting for the story teller to describe a card';
    $('#cardDescritpion').text(desc);
}

function setGameInfo(info) {
    $('#gameInfo').text(info);
}

function clearErrors() {
    $('#error').text('');
}
function error(errMsg) {
    $('#error').text(errMsg);
    console.log('[Error]: ', errMsg);
}

function removeCard(id) {
    for (i = 0;i < hand.length;i++) {
        if (hand[i].id == id) {
            hand.splice(i, 1);
            updateHand();
            return true;
        }
    }
    return false;
}

function getSelectedId(listId) {
    listId = listId || '#hand';

    var cardDom = $(listId + ' > .active');
    if (cardDom.length > 0) {
        return cardDom.data('cardId');
    } else {
        error('I can\'t obey your orders, if you haven\'t choosen a card.');
        return '';
    }
}

function startRound() {
    updateScoreboard();
    updateHand();

    if (storyTeller) {
        setGameInfo('Choose a card from your hand and describe it');
        setDescription('Don\'t look at me, that\'s your job');

        $('#descriptionForm').show();
        $('#descriptionForm').submit(function() {
            var curCardId = getSelectedId('#hand'),
                description = $('#descriptionInput').val(),
                i = 0;

            if (!curCardId) {
                return false;
            }
            if (description === '') {
                error('I know it\'s hard, but just give it a try, ' +
                      'write some kind of a description');
                return false;
            }

            ws.send(JSON.stringify({
                type: 'describeCard',
                id: curCardId,
                text: description
            }));

            clearErrors();
            removeCard(curCardId);
            setGameInfo('Wait for the other players to choose a card, ' +
                    'fiting your description');
            setDescription(description);
            $('#descriptionForm').hide();

            return false;
        })
    } else {
        setGameInfo('Wait for the story teller to describe a card');
        setDescription('Don\'t know, read the story teller\'s mind');
    }

    setView('playView');
}

function handleMessage(msgStr) {
    console.log(msgStr);
    var msg = JSON.parse(msgStr.data);

    switch (msg.type) {
        case 'error':
            $('#error').text(msg.text);
            break;
        case 'updatePlayers':
            players = msg.players;
            if (curView == 'playView') {
                updateScoreboard();
            } else {
                updatePlayerList();
            }
            break;
        case 'startRound':
            hand = msg.hand;
            storyTeller = msg.storyTeller;
            players = msg.players;

            startRound();
            break;

        case 'describeCard':
            setDescription(msg.text);
            setGameInfo('Choose a card that fits best the given descrption');

            $('#playCardDiv').show();
            $('#playCard').click(function() {
                var curCardId = getSelectedId('#hand');

                if (!curCardId) {
                    return;
                }
                ws.send(JSON.stringify({
                    type: 'playCard',
                    id: curCardId
                }));

                clearErrors();
                removeCard(curCardId);
                setGameInfo('Wait for the other players to choose a card');
                $('#playCardDiv').hide();
            });
    
            break;
    }
}


function connectWS() {
    ws = new WebSocket('ws://192.168.0.201:8080');
    ws.onopen = function() {
        ws.send(JSON.stringify({
            type: 'connect',
            name: userName,
            gameId: gameId
        }));

        setView('waitView');
    };
    ws.onmessage = handleMessage;
    ws.onerror = ws.onclose = function() {
        window.location = '/';
    };
}


function getGameId() {
    var url = document.URL;
    return url.substr(url.lastIndexOf('/') + 1);
}

function startGame() {
    ws.send(JSON.stringify({type: 'startGame'}));
}

$(function() {
    setView('joinView');
    gameId = getGameId();

    $('button').click(function() {
        $('#error').text('');
    });

    $('#joinForm').submit(function() {
        $('#error').text('');
        userName = $('#nameInput').val();
        if (userName == '') {
            $('#error').text('One needs an username');
        } else {
            connectWS();
        }
        //makes sure the form isn't actually submited
        return false;
    });

    $('#startGame').click(startGame);
});
