import { useState } from "react";
import { Box, Button, Typography, IconButton } from "@mui/material";
import MinimizeIcon from "@mui/icons-material/Remove";
import MaximizeIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CloseIcon from "@mui/icons-material/Close";

function App() {
  const [message, setMessage] = useState("");
  const [savedPath, setSavedPath] = useState("");

  const handleClick = async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (!folderPath) return;

    const res = await fetch("http://localhost:5000/save-file-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderPath }),
    });

    const data = await res.json();

    if (data.hidx) {
      setMessage(data.hidx);

      // 🔍 첫 줄에서 repo 이름 추출
      const firstLine = data.hidx.split("\n")[0];
      const tokens = firstLine.trim().split(" ");
      const repoName = tokens[1] || "result"; // 두 번째 단어 (없으면 기본값 'result')

      const filename = `hashmark_0_${repoName}.hidx`;

      // 저장 요청
      const saved = await window.electronAPI.saveFile(filename, data.hidx);
      if (saved) {
        setSavedPath(saved);
      } else {
        setSavedPath("❌ 저장 실패");
      }
    } else {
      setMessage("❌ 서버 오류");
    }
  };

  return (
    <Box
      sx={{
        width: 800,
        height: "100vh",
        mx: "auto",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        bgcolor: "rgb(250, 245, 240)",
        fontFamily: "sans-serif",
      }}
    >
      {/* 헤더 */}
      <Box
        sx={{
          height: 32,
          bgcolor: "rgb(250, 245, 240)",
          color: "black",
          px: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          WebkitAppRegion: "drag",
        }}
      >
        <Typography variant="body2">📦 Hmark</Typography>
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

      {/* 본문 */}
      <Box sx={{ p: 3, flex: 1 }}>
        <Typography variant="h6" gutterBottom>
          📂 폴더 파일 목록 저장기
        </Typography>
        <Button variant="contained" onClick={handleClick}>
          폴더 선택
        </Button>

        <Box
          sx={{
            mt: 2,
            p: 2,
            backgroundColor: "#f0f0f0",
            borderRadius: 2,
            fontFamily: "monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            maxHeight: 300,
            minHeight: 300,
            overflowY: "auto",
          }}
        >
          {message}
        </Box>

        {savedPath && (
          <Typography sx={{ mt: 2, fontSize: 14, color: "#555" }}>
            📁 저장 위치: <br />
            <code>{savedPath}</code>
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default App;
