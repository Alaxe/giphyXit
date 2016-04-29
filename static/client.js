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
    console.log('setting view %s', view);
    $('.view').hide();
    $('#' + view).show();

    curView = view;
}

function updatePlayers(newList) {
    playerList = newList;

    var waitList = $('#playerList');
    waitList.empty();
    playerList.forEach(function(player) {
        $('<li></li>')
        .text(player.name)
        .addClass('list-group-item')
        .addClass((player.name === userName) ? 'active' : '')
        .appendTo(waitList);
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
