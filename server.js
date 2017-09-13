// requires
const express = require('express');
const app = express();
var OpenTok = require('opentok');

// variables
var apiKey = process.env.TOKBOX_API_KEY;
var secret = process.env.TOKBOX_SECRET;
var rooms = {};

if (!apiKey || !secret) {
  console.error('Missing TOKBOX_API_KEY or TOKBOX_SECRET');
  process.exit();
}

var opentok = new OpenTok(apiKey, secret);

// express routing
app.use(express.static('public'));

// tokbox session creation
app.get('/room/:name', function (req, res) {
  var roomName = req.params.name;
  var sessionId;
  var token;
  console.log('attempting to create a session associated with the room: ' + roomName);

  // if the room name is associated with a session ID, fetch that
  if (rooms[roomName]) {
    sessionId = rooms[roomName];

    // generate token
    token = opentok.generateToken(sessionId);
    res.setHeader('Content-Type', 'application/json');
    res.send({
      apiKey: apiKey,
      sessionId: sessionId,
      token: token
    });
  }
  // if this is the first time the room is being accessed, create a new session ID
  else {
    opentok.createSession({ mediaMode: 'routed' }, function (err, session) {
      if (err) {
        console.log(err);
        res.status(500).send({ error: 'createSession error:' + err });
        return;
      }
      
      // adding the session to the rooms array
      rooms[roomName] = session.sessionId;

      // generate token
      token = opentok.generateToken(session.sessionId);
      res.setHeader('Content-Type', 'application/json');
      res.send({
        apiKey: apiKey,
        sessionId: session.sessionId,
        token: token
      });
    });
  }
});

// listener
app.listen(3000, function () {
    console.log('listening on *:3000');
});

