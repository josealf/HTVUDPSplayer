# UDP Stream Player — Samsung Hospitality TV (Tizen 6+)

## Files

```
udp-player/
├── index.html      — App entry point; loads avplayextension.js
├── config.xml      — Tizen manifest with required privileges
├── js/app.js       — Player logic and remote-control handling
├── css/style.css   — HUD overlay styles (1920×1080)
└── icon.png        — (add your own 117×117 PNG)
```

## Quick start

1. **Edit your channel list** in `js/app.js`:
   ```js
   var CHANNELS = [
       { name: 'Channel 1', url: 'udp://235.1.1.1:5004' },
       { name: 'Channel 2', url: 'rtp://235.1.1.3:5004' },
   ];
   ```

2. **Package and deploy** via Tizen Studio:
   - Import the folder as a Tizen Web project
   - Set the target device to your Hospitality TV
   - Run `Project → Build Signed Package` with a Partner-level certificate
   - Deploy via **Run As → Tizen Web Application**

## Critical requirements (Tizen 6+)

| Requirement | Detail |
|---|---|
| **API** | Player object is `webapis.avplay`; UDP/RTP support is enabled by loading `avplayextension.js` |
| **Script tag** | Load both `$WEBAPIS/webapis/webapis.js` and `$WEBAPIS/avplayextension/avplayextension.js` |
| **Network** | Wired ethernet only — Wi-Fi does not support multicast |
| **Multicast range** | Use `234.0.0.0`–`238.255.255.255`. Do NOT use `224.x.x.x` or `239.x.x.x` |
| **Sync byte** | Each UDP packet must start with `0x47` |
| **IGMP** | Network switch must support IGMPv2 or newer |
| **Bandwidth** | Switch/router must handle ≥80 Mbps |
| **Container** | MPEG-TS only |

## Remote control keys

| Key | Action |
|---|---|
| PLAY | Play current channel (or retry on error) |
| STOP | Stop playback |
| ◄ / ► | Previous / next channel |
| BACK | Exit app |

## Troubleshooting

**`PLAYER_ERROR_NOT_SUPPORTED_FORMAT`**
- Confirm `avplayextension.js` is loaded so `webapis.avplay` accepts UDP/RTP URLs
- Verify the stream is MPEG-TS with sync byte `0x47`
- Check the codec is MPEG-2 Video or H.264 (H.265 requires separate check)

**`PLAYER_ERROR_CONNECTION_FAILED`**
- Confirm TV is on a wired connection
- Verify the multicast address is in the `234–238.x.x.x` range
- Check the network switch has IGMP snooping enabled
- Confirm the stream is actively broadcasting before the TV tries to join

**AVPlayExtension not available**
- The TV model may not have the IPTV hardware decoder
- Check the engineering menu: `Option → MRT Option → Option Num`
  If there is no "Num of IPTV" entry, the hardware is absent and UDP will not work
