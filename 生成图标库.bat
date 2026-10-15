@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在将 Laya.png 和 Laya2.png 转换为免跨域安全编码...

powershell -Command "$b1 = [Convert]::ToBase64String([IO.File]::ReadAllBytes('Laya.png')); $b2 = [Convert]::ToBase64String([IO.File]::ReadAllBytes('Laya2.png')); $content = 'window.LOCAL_LOGOS = { \"Laya.png\": \"data:image/png;base64,' + $b1 + '\", \"Laya2.png\": \"data:image/png;base64,' + $b2 + '\" };'; [IO.File]::WriteAllText('logos.js', $content, [Text.Encoding]::UTF8)"

echo ✅ 已成功生成 logos.js！
pause
