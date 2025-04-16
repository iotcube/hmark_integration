from flask import Flask, request, jsonify
from flask_socketio import SocketIO
from hatbom_hashing import hatbom_hasing_main
from vuddy_hashing import vuddy_hashing
import traceback

from flask_cors import CORS

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:5173"])
CORS(app, origins=["http://localhost:5173"])

@socketio.on("connect")
def handle_connect(auth):
    print("클라이언트 연결됨")

@socketio.on("disconnect")
def handle_disconnect():
    print("클라이언트 연결 끊김")

# 각각 전용 emit_log 함수 사용
def emit_hatbom_log(msg):
    print("[HATBOM]", msg)
    socketio.emit("hatbom_log", msg)

def emit_vuddy_log(msg):
    print("[VUDDY]", msg)
    socketio.emit("vuddy_log", msg)

@app.route("/hatbom_hash", methods=["POST"])
def hatbom_hash():
    try:
        data = request.get_json()
        folder_path = data.get("folderPath")

        emit_hatbom_log(f"Hatbom 해싱 시작: {folder_path}")

        def progress(current, total):
            socketio.emit("hatbom_progress", {"current": current, "total": total})

        result = hatbom_hasing_main(
            folder_path,
            logger=emit_hatbom_log,
            progress_callback=progress
        )

        return jsonify({"hidx": result})

    except Exception as e:
        error_msg = f"hatbom 처리 중 오류: {str(e)}"
        emit_hatbom_log(error_msg)
        return jsonify({"error": str(e)}), 500


@app.route("/vuddy_hash", methods=["POST"])
def vuddy_hash():
    try:
        data = request.get_json()
        folder_path = data.get("folderPath")

        emit_vuddy_log(f"Vuddy 해싱 시작: {folder_path}")

        def progress(current, total):
            socketio.emit("vuddy_progress", {"current": current, "total": total})

        result = vuddy_hashing(
            folder_path,
            logger=emit_vuddy_log,
            progress_callback=progress
        )

        return jsonify({"hidx": result})

    except Exception as e:
        emit_vuddy_log(f"vuddy 처리 중 오류: {str(e)}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)
