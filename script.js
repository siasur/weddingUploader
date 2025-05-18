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

let allFiles = [];
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
  uploadBtn.disabled = invalidFileIds.size > 0 || allFiles.length === 0;
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
    allFiles = allFiles.filter(f => getFileId(f) !== fileId);
    invalidFileIds.delete(fileId);
    if (allFiles.length === 0) fileInput.value = "";
    updateFileList(allFiles);
    updateUploadBtnState();
  };

  li.appendChild(removeBtn);
  li.appendChild(thumb);
  li.appendChild(details);

  return li;
}

function updateFileList(files) {
  // Build a map of current <li> elements by fileId
  const existingLis = {};
  Array.from(fileList.children).forEach(li => {
    if (li.dataset && li.dataset.fileId) {
      existingLis[li.dataset.fileId] = li;
    }
  });

  // Track fileIds to keep
  const fileIdsToKeep = new Set();

  files.forEach(file => {
    const fileId = getFileId(file);
    fileIdsToKeep.add(fileId);

    if (!existingLis[fileId]) {
      // New file, add entry
      const validation = validateFile(file);
      const li = renderFileEntry(file, validation);
      fileList.appendChild(li);
    }
    // else leave as is
  });

  // Remove <li> for files no longer present
  Array.from(fileList.children).forEach(li => {
    if (li.dataset && li.dataset.fileId && !fileIdsToKeep.has(li.dataset.fileId)) {
      fileList.removeChild(li);
    }
  });
}

// Add files to the list
function displayFiles(files) {
  let filesArr = Array.from(files);

  // Merge new files with existing, avoiding duplicates by fileId
  const existingIds = new Set(allFiles.map(getFileId));
  const newFiles = filesArr.filter(f => !existingIds.has(getFileId(f)));
  allFiles = allFiles.concat(newFiles);

  invalidFileIds = new Set();
  allFiles.forEach(file => {
    const validation = validateFile(file);
    if (!validation.valid) {
      invalidFileIds.add(getFileId(file));
    }
  });

  updateFileList(allFiles);
  updateUploadBtnState();
  fileInput.value = ""; // Clear file input after processing
}

// Hide file input visually (but keep accessible for click)
fileInput.style.display = "none";

// Open file selector when clicking dropzone
dropzone.addEventListener("click", () => {
  fileInput.click();
});

// Events
fileInput.addEventListener("change", () => {
  displayFiles(fileInput.files);
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
  displayFiles(e.dataTransfer.files);
});

removeInvalidBtn.addEventListener("click", () => {
  if (invalidFileIds.size === 0) return;
  // Remove invalid entries from DOM
  invalidFileIds.forEach(fileId => {
    const li = fileList.querySelector(`li[data-file-id="${fileId}"]`);
    if (li) li.remove();
  });
  // Only keep valid files
  allFiles = allFiles.filter(f => !invalidFileIds.has(getFileId(f)));
  invalidFileIds.clear();
  updateFileList(allFiles);
  updateUploadBtnState();
  if (allFiles.length === 0) fileInput.value = "";
});

uploadBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) return alert("Please enter your name.");
  if (allFiles.length === 0) return alert("Please select valid image/video files.");
  if (invalidFileIds.size > 0) return alert("Please remove all invalid files before uploading.");

  setCookie("uploaderName", name, 180);

  // Helper to update status for a file
  function setFileStatus(file, text, color) {
    const fileId = getFileId(file);
    const li = fileList.querySelector(`li[data-file-id="${fileId}"]`);
    if (li) {
      const status = li.querySelector('.file-info span:last-child');
      if (status) {
        status.textContent = text;
        status.style.color = color;
      }
    }
  }

  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading...";

  // Split files into bundles of 5
  const bundles = [];
  for (let i = 0; i < allFiles.length; i += 5) {
    bundles.push(allFiles.slice(i, i + 5));
  }

  let anyFatalError = false;
  let allResults = [];

  for (let bundleIdx = 0; bundleIdx < bundles.length; bundleIdx++) {
    const bundle = bundles[bundleIdx];
    const formData = new FormData();
    formData.append("name", name);
    bundle.forEach(file => formData.append("files", file));

    try {
      const response = await fetch("https://wedding-upload.azurewebsites.net/api/Upload", {
        method: "POST",
        body: formData
      });

      let result;
      let isFatalError = false;
      try {
        result = await response.json();
      } catch (e) {
        result = await response.text();
        isFatalError = true;
      }

      allResults.push(result);

      if (isFatalError || typeof result !== "object" || !result.successful) {
        // Fatal error, show as string
        anyFatalError = true;
        resultDiv.hidden = false;
        resultDiv.textContent = typeof result === "string" ? result : JSON.stringify(result, null, 2);
        // Mark all files in this bundle as failed
        bundle.forEach(file => setFileStatus(file, "Hochladen Fehlgeschlagen: Serverfehler", "red"));
        break; // Stop further uploads on fatal error
      } else {
        // Update each file's status in this bundle
        bundle.forEach(file => {
          if (result.successful && result.successful.includes(file.name)) {
            setFileStatus(file, "Erfolgreich hochgeladen", "green");
          } else if (result.failed && result.failed[file.name]) {
            setFileStatus(file, "Hochladen Fehlgeschlagen: " + result.failed[file.name], "red");
          } else {
            setFileStatus(file, "Hochladen Fehlgeschlagen: Unbekannter Fehler", "red");
          }
        });
        // Show last message/result for now
        resultDiv.hidden = false;
        resultDiv.textContent = result.message || JSON.stringify(result, null, 2);
      }
    } catch (err) {
      anyFatalError = true;
      resultDiv.hidden = false;
      resultDiv.textContent = `Upload failed: ${err.message}`;
      // Mark all files in this bundle as failed
      bundle.forEach(file => setFileStatus(file, "Hochladen Fehlgeschlagen: Netzwerkfehler", "red"));
      break; // Stop further uploads on network error
    }
  }

  uploadBtn.disabled = false;
  uploadBtn.textContent = "Upload";
}
);
