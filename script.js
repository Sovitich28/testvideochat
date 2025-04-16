const socket = io('https://backend-2mfz.onrender.com');
let localStream;
let peerConnections = {};
const roomIdInput = document.getElementById('roomId');
const localVideo = document.getElementById('localVideo');
const videoContainer = document.getElementById('videoContainer');
const muteBtn = document.getElementById('muteBtn');
const videoBtn = document.getElementById('videoBtn');
let isMuted = false;
let isVideoOn = true;

const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

async function startMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
    } catch (err) {
        console.error('Error accessing media devices:', err);
    }
}

function joinRoom() {
    const roomId = roomIdInput.value.trim();
    if (!roomId) return alert('Please enter a room ID');
    
    socket.emit('join-room', roomId);
    roomIdInput.disabled = true;
    document.querySelector('.join-room button').disabled = true;
}

socket.on('user-connected', async (userId) => {
    const pc = new RTCPeerConnection(config);
    peerConnections[userId] = pc;

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
        const remoteVideo = document.createElement('video');
        remoteVideo.id = `video-${userId}`;
        remoteVideo.autoplay = true;
        remoteVideo.srcObject = event.streams[0];
        videoContainer.appendChild(remoteVideo);
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { candidate: event.candidate, to: userId });
        }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('offer', { offer, to: userId });
});

socket.on('offer', async ({ offer, from }) => {
    const pc = new RTCPeerConnection(config);
    peerConnections[from] = pc;

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
        const remoteVideo = document.createElement('video');
        remoteVideo.id = `video-${from}`;
        remoteVideo.autoplay = true;
        remoteVideo.srcObject = event.streams[0];
        videoContainer.appendChild(remoteVideo);
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { candidate: event.candidate, to: from });
        }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('answer', { answer, to: from });
});

socket.on('answer', async ({ answer, from }) => {
    const pc = peerConnections[from];
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async ({ candidate, from }) => {
    const pc = peerConnections[from];
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
});

socket.on('user-disconnected', (userId) => {
    if (peerConnections[userId]) {
        peerConnections[userId].close();
        delete peerConnections[userId];
        const remoteVideo = document.getElementById(`video-${userId}`);
        if (remoteVideo) remoteVideo.remove();
    }
});

muteBtn.onclick = () => {
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
    muteBtn.textContent = isMuted ? 'Unmute Mic' : 'Mute Mic';
};

videoBtn.onclick = () => {
    isVideoOn = !isVideoOn;
    localStream.getVideoTracks().forEach(track => track.enabled = isVideoOn);
    videoBtn.textContent = isVideoOn ? 'Stop Video' : 'Start Video';
};

startMedia();
