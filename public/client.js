// getting dom elements
var inputRoom = document.getElementById('room');
var btnEnter = document.getElementById('enter');
var divSelectRoom = document.getElementById('selectRoom');
var divVideos = document.getElementById('videos');

// variables and constants
var apiKey;
var sessionId;
var token;
var roomName;
var SERVER_BASE_URL = 'http://localhost:3000';

// Let's do this
btnEnter.onclick = function () {
    roomName = inputRoom.value;

    fetch(SERVER_BASE_URL + '/room/' + roomName).then(function (res) {
        return res.json()
    }).then(function (res) {
        apiKey = res.apiKey;
        sessionId = res.sessionId;
        token = res.token;
        initializeSession();
    }).catch(handleError);
}

// tokbox code
function initializeSession() {

    divSelectRoom.style = "display: none";
    divVideos.style = "display: block";

    var session = OT.initSession(apiKey, sessionId);

    // Subscribe to a newly created stream
    session.on('streamCreated', function (event) {
        session.subscribe(event.stream, 'subscribers', {
            insertMode: 'append',
            width: '360px',
            height: '240px'
        }, handleError);
    });
    // Create a publisher
    var publisher = OT.initPublisher('publisher', {
        insertMode: 'append',
        width: '360px',
        height: '240px'
    }, handleError);

    // Connect to the session
    session.connect(token, function (error) {
        // If the connection is successful, publish to the session
        if (error) {
            handleError(error);
        } else {
            session.publish(publisher, handleError);
        }
    });
}

// Handling all of our errors here by alerting them
function handleError(error) {
    if (error) {
        alert(error.message);
    }
}