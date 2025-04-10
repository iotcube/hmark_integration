from flask import Flask, request, jsonify
from hatbom_hashing import hatbom_hasing_main
from vuddy_hashing import vuddy_hashing
import traceback

app = Flask(__name__)

@app.route('/hatbom_hash', methods=['POST'])
def hatbom_hash():
    try:
        data = request.get_json()
        folder_path = data.get('folderPath')

        result = hatbom_hasing_main(folder_path)  

        return jsonify({"hidx": result})
    
    except Exception as e:
        print("오류 발생:", traceback.format_exc())
        return jsonify({'error': str(e)}), 500
    
@app.route('/vuddy_hash', methods=['POST'])
def vuddy_hash():
    try:
        data = request.get_json()
        folder_path = data.get('folderPath')

        result = vuddy_hashing(folder_path) 

        return jsonify({"hidx": result})
    
    except Exception as e:
        print("오류 발생:", traceback.format_exc())
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)
