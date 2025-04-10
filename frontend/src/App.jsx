import { useState } from "react";
import { Box, Button, Typography, IconButton, Tabs, Tab } from "@mui/material";
import MinimizeIcon from "@mui/icons-material/Remove";
import MaximizeIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CloseIcon from "@mui/icons-material/Close";
import JSZip from "jszip";

function App() {
  const [message, setMessage] = useState("");
  const [savedPath, setSavedPath] = useState("");
  const [vuddyMessage, setVuddyMessage] = useState("");
  const [vuddySavedPath, setVuddySavedPath] = useState("");
  const [zipPath, setZipPath] = useState("");
  const [tab, setTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const handleClick = async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (!folderPath) return;

    const postToApi = async (endpoint) => {
      const res = await fetch(`http://localhost:5000/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath }),
      });
      return res.json();
    };

    try {
      const [hatbomData, vuddyData] = await Promise.all([
        postToApi("hatbom_hash"),
        postToApi("vuddy_hash"),
      ]);

      const extractRepoName = (hidx) => {
        const firstLine = hidx.split("\n")[0];
        const tokens = firstLine.trim().split(" ");
        return tokens[1] || "result";
      };

      let hatbomFileName = "",
        vuddyFileName = "";
      let hatbomSavedPath = "",
        vuddySavedPath = "";

      // hatbom
      if (hatbomData.hidx) {
        setMessage(hatbomData.hidx);
        const repoName = extractRepoName(hatbomData.hidx);
        hatbomFileName = `hashmark_0_${repoName}.hidx`;
        hatbomSavedPath = await window.electronAPI.saveFile(
          hatbomFileName,
          hatbomData.hidx
        );
        setSavedPath(hatbomSavedPath || "❌ 저장 실패");
      } else {
        setMessage("❌ hatbom 서버 오류");
      }

      // vuddy
      if (vuddyData.hidx) {
        setVuddyMessage(vuddyData.hidx);
        const repoName = extractRepoName(vuddyData.hidx);
        vuddyFileName = `hashmark_4_${repoName}.hidx`;
        vuddySavedPath = await window.electronAPI.saveFile(
          vuddyFileName,
          vuddyData.hidx
        );
        setVuddySavedPath(vuddySavedPath || "❌ 저장 실패");
      } else {
        setVuddyMessage("❌ vuddy 서버 오류");
      }

      // ✅ 둘 다 성공했을 때 zip 생성
      if (
        hatbomData.hidx &&
        vuddyData.hidx &&
        hatbomSavedPath &&
        vuddySavedPath
      ) {
        try {
          const zip = new JSZip();
          zip.file("test.hidx", hatbomData.hidx);
          zip.file(vuddyFileName, vuddyData.hidx);
          const zipBuffer = await zip.generateAsync({ type: "uint8array" });

          const zipSavePath = await window.electronAPI.saveZipFile(
            "hashmark_result.zip",
            zipBuffer
          );
          setZipPath(zipSavePath || "❌ zip 저장 실패");
        } catch (zipErr) {
          setZipPath(`❌ zip 생성 실패 ${zipErr}`);
        }
      }
    } catch (err) {
      console.error("❌ 통신 에러:", err);
      setMessage("❌ 요청 실패");
      setVuddyMessage("❌ 요청 실패");
    }
  };

  const handleZipDownload = async () => {
    if (!message || !vuddyMessage) return;

    const zip = new JSZip();
    const filename1 = savedPath.split(/[\\/]/).pop() || "hatbom.hidx";
    const filename2 = vuddySavedPath.split(/[\\/]/).pop() || "vuddy.hidx";

    zip.file(filename1, message);
    zip.file(filename2, vuddyMessage);

    const zipBuffer = await zip.generateAsync({ type: "uint8array" });

    const savedZipPath = await window.electronAPI.saveZipFile(
      "hashmark_result.zip",
      zipBuffer
    );
    if (savedZipPath) {
      setZipPath(savedZipPath);
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

        <Tabs
          value={tab}
          onChange={handleTabChange}
          TabIndicatorProps={{ style: { display: "none" } }}
          sx={{ mt: 3 }}
        >
          <Tab label="Hatbom 결과" sx={tabStyle} />
          <Tab label="Vuddy 결과" sx={tabStyle} />
        </Tabs>

        <Box
          sx={{
            mt: 1,
            p: 2,
            backgroundColor: "rgb(240, 240, 240)",
            borderRadius: 2,
            fontFamily: "monospace",
            fontSize: 13,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            height: 300,
            overflowY: "auto",
          }}
        >
          {tab === 0 ? message : vuddyMessage}
        </Box>

        <Typography sx={{ mt: 1, fontSize: 14, color: "#555" }}>
          📁 저장 위치: <br />
          <code>{tab === 0 ? savedPath : vuddySavedPath}</code>
        </Typography>

        {/* zip 다운로드 버튼 */}
        {message && vuddyMessage && (
          <Box sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={() => handleZipDownload()}>
              ZIP 다운로드
            </Button>
            {zipPath && (
              <Typography sx={{ mt: 1, fontSize: 14, color: "#555" }}>
                🗜️ 저장된 ZIP 경로: <br />
                <code>{zipPath}</code>캬ㅔ
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

const tabStyle = {
  textTransform: "none",
  minWidth: 120,
  fontWeight: 500,
  bgcolor: "transparent",
  "&:hover": {
    bgcolor: "rgb(230, 230, 230)",
  },
  "&.Mui-selected": {
    bgcolor: "transparent",
    color: "black",
  },
};

export default App;
