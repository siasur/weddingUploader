const nameInput = document.getElementById("name");
const fileInput = document.getElementById("file-input");
const dropzone = document.getElementById("dropzone");
const uploadBtn = document.getElementById("upload-btn");
const fileList = document.getElementById("file-list");
const resultDiv = document.getElementById("result");
const removeInvalidBtn = document.getElementById("remove-invalid-btn");

const allowedTypes = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"
];

let currentFiles = [];
let invalidFileIds = new Set();

// Cookie helpers
function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function getCookie(name) {
  return document.cookie.split('; ').reduce((r, c) => {
    const [key, v] = c.split('=');
    return key === name ? decodeURIComponent(v) : r;
  }, '');
}

// Prefill name from cookie
window.addEventListener("DOMContentLoaded", () => {
  const savedName = getCookie("uploaderName");
  if (savedName) nameInput.value = savedName;
  updateUploadBtnState();
});

function getFileId(file) {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

function updateUploadBtnState() {
  uploadBtn.disabled = invalidFileIds.size > 0 || currentFiles.length === 0;
}

// File validation and rendering
function validateFile(file) {
  const type = file.type;
  const sizeMB = file.size / (1024 * 1024);
  if (!allowedTypes.includes(type)) {
    return { error: "Not an image/video", valid: false };
  } else if (type.startsWith("image/") && sizeMB > 10) {
    return { error: "Image too large (max 10MB)", valid: false };
  } else if (type.startsWith("video/") && sizeMB > 200) {
    return { error: "Video too large (max 200MB)", valid: false };
  }
  return { error: null, valid: true };
}

function renderFileEntry(file, validation) {
  const li = document.createElement("li");
  li.className = "file-entry";
  li.dataset.fileId = getFileId(file);

  const thumb = document.createElement("div");
  thumb.className = "thumbnail";

  if (validation.valid) {
    const previewUrl = URL.createObjectURL(file);
    if (file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = previewUrl;
      thumb.appendChild(img);
    } else if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = previewUrl;
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.width = 60;
      video.height = 40;
      video.addEventListener("loadeddata", () => video.pause());
      thumb.appendChild(video);
    }
  } else {
    thumb.textContent = "🚫";
    thumb.title = "No preview";
  }

  const sizeMB = file.size / (1024 * 1024);
  const label = document.createElement("span");
  label.textContent = `${file.name} (${Math.round(sizeMB * 100) / 100} MB)`;

  const status = document.createElement("span");
  status.style.marginLeft = "1em";
  status.textContent = validation.error ? `❌ ${validation.error}` : "✅ OK";
  status.style.color = validation.error ? "red" : "green";

  const details = document.createElement("div");
  details.className = "file-info";
  details.appendChild(label);
  details.appendChild(status);

  // Add trashcan button
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.title = "Remove file";
  removeBtn.className = "remove-btn";
  removeBtn.style.marginLeft = "1em";
  removeBtn.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M7 4V2.5A1.5 1.5 0 0 1 8.5 1h7A1.5 1.5 0 0 1 17 2.5V4h4a1 1 0 1 1 0 2h-1.1l-1.1 14.1A2 2 0 0 1 16.8 22H7.2a2 2 0 0 1-1.99-1.9L4.1 6H3a1 1 0 1 1 0-2h4zm2 0h6V2.5a.5.5 0 0 0-.5-.5h-7a.5.5 0 0 0-.5.5V4zm7.8 2H6.2l1.09 14.1a1 1 0 0 0 .99.9h9.6a1 1 0 0 0 .99-.9L17.8 6z"/>
    </svg>
  `;
  removeBtn.onclick = () => {
    li.remove();
    const fileId = getFileId(file);
    currentFiles = currentFiles.filter(f => getFileId(f) !== fileId);
    invalidFileIds.delete(fileId);
    if (currentFiles.length === 0) fileInput.value = "";
    updateUploadBtnState();
  };

  li.appendChild(removeBtn);
  li.appendChild(thumb);
  li.appendChild(details);

  return li;
}

function updateFileList(files) {
  fileList.innerHTML = "";
  files.forEach(file => {
    const validation = validateFile(file);
    const li = renderFileEntry(file, validation);
    fileList.appendChild(li);
  });
}

// File display and merging
function displayFiles(files, additive = false) {
  let filesArr = Array.from(files);

  // Merge with currentFiles if additive, else replace
  let mergedFiles;
  if (additive) {
    const existingIds = new Set(currentFiles.map(getFileId));
    mergedFiles = currentFiles.concat(
      filesArr.filter(f => !existingIds.has(getFileId(f)))
    );
  } else {
    mergedFiles = filesArr;
  }

  currentFiles = [];
  invalidFileIds = new Set();

  mergedFiles.forEach(file => {
    const validation = validateFile(file);
    if (validation.valid) {
      currentFiles.push(file);
    } else {
      invalidFileIds.add(getFileId(file));
    }
  });

  updateFileList(mergedFiles);
  updateUploadBtnState();
}

// Events
fileInput.addEventListener("change", () => {
  displayFiles(fileInput.files, true); // additive
});

dropzone.addEventListener("dragover", e => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});

dropzone.addEventListener("drop", e => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  displayFiles(e.dataTransfer.files, true); // additive
});

removeInvalidBtn.addEventListener("click", () => {
  // Remove all invalid files from the DOM and from merged list
  if (invalidFileIds.size === 0) return;
  // Remove invalid entries from DOM
  invalidFileIds.forEach(fileId => {
    const li = fileList.querySelector(`li[data-file-id="${fileId}"]`);
    if (li) li.remove();
  });
  // Remove invalid files from currentFiles (shouldn't be present, but for safety)
  // Only keep valid files
  currentFiles = currentFiles.filter(f => !invalidFileIds.has(getFileId(f)));
  invalidFileIds.clear();
  updateUploadBtnState();
  // If no files left, clear file input
  if (currentFiles.length === 0) fileInput.value = "";
});

uploadBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) return alert("Please enter your name.");
  if (currentFiles.length === 0) return alert("Please select valid image/video files.");
  if (invalidFileIds.size > 0) return alert("Please remove all invalid files before uploading.");

  setCookie("uploaderName", name, 180);

  const formData = new FormData();
  formData.append("name", name);
  currentFiles.forEach(file => formData.append("files", file));

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  try {
    const response = await fetch("https://wedding-upload.azurewebsites.net/api/Upload", {
      method: "POST",
      body: formData
    });

    const result = await response.json();
    resultDiv.hidden = false;
    resultDiv.textContent = JSON.stringify(result, null, 2);
  } catch (err) {
    resultDiv.hidden = false;
    resultDiv.textContent = `Upload failed: ${err.message}`;
  } finally {
    updateUploadBtnState();
    uploadBtn.textContent = "Upload";
  }
});
