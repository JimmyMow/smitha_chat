var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io =require('socket.io').listen(server);
var mongoose = require('mongoose');
var users = {};

server.listen(3000, function() {
  console.log('Listening on port %d', server.address().port);
});

mongoose.connect('mongodb://localhost/chat', function(err) {
  if(err) {
    console.log(err);
  } else {
    console.log('Connected to mongodb');
  }
});

var chatSchema = mongoose.Schema({
  nick: String,
  msg: String,
  created: { type: Date, default: Date.now }
});

var Chat = mongoose.model('Message', chatSchema);

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function(socket) {
  var query = Chat.find({});
    query.sort('-created').limit(8).exec(function(err, messages) {
    if(err) throw err;
    console.log(messages);
    socket.emit('load old msgs', messages);
  });

  function updateNicknames() {
    io.sockets.emit('usernames', Object.keys(users));
  }

  socket.on('new user', function(data, callback) {
    if( data in users ) {
      callback(false);
    } else {
      callback(true);
      socket.nickname = data;
      users[socket.nickname] = socket;
      updateNicknames();
    }
  });

  socket.on('send message', function(data, callback) {
    var msg = data.trim();
    if( msg.substr(0, 3) === '/w ' ) {
      msg = msg.substr(3);
      var ind = msg.indexOf(' ');
      if(ind != -1) {
        var name = msg.substr(0, ind);
        var msg = msg.substr(ind + 1);
        if( name in users ) {
          users[name].emit('whisper', {msg: msg, nick: socket.nickname});
        } else {
          callback("Error! Enter a valid user.");
        }
      } else {
        callback("Error! Please enter a message for your whisperer");
      }
    } else {
      var newMsg = new Chat({ msg: msg, nick: socket.nickname });
      newMsg.save(function(err) {
        if(err) throw err;
        io.sockets.emit('new message', {msg: msg, nick: socket.nickname});
      });
    }
  });

  socket.on('disconnect', function(data) {
    if(!socket.nickname) {return;}
    delete users[socket.nickname];
    updateNicknames();
  });
});
