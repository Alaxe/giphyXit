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

function updatePlayerList() {
    var waitTable = $('#playerList > tbody'),
        row = null,
        cell = null;

    waitTable.empty();
    playerList.forEach(function (player) {
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
    playerList.forEach(function (player) {
        row = $('<tr></tr>')
            .addClass((player.name === userName) ? 'active' : '')
            .appendTo(scoreboard);
        nameCell = $('<td></td>')
            .text(player.name)
            .appendTo(row);
        scoreCell = $('<td></td>')
            .text(player.score)
            .appendTo(row);
    });
}

function beginRound() {
    updateScoreboard();
}

function handleMessage(msgStr) {
    console.log(msgStr);
    var msg = JSON.parse(msgStr.data);

    switch (msg.type) {
        case 'error':
            $('#error').text(msg.text);
            break;
        case 'updatePlayers':
            playerList = msg.players;
            updatePlayerList();
            break;
        case 'startGame':
            hand = msg.hand;
            storyTeller = msg.storyTeller;
            beginRound();

            setView('playView');
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
