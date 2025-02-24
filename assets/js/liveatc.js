function isMobile() {
    return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent);
}

document.addEventListener("DOMContentLoaded", async () => {
    const mobileMessage = document.getElementById("mobile-message");
    if (isMobile()) {
        mobileMessage.style.display = "block";
    }

    if (!window.FFmpeg || !window.FFmpeg.createFFmpeg) {
        console.error("FFmpeg library loading failed!");
        return;
    }

    const { createFFmpeg } = window.FFmpeg;
    const ffmpeg = createFFmpeg({
//        log: true,
        corePath: "https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.js",
        wasmPath: "https://unpkg.com/@ffmpeg/core@0.10.0/dist/ffmpeg-core.wasm"
    });

    await ffmpeg.load();

//    ffmpeg.setLogger(({ type, message }) => {
//        if (message.includes("start: 0.000000")) { // [fferr] Duration: 00:31:52.06, start: 0.000000, bitrate: 16 kb/s
//            const bitrateMatch = message.match(/bitrate:\s*(\d+)\s*kb\/s/);
//            if (bitrateMatch) {
//                originalBitrateInput.value = `${bitrateMatch[1]}k`;
//            }
//        }
//    });

    const dropArea = document.getElementById("drop-area");
    const fileInput = document.getElementById("file-input");
    const fileList = document.getElementById("file-list");
    const processButton = document.getElementById("process-button");
    const loadingIndicator = document.getElementById("loading-indicator");
    const downloadAllButton = document.getElementById("download-all-button");

    let filesArray = [];
    let isProcessing = false;

    dropArea.addEventListener("dragover", (event) => {
        event.preventDefault();
    });

    dropArea.addEventListener("dragleave", () => {
    });

    dropArea.addEventListener("drop", async (event) => {
        event.preventDefault();
        if (isProcessing) {
            alert("Processing is in progress");
            return;
        }
        const files = event.dataTransfer.files;
        addFiles(files);
    });

    fileInput.addEventListener("change", async (event) => {
        const files = event.target.files;
        addFiles(files);
    });

    function addFiles(files) {
        for (let file of files) {
            if (file.type === "audio/mpeg") {
                filesArray.push(file);
                const listItem = document.createElement("li");
                listItem.classList.add("file-item");

                const fileNameSpan = document.createElement("span");
                fileNameSpan.textContent = file.name;

                const progressBar = document.createElement("div");
                progressBar.classList.add("progress-bar");
                const progress = document.createElement("span");
                progressBar.appendChild(progress);

                listItem.appendChild(fileNameSpan);
                listItem.appendChild(progressBar);
                fileList.appendChild(listItem);
            }
        }
        if (filesArray.length > 0) {
            processButton.style.display = "inline-block";
        }
    }

    processButton.addEventListener("click", async () => {
        isProcessing = true;
        processButton.style.display = "none";
        mobileMessage.style.display = "none";
        document.getElementById("file-label").style.display = "none";
        loadingIndicator.style.display = "block";

        let processedFiles = [];

        for (let i = 0; i < filesArray.length; i++) {
            const file = filesArray[i];
            const listItem = fileList.children[i];
            const progress = listItem.querySelector(".progress-bar span");

            try {
                const fileName = file.name;
                const inputMp3 = fileName;
                const tempWav = `temp.wav`;
                const cleanedWav = `cleaned.wav`;
                const outputMp3 = fileName.replace(".mp3", "_cleaned.mp3");

                const fileData = new Uint8Array(await file.arrayBuffer());
                ffmpeg.FS('writeFile', inputMp3, fileData);

                progress.style.width = "25%";
                await ffmpeg.run("-i", inputMp3, "-acodec", "pcm_s16le", "-ar", "8000", "-ac", "1", tempWav);

                progress.style.width = "50%";
                await ffmpeg.run("-i", tempWav, "-af", "volume=2.0, silenceremove=start_periods=1:start_threshold=-40dB:start_silence=1.5:stop_threshold=-40dB:stop_silence=2:stop_periods=-1", cleanedWav);

                progress.style.width = "75%";
                await ffmpeg.run("-i", cleanedWav, "-codec:a", "libmp3lame", "-b:a", "32k", "-ar", "8000", "-ac", "1", outputMp3);

                progress.style.width = "100%";

                const processedData = ffmpeg.FS('readFile', outputMp3);
                const audioBlob = new Blob([processedData.buffer], { type: "audio/mpeg" });

                listItem.innerHTML = "";
                const cleanedFileName = document.createElement("span");
                cleanedFileName.textContent = outputMp3;
                listItem.appendChild(cleanedFileName);

                const downloadLink = document.createElement("a");
                downloadLink.href = URL.createObjectURL(audioBlob);
                downloadLink.download = outputMp3;
                downloadLink.textContent = "Download";
                downloadLink.classList.add("button");

                if (!isMobile()) {
                    listItem.appendChild(downloadLink);
                }

                processedFiles.push({ name: outputMp3, blob: audioBlob });
            } catch (error) {
                console.error("[YB ERR] Error while processing file:", error);
            }
        }

        loadingIndicator.style.display = "none";

        if (processedFiles.length > 0) {
            downloadAllButton.classList.remove("hidden");
            downloadAllButton.addEventListener("click", () => {
                processedFiles.forEach((file) => {
                    const downloadLink = document.createElement("a");
                    downloadLink.href = URL.createObjectURL(file.blob);
                    downloadLink.download = file.name;
                    downloadLink.click();
                });
            });
        }
        isProcessing = false;
    });
});
