'use strict';
//ws stands for WebSocket
var curView = null,
    gameId = '',
    ws = null,

    userName = '',
    storyTeller = false,
    playedCardId = '',
    votedId = '',

    players = [],
    hand = [],
    voteList = [];

function setView(view) {
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
function updateScoreboard(container) {
    container = container || '#scoreboard';
    var scoreboard = $(container + ' > tbody'),
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
function updateCardList(container, cardList) {
    var cardPanel = null,
        panelBody = null;

    container.empty();
    cardList.forEach(function (card) {
        cardPanel = $('<div></div>')
            .addClass('panel panel-default card')
            .data('cardId', card.id)
            .appendTo(container);
        panelBody = $('<div></div>')
            .addClass('panel-body')
            .appendTo(cardPanel);
        $('<img/>')
            .attr('src', card.fixed_width_downsampled_url)
            .appendTo(panelBody);
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
    $('#error').slideUp();
}
function error(errMsg) {
    $('#error').text(errMsg);
    $('#error').slideDown();
}
function removeCard(id) {
    var i;
    for (i = 0;i < hand.length;i++) {
        if (hand[i].id == id) {
            hand.splice(i, 1);
            updateHand();
            //updateCardList('#hand', hand);
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

function onJoinFormSubmit() {
    userName = $('#nameInput').val();
    if (userName == '') {
        error('One needs an username');
        return false;
    } else {
        clearErrors();
    }

    ws = new WebSocket('ws://' + document.location.hostname + ':8080');
    ws.onopen = function() {
        ws.send(JSON.stringify({
            type: 'connect',
            name: userName,
            gameId: gameId
        }));

        setView('waitView');
    };
    ws.onmessage = handleMessage;

    ws.onerror = function() {
        window.location = '/';
    };
    
    //makes sure the form isn't actually submited
    return false;
}
function onNameTaken() {
    error('Name is already taken');
    ws.close();

    $('#nameInput').val('');
    setView('joinView');
}
function onDescriptionFormSubmit() {
    var curCardId = getSelectedId('#hand'),
        description = $('#descriptionInput').val(),
        i = 0;

    if (!curCardId) {
        error('I\'m trying not to be assertive, but you have to select a card');
        return false;
    }
    if (description === '') {
        error('I know it\'s hard, but just give it a try, ' +
              'write some kind of a description');
        return false;
    }

    playedCardId = curCardId;
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
}
function updateHand() {
    var handDiv = $('#hand');

    updateCardList(handDiv, hand);

    handDiv.children().click(function() {
        handDiv.children().removeClass('active');
        $(this).addClass('active');
    });
}
function onStartRound(msg) {
    hand = msg.hand;
    storyTeller = msg.storyTeller;
    players = msg.players;

    playedCardId = votedId = '';

    updateScoreboard();
    updateHand();

    if (storyTeller) {
        setGameInfo('Choose a card from your hand and describe it');
        setDescription('Don\'t look at me, that\'s your job');

        $('#descriptionForm').show();
    } else {
        setGameInfo('Wait for the story teller to describe a card');
        setDescription('Don\'t know, read the story teller\'s mind');
    }

    $('#chooseCardPanel').hide();
    setView('playView');
}
function onUpdatePlayers(msg) {
    players = msg.players;
    if (curView == 'playView') {
        updateScoreboard();
    } else if (curView == 'waitView') {
        updatePlayerList();
    }
}
function onPlayCardClick() {
    var curCardId = getSelectedId('#hand');

    if (!curCardId) {
        return;
    }
    ws.send(JSON.stringify({
        type: 'playCard',
        id: curCardId
    }));
    playedCardId = curCardId;

    clearErrors();
    removeCard(curCardId);
    setGameInfo('Wait for the other players to choose a card');
    $('#playCardDiv').hide();
}
function onDescribeCard(msg) {
    setDescription(msg.text);
    setGameInfo('Choose a card that fits best the given descrption');

    $('#playCardDiv').show();
}
function updateVoteList() {
    var voteDiv = $('#voteList');
    
    updateCardList(voteDiv, voteList);

    $('#voteList').children().each(function () {
        if ($(this).data('cardId') == playedCardId) {
            $(this).addClass(storyTeller ? 'correct' : 'yours');
        }
    });
    if (!storyTeller) {
        voteDiv.children().click(function() {
            if ($(this).data('cardId') == playedCardId) {
                return;
            }
            if (votedId != '') {
                return;
            }

            voteDiv.children().removeClass('active');
            $(this).addClass('active');
        });
    }
}
function onChooseCardClick() {
    var curId = getSelectedId('#voteList');

    if (curId == '') {
        error('Vote for a card, abstention is not an option!');
        return;
    } else {
        clearErrors();
    }

    ws.send(JSON.stringify({
        type: 'vote',
        id: curId
    }));
    votedId = curId;

    setGameInfo('Wait for the other players to vote');
    $('#chooseCardDiv').hide();
}
function onChooseCard(msg) {
    voteList = msg.cards;
    updateVoteList();

    $('#chooseCardPanel').show();
    if (storyTeller) {
        setGameInfo('Wait for the other players to vote');
    } else {
        $('#chooseCardDiv').show();
        setGameInfo('Pick the card, which you think is the story teller\'s');
    }
}
function onVoteResults(msg) {
    var guessed = false;
    $('#voteList').children().each(function() {
        var curId = $(this).data('cardId'),
            authorDiv = $('<div></div>')
                .addClass('author-info')
                .appendTo($(this)),
            votedTable = null,
            thead = null,
            tr = null,
            tbody = null;

        if (curId == msg.correctId) {
            $(this).addClass('correct');
            authorDiv.text('Story teller\'s card');
        } else {
            if (curId == votedId) {
                $(this).removeClass('active');
                $(this).removeClass('wrong');
            }
            authorDiv.text(msg.votesById[curId].player + '\'s card');
        }

        if (msg.votesById[curId].votes.length == 0) {
            return;
        }

        votedTable = $('<table></table>')
            .addClass('table')
            .appendTo($(this));
        thead = $('<thead></thead>')
            .appendTo(votedTable);
        tr = $('<tr></tr>')
            .appendTo(thead);
        $('<th></th>')
            .text('Players voted:')
            .appendTo(tr);
        tbody = $('<tbody></tbody>').
            appendTo(votedTable);

        msg.votesById[curId].votes.forEach(function(name) {
            tr = $('<tr></tr>')
                .appendTo(tbody);
            $('<td></td>')
                .text(name == userName ? 'You' : name)
                .appendTo(tr);
        })
    });
    setGameInfo('Look at who voted how and wait for the start of the next round');

}
function onGameEnded(msg) {
    players = msg.players;
    updateScoreboard('#results');
    setView('resultsView');
    //ws.close();
}

function handleMessage(msgStr) {
    var msg = JSON.parse(msgStr.data);

    switch (msg.type) {
        case 'nameTaken':
            onNameTaken(msg);
            break;
        case 'error':
            error(msg.text);
            break;
        case 'updatePlayers':
            onUpdatePlayers(msg);       
            break;
        case 'startRound':
            onStartRound(msg);
            break;
        case 'describeCard':
            onDescribeCard(msg);
            break;
        case 'chooseCard':
            onChooseCard(msg);
            break;
        case 'voteResults':
            onVoteResults(msg);
            break;
        case 'gameEnded':
            onGameEnded(msg);
            break;
    }
}

$(function() {
    setView('joinView');
    gameId = document.URL.substr(document.URL.lastIndexOf('/') + 1);

    $('#joinForm').submit(onJoinFormSubmit);
    $('#startGame').click(function() {
        ws.send(JSON.stringify({type: 'startGame'}));
    });
    $('#descriptionForm').submit(onDescriptionFormSubmit);
    $('#playCard').click(onPlayCardClick);
    $('#chooseCard').click(onChooseCardClick);

});
