import os
import sys
import time
import platform
import subprocess
import json
from hashlib import md5
import parseutility2 as pu

localVersion = "4.0.1"
osName = platform.system().lower()

if osName == "windows":
    osName = "win"
elif osName == "darwin":
    osName = "osx"
else:
    osName = "linux"


def parseFiles_shallow(f):
    if f[1] == "c":
        return (f[0], pu.parse_c_shallow(f[0]), f[1])
    elif f[1] == "java":
        return (f[0], pu.parse_java_shallow(f[0]), f[1])
    elif f[1] == "python":
        return (f[0], pu.parse_python_shallow(f[0]), f[1])
    elif f[1] == "go":
        return (f[0], pu.parse_go_shallow(f[0]), f[1])
    elif f[1] == "javascript":
        return (f[0], pu.parse_js_shallow(f[0]), f[1])


def parseFiles_deep(f):
    if f[1] == "c":
        return (f[0], pu.parse_c_deep(f[0]), f[1])
    elif f[1] == "java":
        return (f[0], pu.parse_java_deep(f[0]), f[1])
    elif f[1] == "python":
        return (f[0], pu.parse_python_deep(f[0]), f[1])
    elif f[1] == "go":
        return (f[0], pu.parse_go_deep(f[0]), f[1])
    elif f[1] == "javascript":
        return (f[0], pu.parse_js_deep(f[0]), f[1])


def vuddy_hashing(directory, isAbstraction="on", logger=None, progress_callback=None):
    absLevel = 4 if isAbstraction.lower() == "on" else 0
    directory = os.path.normpath(directory)

    proj = os.path.basename(directory)
    if logger:
        logger(f"분석 시작: {proj} (추상화 level {absLevel})")

    timeIn = time.time()
    tupleList = pu.loadSource(directory)
    numFile = len(tupleList)
    numFunc = 0
    numLine = 0
    listOfHashJsons = []

    if numFile == 0:
        msg = "소스 파일을 찾을 수 없습니다."
        if logger: logger(msg)
        return msg

    func = parseFiles_deep if absLevel == 4 else parseFiles_shallow

    for idx, tup in enumerate(tupleList):

        if progress_callback:
            progress_callback(current=idx + 1, total=numFile)

        f, functionInstanceList, language = func(tup)
        if logger:
            logger(f"{f} → 함수 {len(functionInstanceList)}개 추출")

        numFunc += len(functionInstanceList)

        if len(functionInstanceList) > 0:
            numLine += functionInstanceList[0].parentNumLoc

        for funcInst in functionInstanceList:
            funcInst.removeListDup()
            _, absBody = pu.new_abstract(funcInst, absLevel, language)
            absBody = pu.normalize(absBody)
            funcLen = len(absBody)

            if funcLen > 50:
                hashValue = md5(absBody.encode('utf-8')).hexdigest()
                cutLength = len(str(funcInst.parentFile.split(str(proj) + "/")[0]) + str(proj) + "/")
                rel_path = str(funcInst.parentFile[cutLength:])
                listOfHashJsons.append({
                    "file": rel_path,
                    "function id": str(funcInst.funcId),
                    "function length": str(funcLen),
                    "hash value": hashValue
                })
                if logger:
                    logger(f"  {rel_path} / func {funcInst.funcId} → {hashValue}")
            else:
                numFunc -= 1
                if logger:
                    logger(f"  무시됨 (짧은 함수): {funcInst.funcId} ({funcLen} bytes)")

    global title_info
    title_info = f"{localVersion} {proj} {numFile} {numFunc} {numLine}\n"
    full_result = title_info + json.dumps(listOfHashJsons, indent=2)

    if logger:
        logger("해싱 완료")
        logger(title_info.strip())

    return full_result



# if __name__ == "__main__":
#     target_directory = "C:/Users/연구원/Downloads/feelpp-develop"  # 대상 폴더 설정 (변경 가능)
#     result_str = generate_hash_index(target_directory)
#     print(title_info)  # 프로세스 빌더가 읽을 수 있도록 출력