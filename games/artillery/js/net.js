// Online play with no game server: a direct WebRTC data channel between the
// two phones. Players swap two short codes (an invite and a reply) through
// any messaging app. Only a free public STUN server is used to find routes.
(function () {
  'use strict';

  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

  function b64url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64url(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  async function pipe(bytes, stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }

  // Codes are "Z" + deflated JSON when the browser can compress, else "J" + JSON.
  async function encode(desc) {
    const json = JSON.stringify({ t: desc.type, s: desc.sdp });
    const raw = new TextEncoder().encode(json);
    if (window.CompressionStream) {
      try { return 'Z' + b64url(await pipe(raw, new CompressionStream('deflate-raw'))); } catch (e) { /* fall through */ }
    }
    return 'J' + b64url(raw);
  }
  async function decode(code) {
    code = (code || '').trim();
    const m = code.match(/[#&?]join=([A-Za-z0-9_-]+)/);
    if (m) code = m[1];
    code = code.replace(/\s+/g, '');
    let bytes = unb64url(code.slice(1));
    if (code[0] === 'Z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (code[0] !== 'J') throw new Error('That code does not look right.');
    const o = JSON.parse(new TextDecoder().decode(bytes));
    return { type: o.t, sdp: o.s };
  }

  function waitIce(pc) {
    return new Promise(function (resolve) {
      if (pc.iceGatheringState === 'complete') return resolve();
      const done = function () { if (pc.iceGatheringState === 'complete') { clearTimeout(timer); resolve(); } };
      const timer = setTimeout(resolve, 5000);
      pc.addEventListener('icegatheringstatechange', done);
    });
  }

  function Link() {
    this.pc = null;
    this.ch = null;
    this.onMessage = null;
    this.onOpen = null;
    this.onClose = null;
    this.closed = false;
  }

  Link.supported = function () { return !!window.RTCPeerConnection; };

  Link.prototype._setup = function () {
    const self = this;
    this.pc = new RTCPeerConnection({ iceServers: ICE });
    this.pc.addEventListener('connectionstatechange', function () {
      const s = self.pc.connectionState;
      if ((s === 'failed' || s === 'disconnected' || s === 'closed') && !self.closed) {
        self.closed = true;
        if (self.onClose) self.onClose(s);
      }
    });
  };

  Link.prototype._bind = function (ch) {
    const self = this;
    this.ch = ch;
    ch.onopen = function () { if (self.onOpen) self.onOpen(); };
    ch.onclose = function () {
      if (!self.closed) { self.closed = true; if (self.onClose) self.onClose('closed'); }
    };
    ch.onmessage = function (e) {
      let msg;
      try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (self.onMessage) self.onMessage(msg);
    };
  };

  // Host: make the invite code.
  Link.prototype.host = async function () {
    this._setup();
    this._bind(this.pc.createDataChannel('game', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await waitIce(this.pc);
    return encode(this.pc.localDescription);
  };

  // Host: paste the friend's reply code.
  Link.prototype.accept = async function (replyCode) {
    const desc = await decode(replyCode);
    if (desc.type !== 'answer') throw new Error('That is an invite code. Paste the reply code your friend sent back.');
    await this.pc.setRemoteDescription(desc);
  };

  // Friend: take the invite, produce the reply code.
  Link.prototype.join = async function (inviteCode) {
    const desc = await decode(inviteCode);
    if (desc.type !== 'offer') throw new Error('That is a reply code. Paste the invite code from your friend.');
    this._setup();
    const self = this;
    this.pc.addEventListener('datachannel', function (e) { self._bind(e.channel); });
    await this.pc.setRemoteDescription(desc);
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await waitIce(this.pc);
    return encode(this.pc.localDescription);
  };

  Link.prototype.send = function (msg) {
    if (this.ch && this.ch.readyState === 'open') this.ch.send(JSON.stringify(msg));
  };

  Link.prototype.close = function () {
    this.closed = true;
    try { if (this.ch) this.ch.close(); } catch (e) { /* ignore */ }
    try { if (this.pc) this.pc.close(); } catch (e) { /* ignore */ }
  };

  window.ArtilleryNet = { Link: Link };
})();
