// getting dom elements
var divSelectRoom = document.getElementById("selectRoom");
var divConsultingRoom = document.getElementById("consultingRoom");
var inputRoomNumber = document.getElementById("roomNumber");
var btnGoRoom = document.getElementById("goRoom");
var localVideo = document.getElementById("localVideo");
var remoteVideo = document.getElementById("remoteVideo");

// variables
var roomNumber;
var localStream;
var remoteStream;
var rtcPeerConnection;
var iceServers = {
    'iceServers': [
        { 'url': 'stun:stun.services.mozilla.com' },
        { 'url': 'stun:stun.l.google.com:19302' }
    ]
}
var streamConstraints = { audio: true, video: true };
var isCaller;

// Let's do this
var socket = io();

btnGoRoom.onclick = function () {
    if (inputRoomNumber.value === '') {
        alert("Please type a room number")
    } else {
        roomNumber = inputRoomNumber.value;
        socket.emit('create or join', roomNumber);
        divSelectRoom.style = "display: none;";
        divConsultingRoom.style = "display: block;";
    }
};

// message handlers
socket.on('created', function (room) {
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        localStream = stream;
        localVideo.src = URL.createObjectURL(stream);
        isCaller = true;
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices');
    });
});

socket.on('joined', function (room) {
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        localStream = stream;
        localVideo.src = URL.createObjectURL(stream);
        socket.emit('ready', roomNumber);
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices');
    });
});

socket.on('candidate', function (event) {
    var candidate = new RTCIceCandidate({
        sdpMLineIndex: event.label,
        candidate: event.candidate
    });
    rtcPeerConnection.addIceCandidate(candidate);
});

socket.on('ready', function () {
    if (isCaller) {
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.onaddstream = onAddStream;
        rtcPeerConnection.addStream(localStream);
        rtcPeerConnection.createOffer(setLocalAndOffer, function(e){console.log(e)});
    }
});

socket.on('offer', function (event){
    if(!isCaller){
        rtcPeerConnection = new RTCPeerConnection(iceServers);
        rtcPeerConnection.onicecandidate = onIceCandidate;
        rtcPeerConnection.onaddstream = onAddStream;
        rtcPeerConnection.addStream(localStream);
        rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
        rtcPeerConnection.createAnswer(setLocalAndAnswer, function(e){console.log(e)});
    }
});

socket.on('answer', function (event){
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
})

// handler functions
function onIceCandidate(event) {
    if (event.candidate) {
        console.log('sending ice candidate');
        socket.emit('candidate', {
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
            room: roomNumber
        })
    }
}

function onAddStream(event) {
    remoteVideo.src = URL.createObjectURL(event.stream);
    remoteStream = event.stream;
}

function setLocalAndOffer(sessionDescription) {
    rtcPeerConnection.setLocalDescription(sessionDescription);
    socket.emit('offer', {
        type: 'offer',
        sdp: sessionDescription,
        room: roomNumber
    });
}

function setLocalAndAnswer(sessionDescription) {
    rtcPeerConnection.setLocalDescription(sessionDescription);
    socket.emit('answer', {
        type: 'answer',
        sdp: sessionDescription,
        room: roomNumber
    });
}