@echo off
cd /d "%~dp0"
if "%~1"=="" (
    echo Usage: push "Your commit message"
    exit /b 1
)
git add .
git commit -m "%~1"
git push origin master
echo Done! Pushed to GitHub!