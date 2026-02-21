let player;
let isPlayerReady = false;
let isAdmin = false;
let roomId = '';
let userName = '';
let currentVideoId = '';
let lastChatLength = 0;
let isPolling = false;

function onYouTubeIframeAPIReady() {
    // Setup deferral
}

function initPlayer(videoId) {
    if (player) {
        player.loadVideoById(videoId);
        return;
    }
    player = new YT.Player('player', {
        videoId: videoId || '_o7qjN3KF8U',
        playerVars: {
            'controls': isAdmin ? 1 : 0,
            'disablekb': isAdmin ? 0 : 1,
            'rel': 0,
            'modestbranding': 1,
            'autoplay': 0
        },
        events: {
            'onReady': () => { isPlayerReady = true; },
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    if (!isAdmin) return;
    
    if (event.data == YT.PlayerState.PLAYING) {
        sendAction('play', player.getCurrentTime());
    } else if (event.data == YT.PlayerState.PAUSED) {
        sendAction('pause', player.getCurrentTime());
    }
}

async function joinRoom() {
    const nameInput = document.getElementById('userName').value.trim();
    userName = nameInput || 'Anonymous-' + Math.floor(Math.random()*1000);
    roomId = document.getElementById('roomIdInput').value.trim() || Math.random().toString(36).substring(2, 9).toUpperCase();
    isAdmin = document.getElementById('isAdminCheck').checked;

    document.getElementById('setupModal').classList.add('hidden');
    document.getElementById('roomIdDisplay').innerText = `(Room: ${roomId})`;
    
    const badge = document.getElementById('roleBadge');
    badge.innerText = isAdmin ? 'Admin' : 'Viewer';
    badge.classList.remove('hidden');
    badge.classList.add(isAdmin ? 'bg-primary' : 'bg-secondary', isAdmin ? 'text-primary-foreground' : 'text-secondary-foreground');

    if (isAdmin) {
        document.getElementById('adminControls').classList.remove('hidden');
    }

    appendMessage({ sender: 'System', message: `Joined room ${roomId} as ${userName}.` });

    // Start polling loop
    isPolling = true;
    pollState();
}

async function pollState() {
    if (!isPolling) return;
    
    try {
        const url = `/api/state/${roomId}?username=${encodeURIComponent(userName)}&is_admin=${isAdmin}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            
            if (data.video_id && data.video_id !== currentVideoId) {
                currentVideoId = data.video_id;
                initPlayer(currentVideoId);
            }

            if (data.history && data.history.length > lastChatLength) {
                const newMessages = data.history.slice(lastChatLength);
                newMessages.forEach(msg => appendMessage(msg));
                lastChatLength = data.history.length;
            }

            // Viewer syncing logic
            if (!isAdmin && isPlayerReady) {
                // Apply state if action requires it
                if (data.action === "play") {
                    let diff = Math.abs(player.getCurrentTime() - data.current_time);
                    if (diff > 2) player.seekTo(data.current_time, true);
                    if (player.getPlayerState() !== YT.PlayerState.PLAYING) player.playVideo();
                    
                } else if (data.action === "pause") {
                    let diff = Math.abs(player.getCurrentTime() - data.current_time);
                    if (diff > 2) player.seekTo(data.current_time, true);
                    if (player.getPlayerState() !== YT.PlayerState.PAUSED) player.pauseVideo();
                    
                } else if (data.action === "sync") {
                    let diff = Math.abs(player.getCurrentTime() - data.current_time);
                    if (diff > 2) player.seekTo(data.current_time, true);
                    if (data.state === 'playing' && player.getPlayerState() !== YT.PlayerState.PLAYING) {
                        player.playVideo();
                    } else if (data.state === 'paused' && player.getPlayerState() !== YT.PlayerState.PAUSED) {
                        player.pauseVideo();
                    }
                } else if (data.action === "change") {
                     if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
                }
            }
        }
    } catch(e) {}
    
    setTimeout(pollState, 1500); // Pool every 1.5 seconds
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (message && roomId) {
        input.value = '';
        await fetch(`/api/chat/${roomId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: userName, message: message, is_admin: isAdmin })
        });
        pollState(); // Trigger immediate poll
    }
}

function handleEnter(e) {
    if (e.key === 'Enter') sendMessage();
}

function appendMessage(data) {
    const container = document.getElementById('chatMessages');
    const isSystem = data.sender === 'System';
    
    let nameBadge = data.sender;
    if (data.is_admin) {
        nameBadge += ' <span class="bg-primary text-primary-foreground px-1.5 py-0.5 rounded-[4px] text-[9px] ml-1.5 uppercase tracking-wide font-bold inline-block align-middle mb-0.5">Admin</span>';
    }

    const msgHtml = isSystem ? 
        `<div class="text-center text-xs text-muted-foreground my-1">${data.message}</div>` :
        `<div class="flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <span class="text-xs font-semibold text-muted-foreground flex items-center h-4">${nameBadge}</span>
            <div class="bg-muted px-3.5 py-2.5 rounded-lg text-sm w-fit max-w-[90%] rounded-tl-sm break-words leading-relaxed text-secondary-foreground shadow-sm">
                ${data.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
            </div>
        </div>`;
    
    container.insertAdjacentHTML('beforeend', msgHtml);
    container.scrollTop = container.scrollHeight;
}

async function sendAction(action, time = 0, video_id = null, state = null) {
    if (!isAdmin || !roomId) return;
    await fetch(`/api/action/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, time, video_id, state })
    });
}

// Admin Video Actions
function playVideo() {
    if (isPlayerReady) {
        player.playVideo();
        sendAction('play', player.getCurrentTime());
    }
}
function pauseVideo() {
    if (isPlayerReady) {
        player.pauseVideo();
        sendAction('pause', player.getCurrentTime());
    }
}
function changeVideo() {
    const input = document.getElementById('videoUrl');
    let id = input.value.trim();
    if (!id) return;
    if (id.includes('v=')) id = id.split('v=')[1].split('&')[0];
    else if (id.includes('youtu.be/')) id = id.split('youtu.be/')[1].split('?')[0];
    
    if (id) {
        input.value = '';
        player.loadVideoById(id);
        sendAction('change', 0, id);
    }
}
function syncVideo() {
    if (isPlayerReady) {
        const state = player.getPlayerState() == YT.PlayerState.PLAYING ? 'playing' : 'paused';
        sendAction('sync', player.getCurrentTime(), null, state);
    }
}
