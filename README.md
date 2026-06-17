# UDP Stream Player — Samsung Hospitality TV (Tizen 6+)

This is an UDP Stream Player project mainly targeting Samsung Hospitality TVs, but it probably works on other Samsung devices running Tyzen 6 or later OS.

This project is the result of a collaborative effort to resolve a critical compatibility issue where AVPlay UDP streams function correctly on Tizen 3 but fail on Tizen 6 Hospitality TVs. The technical background and discussion for this fix can be found in this [Spiceworks community thread.](https://community.spiceworks.com/t/avplay-udp-stream-works-on-tizen-3-but-fails-on-tizen-6-hospitality-tv/1254380) 

This is a work in progress. As of Jun 17, 2026 playimg RTP Streams have not been tested.

## Files

```
HTVUDPSPlayer/
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
       { name: 'Channel 1', url: 'udp://@239.193.133.5:5000' },
       { name: 'Channel 2', url: 'rtp://@235.1.1.3:5004' },
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
| **Privilege** | `streamingtvplayer` (partner-level) declared in `config.xml`, signed with a **partner-level** certificate — required for UDP/RTP |
| **URL format** | `udp://@IP:Port` — the `@` joins the multicast group; `rtp://@IP:Port` for RTP |
| **Network** | Wired ethernet only — Wi-Fi does not support multicast |
| **Multicast range** | Samsung docs: use `234.0.0.0`–`238.255.255.255`; do NOT use `224.x.x.x` or `239.x.x.x`. In our tests `239.x.x.x` also worked (confirmed `239.193.133.5`) |
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
- Verify the multicast address (iSamsung docs recommend `234–238.x.x.x` but `239.x.x.x` worked in our tests)
- Confirm the URL uses the `udp://@IP:Port` form
- Check the network switch has IGMP snooping enabled
- Confirm the stream is actively broadcasting before the TV tries to join

**`SecurityException` / "Player setup error" on `player.open()`**
- Declare the `streamingtvplayer` privilege (partner-level) in `config.xml`
- Sign the package with a Samsung **partner-level** certificate — a public
  author/distributor certificate is **not** sufficient for UDP/RTP AVPlay

**AVPlayExtension not available**
- The TV model may not have the IPTV hardware decoder
- Check the engineering menu: `Option → MRT Option → Option Num`
  If there is no "Num of IPTV" entry, the hardware is absent and UDP will not work


## License

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://apache.org

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

