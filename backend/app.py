from flask import Flask, request, jsonify
from folder_processor import process_repository  # ✅ import
import traceback

app = Flask(__name__)

@app.route('/save-file-list', methods=['POST'])
def save_file_list():
    try:
        data = request.get_json()
        folder_path = data.get('folderPath')

        result = process_repository(folder_path)  # ✅ 외부 함수 호출
        print("저장경로 : ", result)

        return jsonify({"hidx": result})
    
    except Exception as e:
        print("오류 발생:", traceback.format_exc())
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)
