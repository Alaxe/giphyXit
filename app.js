var express = require('express');
var app = express();

app.set('view engine', 'ejs');

app.get('/', function(req, res) {
    res.render('index');
    //res.send('Hello\n');
});

app.get('/p/:room', function(req, res) {
    res.send(req.params.room);
});

app.listen(8000, function() {
    console.log('listening on some port');
});
