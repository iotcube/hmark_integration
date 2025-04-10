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


def generate_hash_index(directory, isAbstraction="on"):
    absLevel = 4 if isAbstraction.lower() == "on" else 0
    directory = os.path.normpath(directory)

    proj = os.path.basename(directory)

    timeIn = time.time()
    tupleList = pu.loadSource(directory)
    numFile = len(tupleList)
    numFunc = 0
    numLine = 0
    listOfHashJsons = []

    if numFile == 0:
        return "ERROR: No source files found"

    func = parseFiles_deep if absLevel == 4 else parseFiles_shallow

    for idx, tup in enumerate(tupleList):
        f, functionInstanceList, language = func(tup)
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
                cutLength = len(str(funcInst.parentFile.split(str(proj)+"/")[0]) + str(proj) + "/")
                rel_path = str(funcInst.parentFile[cutLength:])
                listOfHashJsons.append({
                    "file": rel_path,
                    "function id": str(funcInst.funcId),
                    "function length": str(funcLen),
                    "hash value": hashValue
                })
            else:
                numFunc -= 1

    global title_info
    title_info = f"{localVersion} {proj} {numFile} {numFunc} {numLine}\n"
    full_result = title_info + json.dumps(listOfHashJsons, indent=2)
    return full_result


# if __name__ == "__main__":
#     target_directory = "C:/Users/연구원/Downloads/feelpp-develop"  # 대상 폴더 설정 (변경 가능)
#     result_str = generate_hash_index(target_directory)
#     print(title_info)  # 프로세스 빌더가 읽을 수 있도록 출력