let APP_ID="9afef10cc80b4f6ba0e812c5c655f7d2";

let token = null;
let uid = String(Math.floor(Math.random()*10000));

let client;
let channel;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room');

if(!roomId){
    window.location = 'lobby.html';
}

let localStream;
let remoteStream;
let peerConnection;

const servers = {
    iceServers:[
        {
            urls:['stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']
        }
    ]
};

let constraints = {
    video:{
        width:{min:640,ideal:1920,max:1920},
        height:{min:480,ideal:1080,max:1080},
    },
    audio:true
};

let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID);
    await client.login({uid});

    //index.html?room=243345
    channel = client.createChannel(roomId);
    await channel.join();

    channel.on('MemberJoined', handleUserJoined);
    channel.on('MemberLeft',handleUserLeft);

    client.on('MessageFromPeer', handleMessageFromPeer);

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById('user-1').srcObject = localStream;

}

let handleUserLeft = (MemberId) => {
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame');
};

let handleMessageFromPeer = async (msg,MemberId) => {
    msg = JSON.parse(msg.text);
    if(msg.type === 'offer'){
        createAnswer(MemberId,msg.offer);
    }else if(msg.type === 'answer'){
        addAnswer(msg.answer);
    }else if(msg.type === 'candidate'){
        if(peerConnection){
            peerConnection.addIceCandidate(msg.candidate);
        }
    }
};

let handleUserJoined = async (MemberId) => {
    console.log('User Joined: ', MemberId);
    createOffer(MemberId);
}

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers);

    remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display = 'block';

    document.getElementById('user-1').classList.add('smallFrame');

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia({video:true,audio:false});
        document.getElementById('user-1').srcObject = localStream;
    }

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track,localStream);
    });

    peerConnection.ontrack = (e) => {
        e.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
        })
    };

    peerConnection.onicecandidate = async (e) => {
        if(e.candidate){
            client.sendMessageToPeer({text:JSON.stringify({'type':'candidate','candidate':e.candidate})},MemberId);
        }
    };
};

let createOffer = async (MemberId) => {
    await createPeerConnection(MemberId);

    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    client.sendMessageToPeer({text:JSON.stringify({'type':'offer','offer':offer})},MemberId);
}

let createAnswer = async (MemberId, offer) => {
    await createPeerConnection(MemberId);

    await peerConnection.setRemoteDescription(offer);

    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    client.sendMessageToPeer({text:JSON.stringify({'type':'answer','answer':answer})},MemberId);
};

let addAnswer = async (answer) => {
    if(!peerConnection.currentRemoteDescription){
        await peerConnection.setRemoteDescription(answer);
    }
};

let leaveChannel = async () => {
    await channel.leave();
    await client.logout();
};

let toggleCamera = async () => {
    let videoTrack = localStream.getVideoTracks().find(track => track.kind === 'video');

    if(videoTrack.enabled){
        videoTrack.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255,80,80)';
    }else{
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(172,102,249,.9)';
    }
};

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio');

    if(audioTrack.enabled){
        audioTrack.enabled = false;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255,80,80)';
    }else{
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(172,102,249,.9)';
    }
};

window.addEventListener('beforeunload',leaveChannel);

document.getElementById('camera-btn').addEventListener('click',toggleCamera);

document.getElementById('mic-btn').addEventListener('click',toggleMic);

init();