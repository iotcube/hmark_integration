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

def hashingFile(repoPath):
    possible_extensions = (".c", ".cc", ".cpp", ".py", ".java")
    fileCnt = 0
    lineCnt = 0
    resDict = {}

    for path, _, files in os.walk(repoPath):
        for file in files:
            if file.endswith(possible_extensions):
                filePath = os.path.join(path, file)
                ext = file.split('.')[-1]
                try:
                    fileHash = md5File(filePath, ext)
                    with open(filePath, 'rb') as f:
                        lineCnt += len(f.readlines())
                    fileCnt += 1
                    resDict.setdefault(fileHash, []).append(filePath.replace(repoPath, "", 1))
                except Exception as e:
                    print(f"Error hashing file {filePath}: {e}")

    return resDict, fileCnt, lineCnt

def indexing_file(resDict, title, filePath):
    with open(filePath, 'w') as fres:
        fres.write(title + '\n')
        for hashval, paths in resDict.items():
            fres.write(hashval + '\t' + '\t'.join(paths) + '\n')
        fres.flush()
        os.fsync(fres.fileno())

def hatbom_hasing_main(inputPath):
    warnings.filterwarnings("ignore", category=SyntaxWarning)
    inputPath = inputPath.replace("\\", "/")
    resDict, fileCnt, lineCnt = hashingFile(inputPath)
    repoName = os.path.basename(inputPath)

    if resDict:
        title = f"4.0.1 {repoName} {fileCnt} {lineCnt}"
        hidx_content = title + '\n'
        for hashval, paths in resDict.items():
            hidx_content += hashval + '\t' + '\t'.join(paths) + '\n'

        return hidx_content
    else:
        return  None
