// requires
const express = require('express');
const app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var kurento = require('kurento-client');
var minimist = require('minimist');

// variables
var kurentoClient = null;
var iceCandidateQueues = {};

// constants
var argv = minimist(process.argv.slice(2), {
    default: {
        as_uri: 'http://localhost:3000/',
        ws_uri: 'ws://localhost:8888/kurento'
    }
});

// express routing
app.use(express.static('public'))

// signaling
io.on('connection', function (socket) {
    console.log('a user connected');

    socket.on('message', function (message) {
        console.log('Message received: ', message.event);

        switch (message.event) {
            case 'presenter':
                createPresenter(socket, message.userName, message.roomName, err => {
                    if (err) {
                        console.log(err)
                    }
                });
                break;
            case 'joinRoom':
                joinRoom(socket, message.userName, message.roomName, err => {
                    if (err) {
                        console.log(err);
                    }
                });
                break;

            case 'processOffer':
                processOffer(socket, message.roomName, message.sdpOffer, err => {
                    if (err) {
                        console.log(err);
                    }
                });
                break;

            case 'candidate':
                addIceCandidate(socket, message.userid, message.roomName, message.candidate, err => {
                    if (err) {
                        console.log(err);
                    }
                });
                break;
        }

    });
});

// signaling functions
function createPresenter(socket, username, roomName, callback) {
    getRoom(socket, roomName, (err, myRoom) => {
        if(err) {
            return callback(err);
        }

        myRoom.pipeline.create('WebRtcEndpoint', (err, masterEndpoint) => {
            if (err) {
                return callback(err);
            }

            const user = {
                id: socket.id,
                name: username,
                endpoint: masterEndpoint
            }

            const iceCandidateQueue = iceCandidateQueues[user.id];
            if (iceCandidateQueue) {
                while (iceCandidateQueue.length) {
                    const ice = iceCandidateQueue.shift();
                    console.log(`user: ${user.name} collect candidate for outgoing media`);
                    user.endpoint.addIceCandidate(ice.candidate);
                }
            }

            user.endpoint.on('OnIceCandidate', event => {
                const candidate = kurento.register.complexTypes.IceCandidate(event.candidate);
                socket.emit('message', {
                    event: 'candidate',
                    userid: user.id,
                    candidate: candidate
                });
            });

            myRoom.presenter = user;
            socket.emit('message', {
                event: 'ready'
            });
        })
    })
}

function joinRoom(socket, username, roomname, callback) {
    getRoom(socket, roomname, (err, myRoom) => {
        if (err) {
            return callback(err);
        }

        myRoom.pipeline.create('WebRtcEndpoint', (err, viewerEndpoint) => {
            if (err) {
                return callback(err);
            }

            var user = {
                id: socket.id,
                name: username,
                endpoint: viewerEndpoint
            }

            let iceCandidateQueue = iceCandidateQueues[user.id];
            if (iceCandidateQueue) {
                while (iceCandidateQueue.length) {
                    let ice = iceCandidateQueue.shift();
                    console.log(`user: ${user.name} collect candidate for outgoing media`);
                    user.endpoint.addIceCandidate(ice.candidate);
                }
            }

            user.endpoint.on('OnIceCandidate', event => {
                let candidate = kurento.register.complexTypes.IceCandidate(event.candidate);
                socket.emit('message', {
                    event: 'candidate',
                    userid: user.id,
                    candidate: candidate
                });
            });

            socket.to(myRoom.presenter.id).emit('message', {
                event: 'newParticipantArrived', 
                userid: user.id,
                username: user.name
            });

            myRoom.participants[user.id] = user;
            socket.emit('message', {
                event: 'ready',
                presenterName: myRoom.presenter.name
            });
        });
    });
}

function processOffer(socket, roomname, sdpOffer, callback) {
    getEndpointForUser(socket, roomname, (err, endpoint) => {
        if (err) {
            return callback(err);
        }

        endpoint.processOffer(sdpOffer, (err, sdpAnswer) => {
            if (err) {
                return callback(err);
            }

            socket.emit('message', {
                event: 'receiveVideoAnswer',
                sdpAnswer: sdpAnswer
            });

            endpoint.gatherCandidates(err => {
                if (err) {
                    return callback(err);
                }
            });
        });
    })
}

function addIceCandidate(socket, senderid, roomname, iceCandidate, callback) {
    const myRoom = io.sockets.adapter.rooms[roomname]
    let user = myRoom.participants[socket.id] ||  myRoom.presenter;
    if (user != null) {
        let candidate = kurento.register.complexTypes.IceCandidate(iceCandidate);
        user.endpoint.addIceCandidate(candidate);
        callback(null);
    } else {
        callback(new Error("addIceCandidate failed"));
    }
}

// useful functions
function getRoom(socket, roomname, callback) {
    var myRoom = io.sockets.adapter.rooms[roomname] || { length: 0 };
    var numClients = myRoom.length;

    if (numClients == 0) {
        socket.join(roomname, () => {
            myRoom = io.sockets.adapter.rooms[roomname];
            getKurentoClient((error, kurento) => {
                kurento.create('MediaPipeline', (err, pipeline) => {
                    if (error) {
                        return callback(err);
                    }

                    myRoom.pipeline = pipeline;
                    myRoom.participants = {};
                    callback(null, myRoom);
                });
            });
        });
    } else {
        socket.join(roomname);
        callback(null, myRoom);
    }
}

function getEndpointForUser(socket, roomname, callback) {
    var myRoom = io.sockets.adapter.rooms[roomname];
    var viewer = myRoom.participants[socket.id];
    var presenter = myRoom.presenter;

    if (presenter.id === socket.id) {
        return callback(null, presenter.endpoint);
    }

    presenter.endpoint.connect(viewer.endpoint, err => {
        if (err) {
            return callback(err);
        }

        callback(null, viewer.endpoint);
    });
}

function getKurentoClient(callback) {
    if (kurentoClient !== null) {
        return callback(null, kurentoClient);
    }

    kurento(argv.ws_uri, function (error, _kurentoClient) {
        if (error) {
            console.log("Could not find media server at address " + argv.ws_uri);
            return callback("Could not find media server at address" + argv.ws_uri
                + ". Exiting with error " + error);
        }

        kurentoClient = _kurentoClient;
        callback(null, kurentoClient);
    });
}

// listen
http.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});