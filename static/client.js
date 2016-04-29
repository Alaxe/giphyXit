//ws stands for WebSocket
var curView = null,
    gameId = '',
    ws = null,

    userName = '',
    storyTeller = false,

    playerList = [],
    hand = [],
    voteList = [];

function setView(view) {
    $('.view').hide();
    $('#' + view).show();

    curView = view;
}

function updatePlayers(newList) {
    playerList = newList;

    var waitList = $('#waitView > #playerList');
    waitList.empty();
    playerList.forEach(function(player) {
        $('<li></li>').text(player.name).appendTo(waitList);
    });
}

function beginRound() {
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
            updatePlayers(msg.players);
            break;
        case 'gameStart':
            hand = msg.hand;
            storyTeller = msg.storyTeller;
            beginRound();
            break;

    }
}


function connectWS() {
    ws = new WebSocket('ws://192.168.0.201:8080');
    ws.onopen = function() {
        var msg = {
            type: 'connect',
            name: userName,
            gameId: gameId
        };
        ws.send(JSON.stringify(msg));

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
    console.log('hi');
    var msg = JSON.stringify({type: 'startGame'});
    ws.send(msg);
}

$(function() {
    setView('joinView');
    gameId = getGameId();

    $('button').click(function() {
        $('#error').text('');
    });

    $('#joinGame').click(function() {
        userName = $('#nameInput').val();
        if (userName == '') {
            $('#error').text('One needs an username');
        } else {
            connectWS();
        }
    });
    $('#startGame').click(startGame);
});
