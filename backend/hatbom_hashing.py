import os
import re
import ast
import hashlib
import warnings

def md5File(fname, ext):
    with open(fname, "r", encoding="utf-8", errors="ignore") as f:
        fileContent = f.read()

        if ext == "py":
            try:
                parsed = ast.parse(fileContent)
                fileContent = normalize(removePyComment(parsed))
            except:
                fileContent = normalize(removeComment(fileContent, "python"))
        elif ext == 'java':
            fileContent = remove_go_imports(fileContent)
            fileContent = normalize(removeComment(fileContent, "c"))
        else:
            fileContent = normalize(removeComment(fileContent, "c"))

        hash = hashlib.md5(fileContent.encode("utf-8")).hexdigest()
    return hash

def remove_go_imports(file_content):
    pattern = re.compile(r'^\s*import\s*\(\s*[\s\S]*?\)\s*|^import\s*[\s\S]*?$', re.MULTILINE)
    file_content_without_imports = re.sub(pattern, '', file_content)
    pattern = re.compile(r'^\s*package\s*\(\s*[\s\S]*?\)\s*|^package\s*[\s\S]*?$', re.MULTILINE)
    file_content_without_imports = re.sub(pattern, '', file_content_without_imports)
    return file_content_without_imports

def removeComment(string, language):
    c_regex = re.compile(r'(?P<comment>//.*?$|[{}]+)|(?P<multilinecomment>/\*.*?\*/)|(?P<noncomment>\'(\\.|[^\\\'])*\'|"(\\.|[^\\"])*"|.[^/\'\"]*)', re.DOTALL | re.MULTILINE)
    pythonShortComRegex = re.compile(r'(?!.*"|.*\')[\r\t\f\v]*(#).*(?!.*"|.*\')')
    pythonLongComRegex = re.compile(r'(\"\"\").*?(\"\"\")', re.DOTALL)

    if language == "c":
        return ''.join([c.group('noncomment') for c in c_regex.finditer(string) if c.group('noncomment')])
    elif language == "python":
        string = pythonShortComRegex.sub("", string)
        return pythonLongComRegex.sub("", string)

def removeDocstring(node):
    if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef)):
        node.body = [item for item in node.body if not (isinstance(item, ast.Expr) and isinstance(item.value, ast.Constant) and isinstance(item.value.value, str))]

def removePyComment(tree):
    for node in ast.walk(tree):
        if isinstance(node, ast.Module):
            node.body = [item for item in node.body if not (isinstance(item, ast.Expr) and isinstance(item.value, ast.Constant) and isinstance(item.value.value, str))]
        else:
            removeDocstring(node)
    return ast.unparse(tree)

def normalize(string):
    return ''.join(string.replace('\n', '').replace('\r', '').replace('\t', '').replace('{', '').replace('}', '').split(' ')).lower()

def hashingFile(repoPath, logger=None, progress_callback=None):
    possible_extensions = (".c", ".cc", ".cpp", ".py", ".java")
    fileCnt = 0
    lineCnt = 0
    resDict = {}

    # 🔍 먼저 전체 대상 파일 리스트를 수집
    allTargetFiles = []
    for path, _, files in os.walk(repoPath):
        for file in files:
            if file.endswith(possible_extensions):
                allTargetFiles.append(os.path.join(path, file))

    totalFiles = len(allTargetFiles)

    for idx, filePath in enumerate(allTargetFiles):
        ext = filePath.split('.')[-1]
        try:
            if logger:
                logger(f"{filePath} 해싱 중...")

            fileHash = md5File(filePath, ext)

            with open(filePath, 'rb') as f:
                lineCnt += len(f.readlines())
            fileCnt += 1
            resDict.setdefault(fileHash, []).append(filePath.replace(repoPath, "", 1))

            if logger:
                logger(f"{filePath} → {fileHash}")

            # ✅ 진행률 콜백 호출
            if progress_callback:
                progress_callback(current=idx + 1, total=totalFiles)

        except Exception as e:
            msg = f" Error hashing file {filePath}: {e}"
            print(msg)
            if logger:
                logger(msg)

    return resDict, fileCnt, lineCnt


def indexing_file(resDict, title, filePath):
    with open(filePath, 'w') as fres:
        fres.write(title + '\n')
        for hashval, paths in resDict.items():
            fres.write(hashval + '\t' + '\t'.join(paths) + '\n')
        fres.flush()
        os.fsync(fres.fileno())

def hatbom_hasing_main(inputPath, logger=None, progress_callback=None):
    warnings.filterwarnings("ignore", category=SyntaxWarning)
    inputPath = inputPath.replace("\\", "/")

    resDict, fileCnt, lineCnt = hashingFile(inputPath, logger=logger, progress_callback=progress_callback)
    repoName = os.path.basename(inputPath)

    if resDict:
        title = f"4.0.1 {repoName} {fileCnt} {lineCnt}"
        if logger:
            logger(f"결과 요약: {title}")

        hidx_content = title + '\n'
        for hashval, paths in resDict.items():
            hidx_content += hashval + '\t' + '\t'.join(paths) + '\n'

        if logger:
            logger("해싱 완료. hidx 생성됨.")
        return hidx_content
    else:
        if logger:
            logger("해싱 결과 없음.")
        return None

