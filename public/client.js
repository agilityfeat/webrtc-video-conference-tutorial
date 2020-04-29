// getting dom elements
const divRoomSelection = document.getElementById("roomSelection");
const divMeetingRoom = document.getElementById("meetingRoom");
const inputRoom = document.getElementById("room");
const inputName = document.getElementById("name");
const btnPresenter = document.getElementById("presenter");
const btnRegister = document.getElementById("register");

// variables
let roomName;
let userName;
let participants = {};
let isPresenter;
let rtcPeer;

// Let's do this
const socket = io();

btnPresenter.onclick = function () {
  roomName = inputRoom.value;
  userName = inputName.value;

  if (roomName === "" || userName === "") {
    alert("Room and Name are required!");
  } else {
    isPresenter = true;
    const message = {
      event: "presenter",
      userName: userName,
      roomName: roomName,
    };
    sendMessage(message);
    divRoomSelection.style = "display: none";
    divMeetingRoom.style = "display: block";
  }
};

btnRegister.onclick = function () {
  roomName = inputRoom.value;
  userName = inputName.value;

  if (roomName === "" || userName === "") {
    alert("Room and Name are required!");
  } else {
    const message = {
      event: "joinRoom",
      userName: userName,
      roomName: roomName,
    };
    sendMessage(message);
    divRoomSelection.style = "display: none";
    divMeetingRoom.style = "display: block";
  }
};

// messages handlers
socket.on("message", (message) => {
  console.log("Message received: " + message.event);

  switch (message.event) {
    case "ready":
      if(isPresenter) {
        sendVideo();
      } else {
        receiveVideo();
      }
      break;
    case "newParticipantArrived": 
      console.log(`${message.username} has joined the session`);
      break;
    case "receiveVideoAnswer":
      onReceiveVideoAnswer(message.sdpAnswer);
      break;
    case "candidate":
      addIceCandidate(message.candidate);
      break;
  }
});

// handlers functions
function receiveVideo(userid, username) {
  var video = document.createElement("video");
  var div = document.createElement("div");
  div.className = "videoContainer";
  var name = document.createElement("div");
  video.id = userid;
  video.autoplay = true;
  name.appendChild(document.createTextNode(username));
  div.appendChild(video);
  div.appendChild(name);
  divMeetingRoom.appendChild(div);

  var options = {
    remoteVideo: video,
    onicecandidate: onIceCandidate,
  };

  rtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function (
    err
  ) {
    if (err) {
      return console.error(err);
    }
    this.generateOffer(onOffer);
  });

  var onOffer = function (err, offer, wp) {
    console.log("sending offer");
    var message = {
      event: "processOffer",
      roomName: roomName,
      sdpOffer: offer,
    };
    sendMessage(message);
  };

  function onIceCandidate(candidate, wp) {
    console.log("sending ice candidates");
    var message = {
      event: "candidate",
      roomName: roomName,
      candidate: candidate,
    };
    sendMessage(message);
  }
}

function sendVideo() {
  var video = document.createElement("video");
  var div = document.createElement("div");
  div.className = "videoContainer";
  var name = document.createElement("div");
  video.autoplay = true;
  name.appendChild(document.createTextNode(userName));
  div.appendChild(video);
  div.appendChild(name);
  divMeetingRoom.appendChild(div);

  var constraints = {
    audio: false,
    video: {
      mandatory: {
        maxWidth: 320,
        maxFrameRate: 15,
        minFrameRate: 15,
      },
    },
  };

  var options = {
    localVideo: video,
    mediaConstraints: constraints,
    onicecandidate: onIceCandidate,
  };

  rtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function (
    err
  ) {
    if (err) {
      return console.error(err);
    }
    this.generateOffer(onOffer);
  });

  var onOffer = function (err, offer, wp) {
    console.log("sending offer");
    var message = {
      event: "processOffer",
      roomName: roomName,
      sdpOffer: offer,
    };
    sendMessage(message);
  };

  function onIceCandidate(candidate, wp) {
    console.log("sending ice candidates");
    var message = {
      event: "candidate",
      roomName: roomName,
      candidate: candidate,
    };
    sendMessage(message);
  }
}

function onReceiveVideoAnswer(sdpAnswer) {
  rtcPeer.processAnswer(sdpAnswer);
}

function addIceCandidate(candidate) {
  rtcPeer.addIceCandidate(candidate);
}

// utilities
function sendMessage(message) {
  console.log("sending " + message.event + " message to server");
  socket.emit("message", message);
}
