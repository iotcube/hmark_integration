import React, { useRef, useEffect, useState } from "react";

function ProgressBar({ current, total }) {
  const progressPercent =
    total > 0 ? Math.min((current / total) * 100, 100) : 0;

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={containerRef}
        style={{
          marginTop: "20px",
          position: "relative",
          width: "100%",
          height: "20px",
          backgroundColor: "#e5e7eb",
          borderRadius: "30px",
        }}
      >
        {/* 채워진 바 */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${progressPercent}%`,
            background: "linear-gradient(to right, #facc15, #f59e0b)",
            borderRadius: "30px",
          }}
        />

        {/* 깃발 아이콘 */}
        <div
          style={{
            position: "absolute",
            right: "8px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "32px",
            height: "32px",
          }}
        >
          <svg viewBox="0 0 64 64" fill="none" width="100%" height="100%">
            <path fill="#555" d="M10 2v60h4V2h-4z" />
            <path
              d="M14 6c8 6 16 0 24 6s16 0 24 6v24c-8-6-16 0-24-6s-16 0-24-6V6z"
              fill="#ff0000"
            />
          </svg>
        </div>

        {/* 진행률 텍스트 */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontWeight: "bold",
            fontSize: "16px",
          }}
        >
          {current} / {total}
        </div>
      </div>
    </div>
  );
}

export default ProgressBar;
