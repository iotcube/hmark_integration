import React, { useState, useEffect, useRef, useCallback } from "react";
import { Box, Button, Typography, IconButton, Tabs, Tab } from "@mui/material";
import MinimizeIcon from "@mui/icons-material/Remove";
import MaximizeIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CloseIcon from "@mui/icons-material/Close";
import JSZip from "jszip";
import io from "socket.io-client";
import ProgressBar from "./progress-bar/ProgressBar";

import hatbom_logo_crimson from "./assets/hatbom_logo_crimson.png";

const App = () => {
  const [hatbomMessage, setHatbomMessage] = useState("");
  const [vuddyMessage, setVuddyMessage] = useState("");
  const [savedPath, setSavedPath] = useState("");
  const [vuddySavedPath, setVuddySavedPath] = useState("");
  const [zipPath, setZipPath] = useState("");
  const [tab, setTab] = useState(0);
  const [logs, setLogs] = useState([]);
  const [vuddyLogs, setVuddyLogs] = useState([]);
  const [hatbomProgress, setHatbomProgress] = useState({
    current: 0,
    total: 0,
  });
  const [vuddyProgress, setVuddyProgress] = useState({ current: 0, total: 0 });
  const [dragActive, setDragActive] = useState(false);
  const [hatbomInProgress, setHatbomInProgress] = useState(false);
  const [vuddyInProgress, setVuddyInProgress] = useState(false);
  const [flaskPort, setFlaskPort] = useState(5000); // 기본값

  const socketRef = useRef(null);
  const logBoxRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, []);

  useEffect(scrollToBottom, [logs, vuddyLogs]);

  useEffect(() => {
    const port = window.electronAPI?.getFlaskPort?.() || 5000;
    setFlaskPort(port);

    const socket = io(`http://localhost:${port}`, {
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("hatbom_log", (msg) => setLogs((prev) => [...prev, msg]));
    socket.on("vuddy_log", (msg) => setVuddyLogs((prev) => [...prev, msg]));
    socket.on("hatbom_progress", setHatbomProgress);
    socket.on("vuddy_progress", setVuddyProgress);

    return () => {
      socket.disconnect();
    };
  }, []);

  const tabStyle = {
    textTransform: "none",
    minWidth: 120,
    fontWeight: "bold",
    padding: 0,
    bgcolor: "transparent",
    "&:hover": { bgcolor: "rgb(230, 230, 230)" },
    "&.Mui-selected": {
      bgcolor: "rgb(253, 224, 212)",
      color: "black",
    },
  };

  const runHashing = useCallback(
    (folderPath) => {
      setHatbomInProgress(true);
      setVuddyInProgress(true);

      const postToApi = async (endpoint) => {
        const res = await fetch(`http://localhost:${flaskPort}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderPath }),
        });
        return res.json();
      };

      const extractRepoName = (hidx) =>
        hidx?.split("\n")[0]?.trim()?.split(" ")[1] || "result";

      postToApi("hatbom_hash")
        .then(async (hatbomData) => {
          if (hatbomData.hidx) {
            setHatbomMessage(hatbomData.hidx);
            const name = extractRepoName(hatbomData.hidx);
            const saved = await window.electronAPI.saveFile(
              `hashmark_0_${name}.hidx`,
              hatbomData.hidx
            );
            setSavedPath(saved || "❌ 저장 실패");
          } else {
            setHatbomMessage("❌ hatbom 서버 오류");
          }
        })
        .catch((err) => {
          console.error("❌ hatbom 통신 에러:", err);
          setHatbomMessage("❌ 요청 실패");
        })
        .finally(() => {
          setHatbomInProgress(false);
        });

      postToApi("vuddy_hash")
        .then(async (vuddyData) => {
          if (vuddyData.hidx) {
            setVuddyMessage(vuddyData.hidx);
            const name = extractRepoName(vuddyData.hidx);
            const saved = await window.electronAPI.saveFile(
              `hashmark_4_${name}.hidx`,
              vuddyData.hidx
            );
            setVuddySavedPath(saved || "❌ 저장 실패");
          } else {
            setVuddyMessage("❌ vuddy 서버 오류");
          }
        })
        .catch((err) => {
          console.error("❌ vuddy 통신 에러:", err);
          setVuddyMessage("❌ 요청 실패");
        })
        .finally(() => {
          setVuddyInProgress(false);
        });
    },
    [flaskPort]
  );

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === "") {
      const folderPath = files[0].path;
      runHashing(folderPath);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleZipDownload = useCallback(async () => {
    if (!hatbomMessage || !vuddyMessage) return;
    const zip = new JSZip();
    const filename1 = savedPath.split(/[\\/]/).pop() || "hatbom.hidx";
    const filename2 = vuddySavedPath.split(/[\\/]/).pop() || "vuddy.hidx";
    zip.file(filename1, hatbomMessage);
    zip.file(filename2, vuddyMessage);
    const zipBuffer = await zip.generateAsync({ type: "uint8array" });
    const savedZipPath = await window.electronAPI.saveZipFile(
      "hmark_result.zip",
      zipBuffer
    );
    if (savedZipPath) setZipPath(savedZipPath);
  }, [hatbomMessage, vuddyMessage, savedPath, vuddySavedPath]);

  const currentLogs = tab === 0 ? logs : vuddyLogs;
  const currentSavedPath = tab === 0 ? savedPath : vuddySavedPath;
  const currentProgress = tab === 0 ? hatbomProgress : vuddyProgress;

  return (
    <Box
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      sx={{
        display: "flex",
        flexDirection: "column",
        width: 700,
        height: 900,
        mx: "auto",
        overflow: "hidden",
        bgcolor: "rgb(250, 245, 240)",
        fontFamily: "sans-serif",
      }}
    >
      {/* 헤더 */}
      <Box
        sx={{
          height: 32,
          px: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          WebkitAppRegion: "drag",
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", gap: 1, WebkitAppRegion: "no-drag" }}>
          <IconButton
            size="small"
            onClick={() => window.electronAPI.minimize()}
          >
            <MinimizeIcon fontSize="inherit" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => window.electronAPI.maximize()}
          >
            <MaximizeIcon fontSize="inherit" />
          </IconButton>
          <IconButton size="small" onClick={() => window.electronAPI.close()}>
            <CloseIcon fontSize="inherit" />
          </IconButton>
        </Box>
      </Box>

      {/* 타이틀 */}
      <Box
        sx={{
          flexShrink: 0,
          py: 0,
          textAlign: "center",
          backgroundColor: "rgb(247, 243, 236)",
          mb: 0,
        }}
      >
        <Box
          component="img"
          src={hatbom_logo_crimson}
          alt="HatBOM Logo"
          sx={{ width: 144, objectFit: "contain", aspectRatio: "1.24", mb: 0 }}
        />
      </Box>

      {/* 본문 */}
      <Box
        sx={{
          flex: 1,
          p: 3,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            border: "2px dashed #aaa",
            borderRadius: 2,
            textAlign: "center",
            p: 5,
            m: 0,
            bgcolor: dragActive ? "#fef3c7" : "white",
            color: "#333",
            fontSize: 16,
            transition: "background 0.2s",
            cursor: "pointer",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          📁 Drag & Drop your Source Code Folder here, or click to select folder
        </Box>
        <input
          type="file"
          ref={fileInputRef}
          webkitdirectory="true"
          style={{ display: "none" }}
          onChange={(e) => {
            const files = e.target.files;
            if (files.length > 0) {
              const folderPath = files[0].path.replace(/[\\/][^\\/]+$/, "");
              runHashing(folderPath);
              e.target.value = "";
            }
          }}
        />
        <Tabs
          value={tab}
          onChange={(e, newVal) => setTab(newVal)}
          slotProps={{
            indicator: {
              sx: {
                backgroundColor: "rgb(189, 76, 42)",
                height: 3,
                borderRadius: 2,
              },
            },
          }}
          sx={{
            mt: 1,
            borderBottom: "none",
            boxShadow: "none",
            outline: "none",
          }}
        >
          <Tab label="Hatbom 결과" sx={tabStyle} />
          <Tab label="Vuddy 결과" sx={tabStyle} />
        </Tabs>
        <ProgressBar
          current={currentProgress.current}
          total={currentProgress.total}
        />
        <Box
          ref={logBoxRef}
          sx={{
            height: "300px",
            mt: 1,
            p: 2,
            backgroundColor: "rgb(240, 240, 240)",
            borderRadius: 2,
            fontFamily: "monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            overflowY: "auto",
          }}
        >
          {currentLogs.join("\n")}
        </Box>
        <Typography sx={{ mt: 1, fontSize: 14, color: "#555" }}>
          📁 Save File Path: <br />
          <code>{currentSavedPath}</code>
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Button variant="outlined" onClick={handleZipDownload}>
            ZIP Download
          </Button>
          {zipPath && (
            <Typography sx={{ mt: 1, fontSize: 14, color: "#555" }}>
              🗜️ Saved ZIP Path: <br />
              <code>{zipPath}</code>
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default App;
