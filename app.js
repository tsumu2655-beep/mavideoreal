const storagePrefix = "setlog-real";
const groupId = "tedxkeiou-2026";
const groupName = "TEDxKeioU 2026";

if (window.location.search) {
  history.replaceState(null, "", location.pathname);
}

const storageKey = `${storagePrefix}:${groupId}`;
const profileKey = `${storagePrefix}:profile`;

const state = {
  group: loadGroup(),
  profile: loadProfile(),
  stream: null,
  mediaRecorder: null,
  recordedChunks: [],
  mode: "photo",
  pendingMedia: null,
  pendingType: null,
};

const els = {
  groupTitle: document.querySelector("#groupTitle"),
  displayNameInput: document.querySelector("#displayNameInput"),
  inviteUrl: document.querySelector("#inviteUrl"),
  copyLinkButton: document.querySelector("#copyLinkButton"),
  copyLinkInlineButton: document.querySelector("#copyLinkInlineButton"),
  postCount: document.querySelector("#postCount"),
  memberCount: document.querySelector("#memberCount"),
  cameraPreview: document.querySelector("#cameraPreview"),
  capturePreview: document.querySelector("#capturePreview"),
  emptyCamera: document.querySelector("#emptyCamera"),
  photoModeButton: document.querySelector("#photoModeButton"),
  videoModeButton: document.querySelector("#videoModeButton"),
  startCameraButton: document.querySelector("#startCameraButton"),
  captureButton: document.querySelector("#captureButton"),
  fileInput: document.querySelector("#fileInput"),
  captionInput: document.querySelector("#captionInput"),
  composerStatus: document.querySelector("#composerStatus"),
  publishButton: document.querySelector("#publishButton"),
  clearSampleButton: document.querySelector("#clearSampleButton"),
  feed: document.querySelector("#feed"),
  postTemplate: document.querySelector("#postTemplate"),
};

function loadGroup() {
  const saved = readJson(storageKey);
  if (saved) return saved;

  return {
    id: groupId,
    name: groupName,
    createdAt: Date.now(),
    members: [],
    seeded: true,
    posts: [
      {
        id: crypto.randomUUID(),
        author: "Aoi",
        caption: "集合前の空気。こういう一瞬も残しておきたい。",
        type: "image",
        media: makeSampleSvg("#19766b", "#f3b94d", "18:42"),
        createdAt: Date.now() - 1000 * 60 * 54,
      },
      {
        id: crypto.randomUUID(),
        author: "Ren",
        caption: "動画も写真も、あとから見返せるアルバムとして積み上がります。",
        type: "image",
        media: makeSampleSvg("#db6b6b", "#17211d", "Now"),
        createdAt: Date.now() - 1000 * 60 * 22,
      },
    ],
  };
}

function loadProfile() {
  const saved = readJson(profileKey) || {};
  return {
    displayName: saved.displayName || "Guest",
  };
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveGroup() {
  localStorage.setItem(storageKey, JSON.stringify(state.group));
}

function saveProfile() {
  localStorage.setItem(profileKey, JSON.stringify(state.profile));
}

function makeSampleSvg(left, right, label) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${left}"/>
          <stop offset="1" stop-color="${right}"/>
        </linearGradient>
      </defs>
      <rect width="800" height="1000" fill="url(#g)"/>
      <circle cx="620" cy="210" r="95" fill="rgba(255,255,255,.22)"/>
      <rect x="90" y="610" width="620" height="220" rx="32" fill="rgba(255,255,255,.16)"/>
      <text x="110" y="190" fill="white" font-size="86" font-family="Arial, sans-serif" font-weight="700">${label}</text>
      <text x="110" y="720" fill="white" font-size="46" font-family="Arial, sans-serif">Setlog Real</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function render() {
  state.group.name = groupName;
  const invite = `${location.origin}${location.pathname}`;
  const memberNames = new Set([...state.group.members, state.profile.displayName].filter(Boolean));

  els.groupTitle.textContent = groupName;
  els.displayNameInput.value = state.profile.displayName;
  els.inviteUrl.textContent = invite;
  els.postCount.textContent = state.group.posts.length;
  els.memberCount.textContent = memberNames.size;

  els.feed.innerHTML = "";
  const posts = [...state.group.posts].sort((a, b) => b.createdAt - a.createdAt);

  if (!posts.length) {
    const empty = document.createElement("div");
    empty.className = "empty-feed";
    empty.textContent = "まだ投稿がありません。最初の写真を残しましょう。";
    els.feed.append(empty);
    return;
  }

  posts.forEach((post) => {
    const node = els.postTemplate.content.firstElementChild.cloneNode(true);
    const mediaBox = node.querySelector(".post-media");
    const author = node.querySelector(".post-author");
    const time = node.querySelector("time");
    const caption = node.querySelector(".post-caption");
    const media = document.createElement(post.type === "video" ? "video" : "img");

    if (post.type === "video") {
      media.controls = true;
      media.playsInline = true;
      media.preload = "metadata";
    } else {
      media.alt = post.caption || `${post.author}の投稿`;
    }

    media.src = post.media;
    mediaBox.append(media);
    author.textContent = post.author;
    time.textContent = formatTime(post.createdAt);
    time.dateTime = new Date(post.createdAt).toISOString();
    caption.textContent = post.caption || "キャプションなし";
    els.feed.append(node);
  });
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function setMode(mode) {
  state.mode = mode;
  els.photoModeButton.classList.toggle("is-active", mode === "photo");
  els.videoModeButton.classList.toggle("is-active", mode === "video");
  els.captureButton.textContent = mode === "video" ? "録画" : "撮る";
  setStatus(mode === "video" ? "動画モードです" : "写真モードです");
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("このブラウザではカメラが使えません");
    return;
  }

  try {
    stopStream();
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: state.mode === "video",
      video: { facingMode: "environment" },
    });
    els.cameraPreview.srcObject = state.stream;
    await els.cameraPreview.play();
    showLiveCamera();
    setStatus("カメラ準備OK");
  } catch {
    setStatus("カメラを開けませんでした");
  }
}

function stopStream() {
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
}

function showLiveCamera() {
  els.emptyCamera.style.display = "none";
  els.capturePreview.style.display = "none";
  els.cameraPreview.style.display = "block";
}

function showPendingImage(dataUrl) {
  els.capturePreview.src = dataUrl;
  els.capturePreview.style.display = "block";
  els.cameraPreview.style.display = "none";
  els.emptyCamera.style.display = "none";
}

function resetComposer() {
  state.pendingMedia = null;
  state.pendingType = null;
  els.captionInput.value = "";
  els.publishButton.disabled = true;
  els.capturePreview.removeAttribute("src");
  els.capturePreview.style.display = "none";
  if (state.stream) {
    showLiveCamera();
  } else {
    els.emptyCamera.style.display = "grid";
  }
}

async function handleCapture() {
  if (!state.stream) {
    await startCamera();
    if (!state.stream) return;
  }

  if (state.mode === "video") {
    toggleRecording();
    return;
  }

  const canvas = document.createElement("canvas");
  const video = els.cameraPreview;
  canvas.width = video.videoWidth || 960;
  canvas.height = video.videoHeight || 1200;
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  state.pendingMedia = canvas.toDataURL("image/jpeg", 0.88);
  state.pendingType = "image";
  els.publishButton.disabled = false;
  showPendingImage(state.pendingMedia);
  setStatus("写真を確認して投稿できます");
}

function toggleRecording() {
  if (state.mediaRecorder?.state === "recording") {
    state.mediaRecorder.stop();
    return;
  }

  state.recordedChunks = [];
  const recorder = new MediaRecorder(state.stream);
  state.mediaRecorder = recorder;
  recorder.ondataavailable = (event) => {
    if (event.data.size) state.recordedChunks.push(event.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(state.recordedChunks, { type: "video/webm" });
    const reader = new FileReader();
    reader.onload = () => {
      state.pendingMedia = reader.result;
      state.pendingType = "video";
      els.publishButton.disabled = false;
      setStatus("録画を確認して投稿できます");
      els.captureButton.textContent = "録画";
      els.captureButton.classList.remove("recording");
    };
    reader.readAsDataURL(blob);
  };
  recorder.start();
  els.captureButton.textContent = "停止";
  els.captureButton.classList.add("recording");
  setStatus("録画中");
}

function handleFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    state.pendingMedia = reader.result;
    state.pendingType = file.type.startsWith("video") ? "video" : "image";
    els.publishButton.disabled = false;
    if (state.pendingType === "image") {
      showPendingImage(state.pendingMedia);
    } else {
      els.emptyCamera.style.display = "grid";
      els.emptyCamera.textContent = "動画を読み込みました";
      els.capturePreview.style.display = "none";
      els.cameraPreview.style.display = "none";
    }
    setStatus("読み込みました");
  };
  reader.readAsDataURL(file);
}

function publish() {
  if (!state.pendingMedia) return;

  const author = state.profile.displayName.trim() || "Guest";
  const members = new Set([...state.group.members, author]);
  state.group.members = [...members];
  state.group.posts.push({
    id: crypto.randomUUID(),
    author,
    caption: els.captionInput.value.trim(),
    type: state.pendingType,
    media: state.pendingMedia,
    createdAt: Date.now(),
  });
  saveGroup();
  render();
  resetComposer();
  setStatus("投稿しました。これは自動では消えません。");
}

async function copyInvite() {
  const invite = `${location.origin}${location.pathname}`;
  try {
    await navigator.clipboard.writeText(invite);
    setStatus("招待リンクをコピーしました");
  } catch {
    setStatus("コピーできませんでした");
  }
}

function setStatus(text) {
  els.composerStatus.textContent = text;
}

els.displayNameInput.addEventListener("input", (event) => {
  state.profile.displayName = event.target.value.trim() || "Guest";
  saveProfile();
  render();
});

els.copyLinkButton.addEventListener("click", copyInvite);
els.copyLinkInlineButton.addEventListener("click", copyInvite);
els.photoModeButton.addEventListener("click", () => setMode("photo"));
els.videoModeButton.addEventListener("click", () => setMode("video"));
els.startCameraButton.addEventListener("click", startCamera);
els.captureButton.addEventListener("click", handleCapture);
els.fileInput.addEventListener("change", handleFile);
els.publishButton.addEventListener("click", publish);
els.clearSampleButton.addEventListener("click", () => {
  state.group.posts = state.group.posts.filter((post) => post.author !== "Aoi" && post.author !== "Ren");
  state.group.seeded = false;
  saveGroup();
  render();
});

saveGroup();
saveProfile();
render();
setStatus("カメラか読み込みから始められます");
