// getting dom elements
const divRoomSelection = document.getElementById("roomSelection");
const divMeetingRoom = document.getElementById("meetingRoom");
const inputRoom = document.getElementById("room");
const inputName = document.getElementById("name");
const btnPresenter = document.getElementById("presenter");
const btnRegister = document.getElementById("register");
const videoBroadcast = document.getElementById("broadcast");
const pPresenterName = document.getElementById("presenterName");
const ulViewers = document.getElementById("viewers");

// variables
let roomName;
let userName;
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
        receiveVideo(message.presenterName);
      }
      break;
    case "newParticipantArrived": 
      console.log(`${message.username} has joined the session`);
      const li = document.createElement("li");
      li.innerText = `${message.username} has joined`;
      ulViewers.appendChild(li);
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
function receiveVideo(presenterName) {
  pPresenterName.innerText = `${presenterName} is presenting...`

  var options = {
    remoteVideo: videoBroadcast,
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
  pPresenterName.innerText = userName + " is presenting...";

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
    localVideo: videoBroadcast,
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
