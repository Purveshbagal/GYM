@echo off
REM One-time install: runs first-run setup, then (optionally) registers
REM Start-Gym-Agent.bat to launch automatically when this Windows user
REM logs in, via a shortcut in the Startup folder. No admin rights and no
REM separate Node.js/runtime install needed - GymDeviceAgent.exe is
REM self-contained.

setlocal
set "AGENT_DIR=%~dp0"
set "EXE=%AGENT_DIR%GymDeviceAgent.exe"

if not exist "%EXE%" (
    echo GymDeviceAgent.exe not found in %AGENT_DIR%
    echo Build/copy the release folder here first ^(see agent\README.md^).
    pause
    exit /b 1
)

echo ====================================
echo       GYM DEVICE AGENT INSTALL
echo ====================================
echo.
"%EXE%" --setup
if errorlevel 1 (
    echo.
    echo Setup did not complete successfully. Not registering auto-start.
    pause
    exit /b 1
)

set /p AUTOSTART="Start this agent automatically when Windows logs in? (Y/N): "
if /i "%AUTOSTART%"=="Y" (
    powershell -NoProfile -Command ^
        "$ws = New-Object -ComObject WScript.Shell;" ^
        "$s = $ws.CreateShortcut([System.IO.Path]::Combine($env:APPDATA,'Microsoft\Windows\Start Menu\Programs\Startup\GymDeviceAgent.lnk'));" ^
        "$s.TargetPath = '%AGENT_DIR%Start-Gym-Agent.bat';" ^
        "$s.WorkingDirectory = '%AGENT_DIR%';" ^
        "$s.Save()"
    echo Registered to start on Windows login.
)

echo.
echo Starting agent now...
call "%AGENT_DIR%Start-Gym-Agent.bat"
