# ChatApp, a web-based messaging and video/audio calling app.

### <a href="https://dn-chat-app.netlify.app" target="_blank">Visit web app</a>

### Built using:

- React
- Redux
- Material-UI
- Firebase
- WebRTC

### Features:

- Sign in with Google or email
- Toggle dark / light theme
- Track users online presence 
- Create and delete private chats
- Create, manage, leave, and delete public chats
- Send, draft, reply, forward, and delete messages
- Track unread messages count 
- Share files, images, and links
- Make audio and video calls
- Make group calls (under development)
- Responsive design


*Sidenote when testing WebRTC Calls* 

Current implementation: 
Uses Google STUN server. Windows Firewall may block incoming traffic, so peer-to-peer calls can fail. 
To allow incoming calls on Windows, run Command Prompt as Admin:

```netsh advfirewall firewall add rule name="WebRTC Inbound UDP" dir=in action=allow protocol=UDP localport=1024-65535```

For maximum reliability (“works everywhere”): TURN over TLS (turns:) is required. 
This runs on port 443 (almost always open) but needs a valid TLS certificate and a proper domain, 
which was not feasible for this demo project running on a subdomain.

After testing, run the below command to delete the created rule
```netsh advfirewall firewall delete rule name="WebRTC Inbound UDP"```


### Desktop:

<img src="https://github.com/dagm1425/chat-app/blob/main/images/desktop.png" alt="Desktop" width="500">

### Tablet:

<img src="https://github.com/dagm1425/chat-app/blob/main/images/tablet.png" alt="Tablet" width="350">

### Mobile:

<img src="https://github.com/dagm1425/chat-app/blob/main/images/mobile.png" alt="Mobile" width="200">
