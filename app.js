const storagePrefix = "setlog-real";
const groupId = "tedxkeiou-2026";
const groupName = "TEDxKeioU 2026";
const mediaStoreName = "media";

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
  mode: "video",
  pendingMedia: null,
  pendingBlob: null,
  pendingPreviewUrl: null,
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
  videoPreview: document.querySelector("#videoPreview"),
  capturePreview: document.querySelector("#capturePreview"),
  emptyCamera: document.querySelector("#emptyCamera"),
  photoModeButton: document.querySelector("#photoModeButton"),
  videoModeButton: document.querySelector("#videoModeButton"),
  modeRail: document.querySelector("#modeRail"),
  startCameraButton: document.querySelector("#startCameraButton"),
  captureButton: document.querySelector("#captureButton"),
  zoomControl: document.querySelector("#zoomControl"),
  zoomInput: document.querySelector("#zoomInput"),
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
    displayName: saved.displayName ?? "Guest",
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

function mediaExtension(post) {
  if (post.media?.startsWith("data:image/svg+xml")) return "svg";
  if (post.media?.startsWith("data:image/png")) return "png";
  if (post.media?.startsWith("data:image/gif")) return "gif";
  if (post.media?.startsWith("data:image/jpeg")) return "jpg";
  const mime = post.mimeType || (post.type === "video" ? "video/webm" : "image/jpeg");
  if (mime.includes("png")) return "png";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("quicktime")) return "mov";
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("svg")) return "svg";
  return post.type === "video" ? "webm" : "jpg";
}

function makeSampleSvg(left, right, label) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${left}"/>
          <stop offset="1" stop-color="${right}"/>
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#g)"/>
      <circle cx="1320" cy="190" r="95" fill="rgba(255,255,255,.22)"/>
      <rect x="150" y="560" width="760" height="180" rx="32" fill="rgba(255,255,255,.16)"/>
      <text x="150" y="190" fill="white" font-size="94" font-family="Arial, sans-serif" font-weight="700">${label}</text>
      <text x="150" y="668" fill="white" font-size="50" font-family="Arial, sans-serif">Setlog Real</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function openMediaDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`${storagePrefix}:media`, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(mediaStoreName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putMedia(id, blob) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(mediaStoreName, "readwrite");
    transaction.objectStore(mediaStoreName).put(blob, id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

async function getMedia(id) {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(mediaStoreName).objectStore(mediaStoreName).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function render() {
  state.group.name = groupName;
  const invite = `${location.origin}${location.pathname}`;
  const currentName = state.profile.displayName.trim();
  const memberNames = new Set([...state.group.members, currentName].filter(Boolean));

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

  for (const post of posts) {
    const node = els.postTemplate.content.firstElementChild.cloneNode(true);
    const mediaBox = node.querySelector(".post-media");
    const author = node.querySelector(".post-author");
    const time = node.querySelector("time");
    const caption = node.querySelector(".post-caption");
    const saveButton = node.querySelector(".save-post-button");
    const media = document.createElement(post.type === "video" ? "video" : "img");

    if (post.type === "video") {
      media.controls = true;
      media.playsInline = true;
      media.preload = "metadata";
    } else {
      media.alt = post.caption || `${post.author}の投稿`;
    }

    if (post.mediaId) {
      const blob = await getMedia(post.mediaId);
      if (blob) {
        media.src = URL.createObjectURL(blob);
      }
    } else {
      media.src = post.media;
    }

    if (!media.src) {
      mediaBox.textContent = "メディアを読み込めませんでした";
      mediaBox.classList.add("missing-media");
    } else {
      mediaBox.append(media);
    }
    author.textContent = post.author;
    time.textContent = formatTime(post.createdAt);
    time.dateTime = new Date(post.createdAt).toISOString();
    caption.textContent = post.caption || "キャプションなし";
    saveButton.addEventListener("click", () => savePostMedia(post));
    els.feed.append(node);
  }
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
  const isRecording = state.mediaRecorder?.state === "recording";
  els.captureButton.textContent = mode === "video" ? (isRecording ? "録画終了" : "録画開始") : "シャッター";
  els.modeRail.textContent = mode === "video" ? "Video" : "Photo";
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
      video: {
        aspectRatio: { ideal: 16 / 9 },
        facingMode: "environment",
        height: { ideal: 1080 },
        width: { ideal: 1920 },
      },
    });
    els.cameraPreview.srcObject = state.stream;
    await els.cameraPreview.play();
    showLiveCamera();
    setupZoomControl();
    setStatus("カメラ準備OK");
  } catch {
    setStatus("カメラを開けませんでした");
  }
}

function stopStream() {
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  els.zoomControl.classList.remove("is-visible");
}

function showLiveCamera() {
  els.emptyCamera.style.display = "none";
  els.capturePreview.style.display = "none";
  els.videoPreview.style.display = "none";
  els.cameraPreview.style.display = "block";
}

function showPendingImage(dataUrl) {
  els.capturePreview.src = dataUrl;
  els.capturePreview.style.display = "block";
  els.videoPreview.style.display = "none";
  els.cameraPreview.style.display = "none";
  els.emptyCamera.style.display = "none";
}

function showPendingVideo(url) {
  els.videoPreview.src = url;
  els.videoPreview.style.display = "block";
  els.capturePreview.style.display = "none";
  els.cameraPreview.style.display = "none";
  els.emptyCamera.style.display = "none";
}

function setupZoomControl() {
  const track = state.stream?.getVideoTracks()[0];
  const capabilities = track?.getCapabilities?.();
  const settings = track?.getSettings?.();
  const zoom = capabilities?.zoom;

  if (!track || !zoom || typeof zoom.min !== "number" || typeof zoom.max !== "number" || zoom.max <= zoom.min) {
    els.zoomControl.classList.remove("is-visible");
    return;
  }

  els.zoomInput.min = zoom.min;
  els.zoomInput.max = zoom.max;
  els.zoomInput.step = zoom.step || 0.1;
  els.zoomInput.value = settings?.zoom || zoom.min;
  els.zoomControl.classList.add("is-visible");
}

async function applyZoom(value) {
  const track = state.stream?.getVideoTracks()[0];
  if (!track?.applyConstraints) return;

  try {
    await track.applyConstraints({ advanced: [{ zoom: Number(value) }] });
  } catch {
    setStatus("この端末ではズームを変更できません");
  }
}

function resetComposer() {
  state.pendingMedia = null;
  state.pendingBlob = null;
  state.pendingType = null;
  if (state.pendingPreviewUrl) {
    URL.revokeObjectURL(state.pendingPreviewUrl);
    state.pendingPreviewUrl = null;
  }
  els.captionInput.value = "";
  els.publishButton.disabled = true;
  els.capturePreview.removeAttribute("src");
  els.capturePreview.style.display = "none";
  els.videoPreview.removeAttribute("src");
  els.videoPreview.style.display = "none";
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

  const track = state.stream.getVideoTracks()[0];
  if ("ImageCapture" in window && track) {
    try {
      const imageCapture = new ImageCapture(track);
      const blob = await imageCapture.takePhoto();
      setPendingImageBlob(blob);
      return;
    } catch {
      // Fall back to the live video frame below when the browser cannot take a still photo.
    }
  }

  const canvas = document.createElement("canvas");
  const video = els.cameraPreview;
  const sourceWidth = video.videoWidth || 1920;
  const sourceHeight = video.videoHeight || 1080;
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus("写真を保存できませんでした");
      return;
    }
    setPendingImageBlob(blob);
  }, "image/jpeg", 0.95);
}

function setPendingImageBlob(blob) {
  state.pendingBlob = blob;
  state.pendingMedia = null;
  state.pendingType = "image";
  if (state.pendingPreviewUrl) URL.revokeObjectURL(state.pendingPreviewUrl);
  state.pendingPreviewUrl = URL.createObjectURL(blob);
  els.publishButton.disabled = false;
  showPendingImage(state.pendingPreviewUrl);
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
    state.pendingBlob = blob;
    state.pendingMedia = null;
    state.pendingType = "video";
    state.pendingPreviewUrl = URL.createObjectURL(blob);
    els.publishButton.disabled = false;
    showPendingVideo(state.pendingPreviewUrl);
    setStatus("録画を確認して投稿できます");
    els.captureButton.textContent = "録画開始";
    els.captureButton.classList.remove("recording");
  };
  recorder.start();
  els.captureButton.textContent = "録画終了";
  els.captureButton.classList.add("recording");
  setStatus("録画中");
}

async function savePostMedia(post) {
  let url = post.media;
  let revokeUrl = false;

  if (post.mediaId) {
    const blob = await getMedia(post.mediaId);
    if (!blob) {
      setStatus("保存するメディアを読み込めませんでした");
      return;
    }
    url = URL.createObjectURL(blob);
    revokeUrl = true;
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = `tedxkeiou-2026-${post.id}.${mediaExtension(post)}`;
  document.body.append(link);
  link.click();
  link.remove();
  if (revokeUrl) {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function handleFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (state.pendingPreviewUrl) URL.revokeObjectURL(state.pendingPreviewUrl);
  state.pendingBlob = file;
  state.pendingMedia = null;
  state.pendingType = file.type.startsWith("video") ? "video" : "image";
  state.pendingPreviewUrl = URL.createObjectURL(file);
  els.publishButton.disabled = false;
  if (state.pendingType === "video") {
    showPendingVideo(state.pendingPreviewUrl);
  } else {
    showPendingImage(state.pendingPreviewUrl);
  }
  setStatus("読み込みました。投稿できます。");
}

async function publish() {
  if (!state.pendingBlob && !state.pendingMedia) return;

  const author = state.profile.displayName.trim() || "Guest";
  const members = new Set([...state.group.members, author]);
  const post = {
    id: crypto.randomUUID(),
    author,
    caption: els.captionInput.value.trim(),
    type: state.pendingType,
    createdAt: Date.now(),
  };

  els.publishButton.disabled = true;
  setStatus("投稿を保存中です");

  try {
    if (state.pendingBlob) {
      post.mediaId = post.id;
      post.mimeType = state.pendingBlob.type;
      await putMedia(post.mediaId, state.pendingBlob);
    } else {
      post.media = state.pendingMedia;
    }

    state.group.members = [...members];
    state.group.posts.push(post);
    saveGroup();
    await render();
    resetComposer();
    setStatus("投稿しました。これは自動では消えません。");
  } catch (error) {
    console.error(error);
    els.publishButton.disabled = false;
    setStatus("保存できませんでした。短い動画か写真でもう一度試してください。");
  }
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
  state.profile.displayName = event.target.value;
  saveProfile();
  const memberNames = new Set([...state.group.members, state.profile.displayName.trim()].filter(Boolean));
  els.memberCount.textContent = memberNames.size || 1;
});

els.copyLinkButton.addEventListener("click", copyInvite);
els.copyLinkInlineButton.addEventListener("click", copyInvite);
els.photoModeButton.addEventListener("click", () => setMode("photo"));
els.videoModeButton.addEventListener("click", () => setMode("video"));
els.startCameraButton.addEventListener("click", startCamera);
els.captureButton.addEventListener("click", handleCapture);
els.zoomInput.addEventListener("input", (event) => applyZoom(event.target.value));
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
