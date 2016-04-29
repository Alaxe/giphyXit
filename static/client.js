//ws stands for WebSocket
var curView = null,
    gameId = '',
    playerList = [];
    ws = null;

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

function handleMessage(msgStr) {
    console.log(msgStr);
    var msg = JSON.parse(msgStr.data);

    if (msg.type == 'updatePlayers') {
        updatePlayers(msg.players);
    }
}

function getGameId() {
    var url = document.URL;
    return url.substr(url.lastIndexOf('/') + 1);
}

$(function() {
    setView('joinView');
    gameId = getGameId();

    $('#joinGame').click(function() {
        $('#error').text('');
        var userName = $('#nameInput').val();
        if (userName == '') {
            $('#error').text('One needs an username');
            return;
        } 

        ws = new WebSocket('ws://localhost:8080');
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
            setView('joinView');
        };
    });
});
