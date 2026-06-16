/**
 * UDP/RTP Multicast Stream Player
 * Samsung Hospitality TV — Tizen 6+
 *
 * Key differences from standard AVPlay (Tizen 3):
 *  - Use webapis.avplay; loading avplayextension.js enables UDP/RTP URL support
 *  - UDP/RTP playback requires the streamingtvplayer privilege (partner-level)
 *    in config.xml AND signing with a Samsung partner-level certificate
 *  - Multicast URLs use the form udp://@IP:Port (note the '@')
 *  - Samsung docs recommend the 234.0.0.0–238.255.255.255 range and say
 *    224.x.x.x / 239.x.x.x are NOT supported — but 239.x.x.x worked in our
 *    tests (confirmed: udp://@239.193.133.5:5000)
 *  - A wired network connection is required; Wi-Fi will not work
 *  - Each UDP packet must start with sync byte 0x47
 *  - IGMPv2 or newer must be supported by the network switch/router
 */

'use strict';

// ---------------------------------------------------------------------------
// Channel list — edit these to match your multicast streams
// ---------------------------------------------------------------------------
var CHANNELS = [
    { name: 'Channel 1',  url: 'udp://@239.193.133.5:5000' },  // confirmed working
    { name: 'Channel 2',  url: 'udp://@235.1.1.2:5004' },
    { name: 'Channel 3',  url: 'rtp://@235.1.1.3:5004' }   // RTP uses same form
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
var player       = null;   // reference to webapis.avplay
var currentIndex = 0;
var playerState  = 'IDLE'; // IDLE | PREPARING | PLAYING | STOPPED | ERROR

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
var elStatus   = document.getElementById('status-text');
var elChannel  = document.getElementById('channel-label');
var elUrl      = document.getElementById('url-display');
var elHud      = document.getElementById('hud');
var elError    = document.getElementById('error-overlay');
var elErrMsg   = document.getElementById('error-message');

var HUD_TIMEOUT = 4000;    // ms before HUD fades out
var hudTimer    = null;

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------
window.onload = function () {
    initTizenKeys();

    // UDP/RTP support is enabled by loading avplayextension.js (see index.html);
    // the player object itself is the standard webapis.avplay.
    if (typeof webapis !== 'undefined' && webapis.avplay) {
        player = webapis.avplay;
        log('AVPlay API found — ready');
        setStatus('Ready');
        playChannel(currentIndex);
    } else {
        // Fallback: webapis.avplay not present (WebAPIs not loaded or wrong model)
        showError(
            'AVPlay not available',
            'This device may not support UDP streaming, or the webapis.js / ' +
            'avplayextension.js scripts were not loaded. Check config.xml and ' +
            'firmware version.'
        );
    }
};

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------
function playChannel(index) {
    if (!player) return;

    currentIndex = index;
    var channel = CHANNELS[index];

    stopPlayer();   // always stop cleanly before opening a new URL

    elChannel.textContent = channel.name;
    elUrl.textContent     = channel.url;
    setStatus('Connecting…');
    hideError();
    showHud();

    try {
        // 1. Open the URL
        //    UDP format:  udp://@IP:Port   ('@' = join the multicast group)
        //    RTP format:  rtp://@IP:Port
        player.open(channel.url);

        // 2. Bind the video output to the <object> element in the DOM
        player.setDisplayRect(0, 0, 1920, 1080);

        // 3. Register event listeners BEFORE prepare
        player.setListener(makeListener());

        // 4. Use prepareAsync so the UI stays responsive while buffering
        playerState = 'PREPARING';
        player.prepareAsync(
            function onSuccess() {
                log('prepareAsync success — starting playback');
                player.play();
                playerState = 'PLAYING';
                setStatus('Playing');
                hideHudAfterDelay();
            },
            function onError(err) {
                log('prepareAsync failed: ' + JSON.stringify(err));
                playerState = 'ERROR';
                showError(
                    'Prepare failed',
                    buildErrorMessage(err)
                );
            }
        );

    } catch (e) {
        log('Exception during player setup: ' + e.name + ': ' + e.message);
        playerState = 'ERROR';
        if (e.name === 'SecurityError' || /security/i.test(e.message)) {
            showError(
                'Player setup error (SecurityException)',
                'UDP/RTP playback requires the streamingtvplayer privilege ' +
                '(partner-level) in config.xml AND signing with a Samsung ' +
                'partner-level certificate. Verify both, then re-deploy.'
            );
        } else {
            showError('Player setup error', e.message);
        }
    }
}

function stopPlayer() {
    if (!player) return;
    try {
        var state = player.getState();
        if (state !== 'NONE' && state !== 'IDLE') {
            player.stop();
        }
        player.close();
    } catch (e) {
        // Ignore errors on stop/close — state may already be reset
    }
    playerState = 'IDLE';
}

// ---------------------------------------------------------------------------
// AVPlay listener
// ---------------------------------------------------------------------------
function makeListener() {
    return {
        onbufferingstart: function () {
            log('Buffering start');
            setStatus('Buffering…');
        },
        onbufferingprogress: function (percent) {
            log('Buffering: ' + percent + '%');
            setStatus('Buffering ' + percent + '%');
        },
        onbufferingcomplete: function () {
            log('Buffering complete');
            setStatus('Playing');
            hideHudAfterDelay();
        },
        oncurrentplaytime: function (currentTime) {
            // Called periodically during playback; use for progress if needed
        },
        onplaybackcompleted: function () {
            log('Playback completed');
            setStatus('Completed');
            playerState = 'STOPPED';
        },
        onerror: function (eventType) {
            log('Player error event: ' + eventType);
            playerState = 'ERROR';

            var hint = '';
            if (eventType === 'PLAYER_ERROR_NOT_SUPPORTED_FORMAT') {
                hint = 'Stream format not supported. Check codec (MPEG-TS required) ' +
                       'and that sync byte 0x47 is present.';
            } else if (eventType === 'PLAYER_ERROR_CONNECTION_FAILED') {
                hint = 'Cannot reach stream. Verify wired network, multicast ' +
                       'address (docs recommend 234–238.x.x.x; 239.x worked for ' +
                       'us), the udp://@IP:Port form, and IGMP on the switch.';
            }

            showError('Playback error: ' + eventType, hint);
        },
        onevent: function (eventType, eventData) {
            log('Event: ' + eventType + ' data: ' + eventData);
        }
    };
}

// ---------------------------------------------------------------------------
// Remote control key handling
// ---------------------------------------------------------------------------
function initTizenKeys() {
    // Register the keys we need so the TV dispatches them to the app
    var keysToRegister = ['MediaPlay', 'MediaStop', 'MediaPlayPause',
                          'MediaRewind', 'MediaFastForward'];
    try {
        keysToRegister.forEach(function (key) {
            tizen.tvinputdevice.registerKey(key);
        });
    } catch (e) {
        log('Key registration skipped: ' + e.message);
    }

    document.addEventListener('keydown', onKeyDown);
}

function onKeyDown(e) {
    showHud();

    switch (e.keyCode) {
        // Play / Pause / PlayPause
        case 415:  // MediaPlay
        case 10252: // MediaPlayPause
            if (playerState === 'PLAYING') {
                // PLAYING -> PAUSED (freeze-frame; live multicast has no DVR buffer)
                player.pause();
                playerState = 'PAUSED';
                setStatus('Paused');
            } else if (playerState === 'PAUSED') {
                // PAUSED -> PLAYING: play() resumes (no separate resume() in AVPlay)
                player.play();
                playerState = 'PLAYING';
                setStatus('Playing');
            } else {
                // STOPPED / ERROR / IDLE: (re)start the current channel
                playChannel(currentIndex);
            }
            break;

        // Stop
        case 413: // MediaStop
            stopPlayer();
            setStatus('Stopped');
            break;

        // Previous channel
        case 37:  // ArrowLeft
        case 412: // MediaRewind
            changeChannel(-1);
            break;

        // Next channel
        case 39:  // ArrowRight
        case 417: // MediaFastForward
            changeChannel(1);
            break;

        // Back / Exit
        case 10009: // Back
        case 27:    // Escape
            stopPlayer();
            try { tizen.application.getCurrentApplication().exit(); } catch (e) {}
            break;

        default:
            break;
    }

    // Re-arm the HUD fade-out after any keypress so it doesn't linger on screen.
    hideHudAfterDelay();
}

function changeChannel(delta) {
    var next = (currentIndex + delta + CHANNELS.length) % CHANNELS.length;
    playChannel(next);
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
function setStatus(text) {
    elStatus.textContent = text;
    log('Status: ' + text);
}

function showHud() {
    elHud.classList.remove('hidden', 'fade-out');
    if (hudTimer) clearTimeout(hudTimer);
}

function hideHudAfterDelay() {
    if (hudTimer) clearTimeout(hudTimer);
    hudTimer = setTimeout(function () {
        elHud.classList.add('fade-out');
    }, HUD_TIMEOUT);
}

function showError(title, message) {
    elError.classList.remove('hidden');
    document.getElementById('error-title').textContent = title;
    elErrMsg.textContent = message || '';
    showHud();
}

function hideError() {
    elError.classList.add('hidden');
}

function buildErrorMessage(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    return JSON.stringify(err);
}

function log(msg) {
    console.log('[UDP-Player] ' + msg);
}
