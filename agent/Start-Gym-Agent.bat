@echo off
REM Starts the Gym Device Agent. If it has never been configured, runs
REM first-run setup instead. Double-click this file, or place a shortcut
REM to it in shell:startup for it to launch when Windows logs in.

setlocal
set "AGENT_DIR=%~dp0"
set "EXE=%AGENT_DIR%GymDeviceAgent.exe"
set "CONFIG=%PROGRAMDATA%\GymDeviceAgent\config.json"

if not exist "%EXE%" (
    echo GymDeviceAgent.exe not found in %AGENT_DIR%
    echo Copy the full release folder here first ^(see agent\README.md^).
    pause
    exit /b 1
)

if not exist "%CONFIG%" (
    echo No configuration found - starting first-run setup...
    echo.
    "%EXE%" --setup
    exit /b %ERRORLEVEL%
)

"%EXE%"
